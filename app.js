/* ============================================================
   TrackMyHabits - app.js
   Hábitos, cronómetro (normal/pomodoro), tareas semanales y
   gráficos, todo guardado en localStorage.
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const HABIT_COLORS = [
  '#2f80ed', '#38bdf8', '#2563eb', '#0ea5e9', '#60a5fa', '#22d3ee', '#4cc2ff', '#3b82f6', '#7dd3fc', '#1d4ed8',
  '#8b5cf6', '#7c3aed', '#a78bfa', '#c084fc', '#d946ef', '#f0abfc', '#ec4899', '#f472b6', '#fb7185', '#e11d48',
  '#f43f5e', '#ef4444', '#f97316', '#fb923c', '#f59e0b', '#fbbf24', '#facc15', '#eab308', '#a3e635', '#84cc16',
  '#4ade80', '#22c55e', '#16a34a', '#10b981', '#2dd4bf', '#14b8a6', '#06b6d4', '#0d9488', '#34d399', '#4ade80',
  '#64748b', '#475569', '#334155', '#1e293b', '#78350f', '#831843', '#6d28d9', '#4f46e5', '#9333ea', '#a16207'
];

/* ---------- Persistencia ---------- */
/* Los datos se guardan por usuario: clave "habits" pasa a ser "<userId>_habits".
   Además, si Supabase está conectado, se sincronizan en la nube (tabla user_data). */
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

/* Trae los datos del usuario desde Supabase y los vuelca en localStorage */
async function syncPull() {
  const uid = window.Session && window.Session.userId;
  window.syncReady = false;
  if (!uid || !window.supabaseClient) return;
  try {
    const { data, error } = await window.supabaseClient.from('user_data').select('key, data');
    if (error) throw error;
    const rows = data || [];
    window.syncFirstLogin = rows.length === 0;
    rows.forEach((r) => {
      window.syncCache[r.key] = r.data;
      try {
        localStorage.setItem(uid + '_' + r.key, JSON.stringify(r.data));
      } catch (e) { /* sin espacio */ }
    });
    window.syncReady = true;
  } catch (e) {
    console.error('Error al traer datos de la nube:', e);
  }
}

/* Encola un guardado en la nube (con retraso para agrupar cambios) */
function syncPush(key, val) {
  const uid = window.Session && window.Session.userId;
  if (!uid || !window.supabaseClient) return;
  window.syncPending[key] = val;
  if (!window.syncTimer) {
    window.syncTimer = setTimeout(flushSync, 700);
  }
}

