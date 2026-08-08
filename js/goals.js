/* ============================================================
   goals.js - Metas vinculadas a hábitos
   Cada meta se consigue con constancia al completar el hábito
   asociado: por días totales o por racha consecutiva.
   ============================================================ */

function goalHabit(g) {
  return habits.find((h) => h.id === g.habitId) || null;
}

function goalProgress(g) {
  if (g.type === 'streak') {
    return { value: getStreak(g.habitId), best: getBestStreak(g.habitId) };
  }
  const checks = habitChecks[g.habitId] || {};
  const total = Object.keys(checks).filter((k) => checks[k]).length;
  return { value: total, best: null };
}

/* Marca las metas logradas y celebra cuando una se cumple */
function checkGoals() {
  let became = 0;
  goals.forEach((g) => {
    const { value } = goalProgress(g);
    if (!g.achieved && g.target > 0 && value >= g.target) {
      g.achieved = true;
      became++;
    }
  });
  if (became) {
    saveGoals();
    burstConfetti();
    toast(became === 1 ? '¡Meta lograda! 🎉' : `¡${became} metas logradas! 🎉`);
  }
  if ($('#tab-goals').classList.contains('active')) renderGoals();
}

function renderGoals() {
  const list = $('#goalList');
  const empty = $('#goalsEmpty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', goals.length > 0);
  if (!goals.length) {
    empty.textContent = 'Aún no tienes metas. Añade una y vincúlala a un hábito para lograrla con constancia.';
    return;
  }

  const sorted = [...goals].sort((a, b) => (a.achieved === b.achieved ? 0 : a.achieved ? 1 : -1));

  sorted.forEach((g) => {
    const h = goalHabit(g);
    const { value, best } = goalProgress(g);
    const target = g.target;
    const done = !!g.achieved;
    const pct = done ? 100 : Math.min(100, Math.round((value / target) * 100));

    const card = document.createElement('div');
    card.className = 'goal-card' + (done ? ' done' : '');

    const color = document.createElement('span');
    color.className = 'goal-color';
    color.style.background = (h && h.color) || 'var(--primary)';

    const info = document.createElement('div');
    info.className = 'goal-info';
    info.append(Object.assign(document.createElement('h3'), { textContent: g.name }));
    info.append(Object.assign(document.createElement('span'), {
      className: 'goal-habit',
      textContent: h ? `Hábito: ${h.name}` : 'Hábito eliminado'
    }));
    info.append(Object.assign(document.createElement('span'), {
      className: 'goal-sub',
      textContent: g.type === 'streak' ? 'Racha consecutiva' : 'Días totales'
    }));

    const prog = document.createElement('div');
    prog.className = 'goal-progress';
    const label = document.createElement('div');
    label.className = 'goal-progress-label';
    label.append(
      Object.assign(document.createElement('span'), { textContent: `${value} ${value === 1 ? 'día' : 'días'}` }),
      Object.assign(document.createElement('span'), { textContent: `Meta: ${target} ${target === 1 ? 'día' : 'días'}` })
    );
    const bar = document.createElement('div');
    bar.className = 'goal-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'goal-progress-fill' + (done ? ' done' : '');
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    prog.append(label, bar);
    const chartWrap = document.createElement('div');
    chartWrap.className = 'goal-chart-wrap';
    const canvas = document.createElement('canvas');
    chartWrap.appendChild(canvas);
    prog.append(chartWrap);
    if (g.type === 'streak') {
      prog.append(Object.assign(document.createElement('span'), {
        className: 'goal-sub',
        textContent: best > 0 ? `Mejor racha: ${best} ${best === 1 ? 'día' : 'días'}` : 'Aún sin racha'
      }));
    }

    const badge = Object.assign(document.createElement('span'), {
      className: 'goal-badge' + (done ? '' : ' hidden'),
      textContent: '🎉 Lograda'
    });

    const actions = document.createElement('div');
    actions.className = 'goal-actions';
    const edit = Object.assign(document.createElement('button'), { className: 'edit-btn', textContent: 'Editar' });
    edit.addEventListener('click', () => openGoalModal(g.id));
    const del = Object.assign(document.createElement('button'), { className: 'delete-btn', textContent: 'Eliminar' });
    del.addEventListener('click', () => {
      if (!confirm(`¿Eliminar la meta "${g.name}"?`)) return;
      goals = goals.filter((x) => x.id !== g.id);
      saveGoals();
      renderGoals();
      toast('Meta eliminada');
    });
    actions.append(edit, del);

    card.append(color, info, prog, badge, actions);
    list.appendChild(card);
    drawGoalChart(canvas, g);
  });
}

/* Dibuja el gráfico de progreso de una meta: línea acumulativa que
   avanza cada día en que se completó el hábito, con la meta como
   línea de referencia. */
