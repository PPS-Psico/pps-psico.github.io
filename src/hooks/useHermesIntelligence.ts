// ──────────────────────────────────────────────────────────────────────────
// useHermesIntelligence — datos del "Dashboard de Inteligencia Hermes".
//
// Lee TODO lo que el agente ya acumula en Supabase (no toca el backend ni el
// vault). Tres bloques:
//   · Actividad del agente   → agent_suggestions + agent_audit_log
//   · Salud del vínculo      → institucion_resumen
//   · Comunicaciones         → gmail_hilos + whatsapp_mensajes
//
// Todo degrada con elegancia: si una tabla está bloqueada por RLS o no existe,
// el bloque devuelve ceros/vacío en vez de romper el dashboard. Es solo lectura
// agregada; Hermes permanece en shadow mode.
// ──────────────────────────────────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../utils/logger";

// ── Tipos ──────────────────────────────────────────────────────────────────

/** Una fila por tipo de sugerencia, con el desglose por estado. */
export interface SuggestionTypeBreakdown {
  tipo: string;
  total: number;
  pending: number;
  approved: number;
  edited: number;
  discarded: number;
  expired: number;
  /** approved + edited sobre el total resuelto (no pending/expired). */
  acceptanceRate: number | null;
}

export interface AgentActivity {
  totalSuggestions: number;
  byType: SuggestionTypeBreakdown[];
  // Tasa global de aceptación (approved + edited) / resueltas.
  globalAcceptance: number | null;
  // Conteo global por estado.
  estados: {
    pending: number;
    approved: number;
    edited: number;
    discarded: number;
    expired: number;
  };
  // Sugerencias generadas por mes (para tendencia).
  porMes: { mes: string; total: number }[];
}

export interface AgentAudit {
  totalInvocations: number;
  errores: number;
  errorRate: number | null;
  avgDurationMs: number | null;
  // Conteo por herramienta (tool), top primero.
  porTool: { tool: string; total: number; errores: number; avgMs: number | null }[];
  ultimaActividad: string | null;
}

export interface VinculoInstitucional {
  totalConResumen: number;
  frias: number; // > 30 días sin contacto
  conPendientes: number; // tienen pendientes_concretos no vacíos
  porCanal: Record<string, number>;
  // Las más urgentes: frías o con pendientes, ordenadas por antigüedad de contacto.
  destacadas: {
    institucion_id: string;
    nombre: string;
    resumen: string;
    ultimo_canal: string | null;
    ultimo_contacto_at: string | null;
    diasSinContacto: number | null;
    pendientes: string[];
  }[];
}

export interface Comunicaciones {
  gmailTotal: number;
  gmailEsperando: number; // hilos esperando respuesta nuestra
  whatsappTotal: number;
  // Volumen por mes (gmail por ultimo_mensaje_at, wa por timestamp).
  porMes: { mes: string; gmail: number; whatsapp: number }[];
}

export interface AprendizajeItem {
  id: string;
  tag: string | null;
  tipo: string | null;
  accion: string | null;
  aprendizaje: string;
  aplica_cuando: string | null;
  created_at: string;
}

export interface Aprendizajes {
  total: number;
  // Conteo por categoría (tono, criterio, contenido, prioridad, ...).
  porTag: { tag: string; total: number }[];
  // Los más recientes para mostrar como timeline.
  recientes: AprendizajeItem[];
  ultimaFecha: string | null;
}

