
// sw.js para relative base con Firebase Cloud Messaging

// Firebase Cloud Messaging setup
let messaging;
let app;

try {
  importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

  const firebaseConfig = {
    apiKey: 'AIzaSyDRk6xK2NmbG20dgHqBgdyYTREnrcVl_iA',
    authDomain: 'consulta-pps-uflo.firebaseapp.com',
    projectId: 'consulta-pps-uflo',
    storageBucket: 'consulta-pps-uflo.firebasestorage.app',
    messagingSenderId: '977860997987',
    appId: '1:977860997987:web:ffc7e7716cd5da02c9d956'
  };

  app = firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  
  console.log('✅ Firebase initialized in service worker');
} catch (err) {
  console.error('❌ Firebase initialization error in SW:', err);
}

const CACHE_NAME = 'mi-panel-academico-cache-v21';
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
        // Precarga parcial: no fallar la instalación por un asset faltante
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
  // Ignora métodos no-GET y extensiones del navegador
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Intento de red primero
        const networkResponse = await fetch(event.request);

        // Si es un 404 para un archivo CSS o JS (probablemente una versión antigua hasheada),
        // devolvemos una respuesta vacía válida para no ensuciar la consola.
        if (networkResponse.status === 404 && (event.request.url.endsWith('.css') || event.request.url.endsWith('.js'))) {
          return new Response('', {
            status: 200,
            headers: { 'Content-Type': event.request.url.endsWith('.css') ? 'text/css' : 'application/javascript' }
          });
        }

        // Cachea copia si es OK
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          // No bloquea la respuesta
          cache.put(event.request, copy).catch(() => { });
        }
        return networkResponse;
      } catch (err) {
        // Sin red: intenta caché
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Para navegaciones, sirve el index como fallback de SPA
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
        }

        // Último recurso: 404 vacía
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

// --- FIREBASE CLOUD MESSAGING ---
if (messaging) {
  messaging.setBackgroundMessageHandler((payload) => {
    console.log('Received Firebase background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'Notificación';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-72x72.png',
      data: payload.data || {},
      tag: 'fcm-notification',
      requireInteraction: true
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  messaging.onNotification((notification) => {
    console.log('Received Firebase notification:', notification);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const url = event.notification.data.url;
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
