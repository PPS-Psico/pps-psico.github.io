
// sw.js para relative base sin Firebase Cloud Messaging

const CACHE_NAME = 'mi-panel-academico-cache-v25';
const FILES_TO_CACHE = [
  './index.html',
  './manifest.json',
];

// Instala y precachea el shell mínimo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .catch((err) => {
        console.warn('[SW] Precarga parcial', err);
      })
  );
  self.skipWaiting();
});

// Activa y purga caches viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: Network-first con fallback a caché
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);

        if (networkResponse.status === 404 && (event.request.url.endsWith('.css') || event.request.url.endsWith('.js'))) {
          return new Response('', {
            status: 200,
            headers: { 'Content-Type': event.request.url.endsWith('.css') ? 'text/css' : 'application/javascript' }
          });
        }

        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, copy).catch(() => { });
        }
        return networkResponse;
      } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
        }

        return new Response(null, { status: 404, statusText: 'Not Found' });
      }
    })()
  );
});

// --- PUSH NOTIFICATIONS ---

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Mi Panel Académico';
  const options = {
    body: data.message || 'Tienes una nueva notificación.',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const url = event.notification.data?.url;
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url || '/');
      }
    })
  );
});
