/* ============================================================
   sync.js - Persistencia local y sincronización con Supabase
   Los datos se guardan por usuario: clave "habits" pasa a ser
   "<userId>_habits". Si Supabase está conectado, se sincronizan
   en la nube (tabla user_data).

   Estrategia de sincronización (última escritura gana por clave):
   - Cada guardado local registra su timestamp (pfx('__meta__')).
   - syncPull compara el updated_at de la nube con el local:
     si la nube es más nueva, la copia a local; si el local es
     más nuevo (cambios sin subir), los empuja de vuelta a la nube.
   - La cola de pendientes (pfx('__pending__')) persiste en
     localStorage para no perder cambios hechos sin conexión, y se
     reintenta automáticamente.
   ============================================================ */

function pfx(key) {
  const uid = window.Session && window.Session.userId;
  return uid ? `${uid}_${key}` : key;
}

/* Estado de sincronización con la nube */
window.syncCache = {};
window.syncPending = {};
window.syncTimer = null;
window.syncReady = false;
window.syncFirstLogin = false;

function syncKeyPrefix() {
  return (window.Session && window.Session.userId) ? `${window.Session.userId}_` : '';
}

/* ---------- Metadatos de tiempo por clave (local) ---------- */
function readMeta() {
  try {
    return JSON.parse(localStorage.getItem(pfx('__meta__'))) || {};
  } catch (e) {
    return {};
  }
}

function writeMeta(meta) {
  try {
    localStorage.setItem(pfx('__meta__'), JSON.stringify(meta));
  } catch (e) { /* sin espacio */ }
}

function localTs(key) {
  return readMeta()[key] || 0;
}

function setLocalTs(key, ts) {
  const meta = readMeta();
  meta[key] = ts;
  writeMeta(meta);
}

/* ---------- Cola de pendientes persistente ---------- */
function readPending() {
  try {
    return JSON.parse(localStorage.getItem(pfx('__pending__'))) || {};
  } catch (e) {
    return {};
  }
}

function writePending() {
  try {
    localStorage.setItem(pfx('__pending__'), JSON.stringify(window.syncPending));
  } catch (e) { /* sin espacio */ }
}

function scheduleFlush(delay) {
  if (window.syncTimer) return;
  window.syncTimer = setTimeout(flushSync, delay);
}

/* Trae los datos del usuario desde Supabase y los mezcla con local */
async function syncPull() {
  const uid = window.Session && window.Session.userId;
  window.syncReady = false;
  if (!uid || !window.supabaseClient) return;
  try {
    const { data, error } = await window.supabaseClient.from('user_data').select('key, data, updated_at');
    if (error) throw error;
    const rows = data || [];
    window.syncFirstLogin = rows.length === 0;
    rows.forEach((r) => {
      window.syncCache[r.key] = r.data;
      const cloudTs = r.updated_at ? Date.parse(r.updated_at) : 0;
      const lts = localTs(r.key);
      if (cloudTs >= lts) {
        // La nube es igual o más nueva: se vuelca a local
        try {
          localStorage.setItem(uid + '_' + r.key, JSON.stringify(r.data));
        } catch (e) { /* sin espacio */ }
        setLocalTs(r.key, cloudTs || Date.now());
      } else {
        // El local es más nuevo (cambios sin sincronizar): se empujan a la nube
        try {
          const raw = localStorage.getItem(uid + '_' + r.key);
          if (raw !== null) {
            window.syncPending[r.key] = { v: JSON.parse(raw), ts: lts };
          }
        } catch (e) { /* ignorar */ }
      }
    });
    writePending();
    window.syncReady = true;
  } catch (e) {
    console.error('Error al traer datos de la nube:', e);
  }
}

/* Encola un guardado en la nube (con retraso para agrupar cambios) */
function syncPush(key, val, ts) {
  const uid = window.Session && window.Session.userId;
  if (!uid || !window.supabaseClient) return;
  window.syncPending[key] = { v: val, ts: ts || Date.now() };
  writePending();
  scheduleFlush(700);
}

async function flushSync() {
  window.syncTimer = null;
  const uid = window.Session && window.Session.userId;
  if (!uid || !window.supabaseClient) {
    // Sin conexión/credenciales: reintentar más tarde
    if (Object.keys(window.syncPending).length) scheduleFlush(15000);
    return;
  }
  const pending = window.syncPending;
  if (!Object.keys(pending).length) return;
  window.syncPending = {};
  const failed = {};

  for (const key of Object.keys(pending)) {
    const entry = pending[key];
    const ts = entry.ts || Date.now();
    try {
      await window.supabaseClient.from('user_data').upsert({
        user_id: uid,
        key,
        data: entry.v,
        updated_at: new Date(ts).toISOString()
      }, { onConflict: 'user_id,key' });
      setLocalTs(key, Math.max(localTs(key), ts));
    } catch (e) {
      console.error('Error al guardar en la nube:', key, e);
      failed[key] = entry;
    }
  }

  Object.keys(failed).forEach((k) => { window.syncPending[k] = failed[k]; });
  writePending();
  if (Object.keys(window.syncPending).length) scheduleFlush(15000);
}

/* Empuja todo el estado local a la nube (primer inicio de sesión) */
function syncPushAll() {
  const uid = window.Session && window.Session.userId;
  if (!uid || !window.supabaseClient || !window.syncReady) return;
  const keys = ['habits', 'habitChecks', 'weekTasks', 'studyLog', 'pomodoroDays',
    'habitTime', 'calendarMarks', 'calendarNotes', 'timerMode', 'workMin', 'breakMin', 'customMin',
    'recurringTasks', 'recurringDone', 'soundPref', 'timerNotif',
    'reminderEnabled', 'reminderTime', 'reminderLastSent', 'statsRange', 'accent', 'timetable', 'habitFilter', 'goals', 'theme'];
  keys.forEach((k) => {
    try {
      let raw = localStorage.getItem(syncKeyPrefix() + k);
      if (raw === null) {
        // Datos creados en modo invitado (claves sin prefijo de usuario):
        // se migran al prefijo del usuario para poder subirlos a la nube.
        const guest = localStorage.getItem(k);
        if (guest !== null) {
          raw = guest;
          localStorage.setItem(syncKeyPrefix() + k, guest);
        }
      }
      if (raw !== null) {
        window.syncPending[k] = { v: JSON.parse(raw), ts: localTs(k) || Date.now() };
      }
    } catch (e) { /* ignorar */ }
  });
  writePending();
  flushSync();
}

/* Recupera cambios pendientes guardados de una sesión anterior
   (p. ej. hechos sin conexión) y los vuelve a intentar. */
function resumePending() {
  const uid = window.Session && window.Session.userId;
  if (!uid || !window.supabaseClient) return;
  const saved = readPending();
  const fresh = {};
  Object.keys(saved).forEach((key) => {
    const entry = saved[key];
    // Solo reintenta si no existe un cambio local más nuevo
    if (entry && entry.ts >= localTs(key)) fresh[key] = entry;
  });
  window.syncPending = fresh;
  writePending();
  if (Object.keys(fresh).length) scheduleFlush(0);
}

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(pfx(key));
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, val) {
    localStorage.setItem(pfx(key), JSON.stringify(val));
    const ts = Date.now();
    setLocalTs(key, ts);
    syncPush(key, val, ts);
  }
};
