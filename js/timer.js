/* ============================================================
   timer.js - Cronómetro (normal / pomodoro)
   ============================================================ */

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

/* ---------- Estado del cronómetro ---------- */
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

/* ---------- Persistencia del cronómetro ----------
   Guarda el estado del timer para restaurarlo al recargar
   (se guarda solo en localStorage, no en la nube). */
let lastTimerSave = 0;

function saveTimerState() {
  try {
    localStorage.setItem(pfx('timerState'), JSON.stringify({
      mode: timer.mode,
      phase: timer.phase,
      remainingMs: timer.remainingMs,
      totalMs: timer.totalMs,
      running: timer.running,
      lastTick: timer.lastTick || Date.now()
    }));
  } catch (e) { /* sin espacio */ }
}

function maybeSaveTimer() {
  const now = Date.now();
  if (now - lastTimerSave > 1000) {
    lastTimerSave = now;
    saveTimerState();
  }
}

function restoreTimerState() {
  const saved = store.get('timerState', null);
  if (!saved) return false;

  timer.mode = saved.mode === 'pomodoro' ? 'pomodoro' : 'normal';
  timer.phase = saved.phase === 'break' ? 'break' : (saved.phase === 'work' ? 'work' : 'study');
  timerMode = timer.mode;
  timer.totalMs = saved.totalMs > 0 ? saved.totalMs : timer.totalMs;
  timer.remainingMs = saved.remainingMs > 0 ? saved.remainingMs : 0;

  $('#modeNormal').classList.toggle('active', timer.mode === 'normal');
  $('#modePomodoro').classList.toggle('active', timer.mode === 'pomodoro');
  $('#normalConfig').classList.toggle('hidden', timer.mode !== 'normal');
  $('#pomodoroConfig').classList.toggle('hidden', timer.mode !== 'pomodoro');

  if (saved.running) {
    const elapsed = Date.now() - (saved.lastTick || Date.now());
    timer.remainingMs = Math.max(0, timer.remainingMs - elapsed);
    if (timer.remainingMs > 0) {
      timer.running = true;
      timer.lastTick = Date.now();
      timer.interval = setInterval(tick, 250);
      toast('Cronómetro restaurado');
    } else {
      // La fase terminó mientras la app estaba cerrada
      const kind = (timer.mode === 'normal' || timer.phase === 'work') ? 'study' : 'break';
      commitElapsed(kind);
      if (timer.mode === 'pomodoro' && timer.phase === 'work') {
        const today = dateKey();
        pomodoroDays[today] = (pomodoroDays[today] || 0) + 1;
        savePomodoro();
        timer.phase = 'break';
        timer.totalMs = timer.breakMin * 60000;
        timer.remainingMs = timer.totalMs;
      } else {
        timer.remainingMs = timer.totalMs;
      }
      timer.running = false;
      toast('Tu sesión se completó mientras no estabas');
    }
  }
  saveTimerState();
  renderTimerUi();
  return true;
}

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
  saveTimerState();
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
  saveTimerState();
  renderTimerUi();
}

function pauseTimer() {
  timer.running = false;
  clearInterval(timer.interval);
  timer.interval = null;
  saveTimerState();
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
  maybeSaveTimer();
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
  saveTimerState();
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
  saveTimerState();
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
  saveTimerState();
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
  saveTimerState();
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
  saveTimerState();
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
  saveTimerState();
});
