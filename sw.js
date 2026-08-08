/* ============================================================
   sw.js - Service Worker de TrackMyHabits
   Caché de la app para funcionar offline e instalable (PWA).
   ============================================================ */

const CACHE = 'hbtrack-v18';

/* Núcleo de la app: obligatorio para instalar */
const CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/shared.js',
  './js/sync.js',
  './js/habit.js',
  './js/timer.js',
  './js/reminders.js',
  './js/week.js',
  './js/calendar.js',
  './js/timetable.js',
  './js/stats.js',
  './js/dashboard.js',
  './js/goals.js',
  './js/app.js',
  './js/auth.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) =>
        cache.addAll(CORE).then(() =>
          // Opcional: .env y la librería de Supabase (CDN). Si fallan
          // (por ejemplo, el servidor no sirve dotfiles) no rompen la
          // instalación: se cachearán en tiempo de ejecución.
          Promise.allSettled([
            cache.add('./.env'),
            cache.add('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')
          ])
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // La API de Supabase no se cachea (siempre red)
  if (url.hostname.includes('supabase.co')) return;

  // Navegación: red primero, caché como respaldo (offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Resto (JS, CSS, .env, iconos, CDN): caché primero, luego red
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
