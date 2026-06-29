// ──────────────────────────────────────────────────────────────────────────
// useFichaSize — control del ancho del panel derecho de Gestión.
//
// La ficha tiene 3 tamaños discretos: collapsed (48px), normal (380px),
// expanded (560px). El sistema auto-ajusta según el modo y el contenido
// (MailPanel → expanded; CalendarView → collapsed), pero el usuario puede
// sobreescribir con el toggle y la elección se recuerda por modo en
// localStorage.
//
// API mínima para que cada panel (Ficha, MailPanel, etc.) pueda pedir un
// tamaño concreto (que se persiste para próximos mounts) o consultar el
// tamaño actual resuelto.
// ──────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { LS_GV3_FICHA_SIZE } from "../constants/uiConstants";
import type { ViewMode } from "../views/admin/gestion/gestionTypes";

export type FichaSize = "collapsed" | "normal" | "expanded";

export type { ViewMode };

/** Anchos en píxeles del panel derecho. Centralizados para que el CSS scoped
 *  y el hook compartan la misma fuente de verdad. */
export const FICHA_WIDTHS: Record<FichaSize, number> = {
  collapsed: 48,
  normal: 380,
  expanded: 560,
};

type SizeMap = Partial<Record<ViewMode, FichaSize>>;

const safeParse = (raw: string | null): SizeMap => {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    const out: SizeMap = {};
    for (const k of Object.keys(obj)) {
      const v = (obj as Record<string, unknown>)[k];
      if (v === "collapsed" || v === "normal" || v === "expanded") {
        out[k as ViewMode] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
};

const safeWrite = (map: SizeMap) => {
  try {
    localStorage.setItem(LS_GV3_FICHA_SIZE, JSON.stringify(map));
  } catch {
    /* noop */
  }
};

/** Auto-ajuste por modo + contenido. Es la decisión "del sistema" antes de
 *  aplicar la preferencia del usuario (si existe). */
const autoFor = (mode: ViewMode, hasRichContent: boolean): FichaSize => {
  if (mode === "contactos") return "collapsed"; // se oculta igual via CSS
  if (mode === "calendario") return "collapsed"; // se prioriza el grid
  if (mode === "mails") {
    // En "Hoy" el panel arranca en `normal` (380px) mostrando el empty state
    // "Elegí una acción". Al tocar una tarjeta (mail / solicitud /
    // institución) se expande automáticamente para mostrar el panel de
    // acción correspondiente. Al deseleccionar, vuelve a `normal` y
    // reaparece el empty state en la barra derecha.
    return hasRichContent ? "expanded" : "normal";
  }
  return "normal";
};

export interface UseFichaSizeOpts {
  mode: ViewMode;
  /** True si está abierto un panel con contenido denso (MailPanel, etc.). */
  hasRichContent?: boolean;
}

export interface UseFichaSizeResult {
  size: FichaSize;
  width: number;
  /** Override manual del usuario. Se persiste por modo. */
  setSize: (s: FichaSize) => void;
  /** Reset de la elección del usuario para el modo actual (vuelve al auto). */
  resetForMode: () => void;
  /** Tamaño que aplicaría el sistema sin la preferencia del usuario. */
  auto: FichaSize;
  /** True si el tamaño actual viene de un override del usuario. */
  isUserOverride: boolean;
}

export const useFichaSize = ({
  mode,
  hasRichContent = false,
}: UseFichaSizeOpts): UseFichaSizeResult => {
  const [overrides, setOverrides] = useState<SizeMap>(() => safeParse(getInitialLS()));

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOverrides(safeParse(localStorage.getItem(LS_GV3_FICHA_SIZE)));
  }, []);

  const auto = useMemo(() => autoFor(mode, hasRichContent), [mode, hasRichContent]);

  // Resolución del tamaño:
  // - Si hay contenido denso (tarjeta seleccionada) → SIEMPRE `expanded`.
  //   El comportamiento reactivo a los clicks tiene prioridad absoluta sobre
  //   cualquier override del usuario: al clickear una tarjeta la ficha se
  //   expande, al deseleccionar vuelve al estado base (override o auto).
  // - Sin contenido → override del usuario (si existe) o auto del modo.
  const size = useMemo<FichaSize>(() => {
    if (hasRichContent) return "expanded";
    return overrides[mode] ?? autoFor(mode, false);
  }, [overrides, mode, hasRichContent]);

  // Al abrir una tarjeta en el modo actual, limpiamos el override del usuario
  // para que al deseleccionar la ficha vuelva a su estado base (auto del modo)
  // y NO se quede "trabada" en el tamaño que el usuario haya forzado antes con
  // el toggle. El toggle queda reservado para ajustar el empty state entre
  // aperturas, no para bloquear el comportamiento reactivo a los clicks.
  useEffect(() => {
    if (!hasRichContent) return;
    if (!(mode in overrides)) return;
    setOverrides((cur) => {
      if (!(mode in cur)) return cur;
      const next: SizeMap = { ...cur };
      delete next[mode];
      safeWrite(next);
      return next;
    });
  }, [hasRichContent, mode, overrides]);

  const setSize = useCallback(
    (s: FichaSize) => {
      setOverrides((cur) => {
        const next: SizeMap = { ...cur, [mode]: s };
        safeWrite(next);
        return next;
      });
    },
    [mode]
  );

  const resetForMode = useCallback(() => {
    setOverrides((cur) => {
      if (!(mode in cur)) return cur;
      const next: SizeMap = { ...cur };
      delete next[mode];
      safeWrite(next);
      return next;
    });
  }, [mode]);

  return {
    size,
    width: FICHA_WIDTHS[size],
    setSize,
    resetForMode,
    auto,
    isUserOverride: mode in overrides,
  };
};

const getInitialLS = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_GV3_FICHA_SIZE);
};