async function flushSync() {
  window.syncTimer = null;
  const uid = window.Session && window.Session.userId;
  if (!uid || !window.supabaseClient) return;
  const pending = window.syncPending;
  window.syncPending = {};
  const keys = Object.keys(pending);
  if (!keys.length) return;
  for (const key of keys) {
    try {
      await window.supabaseClient.from('user_data').upsert({
        user_id: uid,
        key,
        data: pending[key],
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,key' });
    } catch (e) {
      console.error('Error al guardar en la nube:', key, e);
    }
  }
}

/* Empuja todo el estado local a la nube (primer inicio de sesión) */
function syncPushAll() {
  const uid = window.Session && window.Session.userId;
  if (!uid || !window.supabaseClient || !window.syncReady) return;
  const keys = ['habits', 'habitChecks', 'weekTasks', 'studyLog', 'pomodoroDays',
    'habitTime', 'calendarMarks', 'calendarNotes', 'timerMode', 'workMin', 'breakMin', 'customMin',
    'recurringTasks', 'recurringDone', 'soundPref', 'timerNotif'];
  keys.forEach((k) => {
    try {
      const raw = localStorage.getItem(syncKeyPrefix() + k);
      if (raw !== null) window.syncPending[k] = JSON.parse(raw);
    } catch (e) { /* ignorar */ }
  });
  flushSync();
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
    syncPush(key, val);
  }
};

let habits = [];
let habitChecks = {};
let weekTasks = {};
let studyLog = [];
let pomodoroDays = {};
let habitTime = {};
let calendarMarks = {};
let calendarNotes = {};
let timerMode = 'normal';
let recurringTasks = [];
let recurringDone = {};
let soundPref = 'beep';
let notifEnabled = false;

function loadData() {
  habits = store.get('habits', []);
  habitChecks = store.get('habitChecks', {});
  weekTasks = store.get('weekTasks', {});
  studyLog = store.get('studyLog', []);
  pomodoroDays = store.get('pomodoroDays', {});
  habitTime = store.get('habitTime', {});
  calendarMarks = store.get('calendarMarks', {});
  calendarNotes = store.get('calendarNotes', {});
  recurringTasks = store.get('recurringTasks', []);
  recurringDone = store.get('recurringDone', {});
  soundPref = store.get('soundPref', 'beep');
  notifEnabled = store.get('timerNotif', false);
  timerMode = store.get('timerMode', 'normal');
  timer.workMin = store.get('workMin', 25);
  timer.breakMin = store.get('breakMin', 5);
  timer.customMin = store.get('customMin', 25);
}

function saveHabits() { store.set('habits', habits); }
function saveChecks() { store.set('habitChecks', habitChecks); }
function saveTasks() { store.set('weekTasks', weekTasks); }
function saveStudy() { store.set('studyLog', studyLog); }
function savePomodoro() { store.set('pomodoroDays', pomodoroDays); }
function saveHabitTime() { store.set('habitTime', habitTime); }
function saveCalendarMarks() { store.set('calendarMarks', calendarMarks); }
function saveCalendarNotes() { store.set('calendarNotes', calendarNotes); }
function saveRecurringTasks() { store.set('recurringTasks', recurringTasks); }
function saveRecurringDone() { store.set('recurringDone', recurringDone); }

/* ---------- Utilidades de fecha ---------- */
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shiftDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function startOfWeek(d) {
  const day = (d.getDay() + 6) % 7; // lunes = 0
  return shiftDays(d, -day);
}

function fmtShort(key) {
  const d = keyToDate(key);
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function todayIs(key) {
  return key === dateKey();
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function trackedMinutes(habitId, key = dateKey()) {
  return (habitTime[habitId] && habitTime[habitId][key]) || 0;
}

function formatDuration(min) {
  const total = Math.max(0, Math.round(min));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

/* ---------- Tema claro / oscuro ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('#themeToggle .theme-label').textContent = theme === 'dark' ? 'Oscuro' : 'Claro';
  store.set('theme', theme);
  if ($('#tab-stats').classList.contains('active')) renderStats();
}

function initTheme() {
  const saved = store.get('theme', null);
  applyTheme(saved === 'dark' ? 'dark' : 'light');
}

$('#themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

/* ---------- Avisos del cronómetro ---------- */
$('#soundSel').addEventListener('change', (e) => {
  soundPref = e.target.value;
  store.set('soundPref', soundPref);
  playSound(soundPref);
});

$('#notifToggle').addEventListener('change', (e) => {
  const on = e.target.checked;
  const applyPermission = (p) => {
    if (p === 'granted') {
      notifEnabled = true;
      store.set('timerNotif', true);
      toast('Notificaciones activadas');
    } else {
      notifEnabled = false;
      e.target.checked = false;
      store.set('timerNotif', false);
      toast('Permiso de notificaciones denegado');
    }
  };
  if (!on) {
    notifEnabled = false;
    store.set('timerNotif', false);
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
    } catch (e) {
      e.target.checked = false;
    }
  } else if (Notification.permission === 'granted') {
    notifEnabled = true;
    store.set('timerNotif', true);
  } else {
    notifEnabled = false;
    e.target.checked = false;
    toast('Permiso denegado en el navegador');
  }
});

/* ---------- Navegación por pestañas ---------- */
$$('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach((b) => b.classList.remove('active'));
    $$('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'stats') renderStats();
    if (btn.dataset.tab === 'timer') renderTimerUi();
    if (btn.dataset.tab === 'week') renderWeek();
    if (btn.dataset.tab === 'calendar') renderCalendar();
  });
});

/* ============================================================
   HÁBITOS
   ============================================================ */
function getStreak(habitId) {
  const checks = habitChecks[habitId] || {};
  let d = new Date();
  if (!checks[dateKey(d)]) d = shiftDays(d, -1);
  let streak = 0;
  while (checks[dateKey(d)]) {
    streak++;
    d = shiftDays(d, -1);
  }
  return streak;
}

function toggleCheck(habitId, key) {
  if (!habitChecks[habitId]) habitChecks[habitId] = {};
  habitChecks[habitId][key] = !habitChecks[habitId][key];
  if (!habitChecks[habitId][key]) delete habitChecks[habitId][key];
  saveChecks();
  renderHabits();
  if ($('#tab-stats').classList.contains('active')) renderStats();
}

function renderHabits() {
  const list = $('#habitList');
  const empty = $('#habitsEmpty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', habits.length > 0);

  habits.forEach((habit) => {
    const card = document.createElement('div');
    card.className = 'habit-card';

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftDays(new Date(), -i);
      const key = dateKey(d);
      const checked = !!(habitChecks[habit.id] && habitChecks[habit.id][key]);
      const chip = document.createElement('button');
      chip.className = 'day-chip' + (checked ? ' checked' : '') + (todayIs(key) ? ' today' : '');
      chip.textContent = DAY_LETTERS[d.getDay()];
      chip.title = fmtShort(key);
      chip.addEventListener('click', () => toggleCheck(habit.id, key));
      days.push(chip);
    }

    const streak = getStreak(habit.id);
    const streakEl = document.createElement('span');
    streakEl.className = 'habit-streak' + (streak === 0 ? ' off' : '');
    streakEl.textContent = streak > 0 ? `Racha: ${streak} día${streak === 1 ? '' : 's'}` : 'Sin racha';

    const info = document.createElement('div');
    info.className = 'habit-info';
    info.append(
      Object.assign(document.createElement('h3'), { textContent: habit.name }),
      streakEl
    );

    const daysWrap = document.createElement('div');
    daysWrap.className = 'habit-days';
    days.forEach((chip) => daysWrap.appendChild(chip));

    const actions = document.createElement('div');
    actions.className = 'habit-actions';

    const edit = document.createElement('button');
    edit.className = 'edit-btn';
    edit.textContent = 'Editar';
    edit.addEventListener('click', () => openHabitModal(habit.id));

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = 'Eliminar';
    del.addEventListener('click', () => {
      if (!confirm(`¿Eliminar el hábito "${habit.name}"?`)) return;
      habits = habits.filter((h) => h.id !== habit.id);
      delete habitChecks[habit.id];
      delete habitTime[habit.id];
      recurringTasks.filter((t) => t.habitId === habit.id).forEach((t) => delete recurringDone[t.id]);
      recurringTasks = recurringTasks.filter((t) => t.habitId !== habit.id);
      saveHabits();
      saveChecks();
      saveHabitTime();
      saveRecurringTasks();
      saveRecurringDone();
      buildHabitLinkOptions();
      if (timer.mode === 'normal') loadLinkedNormal();
      renderHabits();
      if ($('#tab-stats').classList.contains('active')) renderStats();
      toast('Hábito eliminado');
    });
    actions.append(edit, del);

    const color = document.createElement('span');
    color.className = 'habit-color';
    color.style.background = habit.color;

    card.append(color, info, daysWrap, actions);

    if (habit.targetMin > 0) {
      const todayMin = trackedMinutes(habit.id);
      const pct = Math.min(100, (todayMin / habit.targetMin) * 100);
      const prog = document.createElement('div');
      prog.className = 'habit-progress';
      const row = document.createElement('div');
      row.className = 'habit-progress-label';
      const left = Object.assign(document.createElement('span'), { textContent: formatDuration(todayMin) });
      const right = Object.assign(document.createElement('span'), { textContent: `Meta: ${formatDuration(habit.targetMin)}` });
      row.append(left, right);
      const bar = document.createElement('div');
      bar.className = 'habit-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'habit-progress-fill' + (pct >= 100 ? ' done' : '');
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      prog.append(row, bar);
      card.appendChild(prog);
    }

    list.appendChild(card);
  });
}

/* Modal añadir/editar hábito */
let selectedColor = HABIT_COLORS[0];
let editingHabitId = null;