function drawGoalChart(canvas, g) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  const days = Math.min(30, Math.max(14, g.target));
  const keys = lastNDays(days);
  const checks = habitChecks[g.habitId] || {};
  let cum = 0;
  const cums = keys.map((k) => {
    if (checks[k]) cum++;
    return cum;
  });
  const target = g.target;

  const padL = 8, padR = 8, padT = 16, padB = 16;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxY = Math.max(target, cum, 1);

  const muted = cssVar('--muted');
  const primary = cssVar('--primary');
  const success = cssVar('--success');

  const yFor = (v) => padT + plotH - (v / maxY) * plotH;
  const stepX = days > 1 ? plotW / (days - 1) : plotW;

  // Línea de la meta (referencia)
  const yT = yFor(target);
  ctx.strokeStyle = muted;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, yT);
  ctx.lineTo(w - padR, yT);
  ctx.stroke();
  ctx.setLineDash([]);

  // Área bajo la curva de progreso
  ctx.beginPath();
  ctx.moveTo(padL, yFor(0));
  cums.forEach((v, i) => ctx.lineTo(padL + stepX * i, yFor(v)));
  ctx.lineTo(padL + stepX * (days - 1), padT + plotH);
  ctx.lineTo(padL, padT + plotH);
  ctx.closePath();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = primary;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Línea de progreso acumulado
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  cums.forEach((v, i) => {
    const x = padL + stepX * i;
    const y = yFor(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Punto actual
  ctx.fillStyle = success;
  ctx.beginPath();
  ctx.arc(padL + stepX * (days - 1), yFor(cum), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Etiquetas del eje
  ctx.fillStyle = muted;
  ctx.font = '10px Segoe UI, Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Hace ' + days + ' días', padL, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText('Hoy', w - padR, h - 4);
}

/* ---------- Modal añadir/editar meta ---------- */
let editingGoalId = null;

function buildGoalHabitOptions() {
  const sel = $('#goalHabit');
  sel.innerHTML = '';
  sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Elegir hábito…' }));
  habits.forEach((h) => {
    sel.appendChild(Object.assign(document.createElement('option'), { value: h.id, textContent: h.name }));
  });
}

function openGoalModal(id) {
  editingGoalId = id || null;
  const g = editingGoalId ? goals.find((x) => x.id === editingGoalId) : null;
  $('#goalModalTitle').textContent = editingGoalId ? 'Editar meta' : 'Nueva meta';
  $('#saveGoal').textContent = editingGoalId ? 'Guardar cambios' : 'Guardar';
  buildGoalHabitOptions();
  $('#goalName').value = g ? g.name : '';
  $('#goalHabit').value = g ? g.habitId : '';
  $('#goalType').value = g ? g.type : 'total';
  $('#goalTarget').value = g ? g.target : 21;
  $('#deleteGoal').classList.toggle('hidden', !editingGoalId);
  $('#goalModal').classList.remove('hidden');
  $('#goalName').focus();
}

function closeGoalModal() {
  $('#goalModal').classList.add('hidden');
}

$('#addGoalBtn').addEventListener('click', () => openGoalModal());
$('#cancelGoal').addEventListener('click', closeGoalModal);
$('#goalModal').addEventListener('click', (e) => {
  if (e.target === $('#goalModal')) closeGoalModal();
});
$('#goalName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#saveGoal').click();
});

$('#saveGoal').addEventListener('click', () => {
  const name = $('#goalName').value.trim();
  if (!name) {
    toast('Escribe el nombre de la meta');
    return;
  }
  const habitId = $('#goalHabit').value;
  if (!habitId) {
    toast('Vincula la meta a un hábito');
    return;
  }
  const target = parseInt($('#goalTarget').value, 10);
  if (!target || target < 1) {
    toast('Indica una meta de días válida');
    return;
  }
  const type = $('#goalType').value;

  if (editingGoalId) {
    const g = goals.find((x) => x.id === editingGoalId);
    if (g) {
      g.name = name;
      g.habitId = habitId;
      g.type = type;
      g.target = target;
      g.achieved = false;
    }
  } else {
    goals.push({ id: uid(), name, habitId, type, target, achieved: false });
  }
  saveGoals();
  closeGoalModal();
  checkGoals();
  renderGoals();
  toast(editingGoalId ? 'Meta actualizada' : 'Meta creada');
});

$('#deleteGoal').addEventListener('click', () => {
  if (!editingGoalId) return;
  const g = goals.find((x) => x.id === editingGoalId);
  if (!g || !confirm(`¿Eliminar la meta "${g.name}"?`)) return;
  goals = goals.filter((x) => x.id !== editingGoalId);
  saveGoals();
  closeGoalModal();
  renderGoals();
  toast('Meta eliminada');
});
