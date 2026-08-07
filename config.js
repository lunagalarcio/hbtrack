/* ============================================================
   config.js - Configuración de Supabase
   ============================================================
   1. Crea un proyecto en https://supabase.com
   2. Ve a Project Settings -> API (o Project Settings -> Data API)
   3. Copia tu Project URL y tu anon/public key aquí abajo.
   4. Ejecuta supabase.sql en tu proyecto (SQL Editor) para crear
      la tabla de perfiles y sus políticas de seguridad.
   ============================================================ */

window.SUPABASE_URL = '';
window.SUPABASE_ANON_KEY = '';

/* Sesión activa del usuario (la actualiza auth.js). */
window.Session = {
  userId: null,       // id del usuario (null = invitado)
  displayName: null,
  email: null
};
