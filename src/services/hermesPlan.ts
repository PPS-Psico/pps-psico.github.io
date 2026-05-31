// ──────────────────────────────────────────────────────────────────────────
// hermesPlan — acceso al "plan del día" de Hermes para el tablero HermesFlow.
//
// Lee las acciones que Hermes planificó (agent_suggestions tipo "accion_dia",
// estado pending) y las normaliza al shape que consume la UI. La regeneración
// delega en el backend de Hermes vía gmailService.planToday (/tasks/plan_today).
//
// Shadow mode: solo SELECT + disparo de replanificación; nunca envía ni cambia
// estados de gestión por su cuenta.
// ──────────────────────────────────────────────────────────────────────────
import { supabase } from "../lib/supabaseClient";
import { planToday } from "./gmailService";

export type AccionTipo =
  | "responder_mail"
  | "mover_solicitud"
  | "verificar_finalizacion"
  | "correccion";

export type CanalContacto = "whatsapp" | "email" | "ninguno";

/** Un mensaje del historial de conversación con la institución. */
export interface HistorialMensaje {
  deMi: boolean;
  autor: string;
  texto: string;
  fecha: string | null;
}

/** Datos de la acción de reactivación de una solicitud (mover_solicitud). */
export interface SolicitudOutreach {
  solicitudId: string;
  nombreAlumno: string | null;
  nombreInstitucion: string | null;
  estadoSeguimiento: string | null;
  diasSinMovimiento: number | null;
  /** Canal elegido automáticamente por Hermes según los datos de contacto. */
  canal: CanalContacto;
  /** Para whatsapp: teléfono normalizado (solo dígitos). Para email: la casilla. */
  destino: string;
  telefono: string | null;
  email: string | null;
  referente: string | null;
  /** Borrador listo para enviar (cuerpo del WhatsApp o del email). */
  mensaje: string | null;
  /** Asunto del email (solo canal email). */
  asunto: string | null;
  /** true = ya hubo conversación previa (seguimiento); false = primer contacto. */
  esSeguimiento: boolean;
  /** Últimos mensajes de la conversación, del más viejo al más nuevo. */
  historial: HistorialMensaje[];
}

export interface AccionDia {
  id: string;
  tipo: AccionTipo;
  titulo: string;
  porQue: string;
  prioridad: "alta" | "media" | "baja";
  tieneBorrador: boolean;
  /** Ruta interna del panel a la que navega la acción. */
  link: string;
  /** thread_id del hilo de Gmail (solo en responder_mail). */
  threadId?: string | null;
  /** Datos de reactivación (solo mover_solicitud). */
  solicitud?: SolicitudOutreach | null;
  orden: number;
}

const PRIORIDAD_RANK: Record<string, number> = { alta: 0, media: 1, baja: 2 };

/**
 * Lee el plan del día desde agent_suggestions (tipo "accion_dia", pending) y lo
 * devuelve ordenado por prioridad y por el orden que dejó Hermes.
 */
export async function getPlanDelDia(isTestingMode = false): Promise<AccionDia[]> {
  if (isTestingMode) return [];

  const { data, error } = await supabase
    .from("agent_suggestions")
    .select("id, payload, contexto, created_at")
    .eq("tipo", "accion_dia")
    .eq("estado", "pending")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];

  const acciones: AccionDia[] = data.map((s) => {
    const p = (s.payload as Record<string, unknown>) || {};
    const ctx = (s.contexto as Record<string, unknown>) || {};
    const ref = (ctx.ref as Record<string, unknown>) || {};
    const tipo = (p.tipo_accion as AccionTipo) || "responder_mail";

    let solicitud: SolicitudOutreach | null = null;
    if (tipo === "mover_solicitud" && ref.solicitud_id) {
      const canal = (ref.canal as CanalContacto) || "ninguno";
      const rawHist = Array.isArray(ref.historial)
        ? (ref.historial as Array<Record<string, unknown>>)
        : [];
      solicitud = {
        solicitudId: String(ref.solicitud_id),
        nombreAlumno: (ref.nombre_alumno as string) ?? null,
        nombreInstitucion: (ref.nombre_institucion as string) ?? null,
        estadoSeguimiento: (ref.estado_seguimiento as string) ?? null,
        diasSinMovimiento: (ref.dias_sin_movimiento as number) ?? null,
        canal,
        destino: String(ref.destino || ""),
        telefono: (ref.telefono as string) ?? null,
        email: (ref.email as string) ?? null,
        referente: (ref.referente as string) ?? null,
        mensaje: (ref.outreach_mensaje as string) ?? null,
        asunto: (ref.outreach_asunto as string) ?? null,
        esSeguimiento: Boolean(ref.es_seguimiento),
        historial: rawHist.map((m) => ({
          deMi: Boolean(m.de_mi),
          autor: String(m.autor || ""),
          texto: String(m.texto || ""),
          fecha: (m.fecha as string) ?? null,
        })),
      };
    }

    return {
      id: String(s.id),
      tipo,
      titulo: String(p.titulo || "Acción"),
      porQue: String(p.por_que || ""),
      prioridad: (p.prioridad as AccionDia["prioridad"]) || "media",
      tieneBorrador: Boolean(p.tiene_borrador),
      link: String(p.link || "/admin/gestion"),
      threadId: (ref.thread_id as string | undefined) ?? null,
      solicitud,
      orden: Number(p.orden ?? 99),
    };
  });

  return acciones.sort(
    (a, b) =>
      (PRIORIDAD_RANK[a.prioridad] ?? 1) - (PRIORIDAD_RANK[b.prioridad] ?? 1) || a.orden - b.orden
  );
}

/**
 * Pide a Hermes recalcular el plan del día (multi-fuente).
 *
 * Devuelve:
 *   · { ok: true, acciones }     → el backend recalculó (acciones puede ser 0).
 *   · { ok: false, motivo }      → no se pudo: endpoint ausente (backend viejo),
 *                                  timeout, o error de red. La UI lo muestra.
 */
export async function regenerarPlanDelDia(
  limit = 9
): Promise<{ ok: true; acciones: number } | { ok: false; motivo: string }> {
  const res = await planToday(limit);
  if (res.ok) return { ok: true, acciones: res.acciones };
  return { ok: false, motivo: res.motivo };
}
