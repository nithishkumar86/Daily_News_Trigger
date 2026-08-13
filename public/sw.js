/**
 * Service Worker — AI Digital Tamizha
 *
 * INSTALL-ONLY, MINIMAL OFFLINE STRATEGY.
 *
 * This site shows LIVE daily AI/investment/job news. Data is fetched from
 * Supabase through API routes under /api/*, including a ZERO-AUTH webhook
 * at /api/webhook (see CLAUDE.md — never add auth/interception there).
 *
 * Only the static app shell (HTML/CSS/JS/icons) is cached so the site can
 * open offline and show a graceful fallback. News data must NEVER be
 * cached and NEVER served stale — it must always come fresh from the
 * network. Do not "simplify" this file into a blanket cache-everything
 * handler; that would risk showing stale news as if it were current and
 * could interfere with the webhook.
 */

// Bump this version string to force cache invalidation on all existing
// installs (old caches are purged in the 'activate' handler below).
const CACHE_VERSION = 'ai-tamizha-v1';

// Small, safe static shell — enough to render an offline fallback.
const PRECACHE_URLS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Never intercept non-GET requests. This unconditionally protects
  // POST /api/webhook and POST /api/generate-content — the service
  // worker must not sit in front of writes or generation calls.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Never intercept /api/* requests, even GET ones (e.g. GET
  // /api/check-cleanup). API responses carry live news/webhook/cleanup
  // data that must always be fetched fresh — caching or serving any of
  // this from the cache would risk showing stale news as current.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Everything else (pages/static assets): network-first, so users
  // always get the freshest shell when online, with a cached fallback
  // only when the network is unavailable.
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Only cache successful, non-opaque 200 responses — never cache
        // error responses or opaque cross-origin responses.
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Last resort: cached shell page instead of a raw browser
          // error page while offline.
          return caches.match('/');
        })
      )
  );
});
