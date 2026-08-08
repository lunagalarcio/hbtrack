/* ============================================================
   auth.js - Inicio de sesión, registro y perfil (Supabase)
   ============================================================ */

let supabaseClient = null;

function isSupabaseConfigured() {
  return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase);
}

function initSupabase() {
  if (!isSupabaseConfigured()) return;
  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.supabaseClient = supabaseClient;
}

function setAuthMsg(msg, type) {
  const el = $('#authMsg');
  if (!msg) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.className = 'auth-msg ' + (type === 'err' ? 'err' : 'info');
}

function showAuthView() {
  $('#authView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
}

function showAppView() {
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  $('#userName').textContent = window.Session.displayName || 'Usuario';
  $('#userEmail').textContent = window.Session.email || '';
  $('#userAvatar').textContent = (window.Session.displayName || 'U').charAt(0).toUpperCase();
}

/* Guarda la info del usuario en la tabla de perfiles */
async function ensureProfile(user) {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('profiles').upsert({
      id: user.id,
      username: window.Session.displayName,
      email: user.email
    }, { onConflict: 'id' });
  } catch (e) {
    console.error('No se pudo guardar el perfil:', e);
  }
}

function onAuthed(user) {
  window.Session.userId = user.id;
  window.Session.email = user.email || '';
  window.Session.displayName =
    (user.user_metadata && user.user_metadata.username) ||
    (user.email || '').split('@')[0];
  showAppView();
  ensureProfile(user);
  if (window.initApp) window.initApp();
}

/* ---------- Alternar entre login y registro ---------- */
$('#goRegister').addEventListener('click', () => {
  setAuthMsg(null);
  $('#loginForm').classList.add('hidden');
  $('#registerForm').classList.remove('hidden');
});

$('#goLogin').addEventListener('click', () => {
  setAuthMsg(null);
  $('#registerForm').classList.add('hidden');
  $('#loginForm').classList.remove('hidden');
});

/* ---------- Iniciar sesión ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!supabaseClient) {
    setAuthMsg('Supabase no está configurado. Revisa config.js.', 'err');
    return;
  }
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  setAuthMsg('Iniciando sesión...', 'info');
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthMsg(error.message, 'err');
    return;
  }
  // El cambio de estado de sesión se encarga de mostrar la app
});

/* ---------- Registro ---------- */
$('#registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!supabaseClient) {
    setAuthMsg('Supabase no está configurado. Revisa config.js.', 'err');
    return;
  }
  const name = $('#regName').value.trim();
  const email = $('#regEmail').value.trim();
  const password = $('#regPassword').value;
  if (password.length < 6) {
    setAuthMsg('La contraseña debe tener al menos 6 caracteres.', 'err');
    return;
  }
  setAuthMsg('Creando cuenta...', 'info');
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { username: name } }
  });
  if (error) {
    setAuthMsg(error.message, 'err');
    return;
  }
  if (!data.session) {
    setAuthMsg('Revisa tu correo para confirmar la cuenta.', 'info');
  }
  // Si hay sesión, onAuthStateChange muestra la app automáticamente
});

/* ---------- Modo invitado (sin Supabase configurado) ---------- */
$('#guestBtn').addEventListener('click', () => {
  window.Session.userId = null;
  window.Session.displayName = 'Invitado';
  window.Session.email = '';
  showAppView();
  if (window.initApp) window.initApp();
});

/* ---------- Cerrar sesión ---------- */
$('#logoutBtn').addEventListener('click', async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  location.reload();
});

/* ---------- Arranque ---------- */
(async function boot() {
  if (window.SUPABASE_READY) await window.SUPABASE_READY;
  initSupabase();

  if (!isSupabaseConfigured()) {
    $('#supabaseNotice').classList.remove('hidden');
    $('#guestBtn').classList.remove('hidden');
    showAuthView();
    return;
  }

  $('#supabaseNotice').classList.add('hidden');
  $('#guestBtn').classList.add('hidden');

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) onAuthed(data.session.user);

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) onAuthed(session.user);
    else showAuthView();
  });
})();
