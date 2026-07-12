import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { testSupabaseConnection } from "./constants";
import { AuthProvider } from "./contexts/AuthContext";
import { logger } from "./utils/logger";

// Diagnóstico de conexión a Supabase: solo en desarrollo.
// En producción no tiene sentido hacer un fetch extra ni volcar datos a la consola.
if (import.meta.env.DEV) {
  logger.info("ANTIGRAVITY CONTROL: main.tsx loaded");

  testSupabaseConnection().then(async (result) => {
    if (result.success) {
      logger.info(`Supabase Connection: OK (Status ${result.status})`);
    } else {
      logger.error(`Supabase Connection: FAILED (Status ${result.status})`);
    }

    logger.debug("=== DETAILED SUPABASE DIAGNOSTICS ===");

    if (result.success) {
      try {
        const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("./constants/configConstants");
        logger.debug("Endpoint URL", SUPABASE_URL);

        // Test with edge function
        const rpcResponse = await fetch(`${SUPABASE_URL}/functions/v1/health-check`, {
          method: "GET",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        });
        logger.debug("RPC Endpoint Health", rpcResponse.status);

        // Test with public table (should be accessible with anon key)
        const tableResponse = await fetch(`${SUPABASE_URL}/rest/v1/app_config?select=*`, {
          method: "GET",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        });
        logger.debug("Public Table Access", tableResponse.status);
      } catch (e) {
        logger.error("Diagnostic error", e);
      }
    }
  });
}

// @ts-ignore
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./styles/orientation-colors.css";
import "./index.css";

// --- REACT RESILIENCE PATCH ---
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (console) logger.warn("[React Resilience] Suppressing removeChild error.");
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) logger.warn("[React Resilience] Suppressing insertBefore error.");
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

document.body.classList.add("notranslate");
document.body.setAttribute("translate", "no");

// Solicitar persistencia de almacenamiento en navegadores móviles (evita purga por inactividad en iOS)
if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
  navigator.storage
    .persisted()
    .then((persisted) => {
      if (!persisted) {
        navigator.storage
          .persist()
          .then((granted) => {
            if (granted) {
              logger.info("[Storage] Persistencia de almacenamiento concedida");
            } else {
              logger.warn("[Storage] Persistencia de almacenamiento denegada");
            }
          })
          .catch((e) => logger.warn("[Storage] Error solicitando persistencia:", e));
      } else {
        logger.info("[Storage] El almacenamiento ya es persistente");
      }
    })
    .catch((e) => logger.warn("[Storage] Error verificando persistencia:", e));
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes - data remains "fresh" preventing immediate refetch
      gcTime: 1000 * 60 * 10, // 10 minutes - keep unused data in cache before garbage collecting
    },
  },
});

console.log("[React] main.tsx inicializado. Montando aplicación...");
console.log("[React] Estado de __PPS_ENTRY_SHELL__:", !!(window as any).__PPS_ENTRY_SHELL__);

const container = document.getElementById("root");

if (!container) {
  throw new Error("No se encontró el elemento root");
}

// Limpiando visual extra por seguridad. La entry shell del panel se mantiene hasta
// que React monte, para que la transicion desde Campus no caiga en pantalla vacia.
if (container.hasChildNodes() && !(window as any).__PPS_ENTRY_SHELL__) {
  container.innerHTML = "";
}

const root = createRoot(container);
// @ts-ignore
window.__REACT_ROOT_INSTANCE__ = root;

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);

// Register the unified Service Worker (handles both PWA caching and FCM push)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Unregister any legacy sw.js service workers to prevent duplicate notifications
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        // If there's a registration that is NOT for firebase-messaging-sw.js, unregister it
        if (reg.active && !reg.active.scriptURL.includes("firebase-messaging-sw.js")) {
          logger.info("Unregistering legacy service worker", reg.active.scriptURL);
          await reg.unregister();
        }
      }

      // Register the unified service worker
      const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
      logger.info("Unified Service Worker registered", registration.scope);
    } catch (error) {
      logger.error("Service Worker registration failed", error);
    }
  });
}