function openHabitModal(habitId) {
  editingHabitId = habitId || null;
  const h = editingHabitId ? habits.find((x) => x.id === editingHabitId) : null;
  $('#habitModalTitle').textContent = editingHabitId ? 'Editar hábito' : 'Nuevo hábito';
  $('#saveHabit').textContent = editingHabitId ? 'Guardar cambios' : 'Guardar';
  $('#habitName').value = h ? h.name : '';
  $('#habitTargetMin').value = h && h.targetMin > 0 ? h.targetMin : '';
  selectedColor = h ? h.color : HABIT_COLORS[0];
  $('#habitModal').classList.remove('hidden');
  $('#habitName').focus();
  buildColorPicker();
}

function closeHabitModal() {
  $('#habitModal').classList.add('hidden');
}

function buildColorPicker() {
  const picker = $('#colorPicker');
  picker.innerHTML = '';
  HABIT_COLORS.forEach((c) => {
    const opt = document.createElement('button');
    opt.className = 'color-opt' + (c === selectedColor ? ' selected' : '');
    opt.style.background = c;
    opt.type = 'button';
    opt.addEventListener('click', () => {
      selectedColor = c;
      buildColorPicker();
    });
    picker.appendChild(opt);
  });
}

$('#addHabitBtn').addEventListener('click', () => openHabitModal());
$('#cancelHabit').addEventListener('click', closeHabitModal);
$('#habitModal').addEventListener('click', (e) => {
  if (e.target === $('#habitModal')) closeHabitModal();
});
$('#habitName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#saveHabit').click();
});

$('#saveHabit').addEventListener('click', () => {
  const name = $('#habitName').value.trim();
  if (!name) {
    toast('Escribe un nombre para el hábito');
    return;
  }
  const targetRaw = parseInt($('#habitTargetMin').value, 10);
  const targetMin = targetRaw > 0 ? targetRaw : 0;

  if (editingHabitId) {
    const h = habits.find((x) => x.id === editingHabitId);
    if (h) {
      h.name = name;
      h.color = selectedColor;
      h.targetMin = targetMin;
      saveHabits();
      buildHabitLinkOptions();
      if (timer.mode === 'normal') loadLinkedNormal();
      closeHabitModal();
      renderHabits();
      if ($('#tab-stats').classList.contains('active')) renderStats();
      if ($('#tab-week').classList.contains('active')) renderWeek();
      if ($('#tab-calendar').classList.contains('active')) renderCalendar();
      toast('Hábito actualizado');
    }
    return;
  }

  habits.push({ id: uid(), name, color: selectedColor, targetMin });
  saveHabits();
  buildHabitLinkOptions();
  closeHabitModal();
  renderHabits();
  toast('Hábito añadido');
});

/* ============================================================
   CRONÓMETRO (normal / pomodoro)
   ============================================================ */
const timer = {
  mode: 'normal',
  phase: 'study', // study | work | break
  remainingMs: 25 * 60000,
  totalMs: 25 * 60000,
  running: false,
  lastTick: 0,
  interval: null,
  workMin: 25,
  breakMin: 5,
  customMin: 25
};

function setMode(mode) {
  commitElapsed('study');
  timer.mode = mode;
  timerMode = mode;
  store.set('timerMode', mode);
  $('#modeNormal').classList.toggle('active', mode === 'normal');
  $('#modePomodoro').classList.toggle('active', mode === 'pomodoro');
  $('#normalConfig').classList.toggle('hidden', mode !== 'normal');
  $('#pomodoroConfig').classList.toggle('hidden', mode !== 'pomodoro');
  stopTimer();
  if (mode === 'normal') {
    timer.phase = 'study';
    if (linkedHabit()) {
      loadLinkedNormal();
      return;
    }
    timer.totalMs = timer.customMin * 60000;
  } else {
    timer.phase = 'work';
    timer.totalMs = timer.workMin * 60000;
  }
  timer.remainingMs = timer.totalMs;
  renderTimerUi();
}

function fmtClock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function phaseLabel() {
  if (timer.mode === 'normal') return 'Tiempo de estudio';
  return timer.phase === 'work' ? 'Enfocado' : 'Descanso';
}

function renderTimerUi() {
  $('#timerDisplay').textContent = fmtClock(timer.remainingMs);
  $('#timerPhase').textContent = phaseLabel();
  $('#startPauseBtn').textContent = timer.running ? 'Pausar' : 'Iniciar';

  const link = linkedHabit();
  $('#timerCycle').textContent = link
    ? (link.targetMin > 0
      ? `Vinculado: ${link.name} · Meta ${formatDuration(link.targetMin)}`
      : `Vinculado: ${link.name}`)
    : (timer.mode === 'pomodoro'
      ? `Pomodoro ${timer.phase === 'work' ? '· Trabajo' : '· Descanso'}`
      : '');
  $('#startPauseBtn').disabled = !timer.running && timer.remainingMs <= 0 && link && link.targetMin > 0;

  const pct = timer.totalMs > 0 ? (1 - timer.remainingMs / timer.totalMs) * 100 : 0;
  $('#timerRing').style.background = `conic-gradient(var(--primary) ${pct}%, var(--ring-track) ${pct}%)`;
  $('#timerRing').classList.toggle('running', timer.running);

  $('#todayPomodoros').textContent = pomodoroDays[dateKey()] || 0;
  $('#todayStudyMin').textContent = Math.round(studyMinToday());
}

function studyMinToday() {
  const today = dateKey();
  return studyLog
    .filter((s) => s.date === today && s.kind === 'study')
    .reduce((sum, s) => sum + s.minutes, 0);
}

function startTimer() {
  if (timer.remainingMs <= 0 && timer.mode === 'normal' && linkedHabit() && linkedHabit().targetMin > 0) {
    toast('La meta de hoy ya está cumplida');
    return;
  }
  if (timer.remainingMs <= 0) {
    timer.remainingMs = timer.totalMs;
  }
  timer.running = true;
  timer.lastTick = Date.now();
  timer.interval = setInterval(tick, 250);
  renderTimerUi();
}

function pauseTimer() {
  timer.running = false;
  clearInterval(timer.interval);
  timer.interval = null;
  renderTimerUi();
}

function stopTimer() {
  pauseTimer();
}

function tick() {
  if (!timer.running) return;
  const now = Date.now();
  timer.remainingMs -= now - timer.lastTick;
  timer.lastTick = now;
  if (timer.remainingMs <= 0) {
    timer.remainingMs = 0;
    completePhase();
  }
  renderTimerUi();
}

