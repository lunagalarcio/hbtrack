/* ============================================================
   dashboard.js - Resumen del día (lo que hay que hacer hoy)
   ============================================================ */

function goToTab(tab) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (btn) btn.click();
}

function emptyEl(text) {
  const el = document.createElement('div');
  el.className = 'empty-mini';
  el.textContent = text;
  return el;
}

function dashGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '¡Buenas noches!';
  if (h < 12) return '¡Buenos días!';
  if (h < 20) return '¡Buenas tardes!';
  return '¡Buenas noches!';
}

/* Tareas de hoy: tareas puntuales + tareas recurrentes del día */
function todayTaskList() {
  const key = dateKey();
  const now = new Date();
  return [
    ...(weekTasks[key] || []),
    ...recurringTasks
      .filter((t) => t.weekday === now.getDay())
      .map((t) => ({ ...t, repeat: true, done: !!(recurringDone[t.id] && recurringDone[t.id][key]) }))
  ];
}

function toggleDashboardTask(task, key) {
  const becoming = !task.done;
  if (task.repeat) {
    if (!recurringDone[task.id]) recurringDone[task.id] = {};
    if (becoming) recurringDone[task.id][key] = true;
    else delete recurringDone[task.id][key];
    if (!Object.keys(recurringDone[task.id]).length) delete recurringDone[task.id];
    saveRecurringDone();
  } else {
    task.done = becoming;
    saveTasks();
  }
  if (task.type === 'Hábito' && task.habitId) {
    if (becoming) {
      if (!habitChecks[task.habitId]) habitChecks[task.habitId] = {};
      habitChecks[task.habitId][key] = true;
    } else if (habitChecks[task.habitId]) {
      delete habitChecks[task.habitId][key];
    }
    saveChecks();
    checkGoals();
    if (becoming && allDueDoneToday()) {
      burstConfetti();
      toast('¡Completaste todos tus hábitos hoy! 🎉');
    }
  }
  if ($('#tab-habits').classList.contains('active')) renderHabits();
  if ($('#tab-week').classList.contains('active')) renderWeek();
  if ($('#tab-calendar').classList.contains('active')) renderCalendar();
  renderDashboard();
}

/* ¿Todos los hábitos que aplican hoy están completados? */
function allDueDoneToday() {
  const key = dateKey();
  const due = habits.filter((h) => habitIsDue(h, key));
  return due.length > 0 && due.every((h) => habitChecks[h.id] && habitChecks[h.id][key]);
}

function burstConfetti() {
  const overlay = document.createElement('div');
  overlay.className = 'confetti-overlay';
  const colors = ['#2383e2', '#38bdf8', '#0f9d58', '#f59e0b', '#9c36b5', '#e8590c', '#0ca678'];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = (Math.random() * 100).toFixed(2) + '%';
    piece.style.background = colors[i % colors.length];
    piece.style.width = 6 + Math.random() * 6 + 'px';
    piece.style.height = 6 + Math.random() * 6 + 'px';
    piece.style.animationDuration = (2 + Math.random() * 2).toFixed(2) + 's';
    piece.style.animationDelay = (Math.random() * 0.4).toFixed(2) + 's';
    overlay.appendChild(piece);
  }
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 4500);
}

function renderDashboard() {
  const key = dateKey();
  const d = new Date();
  const dIdx = dayIndex(d);

  $('#dashGreeting').textContent = dashGreeting() +
    (window.Session && window.Session.displayName ? ' ' + window.Session.displayName : '');
  $('#dashDate').textContent = d.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const dueHabits = habits.filter((h) => habitIsDue(h, key));
  const doneHabits = dueHabits.filter((h) => habitChecks[h.id] && habitChecks[h.id][key]);
  const tasks = todayTaskList();
  const doneTasks = tasks.filter((t) => t.done);
  const studyMin = studyLog
    .filter((s) => s.date === key && s.kind === 'study')
    .reduce((sum, s) => sum + s.minutes, 0);

  let bestStreak = 0, bestName = '';
  habits.forEach((h) => {
    const s = getStreak(h.id);
    if (s > bestStreak) { bestStreak = s; bestName = h.name; }
  });

  const statsWrap = $('#dashStats');
  statsWrap.innerHTML = '';
  const cards = [
    {
      value: dueHabits.length ? `${doneHabits.length}/${dueHabits.length}` : '—',
      label: 'Hábitos hoy',
      sub: dueHabits.length ? `${dueHabits.length - doneHabits.length} por hacer` : 'Nada por hoy'
    },
    {
      value: tasks.length ? `${doneTasks.length}/${tasks.length}` : '—',
      label: 'Tareas de hoy',
      sub: tasks.length ? `${tasks.length - doneTasks.length} por hacer` : 'Sin tareas'
    },
    { value: formatDuration(studyMin), label: 'Estudiado hoy', sub: studyMin > 0 ? 'sesiones registradas' : 'Aún sin estudiar' },
    { value: bestStreak > 0 ? `${bestStreak} ${bestStreak === 1 ? 'día' : 'días'}` : '—', label: 'Racha más larga', sub: bestName || 'Sin registros' }
  ];
  cards.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'stat dash-stat';
    el.append(
      Object.assign(document.createElement('strong'), { textContent: c.value }),
      Object.assign(document.createElement('span'), { textContent: c.label }),
      Object.assign(document.createElement('span'), { className: 'stat-sub', textContent: c.sub })
    );
    statsWrap.appendChild(el);
  });

  renderDashClasses(dIdx);
  renderDashTasks(key, tasks);
  renderDashHabits(key, dueHabits);
  renderDashNotes(key);
  renderDashUpcoming();
}

