import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { testSupabaseConnection } from "./constants";
import { AuthProvider } from "./contexts/AuthContext";

console.log(
  "%c ANTIGRAVITY CONTROL: main.tsx loaded ",
  "background: #222; color: #bada55; font-size: 20px"
);

// Run Supabase connection test on load
testSupabaseConnection().then(async (result) => {
  const message = result.success
    ? `%c✅ Supabase Connection: OK (Status ${result.status}) - background: #1a7f37; color: white; padding: 10px;`
    : `%c❌ Supabase Connection: FAILED (Status ${result.status}) - background: #d32f2f; color: white; padding: 10px;`;

  console.log(message);

  // Detailed diagnostics - Only in development
  if (import.meta.env.DEV) {
    console.log("=== DETAILED SUPABASE DIAGNOSTICS ===");
    console.log("1. Checking Supabase endpoint health...");

    if (result.success) {
      try {
        const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("./constants/configConstants");
        console.log("2. Endpoint URL:", SUPABASE_URL);
        console.log("3. API Key (first 30 chars):", SUPABASE_ANON_KEY.substring(0, 30));

        // Test with edge function
        const rpcResponse = await fetch(`${SUPABASE_URL}/functions/v1/health-check`, {
          method: "GET",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        });

        console.log("4. RPC Endpoint Health:", rpcResponse.status);

        // Test with public table (should be accessible with anon key)
        const tableResponse = await fetch(`${SUPABASE_URL}/rest/v1/app_config?select=*`, {
          method: "GET",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        });

        console.log("5. Public Table Access:", tableResponse.status);
        console.log("6. If this is 401, it may be RLS policies blocking access");
      } catch (e: any) {
        console.error("7. Diagnostic error:", e);
      }
    }

    console.log("===========================================");
  }
});

// @ts-ignore
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";

// --- REACT RESILIENCE PATCH ---
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (console) console.warn("[React Resilience] Suppressing removeChild error.");
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
      if (console) console.warn("[React Resilience] Suppressing insertBefore error.");
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

document.body.classList.add("notranslate");
document.body.setAttribute("translate", "no");

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

const container = document.getElementById("root");

if (!container) {
  throw new Error("No se encontró el elemento root");
}

// Limpiando visual extra por seguridad
if (container.hasChildNodes()) {
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
          console.log("🧹 Unregistering legacy service worker:", reg.active.scriptURL);
          await reg.unregister();
        }
      }

      // Register the unified service worker
      const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
      console.log("✅ Unified Service Worker registered:", registration.scope);
    } catch (error) {
      console.error("❌ Service Worker registration failed:", error);
    }
  });
}