function playSound(kind) {
  if (!kind || kind === 'none') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const tone = (t, freq, dur = 0.42) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur - 0.02);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + dur);
    };
    if (kind === 'ding') {
      tone(0, 1568, 0.5);
    } else if (kind === 'chime') {
      tone(0, 659, 0.7);
      tone(0.3, 880, 0.9);
    } else { // beep
      tone(0, 880);
      tone(0.25, 880);
      tone(0.5, 1174);
    }
  } catch (e) { /* sin audio */ }
}

function playAlert() {
  playSound(soundPref);

  if (!notifEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  let title, body;
  if (timer.mode === 'normal') {
    title = 'Sesión de estudio completada';
    body = '¡Buen trabajo! Tiempo cumplido.';
  } else if (timer.phase === 'work') {
    title = 'Pomodoro completado';
    body = 'Descansa unos minutos.';
  } else {
    title = 'Descanso terminado';
    body = '¡A trabajar de nuevo!';
  }
  try {
    const n = new Notification(title, { body, tag: 'hbtrack-timer' });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 10000);
  } catch (e) { /* sin notificación */ }
}

function logStudy(minutes, kind) {
  studyLog.push({ date: dateKey(), minutes, kind, ts: Date.now() });
  if (studyLog.length > 600) studyLog = studyLog.slice(-600);
  saveStudy();
}

function linkedHabit() {
  const id = $('#linkHabit').value;
  return habits.find((h) => h.id === id) || null;
}

function buildHabitLinkOptions() {
  const sel = $('#linkHabit');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Sin vínculo';
  sel.appendChild(none);

  if (!habits.length) {
    const tip = document.createElement('option');
    tip.value = '';
    tip.disabled = true;
    tip.textContent = 'Crea hábitos primero';
    sel.appendChild(tip);
    sel.value = '';
    return;
  }
  habits.forEach((h) => {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = h.targetMin > 0 ? `${h.name} (${formatDuration(h.targetMin)})` : h.name;
    sel.appendChild(opt);
  });
  sel.value = habits.some((h) => h.id === prev) ? prev : '';
}

function loadLinkedNormal() {
  commitElapsed('study');
  const h = linkedHabit();
  stopTimer();
  timer.phase = 'study';
  if (!h) {
    timer.totalMs = timer.customMin * 60000;
    timer.remainingMs = timer.totalMs;
  } else {
    const targetMs = h.targetMin > 0 ? h.targetMin * 60000 : timer.customMin * 60000;
    const doneMs = h.targetMin > 0 ? trackedMinutes(h.id) * 60000 : 0;
    const rem = Math.max(targetMs - doneMs, 0);
    timer.totalMs = rem > 0 ? rem : targetMs;
    timer.remainingMs = rem;
    if (h.targetMin > 0) {
      if (rem <= 0) {
        toast('Ya cumpliste la meta de hoy para este hábito');
      } else {
        toast(`Meta ${formatDuration(h.targetMin)} · Faltan ${formatDuration(rem / 60000)}`);
      }
    } else {
      toast(`Vinculado a "${h.name}" · ${formatDuration(rem / 60000)}`);
    }
  }
  renderTimerUi();
}

function commitElapsed(kind = 'study') {
  const elapsedMs = timer.totalMs - timer.remainingMs;
  if (elapsedMs < 30000) return;
  const minutes = Math.round((elapsedMs / 60000) * 10) / 10;
  studyLog.push({ date: dateKey(), minutes, kind, ts: Date.now() });
  if (studyLog.length > 600) studyLog = studyLog.slice(-600);
  saveStudy();
  if (kind === 'study') {
    const habit = linkedHabit();
    if (habit) {
      if (!habitTime[habit.id]) habitTime[habit.id] = {};
      const today = dateKey();
      habitTime[habit.id][today] = (habitTime[habit.id][today] || 0) + minutes;
      saveHabitTime();
    }
  }
  renderHabits();
  renderTimerUi();
  if ($('#tab-stats').classList.contains('active')) renderStats();
}

const PRESETS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120];

function buildPresetChips() {
  const wrap = $('#presetChips');
  if (!wrap) return;
  wrap.innerHTML = '';
  PRESETS.forEach((m) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip' + (m === timer.customMin ? ' active' : '');
    chip.dataset.min = String(m);
    chip.textContent = formatDuration(m);
    chip.addEventListener('click', () => setNormalTime(m));
    wrap.appendChild(chip);
  });
}

function setNormalTime(totalMin, opts = {}) {
  if (!totalMin || totalMin < 1) {
    toast('Tiempo no válido');
    return;
  }
  totalMin = Math.round(totalMin);
  commitElapsed('study');
  stopTimer();
  if (linkedHabit()) $('#linkHabit').value = '';
  timer.customMin = totalMin;
  store.set('customMin', totalMin);
  $('#customH').value = Math.floor(totalMin / 60);
  $('#customMin').value = totalMin % 60;
  buildPresetChips();
  if (timer.mode === 'normal') {
    timer.phase = 'study';
    timer.totalMs = totalMin * 60000;
    timer.remainingMs = timer.totalMs;
    renderTimerUi();
  }
  if (!opts.silent) toast(`Tiempo configurado: ${formatDuration(totalMin)}`);
}

function completePhase() {
  playAlert();
  pauseTimer();

  if (timer.mode === 'normal') {
    commitElapsed('study');
    toast('¡Sesión de estudio completada!');
    timer.remainingMs = timer.totalMs;
    renderTimerUi();
    if ($('#tab-stats').classList.contains('active')) renderStats();
    return;
  }

  // Pomodoro
  if (timer.phase === 'work') {
    commitElapsed('study');
    const today = dateKey();
    pomodoroDays[today] = (pomodoroDays[today] || 0) + 1;
    savePomodoro();
    toast('¡Pomodoro completado! Toca descanso.');
    timer.phase = 'break';
    timer.totalMs = timer.breakMin * 60000;
  } else {
    commitElapsed('break');
    toast('Descanso terminado. ¡A trabajar!');
    timer.phase = 'work';
    timer.totalMs = timer.workMin * 60000;
  }
  timer.remainingMs = timer.totalMs;
  startTimer();
  renderTimerUi();
  if ($('#tab-stats').classList.contains('active')) renderStats();
}

