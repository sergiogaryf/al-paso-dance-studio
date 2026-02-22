/* ============================================
   ESTACION SALSERA - Service Worker
   Cache-first para assets, network-first para API
   ============================================ */

const CACHE_NAME = 'al-paso-dance-v3';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
  '/',
  '/app.html',
  '/login.html',
  '/offline.html',
  '/css/shared.css',
  '/css/app.css',
  '/css/login.css',
  '/marzo_clases_2026.ics',
  '/img/Logo.png',
  '/img/favicon.svg',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap'
];

// Instalación: cachear assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar caches anteriores
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first para assets, network-first para Firebase
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear requests de API ni Firebase/Firestore
  if (url.pathname.startsWith('/api/') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('firestore.googleapis.com')) {
    return;
  }

  // Para navegación (HTML): network-first con fallback offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_URL));
        })
    );
    return;
  }

  // Para assets estáticos: cache-first
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok && url.protocol === 'https:') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
      .catch(() => {
        if (request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#1a1a1a" width="200" height="200"/><text fill="#555" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14">Sin conexión</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      })
  );
});
