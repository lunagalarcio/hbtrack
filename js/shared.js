/* ============================================================
   shared.js - Constantes, helpers y estado compartido
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const HABIT_COLORS = [
  '#2f80ed', '#38bdf8', '#2563eb', '#0ea5e9', '#60a5fa', '#22d3ee', '#4cc2ff', '#3b82f6', '#7dd3fc', '#1d4ed8',
  '#8b5cf6', '#7c3aed', '#a78bfa', '#c084fc', '#d946ef', '#f0abfc', '#ec4899', '#f472b6', '#fb7185', '#e11d48',
  '#f43f5e', '#ef4444', '#f97316', '#fb923c', '#f59e0b', '#fbbf24', '#facc15', '#eab308', '#a3e635', '#84cc16',
  '#4ade80', '#22c55e', '#16a34a', '#10b981', '#2dd4bf', '#14b8a6', '#06b6d4', '#0d9488', '#34d399', '#4ade80',
  '#64748b', '#475569', '#334155', '#1e293b', '#78350f', '#831843', '#6d28d9', '#4f46e5', '#9333ea', '#a16207'
];

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

/* Día de la semana en formato lunes = 0 ... domingo = 6 */
function dayIndex(d = new Date()) {
  return (d.getDay() + 6) % 7;
}

/* ¿El hábito aplica en esta fecha? (habit.days usa lunes = 0) */
function habitIsDue(habit, key) {
  if (!habit || !habit.days || !habit.days.length) return true;
  return habit.days.includes(dayIndex(keyToDate(key)));
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

/* ---------- Estado de la aplicación ---------- */
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
  statsRange = store.get('statsRange', 7);
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
  applyAccent(store.get('accent', ''), false);
}

/* ---------- Color de acento ---------- */
let accentColor = '';

function applyAccent(color, persist = true) {
  accentColor = color || '';
  if (accentColor) document.documentElement.style.setProperty('--accent', accentColor);
  else document.documentElement.style.removeProperty('--accent');
  $$('.accent-swatch').forEach((b) => {
    b.classList.toggle('selected', (b.dataset.accent || '') === accentColor);
  });
  if (persist) store.set('accent', accentColor);
  if ($('#tab-stats').classList.contains('active')) renderStats();
}

$$('.accent-swatch').forEach((btn) => {
  btn.addEventListener('click', () => applyAccent(btn.dataset.accent || ''));
});

$('#themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
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
