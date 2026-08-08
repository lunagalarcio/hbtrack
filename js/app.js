/* ============================================================
   TrackMyHabits - app.js (punto de entrada)
   Carga los módulos: shared, sync, habit, timer, week,
   calendar, stats (en ese orden en index.html).
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
  initReminders();
  renderHabits();
  buildWeekSelects();
  renderWeek();
  buildCalSelects();
  renderCalendar();
  renderTimerUi();
};
