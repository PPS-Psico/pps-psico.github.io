import { useRef } from "react";
import { logger } from "../utils/logger";

const isDev = import.meta.env?.DEV ?? false;

/**
 * Hook de diagnóstico (SOLO dev): cuenta cuántas veces renderiza un componente y,
 * si le pasás sus props/valores observados, loguea CUÁLES cambiaron desde el
 * render anterior. Es la forma rápida de cazar "re-render storms".
 *
 * Uso:
 *   const MiComponente = (props) => {
 *     useRenderTrace("MiComponente", { legajo: props.legajo, user });
 *     ...
 *   };
 *
 * Salida típica:
 *   🔁 [MiComponente] render #4 · cambió: user
 *
 * En producción es un no-op (no cuenta, no loguea, no compara) para no costar nada.
 */
export function useRenderTrace(name: string, watched?: Record<string, unknown>): number {
  const count = useRef(0);
  const prev = useRef<Record<string, unknown> | undefined>(undefined);

  // Incrementamos siempre para que el número sea real, pero solo logueamos en dev.
  count.current += 1;

  if (isDev) {
    let changedMsg = "";
    if (watched && prev.current) {
      const changed = Object.keys(watched).filter((k) => !Object.is(watched[k], prev.current![k]));
      changedMsg = changed.length ? ` · cambió: ${changed.join(", ")}` : " · sin cambios de props";
    } else if (watched) {
      changedMsg = " · primer render";
    }
    logger.info(`🔁 [${name}] render #${count.current}${changedMsg}`);
    prev.current = watched ? { ...watched } : undefined;
  }

  return count.current;
}
