/* ============================================================
   board.js - Tablero tipo Padlet (enlaces y comentarios)
   Cada post: { id, type ('note'|'link'), title, url, text,
   color, ts }
   ============================================================ */

const BOARD_COLORS = [
  '#fde047', '#fdba74', '#fda4af', '#a5b4fc', '#86efac',
  '#5eead4', '#a7f3d0', '#fed7aa', '#fbcfe8', '#c4b5fd'
];

/* ---------- Modal ---------- */
let editingPostId = null;
let selectedPostType = 'note';
let selectedPostColor = BOARD_COLORS[0];

function buildPostColorPicker() {
  const picker = $('#postColorPicker');
  picker.innerHTML = '';
  BOARD_COLORS.forEach((c) => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'color-opt' + (c === selectedPostColor ? ' selected' : '');
    opt.style.background = c;
    opt.addEventListener('click', () => {
      selectedPostColor = c;
      buildPostColorPicker();
    });
    picker.appendChild(opt);
  });
}

function openPostModal(id) {
  editingPostId = id || null;
  const p = editingPostId ? boardPosts.find((x) => x.id === editingPostId) : null;
  selectedPostType = p ? p.type : 'note';
  selectedPostColor = p ? p.color : BOARD_COLORS[0];
  $('#postModalTitle').textContent = editingPostId ? 'Editar publicación' : 'Nueva publicación';
  $('#postTitle').value = p ? (p.title || '') : '';
  $('#postUrl').value = p ? (p.url || '') : '';
  $('#postText').value = p ? (p.text || '') : '';
  $('#deletePost').classList.toggle('hidden', !editingPostId);

  $$('#postTypePicker .day-opt').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === selectedPostType);
  });
  updatePostUrlVisibility();
  buildPostColorPicker();
  $('#postModal').classList.remove('hidden');
  $('#postTitle').focus();
}

function closePostModal() {
  $('#postModal').classList.add('hidden');
}

function updatePostUrlVisibility() {
  const row = $('#postUrlRow');
  if (row) row.classList.toggle('hidden', selectedPostType !== 'link');
}

/* ---------- Render ---------- */
function renderBoard() {
  const grid = $('#boardGrid');
  const empty = $('#boardEmpty');
  if (!grid) return;
  grid.innerHTML = '';
  empty.classList.toggle('hidden', boardPosts.length > 0);
  if (!boardPosts.length) {
    empty.textContent = 'Tu tablero está vacío. Añade enlaces o comentarios para tenerlos a mano.';
    return;
  }

  [...boardPosts].sort((a, b) => b.ts - a.ts).forEach((p) => {
    const card = document.createElement('div');
    card.className = 'board-post';
    card.style.setProperty('--post-color', p.color);

    const head = document.createElement('div');
    head.className = 'board-post-head';
    const badge = document.createElement('span');
    badge.className = 'board-post-type';
    badge.textContent = p.type === 'link' ? 'Enlace' : 'Nota';
    const date = document.createElement('span');
    date.className = 'board-post-date';
    date.textContent = fmtShort(dateKey(new Date(p.ts)));
    head.append(badge, date);

    const title = document.createElement('h3');
    title.className = 'board-post-title';
    title.textContent = p.title || (p.type === 'link' ? p.url : 'Sin título');

    const body = document.createElement('div');
    body.className = 'board-post-body';
    if (p.text) body.append(Object.assign(document.createElement('p'), { textContent: p.text }));

    const foot = document.createElement('div');
    foot.className = 'board-post-foot';
    const actions = document.createElement('div');
    actions.className = 'board-post-actions';
    const edit = Object.assign(document.createElement('button'), { className: 'edit-btn', textContent: 'Editar' });
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      openPostModal(p.id);
    });
    const del = Object.assign(document.createElement('button'), { className: 'delete-btn', textContent: 'Eliminar' });
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar "${p.title || 'esta publicación'}"?`)) return;
      boardPosts = boardPosts.filter((x) => x.id !== p.id);
      saveBoard();
      renderBoard();
      toast('Publicación eliminada');
    });
    actions.append(edit, del);

    if (p.type === 'link' && p.url) {
      const link = Object.assign(document.createElement('a'), {
        className: 'board-post-link',
        href: p.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        textContent: p.url
      });
      foot.appendChild(link);
    }
    foot.appendChild(actions);
    card.append(head, title, body, foot);
    grid.appendChild(card);
  });
}

/* ---------- Eventos ---------- */
$('#addPostBtn').addEventListener('click', () => openPostModal(null));

$('#postTypePicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.day-opt');
  if (!btn) return;
  selectedPostType = btn.dataset.type;
  $$('#postTypePicker .day-opt').forEach((b) => b.classList.toggle('active', b === btn));
  updatePostUrlVisibility();
});

$('#savePost').addEventListener('click', () => {
  const title = $('#postTitle').value.trim();
  const url = $('#postUrl').value.trim();
  const text = $('#postText').value.trim();
  if (!title && !url && !text) {
    toast('Escribe al menos un título, enlace o comentario');
    return;
  }
  if (selectedPostType === 'link' && url && !/^https?:\/\//i.test(url)) {
    toast('El enlace debe empezar con http:// o https://');
    return;
  }
  if (editingPostId) {
    const p = boardPosts.find((x) => x.id === editingPostId);
    if (p) {
      p.type = selectedPostType;
      p.title = title;
      p.url = url;
      p.text = text;
      p.color = selectedPostColor;
    }
  } else {
    boardPosts.push({
      id: uid(),
      type: selectedPostType,
      title,
      url,
      text,
      color: selectedPostColor,
      ts: Date.now()
    });
  }
  saveBoard();
  closePostModal();
  renderBoard();
  toast(editingPostId ? 'Publicación actualizada' : 'Publicación añadida');
});

$('#cancelPost').addEventListener('click', closePostModal);
$('#postModal').addEventListener('click', (e) => {
  if (e.target === $('#postModal')) closePostModal();
});
$('#postTitle').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#savePost').click();
});

$('#deletePost').addEventListener('click', () => {
  if (!editingPostId) return;
  const p = boardPosts.find((x) => x.id === editingPostId);
  if (!p || !confirm(`¿Eliminar "${p.title || 'esta publicación'}"?`)) return;
  boardPosts = boardPosts.filter((x) => x.id !== editingPostId);
  saveBoard();
  closePostModal();
  renderBoard();
  toast('Publicación eliminada');
});
