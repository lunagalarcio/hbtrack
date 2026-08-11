/* ============================================================
   week.js - Tareas semanales por día
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
          checkGoals();
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

      const taskMin = taskTime[task.id] && taskTime[task.id][key];
      if (taskMin > 0) {
        const min = Object.assign(document.createElement('span'), { className: 'task-min', textContent: formatDuration(taskMin) });
        li.appendChild(min);
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
  buildTaskLinkOptions();
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
