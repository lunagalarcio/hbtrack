/* ============================================================
   reminders.js - Recordatorio diario de hábitos
   Envía una notificación una vez al día a la hora elegida
   mientras la app está abierta.
   ============================================================ */

let reminderEnabled = false;
let reminderTime = '20:00';
let reminderLastSent = '';
let reminderCheckTimer = null;

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
