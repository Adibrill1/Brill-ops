/**
 * Minimal service worker: enough to make Brill Ops installable and to show a
 * truthful offline page.
 *
 * Deliberately conservative — it never caches API or Supabase responses, because
 * a campaign dashboard showing stale statistics is worse than one that says it is
 * offline. Statistics are live by design.
 */
const CACHE = 'brill-ops-shell-v2';
const OFFLINE_URL = '/offline';
const SHELL = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

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
  // Never cache campaign pages or statistics. A failed navigation gets one
  // static explanation instead of a stale dashboard that looks current.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
