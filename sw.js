/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Service Worker
   File: sw.js  Version: 2.0
   Handles: Offline caching, background sync
═══════════════════════════════════════════════════════════ */

const CACHE_NAME    = 'scholar-analytics-v2';
const API_BASE      = 'https://scholar-analytics-api.onrender.com';



/* All static assets to cache on install.
 * NOTE: JS files are intentionally excluded — they are always
 * fetched fresh from the network (see FETCH handler below), so
 * a stale service-worker cache can never serve outdated app logic. */
const STATIC_ASSETS = [
  '/pages/login.html',
  '/pages/dashboard.html',
  '/pages/students.html',
  '/pages/classes.html',
  '/pages/subjects.html',
  '/pages/exams.html',
  '/pages/marks.html',
  '/pages/results.html',
  '/pages/reports.html',
  '/pages/analytics.html',
  '/pages/settings.html',
  '/pages/users.html',
  '/pages/sa-login.html',
  '/pages/sa-dashboard.html',
  '/pages/sa-schools.html',
  '/pages/sa-users.html',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/dash-page.css',
  '/css/students.css',
  '/css/marks.css',
  '/css/results.css',
  '/css/reports.css',
  '/css/analytics.css',
  '/css/settings.css',
  '/css/sa.css',
];

/* ── INSTALL — cache all static assets ──────────────────── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache:'reload' })))
        .catch(err => console.warn('[SW] Some assets failed to cache:', err));
    })
  );
  self.skipWaiting();
});

/* ── ACTIVATE — clean old caches ────────────────────────── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

/* ── FETCH — serve from cache when offline ──────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url         = new URL(request.url);

  /* Skip API calls — let them fail naturally when offline */
  if (url.origin === new URL(API_BASE).origin ||
      url.pathname.startsWith('/api/')) {
    return;
  }

  /* Skip non-GET requests */
  if (request.method !== 'GET') return;

  /*
   * JS files: ALWAYS network-only, never cache.
   * This must live in the fetch handler (not just STATIC_ASSETS)
   * because the cache-first logic below opportunistically caches
   * ANY successful GET response the first time it's seen — so a
   * JS file would still get stuck in the cache on first visit
   * even after being removed from the precache list.
   */
  if (url.pathname.startsWith('/js/')) {
    event.respondWith(fetch(request));
    return;
  }

  /* Cache-first strategy for static assets (HTML/CSS/etc.) */
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      /* Not in cache — fetch from network and cache it */
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          /* Completely offline — return offline page if HTML */
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/pages/dashboard.html');
          }
        });
    })
  );
});