import React from 'react';
console.log('%c ANTIGRAVITY CONTROL: main.tsx loaded ', 'background: #222; color: #bada55; font-size: 20px');
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
// @ts-ignore
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';

// Initialize Monitoring
import { initSentry } from './lib/sentry';
import { initGA4 } from './lib/analytics';
import { initWebVitals } from './lib/webVitals';

// --- REACT RESILIENCE PATCH ---
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
      staleTime: 1000 * 60 * 2, // 2 minutes - data remains "fresh" preventing immediate refetch
      gcTime: 1000 * 60 * 10,  // 10 minutes - keep unused data in cache before garbage collecting
    },
  },
});

const container = document.getElementById('root');

if (!container) {
  throw new Error("No se encontró el elemento root");
}

// --- SINGLETON PATTERN ---
// @ts-ignore
if (window.__REACT_ROOT_INSTANCE__) {
  console.log('Desmontando instancia previa (src/main)...');
  // @ts-ignore
  window.__REACT_ROOT_INSTANCE__.unmount();
}

// Limpieza visual extra por seguridad
if (container.hasChildNodes()) {
  container.innerHTML = '';
}

const root = createRoot(container);
// @ts-ignore
window.__REACT_ROOT_INSTANCE__ = root;

// Initialize monitoring services
initSentry();
initGA4();
initWebVitals();

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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // In dev, sw.js is served from /public
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('SW registrado:', registration.scope);
      })
      .catch(error => {
        console.log('SW falló:', error);
      });
  });
}