function skipPhase() {
  commitElapsed('study');
  if (!timer.running && timer.mode !== 'pomodoro') {
    timer.remainingMs = timer.totalMs;
    renderTimerUi();
    return;
  }
  if (timer.mode === 'normal') {
    stopTimer();
    timer.remainingMs = timer.totalMs;
    renderTimerUi();
    return;
  }
  if (timer.phase === 'work') {
    timer.phase = 'break';
    timer.totalMs = timer.breakMin * 60000;
  } else {
    timer.phase = 'work';
    timer.totalMs = timer.workMin * 60000;
  }
  timer.remainingMs = timer.totalMs;
  startTimer();
  renderTimerUi();
}

$('#startPauseBtn').addEventListener('click', () => {
  if (timer.running) {
    pauseTimer();
    commitElapsed('study');
  } else {
    startTimer();
  }
});

$('#resetBtn').addEventListener('click', () => {
  commitElapsed('study');
  stopTimer();
  if (timer.mode === 'normal') {
    timer.phase = 'study';
    if (linkedHabit()) {
      loadLinkedNormal();
      return;
    }
    timer.totalMs = timer.customMin * 60000;
  } else {
    timer.phase = 'work';
    timer.totalMs = timer.workMin * 60000;
  }
  timer.remainingMs = timer.totalMs;
  renderTimerUi();
});

$('#skipBtn').addEventListener('click', skipPhase);

$('#modeNormal').addEventListener('click', () => setMode('normal'));
$('#modePomodoro').addEventListener('click', () => setMode('pomodoro'));

$('#applyNormal').addEventListener('click', () => {
  const h = parseInt($('#customH').value, 10) || 0;
  const m = parseInt($('#customMin').value, 10) || 0;
  const total = h * 60 + m;
  if (total < 1) return toast('Tiempo no válido');
  setNormalTime(total);
});

['#customH', '#customMin'].forEach((sel) => {
  $(sel).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#applyNormal').click();
  });
});

$('#linkHabit').addEventListener('change', () => {
  if (timer.mode === 'normal') loadLinkedNormal();
});

$('#applyPomodoro').addEventListener('click', () => {
  const w = parseInt($('#workMin').value, 10);
  const b = parseInt($('#breakMin').value, 10);
  if (!w || !b || w < 1 || b < 1) return toast('Valores no válidos');
  timer.workMin = w;
  timer.breakMin = b;
  store.set('workMin', w);
  store.set('breakMin', b);
  if (timer.mode === 'pomodoro' && !timer.running) {
    timer.phase = 'work';
    timer.totalMs = w * 60000;
    timer.remainingMs = timer.totalMs;
    renderTimerUi();
  }
  toast(`Pomodoro: ${w} min trabajo / ${b} min descanso`);
});

/* ============================================================
   SEMANA (tareas por día)
   ============================================================ */
let weekOffset = 0;

const TASK_TYPES = ['Tarea', 'Hábito', 'Hobbie', 'Compromiso'];
const TYPE_COLORS = {
  Tarea: '#2383e2',
  Hobbie: '#8b5cf6',
  Compromiso: '#f59e0b'
};

function taskColor(task) {
  if (task.type === 'Hábito' && task.habitId) {
    const h = habits.find((x) => x.id === task.habitId);
    if (h) return h.color;
  }
  return TYPE_COLORS[task.type] || TYPE_COLORS.Tarea;
}

