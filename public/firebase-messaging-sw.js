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

const CACHE_NAME = "mi-panel-academico-cache-v40";
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

// Network-first fetch strategy with cache-first for hashed assets to optimize View Transitions
self.addEventListener("fetch", (event) => {
  // Ignore non-GET and browser extension requests
  if (event.request.method !== "GET" || event.request.url.startsWith("chrome-extension://")) {
    return;
  }

  event.respondWith(
    (async () => {
      const url = new URL(event.request.url);
      const isHashedAsset =
        url.pathname.includes("/assets/") &&
        (url.pathname.endsWith(".js") ||
          url.pathname.endsWith(".css") ||
          url.pathname.endsWith(".woff2") ||
          url.pathname.endsWith(".png") ||
          url.pathname.endsWith(".jpg") ||
          url.pathname.endsWith(".svg"));

      // Para los assets hasheados e inmutables (ej: CSS, JS, Fuentes), usamos Cache-First:
      // Si están en la caché del Service Worker, los servimos en 0ms. Esto es crítico para
      // que las View Transitions no se cancelen por lentitud de red.
      if (isHashedAsset) {
        const cached = await caches.match(event.request);
        if (cached) {
          console.log("[SW Cache-First] Servido desde caché instantánea (0ms):", url.pathname.split("/").pop());
          return cached;
        }
      }

      // El documento HTML (navegaciones) se revalida SIEMPRE contra la red sin
      // usar la caché HTTP del navegador. Así un index.html viejo no puede
      // seguir apuntando a bundles JS/CSS hash viejos tras un deploy.
      const isNavigation =
        event.request.mode === "navigate" ||
        url.pathname.endsWith("/") ||
        url.pathname.endsWith("index.html");

      try {
        if (isNavigation) {
          console.log("[SW Navigation] Buscando en red:", url.pathname);
        } else {
          console.log("[SW Network-First] Descargando de red:", url.pathname.split("/").pop());
        }
        const networkResponse = await fetch(
          event.request,
          isNavigation ? { cache: "no-store" } : undefined
        );

        // Handle 404s for hashed assets (old versions after deploy)
        if (
          networkResponse.status === 404 &&
          (url.pathname.endsWith(".css") || url.pathname.endsWith(".js"))
        ) {
          return new Response("", {
            status: 200,
            headers: {
              "Content-Type": url.pathname.endsWith(".css")
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
  const type = data.content_type || data.type || "message";

  // Select icon based on type
  let icon = "/icons/icon-192x192.png"; // Default fallback

  // Try to use specific icons if available (user must upload them)
  // Otherwise fall back to generic app icon, but user requested specific icons.
  if (type === "selection") icon = "/icons/icon-celebration.png";
  else if (type === "announcement") icon = "/icons/icon-megaphone.png";
  else if (type === "compromiso") icon = "/icons/icon-bell-outline.png";
  else if (type === "message" || type === "test") icon = "/icons/icon-email.png";

  const options = {
    body: body,
    icon: icon, // Dynamic context icon
    badge: "/icons/icon-badge-v4.png", // V4: Larger bars for better visibility
    data: { url: data.url || "https://pps-psico.github.io/" },
    // Tag por notificación: permite que distintos tipos (p. ej. selección y
    // consentimiento) coexistan en vez de reemplazarse entre sí.
    tag: data.tag || "pps-notification",
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
