/* ============================================================
   build.js - Script de build para Vercel
   Inyecta las credenciales de Supabase (variables de entorno de
   Vercel) en js/config.js en tiempo de build, ya que Vercel no
   sirve el archivo .env (está en .gitignore).

   Variables de entorno esperadas (añadirlas en Vercel):
     VITE_SUPABASE_URL
     VITE_SUPABASE_ANON_KEY
   ============================================================ */

const fs = require('fs');

function readVar(names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  return '';
}

const url = readVar(['VITE_SUPABASE_URL', 'SUPABASE_URL']);
const anon = readVar(['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY']);

if (!url || !anon) {
  console.warn('Aviso: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no configuradas en Vercel. La app usará el modo invitado.');
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const file = 'js/config.js';
let src = fs.readFileSync(file, 'utf8');

src = src.replace(
  /(window\.SUPABASE_URL\s*=\s*')[^']*(';)/,
  `$1${esc(url)}$2`
);
src = src.replace(
  /(window\.SUPABASE_ANON_KEY\s*=\s*')[^']*(';)/,
  `$1${esc(anon)}$2`
);

fs.writeFileSync(file, src);
console.log('Credenciales de Supabase inyectadas en js/config.js');
