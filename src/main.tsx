
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
// @ts-ignore
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';

// --- REACT RESILIENCE PATCH (GOOGLE TRANSLATE FIX) ---
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (console) console.warn('[React Resilience] Suppressing removeChild error.');
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) console.warn('[React Resilience] Suppressing insertBefore error.');
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

document.body.classList.add('notranslate');
document.body.setAttribute('translate', 'no');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const container = document.getElementById('root');

if (!container) {
  throw new Error("No se encontró el elemento root");
}

// --- SINGLETON ROOT PATTERN ---
// Previene que la aplicación se monte múltiples veces si el script se carga duplicado
// o durante actualizaciones de Hot Module Replacement (HMR).

// @ts-ignore - Propiedad custom para rastrear el root en window
if (window.__APP_MOUNTED__) {
  console.warn("⚠️ La aplicación ya estaba montada. Limpiando para remontaje...");
  // Si llegamos aquí, es probable que haya un remanente. Limpiamos el DOM.
  container.innerHTML = '';
}

// @ts-ignore
window.__APP_MOUNTED__ = true;

// Aseguramos limpieza visual antes de crear el root
if (container.hasChildNodes()) {
  container.innerHTML = '';
}

const root = createRoot(container);

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

// Service Worker
const meta = import.meta as any;
if (meta.env && meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usamos ruta relativa para que funcione bajo el subdirectorio de GitHub Pages
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('SW registrado:', registration.scope);
      })
      .catch(error => {
        console.log('SW falló:', error);
      });
  });
}