function renderWeek() {
  const grid = $('#weekGrid');
  const weekStart = shiftDays(startOfWeek(new Date()), weekOffset * 7);
  const today = dateKey();

  $('#weekSel').value = String(weekNumber(weekStart));
  populateWeekOptions(weekStart.getFullYear(), weekStart.getMonth());
  $('#weekSel').value = String(weekNumber(weekStart));
  $('#weekMonthSel').value = String(weekStart.getMonth());
  $('#weekYearSel').value = String(weekStart.getFullYear());

  const from = weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const to = shiftDays(weekStart, 6).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  $('#weekLabel').textContent = `${from} - ${to}`;

  grid.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const d = shiftDays(weekStart, i);
    const key = dateKey(d);
    const tasks = [
      ...(weekTasks[key] || []),
      ...recurringTasks
        .filter((t) => t.weekday === d.getDay())
        .map((t) => ({ ...t, repeat: true, done: !!(recurringDone[t.id] && recurringDone[t.id][key]) }))
    ];

    const col = document.createElement('div');
    col.className = 'day-col' + (todayIs(key) ? ' today-col' : '');

    const h4 = Object.assign(document.createElement('h4'), { textContent: DAY_NAMES[d.getDay()] });
    const dateNum = Object.assign(document.createElement('span'), {
      className: 'date-num',
      textContent: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    });

    // Fechas importantes del calendario mostradas en la semana
    const importantWrap = document.createElement('div');
    importantWrap.className = 'day-important';
    if (calendarMarks[key]) {
      const b = document.createElement('span');
      b.className = 'cal-important-badge';
      b.textContent = 'Importante';
      importantWrap.appendChild(b);
    }
    const notes = calendarNotes[key] || [];
    notes.slice(0, 3).forEach((n) => {
      const item = document.createElement('div');
      item.className = 'day-important-note';
      item.textContent = n.text;
      item.title = n.text;
      importantWrap.appendChild(item);
    });
    if (notes.length > 3) {
      const more = document.createElement('span');
      more.className = 'cal-important-more';
      more.textContent = `+${notes.length - 3} más`;
      importantWrap.appendChild(more);
    }

    const ul = document.createElement('ul');
    ul.className = 'task-list';

    tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.done ? ' done' : '');
      li.style.setProperty('--task-color', taskColor(task));

      const dot = document.createElement('span');
      dot.className = 'task-dot';
      dot.style.background = taskColor(task);
      dot.title = task.type || 'Tarea';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'task-check';
      chk.checked = !!task.done;
      chk.addEventListener('change', () => {
        if (task.repeat) {
          if (!recurringDone[task.id]) recurringDone[task.id] = {};
          recurringDone[task.id][key] = chk.checked;
          if (!recurringDone[task.id][key]) delete recurringDone[task.id][key];
          if (Object.keys(recurringDone[task.id]).length === 0) delete recurringDone[task.id];
          saveRecurringDone();
        } else {
          task.done = chk.checked;
          saveTasks();
        }
        if (task.type === 'Hábito' && task.habitId) {
          if (chk.checked) {
            if (!habitChecks[task.habitId]) habitChecks[task.habitId] = {};
            habitChecks[task.habitId][key] = true;
          } else if (habitChecks[task.habitId]) {
            delete habitChecks[task.habitId][key];
          }
          saveChecks();
          if ($('#tab-habits').classList.contains('active')) renderHabits();
        }
        renderWeek();
      });

      const span = Object.assign(document.createElement('span'), {
        className: 'task-text',
        textContent: task.text
      });

      li.append(dot, chk, span);

      if (task.repeat) {
        const rep = document.createElement('span');
        rep.className = 'task-repeat-icon';
        rep.textContent = '↻';
        rep.title = 'Se repite cada semana';
        li.appendChild(rep);
      }

      const del = document.createElement('button');
      del.className = 'task-del';
      del.textContent = 'x';
      del.title = 'Eliminar';
      del.addEventListener('click', () => {
        if (task.repeat) {
          if (!confirm(`¿Eliminar la tarea recurrente "${task.text}" de todas las semanas?`)) return;
          recurringTasks = recurringTasks.filter((t) => t.id !== task.id);
          delete recurringDone[task.id];
          saveRecurringTasks();
          saveRecurringDone();
        } else {
          weekTasks[key] = (weekTasks[key] || []).filter((t) => t.id !== task.id);
          if (weekTasks[key].length === 0) delete weekTasks[key];
          saveTasks();
        }
        renderWeek();
      });

      li.append(del);
      ul.appendChild(li);
    });

    // Formulario para añadir por tipo
    const addForm = document.createElement('div');
    addForm.className = 'task-add';

    const typeSel = document.createElement('select');
    typeSel.className = 'task-type';
    TASK_TYPES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      typeSel.appendChild(opt);
    });

    const addRow = document.createElement('div');
    addRow.className = 'task-add-row';

    const input = Object.assign(document.createElement('input'), {
      placeholder: 'Escribe...',
      maxLength: 60
    });

    const habitSel = document.createElement('select');
    habitSel.className = 'task-habit hidden';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Elegir hábito…';
    habitSel.appendChild(ph);
    habits.forEach((h) => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.name;
      habitSel.appendChild(opt);
    });

    const repeatWrap = document.createElement('label');
    repeatWrap.className = 'task-repeat';
    repeatWrap.title = 'Se repite todos los ' + DAY_NAMES[d.getDay()];
    const repeatChk = document.createElement('input');
    repeatChk.type = 'checkbox';
    const repeatSpan = Object.assign(document.createElement('span'), { textContent: 'Repite' });
    repeatWrap.append(repeatChk, repeatSpan);

    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.title = 'Añadir';

    const toggleInputs = () => {
      const isHabit = typeSel.value === 'Hábito';
      input.classList.toggle('hidden', isHabit);
      habitSel.classList.toggle('hidden', !isHabit);
    };
    typeSel.addEventListener('change', toggleInputs);

    const addTask = () => {
      const type = typeSel.value;
      let text = '';
      let habitId = null;
      if (type === 'Hábito') {
        habitId = habitSel.value;
        const h = habits.find((x) => x.id === habitId);
        if (!h) {
          toast('Selecciona un hábito');
          return;
        }
        text = h.name;
      } else {
        text = input.value.trim();
        if (!text) {
          toast('Escribe el nombre');
          return;
        }
      }
      if (repeatChk.checked) {
        recurringTasks.push({ id: uid(), type, text, habitId, weekday: d.getDay() });
        saveRecurringTasks();
        toast('Tarea recurrente creada');
      } else {
        if (!weekTasks[key]) weekTasks[key] = [];
        weekTasks[key].push({
          id: uid(),
          type,
          text,
          habitId,
          done: habitId ? !!(habitChecks[habitId] && habitChecks[habitId][key]) : false
        });
        saveTasks();
      }
      renderWeek();
    };
    addBtn.addEventListener('click', addTask);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTask();
    });
    habitSel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTask();
    });

    addRow.append(input, habitSel, repeatWrap, addBtn);
    addForm.append(typeSel, addRow);
    col.append(h4, dateNum, importantWrap, ul, addForm);
    grid.appendChild(col);
  }
}

$('#prevWeek').addEventListener('click', () => { weekOffset--; renderWeek(); });
$('#nextWeek').addEventListener('click', () => { weekOffset++; renderWeek(); });

/* ---------- Navegación por semana / mes / año ---------- */
function firstWeekStart(y, m) {
  return startOfWeek(new Date(y, m, 1));
}

function weekNumber(weekStart) {
  const fws = firstWeekStart(weekStart.getFullYear(), weekStart.getMonth());
  return Math.round((weekStart - fws) / (7 * 86400000)) + 1;
}

function goToWeek(y, m, n) {
  const target = shiftDays(firstWeekStart(y, m), (n - 1) * 7);
  weekOffset = Math.round((target - startOfWeek(new Date())) / (7 * 86400000));
  renderWeek();
}

function buildWeekSelects() {
  const wSel = $('#weekSel');
  if (!wSel || wSel.options.length) return;
  wSel.addEventListener('change', () => {
    goToWeek(parseInt($('#weekYearSel').value, 10), parseInt($('#weekMonthSel').value, 10), parseInt(wSel.value, 10));
  });

  const mSel = $('#weekMonthSel');
  MONTH_NAMES.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = name;
    mSel.appendChild(opt);
  });
  mSel.addEventListener('change', () => {
    goToWeek(parseInt($('#weekYearSel').value, 10), parseInt(mSel.value, 10), 1);
  });

  const ySel = $('#weekYearSel');
  const cy = new Date().getFullYear();
  for (let y = cy - 6; y <= cy + 6; y++) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    ySel.appendChild(opt);
  }
  ySel.addEventListener('change', () => {
    goToWeek(parseInt(ySel.value, 10), parseInt($('#weekMonthSel').value, 10), 1);
  });
}

/* Muestra cada semana como su rango de fechas: "agosto 3 - agosto 9" */
function populateWeekOptions(y, m) {
  const wSel = $('#weekSel');
  const current = wSel.value;
  wSel.innerHTML = '';
  const fws = firstWeekStart(y, m);
  for (let n = 1; n <= 6; n++) {
    const start = shiftDays(fws, (n - 1) * 7);
    const end = shiftDays(start, 6);
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = `${start.toLocaleDateString('es-ES', { month: 'long' })} ${start.getDate()} - ${end.toLocaleDateString('es-ES', { month: 'long' })} ${end.getDate()}`;
    wSel.appendChild(opt);
  }
  wSel.value = current;
}

