// Bump to drop every older cache on the next visit.
const CACHE_VERSION = 'smi-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheableAsset(response) {
  // Never store an HTML page under a script/style URL (that's what a missing
  // file used to return, and it broke the app until the cache was cleared).
  const type = response.headers.get('Content-Type') || '';
  return response.ok && response.type === 'basic' && !type.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only handle this app's own files; Firebase, APIs and push go straight to the network.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/manifest.json') return;

  // Hashed build files never change: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (isCacheableAsset(response)) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }))
    );
    return;
  }

  // Pages: always the latest from the network; the last copy only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/', copy)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match('/').then((cached) => cached || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })))
    );
    return;
  }

  // Everything else (icons etc.): network, falling back to cache when offline.
  event.respondWith(
    fetch(request).then((response) => {
      if (isCacheableAsset(response)) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || new Response('', { status: 504 })))
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SMI Calendar', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'smi',
      requireInteraction: true,
      actions: [
        { action: 'confirm', title: '✓ Confirm' },
        { action: 'reject', title: '✗ Reject' },
      ],
      data: data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: event.action || 'open',
            data: event.notification.data,
          });
          return;
        }
      }
      return clients.openWindow('/');
    })
  );
});