function renderDashClasses(dIdx) {
  const box = $('#dashClasses');
  box.innerHTML = '';
  const classes = timetable.filter((c) => c.day === dIdx).sort((a, b) => a.start - b.start);
  if (!classes.length) {
    box.appendChild(emptyEl('No tienes clases hoy.'));
    return;
  }
  classes.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'dash-class';
    row.style.setProperty('--task-color', c.color);
    const time = Object.assign(document.createElement('span'), {
      className: 'dash-class-time',
      textContent: `${minToTime(c.start)} – ${minToTime(c.end)}`
    });
    const info = document.createElement('div');
    info.className = 'dash-class-info';
    info.append(Object.assign(document.createElement('strong'), { textContent: c.name }));
    if (c.place) {
      info.append(Object.assign(document.createElement('span'), { className: 'dash-class-place', textContent: c.place }));
    }
    row.append(time, info);
    box.appendChild(row);
  });
}

function renderDashTasks(key, tasks) {
  const box = $('#dashTasks');
  box.innerHTML = '';
  if (!tasks.length) {
    box.appendChild(emptyEl('Sin tareas para hoy. Añádelas en la vista Semana.'));
    return;
  }
  tasks.forEach((task) => {
    const li = document.createElement('label');
    li.className = 'dash-task' + (task.done ? ' done' : '');
    li.style.setProperty('--task-color', taskColor(task));
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!task.done;
    chk.addEventListener('change', () => toggleDashboardTask(task, key));
    const span = Object.assign(document.createElement('span'), {
      className: 'dash-task-text',
      textContent: task.text
    });
    li.append(chk, span);
    if (task.repeat) {
      const rep = document.createElement('span');
      rep.className = 'task-repeat-icon';
      rep.textContent = '↻';
      rep.title = 'Se repite cada semana';
      li.appendChild(rep);
    }
    box.appendChild(li);
  });
}

function renderDashHabits(key, dueHabits) {
  const box = $('#dashHabits');
  box.innerHTML = '';
  if (!dueHabits.length) {
    box.appendChild(emptyEl('Sin hábitos programados para hoy.'));
    return;
  }
  dueHabits.forEach((habit) => {
    const checked = !!(habitChecks[habit.id] && habitChecks[habit.id][key]);
    const li = document.createElement('label');
    li.className = 'dash-habit' + (checked ? ' done' : '');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = checked;
    chk.addEventListener('change', () => {
      toggleCheck(habit.id, key);
      renderDashboard();
    });
    const dot = document.createElement('span');
    dot.className = 'dash-habit-dot';
    dot.style.background = habit.color;
    const name = Object.assign(document.createElement('span'), {
      className: 'dash-habit-name',
      textContent: habit.name
    });
    li.append(chk, dot, name);
    if (habit.targetMin > 0) {
      const todayMin = trackedMinutes(habit.id);
      const pct = Math.min(100, Math.round((todayMin / habit.targetMin) * 100));
      const bar = document.createElement('span');
      bar.className = 'dash-habit-bar';
      const fill = document.createElement('span');
      if (pct >= 100) fill.className = 'done';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      const meta = Object.assign(document.createElement('span'), {
        className: 'dash-habit-meta',
        textContent: `${formatDuration(todayMin)} / ${formatDuration(habit.targetMin)}`
      });
      li.append(bar, meta);
    }
    box.appendChild(li);
  });
}

function renderDashNotes(key) {
  const box = $('#dashNotes');
  box.innerHTML = '';
  const notes = calendarNotes[key] || [];
  if (!notes.length) {
    box.appendChild(emptyEl('Nada marcado como importante hoy.'));
    return;
  }
  notes.forEach((n) => {
    const row = document.createElement('div');
    row.className = 'dash-note';
    const span = Object.assign(document.createElement('span'), { textContent: n.text });
    const del = document.createElement('button');
    del.className = 'task-del';
    del.textContent = 'x';
    del.title = 'Quitar';
    del.addEventListener('click', () => {
      calendarNotes[key] = notes.filter((x) => x.id !== n.id);
      if (!calendarNotes[key].length) delete calendarNotes[key];
      saveCalendarNotes();
      renderDashboard();
      if ($('#tab-calendar').classList.contains('active')) renderCalendar();
    });
    row.append(span, del);
    box.appendChild(row);
  });
}

function renderDashUpcoming() {
  const box = $('#dashUpcoming');
  box.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const day = shiftDays(new Date(), i);
    const k = dateKey(day);
    const dayTasks = [
      ...(weekTasks[k] || []),
      ...recurringTasks.filter((t) => t.weekday === day.getDay())
    ];
    const doneT = dayTasks.filter((t) => t.done || (t.id && recurringDone[t.id] && recurringDone[t.id][k])).length;
    const dueH = habits.filter((h) => habitIsDue(h, k)).length;
    const doneH = habits.filter((h) => habitIsDue(h, k) && habitChecks[h.id] && habitChecks[h.id][k]).length;

    const row = document.createElement('div');
    row.className = 'dash-up-item' + (todayIs(k) ? ' today' : '');
    const label = Object.assign(document.createElement('span'), {
      className: 'dash-up-label',
      textContent: day.toLocaleDateString('es-ES', { weekday: 'short' }) + ' ' + day.getDate()
    });
    const meta = Object.assign(document.createElement('span'), {
      className: 'dash-up-meta',
      textContent: `${doneT}/${dayTasks.length} tareas · ${doneH}/${dueH} hábitos`
    });
    row.append(label, meta);
    box.appendChild(row);
  }
}

$$('.dash-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    goToTab(link.dataset.goto);
  });
});