/* ============================================================
   CALENDARIO
   ============================================================ */
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

let calY = new Date().getFullYear();
let calM = new Date().getMonth();

function weekActivity(key) {
  const tasks = weekTasks[key] || [];
  const doneTasks = tasks.filter((t) => t.done).length;
  const doneHabits = habits.filter((h) => habitChecks[h.id] && habitChecks[h.id][key]).length;
  return { doneTasks, doneHabits };
}

function renderCalendar() {
  const grid = $('#calendarGrid');
  const today = dateKey();

  $('#calMonth').value = String(calM);
  $('#calYear').value = String(calY);

  grid.innerHTML = '';

  const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  weekdays.forEach((wd) => {
    const hd = document.createElement('div');
    hd.className = 'cal-weekday';
    hd.textContent = wd;
    grid.appendChild(hd);
  });

  const first = new Date(calY, calM, 1);
  const offset = (first.getDay() + 6) % 7; // lunes = 0
  const startDate = shiftDays(first, -offset);

  for (let i = 0; i < 42; i++) {
    const d = shiftDays(startDate, i);
    const key = dateKey(d);
    const inMonth = d.getMonth() === calM;
    const isToday = key === today;
    const marked = !!calendarMarks[key];
    const { doneTasks, doneHabits } = weekActivity(key);

    const cell = document.createElement('button');
    cell.className = 'cal-cell' +
      (inMonth ? '' : ' out') +
      (isToday ? ' today' : '') +
      (marked ? ' marked' : '');

    const num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = d.getDate();

    const marks = document.createElement('span');
    marks.className = 'cal-marks';
    if (marked) {
      const m = document.createElement('span');
      m.className = 'mark main';
      marks.appendChild(m);
    }
    if (doneTasks > 0) {
      const m = document.createElement('span');
      m.className = 'mark tasks';
      m.title = `${doneTasks} tarea${doneTasks === 1 ? '' : 's'} hecha${doneTasks === 1 ? '' : 's'}`;
      marks.appendChild(m);
    }
    if (doneHabits > 0) {
      const m = document.createElement('span');
      m.className = 'mark habits';
      m.title = `${doneHabits} hábito${doneHabits === 1 ? '' : 's'} completado${doneHabits === 1 ? '' : 's'}`;
      marks.appendChild(m);
    }
    const notes = calendarNotes[key] || [];
    if (notes.length) {
      const b = document.createElement('span');
      b.className = 'cal-note';
      b.textContent = notes.length;
      b.title = `${notes.length} importante${notes.length === 1 ? '' : 's'}`;
      marks.appendChild(b);
    }

    cell.append(num, marks);

    cell.addEventListener('click', () => {
      if (!inMonth) return;
      openDayModal(key);
    });

    grid.appendChild(cell);
  }
}

/* ---------- Selectores de mes / año ---------- */
function buildCalSelects() {
  const mSel = $('#calMonth');
  if (!mSel || mSel.options.length) return;
  MONTH_NAMES.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = name;
    mSel.appendChild(opt);
  });
  mSel.addEventListener('change', () => {
    calM = parseInt(mSel.value, 10);
    renderCalendar();
  });

  const ySel = $('#calYear');
  const cy = new Date().getFullYear();
  for (let y = cy - 6; y <= cy + 6; y++) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    ySel.appendChild(opt);
  }
  ySel.addEventListener('change', () => {
    calY = parseInt(ySel.value, 10);
    renderCalendar();
  });
}

/* ---------- Modal del día (marcar + cosas importantes) ---------- */
let dayModalKey = null;

function openDayModal(key) {
  dayModalKey = key;
  const d = keyToDate(key);
  $('#dayModalTitle').textContent = d.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  $('#dayMarked').checked = !!calendarMarks[key];
  renderDayNotes();
  $('#dayNoteInput').value = '';
  $('#dayModal').classList.remove('hidden');
  $('#dayNoteInput').focus();
}

function renderDayNotes() {
  const wrap = $('#dayNotes');
  wrap.innerHTML = '';
  const notes = calendarNotes[dayModalKey] || [];
  if (!notes.length) {
    wrap.appendChild(Object.assign(document.createElement('p'), {
      className: 'muted',
      textContent: 'Sin notas todavía.'
    }));
    return;
  }
  notes.forEach((n) => {
    const li = document.createElement('div');
    li.className = 'day-note-item';
    const span = Object.assign(document.createElement('span'), { textContent: n.text });
    const del = document.createElement('button');
    del.className = 'task-del';
    del.textContent = 'x';
    del.addEventListener('click', () => {
      calendarNotes[dayModalKey] = notes.filter((x) => x.id !== n.id);
      if (!calendarNotes[dayModalKey].length) delete calendarNotes[dayModalKey];
      saveCalendarNotes();
      renderDayNotes();
      renderCalendar();
    });
    li.append(span, del);
    wrap.appendChild(li);
  });
}

$('#dayMarked').addEventListener('change', () => {
  if (!dayModalKey) return;
  if ($('#dayMarked').checked) calendarMarks[dayModalKey] = true;
  else delete calendarMarks[dayModalKey];
  saveCalendarMarks();
  renderCalendar();
});

$('#addDayNote').addEventListener('click', () => {
  const text = $('#dayNoteInput').value.trim();
  if (!text || !dayModalKey) return;
  if (!calendarNotes[dayModalKey]) calendarNotes[dayModalKey] = [];
  calendarNotes[dayModalKey].push({ id: uid(), text });
  saveCalendarNotes();
  $('#dayNoteInput').value = '';
  renderDayNotes();
  renderCalendar();
});

$('#dayNoteInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#addDayNote').click();
});

$('#closeDayModal').addEventListener('click', () => {
  $('#dayModal').classList.add('hidden');
});

$('#dayModal').addEventListener('click', (e) => {
  if (e.target === $('#dayModal')) $('#dayModal').classList.add('hidden');
});

$('#calToday').addEventListener('click', () => {
  const now = new Date();
  calY = now.getFullYear();
  calM = now.getMonth();
  renderCalendar();
});

$('#prevMonth').addEventListener('click', () => {
  calM--;
  if (calM < 0) { calM = 11; calY--; }
  renderCalendar();
});

