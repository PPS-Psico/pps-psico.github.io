// ──────────────────────────────────────────────────────────────────────────
// useHermesHealth — estado real de disponibilidad de Hermes.
//
// Reemplaza los puntos verdes fijos que decían "Hermes online" sin comprobar
// nada. Consulta la sonda de `hermes-proxy`, que mide alcanzabilidad desde el
// servidor y distingue online / degradado / offline.
//
// Se refresca cada 2 minutos: suficiente para notar una caída sin castigar a
// la red ni al backend con sondas constantes.
// ──────────────────────────────────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { callHermes, type HermesHealth } from "../services/hermesClient";

const REFRESH_MS = 2 * 60 * 1000;

export interface HermesHealthState {
  /** null mientras no se comprobó todavía. */
  estado: HermesHealth["estado"] | null;
  /** Texto listo para mostrar junto al indicador. */
  label: string;
  /** Tono semántico para el color del punto. */
  tone: "ok" | "warn" | "danger" | "mute";
  latenciaMs?: number;
  verificadoEn?: string;
  isLoading: boolean;
}

const LABELS: Record<HermesHealth["estado"], { label: string; tone: HermesHealthState["tone"] }> = {
  online: { label: "Hermes online", tone: "ok" },
  degradado: { label: "Hermes con fallas", tone: "warn" },
  offline: { label: "Hermes sin conexión", tone: "danger" },
};

export function useHermesHealth(): HermesHealthState {
  const { data, isLoading } = useQuery<HermesHealth>({
    queryKey: ["hermes", "health"],
    queryFn: () => callHermes<HermesHealth>("__health", {}, 10000),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
    // Si la sonda falla (proxy caído, sin permisos), lo tratamos como
    // "desconocido" en vez de reintentar en loop.
    retry: false,
  });

  if (isLoading) {
    return { estado: null, label: "Verificando Hermes…", tone: "mute", isLoading: true };
  }

  if (!data) {
    return { estado: null, label: "Estado de Hermes desconocido", tone: "mute", isLoading: false };
  }

  const meta = LABELS[data.estado];
  return {
    estado: data.estado,
    label: meta.label,
    tone: meta.tone,
    latenciaMs: data.latenciaMs,
    verificadoEn: data.verificadoEn,
    isLoading: false,
  };
}
