import { useEffect, useState } from "react";

/**
 * Detecta viewport mobile (< breakpoint) vía matchMedia.
 * Lee `window.innerWidth` de forma síncrona en el primer render para evitar
 * un flash de layout, y se mantiene reactivo al cruzar el breakpoint.
 *
 * Se usa para montar SOLO el árbol que corresponde al viewport (en lugar de
 * ocultar ambos con `hidden`/`md:hidden`), evitando montar el dashboard del
 * estudiante por duplicado (desktop + mobile) a la vez.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    // Embebido en el campus ⇒ forzamos layout de escritorio (no mobile).
    try {
      if (window.self !== window.top) return false;
    } catch {
      return false; // cross-origin ⇒ embebidos ⇒ escritorio
    }
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    let embedded = false;
    try {
      embedded = window.self !== window.top;
    } catch {
      embedded = true; // cross-origin ⇒ embebidos
    }
    if (embedded) {
      setIsMobile(false);
      return;
    }

    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
