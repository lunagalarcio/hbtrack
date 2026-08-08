/* ============================================================
   habit.js - Hábitos (lista, rachas, modal añadir/editar)
   ============================================================ */

function getStreak(habitId) {
  const habit = habits.find((h) => h.id === habitId);
  const checks = habitChecks[habitId] || {};
  let d = new Date();
  let guard = 0;
  while (!habitIsDue(habit, dateKey(d)) && guard < 14) {
    d = shiftDays(d, -1);
    guard++;
  }
  if (!habitIsDue(habit, dateKey(d))) return 0;
  let streak = 0;
  while (habitIsDue(habit, dateKey(d)) && checks[dateKey(d)]) {
    streak++;
    d = shiftDays(d, -1);
  }
  return streak;
}

function toggleCheck(habitId, key) {
  const habit = habits.find((h) => h.id === habitId);
  if (!habitIsDue(habit, key)) {
    toast('Este hábito no aplica este día');
    return;
  }
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
      if (!habitIsDue(habit, key)) continue;
      const checked = !!(habitChecks[habit.id] && habitChecks[habit.id][key]);
      const chip = document.createElement('button');
      chip.className = 'day-chip' + (checked ? ' checked' : '') + (todayIs(key) ? ' today' : '');
      chip.textContent = DAY_LETTERS[dayIndex(d)];
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
let selectedDays = [0, 1, 2, 3, 4, 5, 6];

function buildDayPicker() {
  const picker = $('#habitDays');
  picker.innerHTML = '';
  DAY_LETTERS.forEach((letter, i) => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'day-opt' + (selectedDays.includes(i) ? ' active' : '');
    opt.textContent = letter;
    opt.title = DAY_NAMES[(i + 6) % 7];
    opt.addEventListener('click', () => {
      if (selectedDays.includes(i)) selectedDays = selectedDays.filter((x) => x !== i);
      else selectedDays = [...selectedDays, i].sort();
      buildDayPicker();
    });
    picker.appendChild(opt);
  });
}

function openHabitModal(habitId) {
  editingHabitId = habitId || null;
  const h = editingHabitId ? habits.find((x) => x.id === editingHabitId) : null;
  $('#habitModalTitle').textContent = editingHabitId ? 'Editar hábito' : 'Nuevo hábito';
  $('#saveHabit').textContent = editingHabitId ? 'Guardar cambios' : 'Guardar';
  $('#habitName').value = h ? h.name : '';
  $('#habitTargetMin').value = h && h.targetMin > 0 ? h.targetMin : '';
  selectedColor = h ? h.color : HABIT_COLORS[0];
  selectedDays = h && h.days && h.days.length ? h.days.slice() : [0, 1, 2, 3, 4, 5, 6];
  $('#habitModal').classList.remove('hidden');
  $('#habitName').focus();
  buildColorPicker();
  buildDayPicker();
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
  const days = selectedDays.length ? selectedDays.slice() : [0, 1, 2, 3, 4, 5, 6];

  if (editingHabitId) {
    const h = habits.find((x) => x.id === editingHabitId);
    if (h) {
      h.name = name;
      h.color = selectedColor;
      h.targetMin = targetMin;
      h.days = days;
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

  habits.push({ id: uid(), name, color: selectedColor, targetMin, days });
  saveHabits();
  buildHabitLinkOptions();
  closeHabitModal();
  renderHabits();
  toast('Hábito añadido');
});
