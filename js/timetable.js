/* ============================================================
   timetable.js - Horario universitario por horas y días
   Cada clase: { id, day (0=lun..6=dom), start/end (minutos
   desde medianoche), name, place, color }
   ============================================================ */

const TT_START_HOUR = 6;
const TT_END_HOUR = 23;
const TT_SLOT_MIN = 30;
const TT_SLOT_H = 20;
const TT_HOUR_H = TT_SLOT_H * (60 / TT_SLOT_MIN);

const CLASS_COLORS = [
  '#2563eb', '#0f9d58', '#e8590c', '#9c36b5', '#e03131', '#0ca678',
  '#f08c00', '#7048e8', '#c2255c', '#1971c2', '#2f9e44', '#d6336c'
];

function timeToMin(v) {
  if (!v) return NaN;
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function saveTimetable() {
  store.set('timetable', timetable);
}

function buildClassEl(c) {
  const startSlot = Math.max(0, Math.round((c.start - TT_START_HOUR * 60) / TT_SLOT_MIN));
  const durSlots = Math.max(1, Math.round((c.end - c.start) / TT_SLOT_MIN));
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tt-class';
  el.style.top = startSlot * TT_SLOT_H + 'px';
  el.style.height = durSlots * TT_SLOT_H - 2 + 'px';
  el.style.background = c.color;
  el.title = `${c.name} · ${minToTime(c.start)}–${minToTime(c.end)}` + (c.place ? ` · ${c.place}` : '');
  el.append(
    Object.assign(document.createElement('span'), { className: 'tt-class-name', textContent: c.name }),
    Object.assign(document.createElement('span'), {
      className: 'tt-class-meta',
      textContent: `${minToTime(c.start)}–${minToTime(c.end)}` + (c.place ? ` · ${c.place}` : '')
    })
  );
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    openClassModal(c.id);
  });
  return el;
}

function renderTimetable() {
  const wrap = $('#timetableGrid');
  if (!wrap) return;
  wrap.innerHTML = '';
  const totalH = TT_HOUR_H * (TT_END_HOUR - TT_START_HOUR);

  const timeCol = document.createElement('div');
  timeCol.className = 'tt-timecol';
  timeCol.style.height = totalH + 'px';
  for (let h = TT_START_HOUR; h < TT_END_HOUR; h++) {
    const lab = document.createElement('div');
    lab.className = 'tt-hlabel';
    lab.style.top = (h - TT_START_HOUR) * TT_HOUR_H + 'px';
    lab.textContent = `${String(h).padStart(2, '0')}:00`;
    timeCol.appendChild(lab);
  }
  wrap.appendChild(timeCol);

  /* Lun (0) a Vie (4): el horario solo cubre la semana lectiva */
  for (let d = 0; d < 5; d++) {
    const col = document.createElement('div');
    col.className = 'tt-daycol';
    col.style.height = totalH + 'px';
    timetable.filter((c) => c.day === d).forEach((c) => col.appendChild(buildClassEl(c)));

    col.addEventListener('click', (e) => {
      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const slot = Math.max(0, Math.floor(y / TT_SLOT_H));
      const mins = TT_START_HOUR * 60 + slot * TT_SLOT_MIN;
      openClassModal(null, d, mins);
    });
    wrap.appendChild(col);
  }
}

/* ---------- Modal de clase ---------- */
let editingClassId = null;
let selectedClassColor = CLASS_COLORS[0];

function buildClassColorPicker() {
  const picker = $('#classColorPicker');
  picker.innerHTML = '';
  CLASS_COLORS.forEach((c) => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'color-opt' + (c === selectedClassColor ? ' selected' : '');
    opt.style.background = c;
    opt.addEventListener('click', () => {
      selectedClassColor = c;
      buildClassColorPicker();
    });
    picker.appendChild(opt);
  });
}

function openClassModal(id, day, mins) {
  editingClassId = id || null;
  const c = editingClassId ? timetable.find((x) => x.id === editingClassId) : null;
  $('#classModalTitle').textContent = editingClassId ? 'Editar clase' : 'Nueva clase';
  $('#className').value = c ? c.name : '';
  $('#classPlace').value = c ? (c.place || '') : '';
  $('#classDay').value = c ? String(c.day) : String(day != null ? day : dayIndex());
  $('#classStart').value = c ? minToTime(c.start) : (mins != null ? minToTime(mins) : '08:00');
  $('#classEnd').value = c ? minToTime(c.end) : (mins != null ? minToTime(mins + 120) : '10:00');
  selectedClassColor = c ? c.color : CLASS_COLORS[0];
  $('#deleteClass').classList.toggle('hidden', !editingClassId);
  $('#classModal').classList.remove('hidden');
  buildClassColorPicker();
  $('#className').focus();
}

function closeClassModal() {
  $('#classModal').classList.add('hidden');
}

$('#addClassBtn').addEventListener('click', () => openClassModal(null, dayIndex(), null));
$('#cancelClass').addEventListener('click', closeClassModal);
$('#classModal').addEventListener('click', (e) => {
  if (e.target === $('#classModal')) closeClassModal();
});
$('#className').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#saveClass').click();
});

$('#saveClass').addEventListener('click', () => {
  const name = $('#className').value.trim();
  if (!name) {
    toast('Escribe el nombre de la clase');
    return;
  }
  const day = parseInt($('#classDay').value, 10);
  const start = timeToMin($('#classStart').value);
  const end = timeToMin($('#classEnd').value);
  if (isNaN(start) || isNaN(end)) {
    toast('Indica la hora de inicio y fin');
    return;
  }
  if (end <= start) {
    toast('El fin debe ser después del inicio');
    return;
  }
  if (start < TT_START_HOUR * 60 || end > TT_END_HOUR * 60) {
    toast(`El horario va de ${TT_START_HOUR}:00 a ${TT_END_HOUR}:00`);
    return;
  }
  const place = $('#classPlace').value.trim();
  if (editingClassId) {
    const c = timetable.find((x) => x.id === editingClassId);
    if (c) {
      c.name = name;
      c.day = day;
      c.start = start;
      c.end = end;
      c.place = place;
      c.color = selectedClassColor;
    }
  } else {
    timetable.push({ id: uid(), day, start, end, name, place, color: selectedClassColor });
  }
  saveTimetable();
  closeClassModal();
  renderTimetable();
  toast('Clase guardada');
});

$('#deleteClass').addEventListener('click', () => {
  if (!editingClassId) return;
  if (!confirm('¿Eliminar esta clase?')) return;
  timetable = timetable.filter((x) => x.id !== editingClassId);
  saveTimetable();
  closeClassModal();
  renderTimetable();
  toast('Clase eliminada');
});