$('#nextMonth').addEventListener('click', () => {
  calM++;
  if (calM > 11) { calM = 0; calY++; }
  renderCalendar();
});

/* ============================================================
   GRÁFICOS
   ============================================================ */
function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(dateKey(shiftDays(new Date(), -i)));
  return days;
}

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 600;
  const h = rect.height || 220;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawBarChart(canvas, labels, values, color, opts = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  if (!values.length || values.every((v) => v === 0)) {
    if (!opts.hideEmpty) {
      ctx.fillStyle = cssVar('--muted');
      ctx.font = '14px Segoe UI, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos para este período', w / 2, h / 2);
    }
    return false;
  }

  const padL = 38, padR = 10, padT = 18, padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? plotW / values.length : plotW;

  const muted = cssVar('--muted');
  const border = cssVar('--border');

  // rejilla
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.fillStyle = muted;
  ctx.font = '11px Segoe UI, Arial';
  ctx.textAlign = 'right';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = Math.round((max / steps) * i);
    const y = padT + plotH - (plotH * i) / steps;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillText(String(val), padL - 6, y + 4);
  }

  values.forEach((v, i) => {
    const bw = Math.min(step * 0.6, 46);
    const x = padL + step * i + (step - bw) / 2;
    const bh = (v / max) * plotH;
    const y = padT + plotH - bh;

    const grad = ctx.createLinearGradient(0, y, 0, padT + plotH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '55');
    ctx.fillStyle = grad;
    const r = Math.min(6, bw / 2);
    ctx.beginPath();
    ctx.moveTo(x, y + bh);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + bw - r, y);
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
    ctx.lineTo(x + bw, y + bh);
    ctx.closePath();
    ctx.fill();

    // etiqueta de valor
    if (v > 0) {
      ctx.fillStyle = cssVar('--text');
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px Segoe UI, Arial';
      ctx.fillText(opts.suffix ? `${v}${opts.suffix}` : String(v), x + bw / 2, y - 5);
    }

    // etiqueta de eje
    ctx.fillStyle = muted;
    ctx.textAlign = 'center';
    ctx.font = '11px Segoe UI, Arial';
    ctx.fillText(labels[i], x + bw / 2, h - 8);
  });
  return true;
}

function drawHBarChart(canvas, rows) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  if (!rows.length) {
    ctx.fillStyle = cssVar('--muted');
    ctx.font = '14px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sin datos para este período', w / 2, h / 2);
    return;
  }
  const padL = 130, padR = 40, padT = 14, padB = 14;
  const plotW = w - padL - padR;
  const rowH = Math.min(34, (h - padT - padB) / rows.length);
  const muted = cssVar('--muted');
  const text = cssVar('--text');

  ctx.font = '12px Segoe UI, Arial';
  ctx.textAlign = 'right';
  ctx.fillStyle = text;
  ctx.textBaseline = 'middle';

  rows.forEach((r, i) => {
    const y = padT + i * rowH + rowH / 2;
    const label = r.name.length > 18 ? r.name.slice(0, 17) + '…' : r.name;
    ctx.fillText(label, padL - 10, y);

    const bw = (Math.min(r.value, 100) / 100) * plotW;
    const barY = y - rowH * 0.3;
    const barH = rowH * 0.6;

    ctx.fillStyle = cssVar('--border');
    ctx.fillRect(padL, barY, plotW, barH);
    ctx.fillStyle = r.color;
    ctx.fillRect(padL, barY, bw, barH);

    ctx.fillStyle = muted;
    ctx.textAlign = 'left';
    ctx.fillText(`${r.value}%`, padL + bw + 8, y);
    ctx.textAlign = 'right';
  });
  ctx.textBaseline = 'alphabetic';
}

function renderStats() {
  const days = lastNDays(7);
  const labels = days.map((k) => {
    const d = keyToDate(k);
    return d.toLocaleDateString('es-ES', { weekday: 'short' });
  });

  // 1) minutos de estudio
  const studyByDay = days.map((k) =>
    studyLog.filter((s) => s.date === k && s.kind === 'study')
      .reduce((sum, s) => sum + s.minutes, 0)
  );
  const studyCtx = $('#chartStudy');
  const hasStudy = studyByDay.some((v) => v > 0);
  $('#noStudyData').classList.toggle('hidden', hasStudy);
  if (!hasStudy) {
    $('#chartStudy').classList.add('hidden');
  } else {
    $('#chartStudy').classList.remove('hidden');
  }
  drawBarChart(studyCtx, labels, studyByDay, cssVar('--primary'));

  // 2) hábitos completados por día
  const habitsByDay = days.map((k) =>
    habits.filter((h) => habitChecks[h.id] && habitChecks[h.id][k]).length
  );
  const hasHabits = habits.length > 0 && habitsByDay.some((v) => v > 0);
  $('#noHabitData').classList.toggle('hidden', hasHabits);
  $('#chartHabitsDay').classList.toggle('hidden', !hasHabits);
  drawBarChart($('#chartHabitsDay'), labels, habitsByDay, cssVar('--success'), { hideEmpty: !hasHabits });

  // 3) porcentaje por hábito (14 días)
  const rateDays = lastNDays(14);
  const rows = habits.map((h) => {
    const done = rateDays.filter((k) => habitChecks[h.id] && habitChecks[h.id][k]).length;
    return { name: h.name, color: h.color, value: Math.round((done / rateDays.length) * 100) };
  });
  drawHBarChart($('#chartHabitRate'), rows);
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
initTheme();

window.addEventListener('resize', () => {
  if ($('#tab-stats').classList.contains('active')) renderStats();
});

/* Se llama desde auth.js una vez el usuario inició sesión
   (o entró como invitado) y la vista de la app es visible. */
window.initApp = async function () {
  await syncPull();
  loadData();
  if (window.syncFirstLogin) syncPushAll();
  buildHabitLinkOptions();
  setMode(timerMode);
  $('#customH').value = Math.floor(timer.customMin / 60);
  $('#customMin').value = timer.customMin % 60;
  buildPresetChips();
  $('#workMin').value = timer.workMin;
  $('#breakMin').value = timer.breakMin;
  $('#soundSel').value = soundPref;
  $('#notifToggle').checked = notifEnabled;
  renderHabits();
  buildWeekSelects();
  renderWeek();
  buildCalSelects();
  renderCalendar();
  renderTimerUi();
};
