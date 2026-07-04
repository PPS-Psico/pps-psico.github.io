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
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
