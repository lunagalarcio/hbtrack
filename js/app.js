/* ============================================================
   TrackMyHabits - app.js (punto de entrada)
   Carga los módulos: shared, sync, habit, timer, week,
   calendar, stats (en ese orden en index.html).
   ============================================================ */

initTheme();

/* ---------- Menú móvil (cajón de la sidebar) ---------- */
function openMobileMenu() {
  document.querySelector('.sidebar').classList.add('open');
  document.querySelector('.sidebar-backdrop').classList.add('open');
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

$('#mobileMenuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-backdrop').classList.toggle('open');
});

document.querySelector('.sidebar-backdrop').addEventListener('click', closeMobileMenu);

window.addEventListener('resize', () => {
  if ($('#tab-stats').classList.contains('active')) renderStats();
  if ($('#tab-goals').classList.contains('active')) renderGoals();
});

/* Se llama desde auth.js una vez el usuario inició sesión
   (o entró como invitado) y la vista de la app es visible. */
window.initApp = async function () {
  await syncPull();
  loadData();
  applyTheme(store.get('theme', 'light'));
  applyAccent(store.get('accent', ''), false);
  if (window.syncFirstLogin) syncPushAll();
  resumePending();
  buildHabitLinkOptions();
  if (!restoreTimerState()) setMode(timerMode);
  $('#customH').value = Math.floor(timer.customMin / 60);
  $('#customMin').value = timer.customMin % 60;
  buildPresetChips();
  $('#workMin').value = timer.workMin;
  $('#breakMin').value = timer.breakMin;
  $('#soundSel').value = soundPref;
  $('#notifToggle').checked = notifEnabled;
  $('#extraTimeToggle').checked = extraTimeEnabled;
  initReminders();
  renderHabits();
  buildHabitFilter();
  buildWeekSelects();
  renderWeek();
  renderTimetable();
  buildCalSelects();
  renderCalendar();
  renderBoard();
  renderTimerUi();
  renderDashboard();
  renderGoals();
};
