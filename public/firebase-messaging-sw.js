// Firebase Cloud Messaging Service Worker
// This file handles background messages and notification display

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDRk6xK2NmbG20dgHqBgdyYTREnrcVl_iA",
  authDomain: "consulta-pps-uflo.firebaseapp.com",
  projectId: "consulta-pps-uflo",
  storageBucket: "consulta-pps-uflo.firebasestorage.app",
  messagingSenderId: "977860997987",
  appId: "1:977860997987:web:ffc7e7716cd5da02c9d956"
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'Nueva Notificación';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: payload.data?.tag || 'default',
    data: payload.data || {},
    requireInteraction: true,
    actions: payload.notification?.actions || []
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || 'https://pps-psico.github.io/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window client is already open, focus it
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
