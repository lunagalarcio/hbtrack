/* ============================================================
   stats.js - Gráficos y estadísticas
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

let statsRange = 7;

/* Mejor racha histórica de un hábito (días consecutivos en que aplica) */
function getBestStreak(habitId) {
  const habit = habits.find((h) => h.id === habitId);
  const checks = habitChecks[habitId] || {};
  const keys = Object.keys(checks).filter((k) => checks[k]).sort();
  if (!keys.length) return 0;
  let best = 0, run = 0;
  let d = keyToDate(keys[0]);
  const last = keyToDate(keys[keys.length - 1]);
  while (d <= last) {
    const key = dateKey(d);
    if (habitIsDue(habit, key)) {
      run = checks[key] ? run + 1 : 0;
      best = Math.max(best, run);
    }
    d = shiftDays(d, 1);
  }
  return best;
}

/* Tarjetas de resumen: racha actual, mejor racha, total estudiado */
function renderSummary() {
  const wrap = $('#statsSummary');
  if (!wrap) return;
  wrap.innerHTML = '';

  let cur = 0, curName = '';
  let best = 0, bestName = '';
  habits.forEach((h) => {
    const s = getStreak(h.id);
    if (s > cur) { cur = s; curName = h.name; }
    const b = getBestStreak(h.id);
    if (b > best) { best = b; bestName = h.name; }
  });
  const totalMin = studyLog.filter((s) => s.kind === 'study')
    .reduce((sum, s) => sum + s.minutes, 0);

  const dayWord = (n) => (n === 1 ? 'día' : 'días');
  const cards = [
    { value: cur > 0 ? `${cur} ${dayWord(cur)}` : '—', label: 'Racha actual', sub: curName || 'Sin racha activa' },
    { value: best > 0 ? `${best} ${dayWord(best)}` : '—', label: 'Mejor racha', sub: bestName || 'Sin registros' },
    { value: formatDuration(totalMin), label: 'Total estudiado', sub: 'sesiones de estudio' }
  ];

  cards.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'stat';
    el.append(
      Object.assign(document.createElement('strong'), { textContent: c.value }),
      Object.assign(document.createElement('span'), { textContent: c.label }),
      Object.assign(document.createElement('span'), { className: 'stat-sub', textContent: c.sub })
    );
    wrap.appendChild(el);
  });
}

/* ---------- Heatmap mensual ---------- */
let heatY = new Date().getFullYear();
let heatM = new Date().getMonth();

function renderHeatmap() {
  const grid = $('#heatGrid');
  const empty = $('#heatEmpty');
  if (!grid || !empty) return;

  $('#heatTitle').textContent = `Intensidad de hábitos · ${MONTH_NAMES[heatM]} ${heatY}`;

  const noHabits = habits.length === 0;
  empty.classList.toggle('hidden', !noHabits);
  grid.classList.toggle('hidden', noHabits);
  $('#heatLegend').classList.toggle('hidden', noHabits);
  if (noHabits) return;

  const totalHabits = habits.length;
  const today = dateKey();
  grid.innerHTML = '';

  const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  weekdays.forEach((wd) => {
    const hd = document.createElement('div');
    hd.className = 'cal-weekday';
    hd.textContent = wd;
    grid.appendChild(hd);
  });

  const first = new Date(heatY, heatM, 1);
  const startDate = shiftDays(first, -((first.getDay() + 6) % 7));

  for (let i = 0; i < 42; i++) {
    const d = shiftDays(startDate, i);
    const key = dateKey(d);
    const inMonth = d.getMonth() === heatM;
    const isToday = key === today;
    const due = habits.filter((h) => habitIsDue(h, key));
    const done = due.filter((h) => habitChecks[h.id] && habitChecks[h.id][key]).length;
    const level = due.length ? Math.round((done / due.length) * 4) : 0;

    const cell = document.createElement('div');
    cell.className = 'heat-cell' +
      (inMonth ? '' : ' out') +
      (isToday ? ' today' : '') +
      (level > 0 ? ` lvl${level}` : '');
    cell.textContent = d.getDate();
    if (inMonth) {
      cell.title = `${fmtShort(key)}: ${done}/${due.length} hábito${due.length === 1 ? '' : 's'} completado${due.length === 1 ? '' : 's'}`;
    }
    grid.appendChild(cell);
  }
}

function buildHeatLegend() {
  const legend = $('#heatLegend');
  if (!legend) return;
  legend.innerHTML = '';
  legend.appendChild(Object.assign(document.createElement('span'), { textContent: 'Menos' }));
  for (let l = 0; l <= 4; l++) {
    const s = document.createElement('span');
    s.className = 'heat-swatch s' + l;
    legend.appendChild(s);
  }
  legend.appendChild(Object.assign(document.createElement('span'), { textContent: 'Más' }));
}

function renderStats() {
  const n = statsRange;
  const days = lastNDays(n);
  const labels = days.map((k) => {
    const d = keyToDate(k);
    return d.toLocaleDateString('es-ES', { weekday: 'short' });
  });

  renderSummary();
  renderHeatmap();
  buildHeatLegend();
  $('#statsRange').value = String(n);
  $('#studyTitle').textContent = `Minutos de estudio (últimos ${n} días)`;
  $('#rateTitle').textContent = `Porcentaje de cumplimiento por hábito (${n} días)`;

  // 1) minutos de estudio
  const studyByDay = days.map((k) =>
    studyLog.filter((s) => s.date === k && s.kind === 'study')
      .reduce((sum, s) => sum + s.minutes, 0)
  );
  const studyCtx = $('#chartStudy');
  const hasStudy = studyByDay.some((v) => v > 0);
  $('#noStudyData').classList.toggle('hidden', hasStudy);
  $('#chartStudy').classList.toggle('hidden', !hasStudy);
  drawBarChart(studyCtx, labels, studyByDay, cssVar('--primary'));

  // 2) hábitos completados por día (solo los que aplican ese día)
  const habitsByDay = days.map((k) =>
    habits.filter((h) => habitIsDue(h, k) && habitChecks[h.id] && habitChecks[h.id][k]).length
  );
  const hasHabits = habits.length > 0 && habitsByDay.some((v) => v > 0);
  $('#noHabitData').classList.toggle('hidden', hasHabits);
  $('#chartHabitsDay').classList.toggle('hidden', !hasHabits);
  drawBarChart($('#chartHabitsDay'), labels, habitsByDay, cssVar('--success'), { hideEmpty: !hasHabits });

  // 3) porcentaje por hábito (sobre los días en que aplica)
  const rows = habits.map((h) => {
    const due = days.filter((k) => habitIsDue(h, k));
    const done = due.filter((k) => habitChecks[h.id] && habitChecks[h.id][k]).length;
    return { name: h.name, color: h.color, value: due.length ? Math.round((done / due.length) * 100) : 0 };
  });
  drawHBarChart($('#chartHabitRate'), rows);
}

$('#statsRange').addEventListener('change', (e) => {
  statsRange = parseInt(e.target.value, 10) || 7;
  store.set('statsRange', statsRange);
  renderStats();
});

$('#prevHeat').addEventListener('click', () => {
  heatM--;
  if (heatM < 0) { heatM = 11; heatY--; }
  renderHeatmap();
});

$('#nextHeat').addEventListener('click', () => {
  heatM++;
  if (heatM > 11) { heatM = 0; heatY++; }
  renderHeatmap();
});

$('#heatToday').addEventListener('click', () => {
  const now = new Date();
  heatY = now.getFullYear();
  heatM = now.getMonth();
  renderHeatmap();
});
