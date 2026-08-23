import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { testSupabaseConnection } from "./constants";
import { AuthProvider } from "./contexts/AuthContext";
import { logger } from "./utils/logger";

const isVisualBaseline = import.meta.env.VITE_VISUAL_BASELINE === "true";

// Diagnóstico de conexión a Supabase: solo en desarrollo real.
// El baseline visual usa datos ficticios y no debe intentar conexiones externas.
if (import.meta.env.DEV && !isVisualBaseline) {
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
import "@fontsource/material-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { classifyDbError, isRetryable } from "./lib/dbError";
import "./index.css";
import "./styles/foundations.css";
import "./styles/orientation-colors.css";

// Las Devtools no forman parte del producto entregado. El import dinámico queda
// eliminado por Vite en producción y evita sumar su runtime al arranque real.
const ReactQueryDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import("@tanstack/react-query-devtools").then((module) => ({
        default: module.ReactQueryDevtools,
      }))
    )
  : null;

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
      // Reintentar solo lo que puede mejorar solo. Un "no tenés permisos" o una
      // sesión vencida no cambian por insistir: reintentarlos solo demora el
      // mensaje que la persona necesita ver.
      retry: (failureCount, error) => failureCount < 1 && isRetryable(error),
      // Con la sesión vencida NINGUNA query del panel puede responder, y de las
      // ~120 llamadas a `useQuery` sólo un puñado renderiza estado de error: el
      // resto mostraría listas vacías y la persona creería que sus datos
      // desaparecieron. En ese caso puntual conviene escalar al ErrorBoundary,
      // que dice qué pasó y ofrece recargar.
      //
      // Deliberadamente NO se escala nada más: un fallo de permisos en un solo
      // widget no justifica tumbar la página entera, y los errores de red se
      // reintentan solos.
      throwOnError: (error) => classifyDbError(error).kind === "session-expired",
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
      {ReactQueryDevtools && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </React.Suspense>
      )}
    </QueryClientProvider>
  </React.StrictMode>
);

// Register the unified Service Worker (handles both PWA caching and FCM push).
// Playwright blocks service workers deliberately to keep visual captures deterministic.
if (!isVisualBaseline && "serviceWorker" in navigator) {
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
