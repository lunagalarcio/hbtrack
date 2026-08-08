/* ============================================================
   calendar.js - Calendario, marcas y cosas importantes
   ============================================================ */

let calY = new Date().getFullYear();
let calM = new Date().getMonth();

function weekActivity(key) {
  const tasks = weekTasks[key] || [];
  const doneTasks = tasks.filter((t) => t.done).length;
  const doneHabits = habits.filter((h) => habitIsDue(h, key) && habitChecks[h.id] && habitChecks[h.id][key]).length;
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
