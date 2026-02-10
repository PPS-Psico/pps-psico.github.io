// ============================================================================
// Unified Service Worker: PWA Cache + Firebase Cloud Messaging
// This single service worker handles both offline caching and push notifications.
// ============================================================================

// --- Firebase SDK (for background messaging) ---
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDRk6xK2NmbG20dgHqBgdyYTREnrcVl_iA",
  authDomain: "consulta-pps-uflo.firebaseapp.com",
  projectId: "consulta-pps-uflo",
  storageBucket: "consulta-pps-uflo.firebasestorage.app",
  messagingSenderId: "977860997987",
  appId: "1:977860997987:web:ffc7e7716cd5da02c9d956",
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// --- PWA CACHING ---

const CACHE_NAME = "mi-panel-academico-cache-v30";
const FILES_TO_CACHE = ["./index.html", "./manifest.json"];

// Install and precache the minimal shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .catch((err) => {
        console.warn("[SW] Precarga parcial", err);
      })
  );
  self.skipWaiting();
});

// Activate and purge old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
      )
  );
  self.clients.claim();
});

// Network-first fetch strategy with cache fallback
self.addEventListener("fetch", (event) => {
  // Ignore non-GET and browser extension requests
  if (event.request.method !== "GET" || event.request.url.startsWith("chrome-extension://")) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);

        // Handle 404s for hashed assets (old versions after deploy)
        if (
          networkResponse.status === 404 &&
          (event.request.url.endsWith(".css") || event.request.url.endsWith(".js"))
        ) {
          return new Response("", {
            status: 200,
            headers: {
              "Content-Type": event.request.url.endsWith(".css")
                ? "text/css"
                : "application/javascript",
            },
          });
        }

        // Cache successful responses
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, copy).catch(() => {});
        }
        return networkResponse;
      } catch (err) {
        // Offline: try cache
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // For navigations, serve index as SPA fallback
        if (event.request.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }

        return new Response(null, { status: 404, statusText: "Not Found" });
      }
    })()
  );
});

// --- PUSH NOTIFICATIONS (Firebase Background Messages) ---
//
// We use onBackgroundMessage to intercept ALL background messages and show
// our own notification with the correct icon/badge. Since the Edge Function
// sends data-only payloads, Firebase will NOT auto-display a notification,
// and this handler is the ONLY place where notifications are created.
//
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);

  // Extract notification data from the data payload
  const data = payload.data || {};

  // Support multiple key names to avoid conflicts and ensure backward compatibility
  const title = data.content_title || data.title || "Mi Panel Academico";
  const body = data.content_body || data.body || data.message || "Nueva notificación";

  const options = {
    body: body,
    icon: "/icons/icon-192x192.png", // Absolute path
    badge: "/icons/icon-notification.png", // Absolute path
    data: { url: data.url || "https://pps-psico.github.io/" },
    tag: "pps-notification",
    renotify: true,
    requireInteraction: true,
  };

  return self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification click received", event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || "https://pps-psico.github.io/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window client is already open, focus it
      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
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
