importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics-compat.js');

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const firebaseConfig = {
    apiKey: 'AIzaSyDRk6xK2NmbG20dgHqBgdyYTREnrcVl_iA',
    authDomain: 'consulta-pps-uflo.firebaseapp.com',
    projectId: 'consulta-pps-uflo',
    storageBucket: 'consulta-pps-uflo.firebasestorage.app',
    messagingSenderId: '977860997987',
    appId: '1:977860997987:web:ffc7e7716cd5da02c9d956'
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Handle background messages
onBackgroundMessage(messaging, (payload) => {
    console.log('Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'Notificación';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: payload.data,
        tag: 'fcm-notification',
        requireInteraction: true
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

console.log('✅ Firebase messaging service worker loaded');
