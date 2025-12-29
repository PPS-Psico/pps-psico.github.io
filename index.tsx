
import React from 'react';
import { createRoot } from 'react-dom/client';
// Ajustamos las rutas porque este archivo está en la raíz
import App from './src/App';
import { AuthProvider } from './src/contexts/AuthContext';
// @ts-ignore
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './src/index.css';

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
    },
  },
});

const container = document.getElementById('root');

if (!container) {
  throw new Error("No se encontró el elemento root");
}

// --- SINGLETON PATTERN ---
// Protege contra doble montaje si el entorno ejecuta tanto index.html como index.tsx
// @ts-ignore
if (window.__REACT_ROOT_INSTANCE__) {
    console.log('Desmontando instancia previa para evitar duplicados...');
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
