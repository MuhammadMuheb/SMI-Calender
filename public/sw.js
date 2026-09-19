const CACHE_VERSION = 'v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip manifest.json - let browser handle it
  if (event.request.url.includes('manifest.json')) {
    return;
  }

  // Network first, with fallback to cache (only GET requests)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache GET requests with successful responses
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(event.request, responseClone).catch(() => {
              // Silently ignore cache errors
            });
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache on network error
        return caches.match(event.request) || new Response('Offline', { status: 503 });
      })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SMI Calendar', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
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
