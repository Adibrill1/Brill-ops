/**
 * Minimal service worker: enough to make Brill Ops installable and to keep the
 * app shell available offline.
 *
 * Deliberately conservative — it never caches API or Supabase responses, because
 * a campaign dashboard showing stale statistics is worse than one that says it is
 * offline. Statistics are live by design.
 */
const CACHE = 'brill-ops-shell-v1';
const SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never serve stale data. Same-origin navigation only.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (request.mode === 'navigate') {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match('/'))),
  );
});
