/* ============================================================
   config.js - Configuración de Supabase
   ============================================================
   Las credenciales se leen del archivo .env (NO se sube a git).

   Pasos:
   1. Crea un proyecto en https://supabase.com
   2. Copia tu Project URL y tu anon key al archivo .env
      (usa .env.example como plantilla).
   3. Ejecuta supabase.sql en tu proyecto (SQL Editor).

   Nota: debes servir la app con un servidor local (ej: npx serve
   o python -m http.server), porque los navegadores no permiten
   leer .env cuando abres index.html directamente (file://).
   ============================================================ */

window.SUPABASE_URL = '';
window.SUPABASE_ANON_KEY = '';

/* Sesión activa del usuario (la actualiza auth.js). */
window.Session = {
  userId: null,       // id del usuario (null = invitado)
  displayName: null,
  email: null
};

function parseEnv(text) {
  const map = {};
  text.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && m[2][0] !== '#') {
      map[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  });
  return map;
}

/* Promesa que se resuelve cuando las credenciales estén cargadas.
   auth.js espera por ella antes de crear el cliente de Supabase. */
window.SUPABASE_READY = (async function () {
  try {
    const res = await fetch('.env');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const env = parseEnv(await res.text());
    window.SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
    window.SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.warn('Faltan credenciales en .env. La app usará el modo invitado.');
    }
  } catch (e) {
    console.warn('No se pudo leer .env (' + e.message + '). La app usará el modo invitado.');
  }
})();
