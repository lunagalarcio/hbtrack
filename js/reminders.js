/* ============================================================
   reminders.js - Recordatorio diario de hábitos
   Envía una notificación una vez al día a la hora elegida
   mientras la app está abierta.
   ============================================================ */

let reminderEnabled = false;
let reminderTime = '20:00';
let reminderLastSent = '';
let reminderCheckTimer = null;

/* Recordatorio de pendientes: hábitos sin marcar, tareas sin hacer
   e importantes del día, una vez al día a la hora elegida. */
let pendingEnabled = false;
let pendingTime = '19:00';
let pendingLastSent = '';
let pendingCheckTimer = null;

function reminderNotify() {
  if (!reminderEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const today = dateKey();
  if (reminderLastSent === today) return;
  const [h, m] = reminderTime.split(':').map(Number);
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (now < target) return;
  reminderLastSent = today;
  store.set('reminderLastSent', reminderLastSent);
  try {
    const n = new Notification('¿Ya hiciste tus hábitos hoy?', {
      body: 'Revisa tu progreso y mantén tu racha.',
      tag: 'hbtrack-reminder'
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 15000);
  } catch (e) { /* sin notificación */ }
}

function checkReminder() {
  reminderNotify();
}

/* Recoge lo pendiente del día: hábitos que tocan hoy sin marcar,
   tareas de hoy sin hacer e importantes anotados en el calendario. */
function pendingItems(todayKey) {
  const due = habits.filter((h) => habitIsDue(h, todayKey));
  const undoneHabits = due.filter((h) => !(habitChecks[h.id] && habitChecks[h.id][todayKey]));
  const undoneTasks = (weekTasks[todayKey] || []).filter((t) => !t.done);
  const notes = (calendarNotes[todayKey] || []).map((n) => n.text);
  return { undoneHabits, undoneTasks, notes };
}

function pendingNotify() {
  if (!pendingEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const today = dateKey();
  if (pendingLastSent === today) return;
  const [h, m] = pendingTime.split(':').map(Number);
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (now < target) return;

  const { undoneHabits, undoneTasks, notes } = pendingItems(today);
  const body = [];
  if (undoneHabits.length) body.push(`${undoneHabits.length} hábito${undoneHabits.length === 1 ? '' : 's'} por hacer`);
  if (undoneTasks.length) body.push(`${undoneTasks.length} tarea${undoneTasks.length === 1 ? '' : 's'} sin terminar`);
  if (notes.length) body.push(`${notes.length} importante${notes.length === 1 ? '' : 's'} en el día`);
  if (!body.length) return;

  pendingLastSent = today;
  store.set('pendingLastSent', pendingLastSent);
  try {
    const n = new Notification('Tienes pendientes de hoy', {
      body: body.join(' · '),
      tag: 'hbtrack-pending'
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 15000);
  } catch (e) { /* sin notificación */ }
}

function checkPending() {
  pendingNotify();
}

function initReminders() {
  reminderEnabled = store.get('reminderEnabled', false);
  reminderTime = store.get('reminderTime', '20:00');
  reminderLastSent = store.get('reminderLastSent', '');

  const toggle = $('#reminderToggle');
  if (toggle) toggle.checked = reminderEnabled;
  const time = $('#reminderTime');
  if (time) time.value = reminderTime;

  clearInterval(reminderCheckTimer);
  reminderCheckTimer = setInterval(checkReminder, 30000);
  reminderNotify();

  /* Recordatorio de pendientes */
  pendingEnabled = store.get('pendingEnabled', false);
  pendingTime = store.get('pendingTime', '19:00');
  pendingLastSent = store.get('pendingLastSent', '');

  const pToggle = $('#pendingToggle');
  if (pToggle) pToggle.checked = pendingEnabled;
  const pTime = $('#pendingTime');
  if (pTime) pTime.value = pendingTime;

  clearInterval(pendingCheckTimer);
  pendingCheckTimer = setInterval(checkPending, 30000);
  pendingNotify();
}

$('#reminderToggle').addEventListener('change', (e) => {
  const on = e.target.checked;
  const applyPermission = (p) => {
    if (p === 'granted') {
      reminderEnabled = true;
      store.set('reminderEnabled', true);
      toast('Recordatorio diario activado');
      reminderNotify();
    } else {
      reminderEnabled = false;
      e.target.checked = false;
      store.set('reminderEnabled', false);
      toast('Permiso de notificaciones denegado');
    }
  };

  if (!on) {
    reminderEnabled = false;
    store.set('reminderEnabled', false);
    return;
  }
  if (!('Notification' in window)) {
    toast('Tu navegador no soporta notificaciones');
    e.target.checked = false;
    return;
  }
  if (Notification.permission === 'default') {
    try {
      const req = Notification.requestPermission();
      if (req && typeof req.then === 'function') req.then(applyPermission);
      else req(applyPermission);
    } catch (err) {
      e.target.checked = false;
    }
  } else if (Notification.permission === 'granted') {
    reminderEnabled = true;
    store.set('reminderEnabled', true);
    reminderNotify();
  } else {
    reminderEnabled = false;
    e.target.checked = false;
    store.set('reminderEnabled', false);
    toast('Permiso denegado en el navegador');
  }
});

$('#reminderTime').addEventListener('change', (e) => {
  if (!e.target.value) return;
  reminderTime = e.target.value;
  store.set('reminderTime', reminderTime);
  toast(`Recordatorio a las ${reminderTime}`);
});

/* ---------- Recordatorio de pendientes ---------- */
$('#pendingToggle').addEventListener('change', (e) => {
  const on = e.target.checked;
  const applyPermission = (p) => {
    if (p === 'granted') {
      pendingEnabled = true;
      store.set('pendingEnabled', true);
      toast('Recordatorio de pendientes activado');
      pendingNotify();
    } else {
      pendingEnabled = false;
      e.target.checked = false;
      store.set('pendingEnabled', false);
      toast('Permiso de notificaciones denegado');
    }
  };

  if (!on) {
    pendingEnabled = false;
    store.set('pendingEnabled', false);
    return;
  }
  if (!('Notification' in window)) {
    toast('Tu navegador no soporta notificaciones');
    e.target.checked = false;
    return;
  }
  if (Notification.permission === 'default') {
    try {
      const req = Notification.requestPermission();
      if (req && typeof req.then === 'function') req.then(applyPermission);
      else req(applyPermission);
    } catch (err) {
      e.target.checked = false;
    }
  } else if (Notification.permission === 'granted') {
    pendingEnabled = true;
    store.set('pendingEnabled', true);
    pendingNotify();
  } else {
    pendingEnabled = false;
    e.target.checked = false;
    store.set('pendingEnabled', false);
    toast('Permiso denegado en el navegador');
  }
});

$('#pendingTime').addEventListener('change', (e) => {
  if (!e.target.value) return;
  pendingTime = e.target.value;
  store.set('pendingTime', pendingTime);
  toast(`Recordatorio de pendientes a las ${pendingTime}`);
});
