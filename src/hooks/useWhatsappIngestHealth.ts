// ──────────────────────────────────────────────────────────────────────────
// useWhatsappIngestHealth — ¿la ingesta de WhatsApp está al día?
//
// El sync corre por n8n a las 5am (`PPS — 03 WhatsApp Sync`) y llama a
// `sync_whatsapp_backup` en Hermes, que baja el backup E2E de Drive con
// `wabdd`, lo desencripta y upsertea en `whatsapp_mensajes`.
//
// Ese pipeline falla en silencio: si el teléfono deja de subir la copia a
// Drive, el sync devuelve 500 todos los días y el panel sigue mostrando datos
// viejos como si nada. Pasó entre el 2026-08-01 y el 2026-08-03 y sólo se
// detectó mirando las ejecuciones de n8n a mano.
//
// No hace falta infraestructura nueva para verlo: Hermes ya audita cada
// corrida en `agent_audit_log` con `wa_sync.start` / `wa_sync.done` /
// `wa_sync.error`. Este hook lee esos eventos y deriva el estado.
//
// Deliberadamente NO usamos `max(ingested_at)` de `whatsapp_mensajes`: un fin
// de semana sin mensajes daría falsa alarma, y una alerta que miente se
// aprende a ignorar. Lo que importa es si la corrida ocurrió y cómo terminó.
// ──────────────────────────────────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

/** El cron es diario: pasadas ~30 h sin éxito, hay al menos una corrida perdida. */
const HORAS_ATRASO = 30;
/** A partir de acá ya no es un tropiezo puntual. */
const HORAS_CRITICO = 72;

const MS_HORA = 60 * 60 * 1000;
const REFRESH_MS = 5 * 60 * 1000;

/** Cuántos eventos traemos: alcanza para ver el desenlace de las últimas corridas. */
const EVENTOS_A_LEER = 25;

export type IngestEstado = "ok" | "atrasado" | "error" | "desconocido";

export interface WhatsappIngestHealth {
  estado: IngestEstado;
  /** Texto listo para mostrar junto al indicador. */
  label: string;
  tone: "ok" | "warn" | "danger" | "mute";
  ultimoExitoAt: string | null;
  ultimoErrorAt: string | null;
  /** Motivo del último fallo, recortado para caber en un tooltip. */
  ultimoErrorDetalle: string | null;
  horasDesdeUltimoExito: number | null;
  isLoading: boolean;
}

interface AuditRow {
  tool: string;
  timestamp: string;
  error: string | null;
  input: unknown;
}

const DESCONOCIDO: WhatsappIngestHealth = {
  estado: "desconocido",
  label: "Ingesta de WhatsApp sin datos",
  tone: "mute",
  ultimoExitoAt: null,
  ultimoErrorAt: null,
  ultimoErrorDetalle: null,
  horasDesdeUltimoExito: null,
  isLoading: false,
};

/** "hace 3 días" / "hace 5 horas" — el detalle de minutos acá no aporta. */
const formatAntiguedad = (horas: number): string => {
  if (horas < 1) return "recién";
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
};

/** El paso que falló (`wabdd_download`, `wabdd_decrypt`, `parse`…) si Hermes lo registró. */
const extraerPaso = (input: unknown): string | null => {
  if (!input || typeof input !== "object") return null;
  const paso = (input as Record<string, unknown>).step;
  return typeof paso === "string" && paso ? paso : null;
};

/**
 * Deriva el estado a partir de los eventos `wa_sync.*`, del más reciente al
 * más viejo. Exportada para poder testearla sin red.
 */
export const evaluarIngesta = (rows: AuditRow[], ahora = Date.now()): WhatsappIngestHealth => {
  if (!rows.length) return DESCONOCIDO;

  const exito = rows.find((r) => r.tool === "wa_sync.done") || null;
  const fallo = rows.find((r) => r.tool === "wa_sync.error") || null;

  // El primer evento terminal de la lista es el desenlace de la última corrida:
  // si es un error, la corrida más reciente falló, aunque haya éxitos previos.
  const ultimoTerminal = rows.find((r) => r.tool === "wa_sync.done" || r.tool === "wa_sync.error");

  const ultimoExitoAt = exito?.timestamp ?? null;
  const ultimoErrorAt = fallo?.timestamp ?? null;

  const horasDesdeUltimoExito = ultimoExitoAt
    ? (ahora - new Date(ultimoExitoAt).getTime()) / MS_HORA
    : null;

  const paso = fallo ? extraerPaso(fallo.input) : null;
  const ultimoErrorDetalle = fallo
    ? [paso, (fallo.error || "").trim() || null].filter(Boolean).join(" · ").slice(0, 300) || null
    : null;

  if (ultimoTerminal?.tool === "wa_sync.error") {
    const antiguedad = ultimoExitoAt
      ? ` · último dato ${formatAntiguedad(horasDesdeUltimoExito as number)}`
      : "";
    return {
      estado: "error",
      label: `Ingesta de WhatsApp con error${antiguedad}`,
      tone: "danger",
      ultimoExitoAt,
      ultimoErrorAt,
      ultimoErrorDetalle,
      horasDesdeUltimoExito,
      isLoading: false,
    };
  }

  // Corrió bien la última vez, pero puede haber dejado de correr del todo
  // (cron desactivado, n8n caído): ahí no hay evento de error que mirar.
  if (horasDesdeUltimoExito == null) return DESCONOCIDO;

  if (horasDesdeUltimoExito >= HORAS_CRITICO) {
    return {
      estado: "error",
      label: `WhatsApp sin sincronizar ${formatAntiguedad(horasDesdeUltimoExito)}`,
      tone: "danger",
      ultimoExitoAt,
      ultimoErrorAt,
      ultimoErrorDetalle,
      horasDesdeUltimoExito,
      isLoading: false,
    };
  }

  if (horasDesdeUltimoExito >= HORAS_ATRASO) {
    return {
      estado: "atrasado",
      label: `WhatsApp desactualizado ${formatAntiguedad(horasDesdeUltimoExito)}`,
      tone: "warn",
      ultimoExitoAt,
      ultimoErrorAt,
      ultimoErrorDetalle,
      horasDesdeUltimoExito,
      isLoading: false,
    };
  }

  return {
    estado: "ok",
    label: "WhatsApp al día",
    tone: "ok",
    ultimoExitoAt,
    ultimoErrorAt,
    ultimoErrorDetalle,
    horasDesdeUltimoExito,
    isLoading: false,
  };
};

export function useWhatsappIngestHealth(isTestingMode = false): WhatsappIngestHealth {
  const { data, isLoading } = useQuery<AuditRow[]>({
    queryKey: ["whatsappIngestHealth", isTestingMode],
    enabled: !isTestingMode,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
    // Sin permisos o con la tabla vacía preferimos "desconocido" antes que
    // reintentar en loop contra un log de auditoría.
    retry: false,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("agent_audit_log")
        .select("tool,timestamp,error,input")
        .like("tool", "wa_sync.%")
        .order("timestamp", { ascending: false })
        .limit(EVENTOS_A_LEER);
      if (error) throw error;
      return (rows || []) as AuditRow[];
    },
  });

  if (isTestingMode) return DESCONOCIDO;
  if (isLoading) {
    return { ...DESCONOCIDO, label: "Verificando ingesta…", isLoading: true };
  }
  if (!data) return DESCONOCIDO;

  return evaluarIngesta(data);
}