export interface HermesIntelligence {
  activity: AgentActivity;
  audit: AgentAudit;
  vinculo: VinculoInstitucional;
  comunicaciones: Comunicaciones;
  aprendizajes: Aprendizajes;
  generatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const monthKey = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (key: string): string => {
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  return `${MESES_CORTOS[idx] ?? m} ${String(y).slice(2)}`;
};

const TIPO_LABEL: Record<string, string> = {
  daily_brief: "Brief diario",
  email_draft: "Borradores de mail",
  whatsapp_followup: "Seguimientos WhatsApp",
  update_estado: "Cambios de estado",
  clasificacion: "Clasificaciones",
  accion_dia: "Acciones del día",
};

export const tipoLabel = (tipo: string): string => TIPO_LABEL[tipo] ?? tipo;

const diasDesde = (iso: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
};

// Construye una serie de los últimos N meses (incluido el actual) con ceros.
const ultimosMeses = (n: number): string[] => {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};

// ── Bloque 1: actividad del agente (agent_suggestions) ──────────────────────

async function fetchAgentActivity(): Promise<AgentActivity> {
  const empty: AgentActivity = {
    totalSuggestions: 0,
    byType: [],
    globalAcceptance: null,
    estados: { pending: 0, approved: 0, edited: 0, discarded: 0, expired: 0 },
    porMes: [],
  };
  try {
    const { data, error } = await supabase
      .from("agent_suggestions")
      .select("tipo, estado, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return empty;

    const byTypeMap = new Map<string, SuggestionTypeBreakdown>();
    const estados = { pending: 0, approved: 0, edited: 0, discarded: 0, expired: 0 };
    const mesMap = new Map<string, number>(ultimosMeses(6).map((m) => [m, 0]));

    for (const r of rows) {
      const tipo = r.tipo ?? "desconocido";
      const estado = (r.estado ?? "pending") as keyof typeof estados;
      if (estado in estados) estados[estado] += 1;

      const e = byTypeMap.get(tipo) ?? {
        tipo,
        total: 0,
        pending: 0,
        approved: 0,
        edited: 0,
        discarded: 0,
        expired: 0,
        acceptanceRate: null,
      };
      e.total += 1;
      if (estado in e) (e as unknown as Record<string, number>)[estado] += 1;
      byTypeMap.set(tipo, e);

      const mk = monthKey(r.created_at);
      if (mk && mesMap.has(mk)) mesMap.set(mk, (mesMap.get(mk) ?? 0) + 1);
    }

    // Calcular tasas de aceptación por tipo.
    const byType = Array.from(byTypeMap.values())
      .map((e) => {
        const resueltas = e.approved + e.edited + e.discarded;
        e.acceptanceRate = resueltas > 0 ? (e.approved + e.edited) / resueltas : null;
        return e;
      })
      .sort((a, b) => b.total - a.total);

    const resueltasGlobal = estados.approved + estados.edited + estados.discarded;
    const globalAcceptance =
      resueltasGlobal > 0 ? (estados.approved + estados.edited) / resueltasGlobal : null;

    const porMes = Array.from(mesMap.entries()).map(([mes, total]) => ({
      mes: monthLabel(mes),
      total,
    }));

    return {
      totalSuggestions: rows.length,
      byType,
      globalAcceptance,
      estados,
      porMes,
    };
  } catch (err) {
    logger.error("[useHermesIntelligence] agent_suggestions:", err);
    return empty;
  }
}

// ── Bloque 2: auditoría (agent_audit_log) ───────────────────────────────────

async function fetchAgentAudit(): Promise<AgentAudit> {
  const empty: AgentAudit = {
    totalInvocations: 0,
    errores: 0,
    errorRate: null,
    avgDurationMs: null,
    porTool: [],
    ultimaActividad: null,
  };
  try {
    const { data, error } = await supabase
      .from("agent_audit_log")
      .select("tool, duration_ms, error, timestamp")
      .order("timestamp", { ascending: false })
      .limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return empty;

    let errores = 0;
    let durSum = 0;
    let durCount = 0;
    const toolMap = new Map<
      string,
      { total: number; errores: number; durSum: number; durCount: number }
    >();

    for (const r of rows) {
      const tool = r.tool ?? "desconocido";
      const hasError = !!r.error;
      if (hasError) errores += 1;
      const t = toolMap.get(tool) ?? { total: 0, errores: 0, durSum: 0, durCount: 0 };
      t.total += 1;
      if (hasError) t.errores += 1;
      if (typeof r.duration_ms === "number") {
        t.durSum += r.duration_ms;
        t.durCount += 1;
        durSum += r.duration_ms;
        durCount += 1;
      }
      toolMap.set(tool, t);
    }

    const porTool = Array.from(toolMap.entries())
      .map(([tool, t]) => ({
        tool,
        total: t.total,
        errores: t.errores,
        avgMs: t.durCount > 0 ? Math.round(t.durSum / t.durCount) : null,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalInvocations: rows.length,
      errores,
      errorRate: rows.length > 0 ? errores / rows.length : null,
      avgDurationMs: durCount > 0 ? Math.round(durSum / durCount) : null,
      porTool,
      ultimaActividad: rows[0]?.timestamp ?? null,
    };
  } catch (err) {
    logger.error("[useHermesIntelligence] agent_audit_log:", err);
    return empty;
  }
}

// ── Bloque 3: salud del vínculo institucional (institucion_resumen) ─────────

async function fetchVinculo(): Promise<VinculoInstitucional> {
  const empty: VinculoInstitucional = {
    totalConResumen: 0,
    frias: 0,
    conPendientes: 0,
    porCanal: {},
    destacadas: [],
  };
  try {
    const { data, error } = await supabase
      .from("institucion_resumen")
      .select("institucion_id, resumen, ultimo_canal, ultimo_contacto_at, pendientes_concretos")
      .order("ultimo_contacto_at", { ascending: true, nullsFirst: true })
      .limit(500);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return empty;

    // Nombres de instituciones para mostrar (una query extra).
    const ids = rows.map((r) => r.institucion_id).filter(Boolean) as string[];
    const nombreMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: insts } = await supabase
        .from("instituciones")
        .select("id, nombre")
        .in("id", ids);
      (insts ?? []).forEach((i) => {
        if (i.id) nombreMap[i.id] = i.nombre ?? "";
      });
    }

    let frias = 0;
    let conPendientes = 0;
    const porCanal: Record<string, number> = {};
    const destacadas: VinculoInstitucional["destacadas"] = [];

    for (const r of rows) {
      const dias = diasDesde(r.ultimo_contacto_at);
      if (dias !== null && dias > 30) frias += 1;
      const canal = r.ultimo_canal ?? "sin dato";
      porCanal[canal] = (porCanal[canal] ?? 0) + 1;

      const pend = r.pendientes_concretos;
      let pendientes: string[] = [];
      if (Array.isArray(pend)) {
        pendientes = pend.map((p) => (typeof p === "string" ? p : JSON.stringify(p)));
      } else if (pend && typeof pend === "object") {
        pendientes = Object.values(pend as Record<string, unknown>).map((v) =>
          typeof v === "string" ? v : JSON.stringify(v)
        );
      }
      if (pendientes.length > 0) conPendientes += 1;

      destacadas.push({
        institucion_id: r.institucion_id,
        nombre: nombreMap[r.institucion_id] || "Institución",
        resumen: r.resumen ?? "",
        ultimo_canal: r.ultimo_canal,
        ultimo_contacto_at: r.ultimo_contacto_at,
        diasSinContacto: dias,
        pendientes,
      });
    }

    // Destacadas: priorizar frías y con pendientes; limitar a 12.
    const ordered = destacadas
      .sort((a, b) => {
        const da = a.diasSinContacto ?? Number.MAX_SAFE_INTEGER;
        const db = b.diasSinContacto ?? Number.MAX_SAFE_INTEGER;
        return db - da;
      })
      .slice(0, 12);

    return {
      totalConResumen: rows.length,
      frias,
      conPendientes,
      porCanal,
      destacadas: ordered,
    };
  } catch (err) {
    logger.error("[useHermesIntelligence] institucion_resumen:", err);
    return empty;
  }
}

// ── Bloque 4: comunicaciones (gmail_hilos + whatsapp_mensajes) ──────────────

async function fetchComunicaciones(): Promise<Comunicaciones> {
  const empty: Comunicaciones = {
    gmailTotal: 0,
    gmailEsperando: 0,
    whatsappTotal: 0,
    porMes: ultimosMeses(6).map((m) => ({ mes: monthLabel(m), gmail: 0, whatsapp: 0 })),
  };

  const mesGmail = new Map<string, number>(ultimosMeses(6).map((m) => [m, 0]));
  const mesWa = new Map<string, number>(ultimosMeses(6).map((m) => [m, 0]));
  let gmailTotal = 0;
  let gmailEsperando = 0;
  let whatsappTotal = 0;

  try {
    const { data, error } = await supabase
      .from("gmail_hilos")
      .select("estado, ultimo_mensaje_at")
      .limit(5000);
    if (!error && data) {
      gmailTotal = data.length;
      for (const r of data) {
        if (r.estado === "esperando_respuesta") gmailEsperando += 1;
        const mk = monthKey(r.ultimo_mensaje_at);
        if (mk && mesGmail.has(mk)) mesGmail.set(mk, (mesGmail.get(mk) ?? 0) + 1);
      }
    }
  } catch (err) {
    logger.error("[useHermesIntelligence] gmail_hilos:", err);
  }

  try {
    const { data, error } = await supabase
      .from("whatsapp_mensajes")
      .select("timestamp")
      .order("timestamp", { ascending: false })
      .limit(8000);
    if (!error && data) {
      whatsappTotal = data.length;
      for (const r of data) {
        const mk = monthKey(r.timestamp);
        if (mk && mesWa.has(mk)) mesWa.set(mk, (mesWa.get(mk) ?? 0) + 1);
      }
    }
  } catch (err) {
    logger.error("[useHermesIntelligence] whatsapp_mensajes:", err);
  }

  const keys = ultimosMeses(6);
  const porMes = keys.map((k) => ({
    mes: monthLabel(k),
    gmail: mesGmail.get(k) ?? 0,
    whatsapp: mesWa.get(k) ?? 0,
  }));

  if (gmailTotal === 0 && whatsappTotal === 0) return empty;
  return { gmailTotal, gmailEsperando, whatsappTotal, porMes };
}

// ── Bloque 5: aprendizajes destilados (agent_aprendizajes) ──────────────────

const TAG_LABEL: Record<string, string> = {
  tono: "Tono",
  criterio: "Criterio",
  contenido: "Contenido",
  prioridad: "Prioridad",
  formato: "Formato",
};

export const tagLabel = (tag: string | null): string =>
  tag ? (TAG_LABEL[tag] ?? tag) : "Sin categoría";

async function fetchAprendizajes(): Promise<Aprendizajes> {
  const empty: Aprendizajes = { total: 0, porTag: [], recientes: [], ultimaFecha: null };
  try {
    // Las lecciones se registran en agent_audit_log con tool='learn.done' y el
    // texto destilado dentro de output.aprendizaje (lo espeja el backend de
    // Hermes en learn_from_feedback). No hace falta una tabla aparte.
    const { data, error } = await supabase
      .from("agent_audit_log")
      .select("id, output, suggestion_id, timestamp")
      .eq("tool", "learn.done")
      .order("timestamp", { ascending: false })
      .limit(500);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return empty;

    // Solo las que efectivamente destilaron una lección (no sin_aprendizaje).
    const items: AprendizajeItem[] = [];
    for (const r of rows) {
      const out = (r.output ?? {}) as Record<string, unknown>;
      const aprendizaje = typeof out.aprendizaje === "string" ? out.aprendizaje.trim() : "";
      const tag = typeof out.tag === "string" ? out.tag : null;
      if (!aprendizaje || tag === "sin_aprendizaje") continue;
      items.push({
        id: r.id,
        tag,
        tipo: typeof out.tipo === "string" ? out.tipo : null,
        accion: typeof out.accion === "string" ? out.accion : null,
        aprendizaje,
        aplica_cuando: typeof out.aplica_cuando === "string" ? out.aplica_cuando : null,
        created_at: r.timestamp,
      });
    }
    if (items.length === 0) return empty;

    const tagMap = new Map<string, number>();
    for (const it of items) {
      const tag = it.tag ?? "sin_tag";
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
    const porTag = Array.from(tagMap.entries())
      .map(([tag, total]) => ({ tag, total }))
      .sort((a, b) => b.total - a.total);

    return {
      total: items.length,
      porTag,
      recientes: items.slice(0, 10),
      ultimaFecha: items[0]?.created_at ?? null,
    };
  } catch (err) {
    logger.error("[useHermesIntelligence] aprendizajes (audit_log):", err);
    return empty;
  }
}

// ── Hook principal ───────────────────────────────────────────────────────────

export const useHermesIntelligence = (isTestingMode = false) => {
  return useQuery<HermesIntelligence>({
    queryKey: ["hermesIntelligence"],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 3,
    queryFn: async (): Promise<HermesIntelligence> => {
      const [activity, audit, vinculo, comunicaciones, aprendizajes] = await Promise.all([
        fetchAgentActivity(),
        fetchAgentAudit(),
        fetchVinculo(),
        fetchComunicaciones(),
        fetchAprendizajes(),
      ]);
      return {
        activity,
        audit,
        vinculo,
        comunicaciones,
        aprendizajes,
        generatedAt: new Date().toISOString(),
      };
    },
  });
};

export default useHermesIntelligence;
