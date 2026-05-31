/**
 * Hook que arma toda la data del Inicio editorial (briefing + bandas + priorities).
 * Lee Supabase directo y la última suggestion `daily_brief` de Hermes.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useGmailHilos, matchesGmailFilter } from "./useGmailHilos";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Tone = "accent" | "warn" | "ok" | "ai" | "crit";

export interface DetectionMetric {
  id: string;
  tone: Tone;
  icon: string;
  n: number;
  label: string;
  sub: string;
  note?: string | null;
  noteTone?: Tone | null;
  noteIcon?: string | null;
  href?: string;
}

export interface DraftPreview {
  id: string;
  canal: "mail" | "whatsapp";
  nombre: string;
  borrador: string;
  institucionId?: string | null;
  threadId?: string | null;
}

export interface PriorityItem {
  id: string;
  tone: Tone;
  eyebrow: string;
  title: string;
  detail: string;
  cta: string;
  href?: string;
}

export interface BriefingData {
  lead: string;
  body: string[];
  generadoAgo: string;
  totalChats: number;
  listaNombre: string;
}

export interface InicioData {
  briefing: BriefingData;
  detectionMetrics: DetectionMetric[];
  solicitudesMetrics: DetectionMetric[];
  drafts: DraftPreview[];
  totalDrafts: number;
  priorities: PriorityItem[];
  loaded: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Rutas internas del panel admin que aceptamos como destino "tal cual".
const KNOWN_ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/lanzador",
  "/admin/gestion",
  "/admin/solicitudes",
  "/admin/metrics",
  "/admin/herramientas",
];

// Normaliza texto para comparar nombres: minúsculas, sin acentos, sin signos.
function normalizeForMatch(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SolicitudRef {
  id: string;
  nombre_alumno?: string | null;
  nombre_institucion?: string | null;
  estado_seguimiento?: string | null;
}

/**
 * Intenta resolver a qué solicitud concreta se refiere un bullet del daily brief
 * cruzando su título/detalle con las solicitudes activas reales. Los bullets de
 * Hermes suelen titularse "Nombre Alumno – Institución", así que buscamos la
 * solicitud cuyo nombre de alumno (o institución) aparece en el texto.
 * Devuelve el id de la solicitud o null si no hay match confiable.
 */
function matchSolicitud(
  context: { titulo?: string; porQue?: string },
  solicitudes: SolicitudRef[]
): SolicitudRef | null {
  const hay = normalizeForMatch(`${context.titulo || ""} ${context.porQue || ""}`);
  if (!hay) return null;

  let best: { sol: SolicitudRef; score: number } | null = null;
  for (const sol of solicitudes) {
    const alumno = normalizeForMatch(sol.nombre_alumno || "");
    const inst = normalizeForMatch(sol.nombre_institucion || "");
    let score = 0;
    // El nombre del alumno es la señal más fuerte (suele ser único).
    if (alumno && alumno.length > 4 && hay.includes(alumno)) score += 3;
    // La institución refuerza el match.
    if (inst && inst.length > 4 && hay.includes(inst)) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { sol, score };
  }
  // Exigimos al menos el nombre del alumno o institución completos.
  return best && best.score >= 2 ? best.sol : null;
}

/**
 * Convierte el `ref` estructurado que ahora adjunta Hermes a cada bullet
 * ({tipo, id}) en una ruta REAL y puntual del panel. Es la vía preferida: el id
 * ya viene verificado contra los datos por el backend (_sanitize_brief_refs).
 * Devuelve null si el ref no es accionable (tipo 'ninguno' o sin id), para caer
 * al resolvedor por texto.
 */
function hrefFromRef(
  ref: { tipo?: string; id?: string } | undefined,
  solicitudes: SolicitudRef[]
): string | null {
  if (!ref || !ref.id) return null;
  const id = encodeURIComponent(ref.id);
  switch (ref.tipo) {
    case "solicitud": {
      const sol = solicitudes.find((s) => s.id === ref.id);
      const estado = (sol?.estado_seguimiento || "").toLowerCase();
      const tab = estado.includes("finaliz") || estado.includes("acredita") ? "egreso" : "ingreso";
      return `/admin/solicitudes?tab=${tab}&focus=${id}`;
    }
    case "gmail":
      return `/admin/gestion?view=mails&thread=${id}`;
    case "whatsapp":
      return `/admin/gestion?view=contactos`;
    case "institucion":
      return `/admin/gestion?view=instituciones&inst=${id}`;
    case "lanzamiento":
      return `/admin/lanzador?launchId=${id}`;
    default:
      return null;
  }
}

/**
 * Convierte el campo libre `recurso` de un bullet del daily brief en una ruta
 * REAL del panel.
 *
 * Hermes (LLM) rellena `recurso` con texto arbitrario: a veces una ruta válida,
 * a veces "WhatsApp", un nombre propio o vacío. Pasar eso directo a `navigate()`
 * hace que React Router caiga en la ruta comodín `*` y te expulse del admin, o
 * que el botón "no lleve a ningún lado". Acá lo saneamos:
 *
 *   1. Si `recurso` ya es una ruta admin conocida → se usa.
 *   2. Si no, se infiere el destino desde el texto del bullet (título + por qué
 *      + acción + recurso): contacto/mail/whatsapp → bandeja de contactos de
 *      Hermes; solicitud/ingreso/egreso/finalización → solicitudes; etc.
 *   3. Fallback: bandeja de contactos de Hermes, que es donde caen casi todas
 *      las prioridades de seguimiento institucional.
 */
function resolvePriorityHref(
  recurso: string | undefined,
  context: { titulo?: string; porQue?: string; accion?: string }
): string {
  const raw = (recurso || "").trim();

  // 1. ¿`recurso` ya es una ruta interna válida?
  if (raw.startsWith("/")) {
    const pathOnly = raw.split("?")[0];
    if (KNOWN_ADMIN_ROUTES.some((r) => pathOnly === r || pathOnly.startsWith(r + "/"))) {
      return raw;
    }
  }

  // 2. Inferir desde el contenido del bullet. Orden: de lo más específico a lo
  //    más genérico. Las señales de "seguimiento/contacto" (sin respuesta, mails
  //    sin responder, WhatsApp) ganan al genérico "solicitud" porque esos casos
  //    se accionan desde la bandeja de contactos de Hermes.
  const hay =
    `${raw} ${context.titulo || ""} ${context.porQue || ""} ${context.accion || ""}`.toLowerCase();

  const has = (...words: string[]) => words.some((w) => hay.includes(w));

  // 2a. Egreso / correcciones: muy específicos.
  if (has("finaliz", "acredita", "egreso")) return "/admin/solicitudes?tab=egreso";
  if (has("correcci", "modificaci")) return "/admin/solicitudes?tab=correcciones";

  // 2b. Seguimiento institucional / contacto (incluye "sin respuesta", "responder").
  if (
    has(
      "sin respuesta",
      "no respond",
      "sin responder",
      "responder",
      "whatsapp",
      "wsp",
      "mail",
      "correo",
      "mensaje",
      "contacto",
      "contactar",
      "instituci",
      "convenio",
      "hermes",
      "chat"
    )
  ) {
    return "/admin/gestion?view=contactos";
  }

  // 2c. Solicitudes de ingreso / postulaciones.
  if (has("solicitud", "ingreso", "postul", "convocatoria propuesta")) return "/admin/solicitudes";

  // 2d. Lanzador / métricas.
  if (has("lanzamiento", "lanzar", "convocatoria", "cupo")) return "/admin/lanzador";
  if (has("métrica", "metrica", "reporte", "estadística", "estadistica")) return "/admin/metrics";

  // 3. Fallback: bandeja de contactos (donde vive el seguimiento institucional).
  return "/admin/gestion?view=contactos";
}

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h ${min % 60} min`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInicioData(): InicioData {
  // 1. Último daily_brief de Hermes
  //    Traemos SIEMPRE el más reciente, sin filtrar por fecha: si el job de las
  //    8am no corrió todavía (o falló), seguimos mostrando el último brief
  //    disponible (el de ayer) en vez de dejar la tarjeta vacía. El brief viejo
  //    se reemplaza recién cuando Hermes persiste uno nuevo.
  const { data: brief } = useQuery({
    queryKey: ["inicio_daily_brief"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_suggestions")
        .select("id, payload, created_at")
        .eq("tipo", "daily_brief")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Métricas de instituciones (DetectionBand)
  // Mails: usamos la MISMA fuente que la bandeja de Mails de Gestión
  // (hook useGmailHilos + matchesGmailFilter) para que el número de la tarjeta
  // y la lista del destino sean siempre idénticos.
  const { data: gmailHilos = [] } = useGmailHilos(false);
  const gmailEsperando = useMemo(
    () => gmailHilos.filter((h) => matchesGmailFilter(h, "esperando")).length,
    [gmailHilos]
  );
  const gmailEsperando5d = useMemo(
    () => gmailHilos.filter((h) => matchesGmailFilter(h, "esperando5d")).length,
    [gmailHilos]
  );

  const { data: clasifPending = 0 } = useQuery({
    queryKey: ["inicio_clasif_pending"],
    queryFn: async () => {
      const { count } = await supabase
        .from("agent_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "clasificacion")
        .eq("estado", "pending");
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  const { data: contactosSinConvenio = 0 } = useQuery({
    queryKey: ["inicio_contactos_sin_convenio"],
    queryFn: async () => {
      const { count } = await supabase
        .from("whatsapp_contactos")
        .select("chat_jid", { count: "exact", head: true })
        .eq("tipo", "sin_convenio");
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  const { data: contactosSinVincular = 0 } = useQuery({
    queryKey: ["inicio_contactos_sin_vincular"],
    queryFn: async () => {
      const { count } = await supabase
        .from("whatsapp_contactos")
        .select("chat_jid", { count: "exact", head: true })
        .is("institucion_id", null)
        .neq("tipo", "ignorado");
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  // 3. Métricas de solicitudes (SolicitudesBand)
  const { data: solicitudesActivas = [] } = useQuery({
    queryKey: ["inicio_solicitudes_activas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("solicitudes_pps")
        .select(
          "id, estado_seguimiento, actualizacion, created_at, nombre_institucion, nombre_alumno"
        )
        .not("estado_seguimiento", "in", "(Realizada,No se pudo concretar,Archivado)")
        .order("created_at", { ascending: false });
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: instituciones = [] } = useQuery({
    queryKey: ["inicio_instituciones_nombres"],
    queryFn: async () => {
      const { data } = await supabase.from("instituciones").select("id, nombre");
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: pendingCorrecciones = 0 } = useQuery({
    queryKey: ["inicio_correcciones_pending"],
    queryFn: async () => {
      const [mod, nuevas] = await Promise.all([
        supabase
          .from("solicitudes_modificacion_pps")
          .select("id", { count: "exact", head: true })
          .eq("estado", "pendiente"),
        supabase
          .from("solicitudes_nueva_pps")
          .select("id", { count: "exact", head: true })
          .eq("estado", "pendiente"),
      ]);
      return (mod.count ?? 0) + (nuevas.count ?? 0);
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: egresoMetrics = { total: 0, criticos: 0, atencion: 0, aprobados: 0 } } = useQuery({
    queryKey: ["inicio_egreso_metrics"],
    queryFn: async () => {
      // egreso pendiente = solicitudes con archivos cargados pero no marcadas como Cargado
      // contamos suggestions tipo=update_estado donde contexto.kind=verificacion_finalizacion
      const { data: verifs } = await supabase
        .from("agent_suggestions")
        .select("payload, contexto, created_at")
        .eq("tipo", "update_estado")
        .eq("estado", "pending");
      const all = (verifs || []).filter(
        (v) => (v.contexto as { kind?: string } | null)?.kind === "verificacion_finalizacion"
      );
      let criticos = 0,
        atencion = 0,
        aprobados = 0;
      for (const v of all) {
        const vp = (v.payload as { verificacion?: { estado?: string } } | null)?.verificacion ?? {};
        if (vp.estado === "critical") criticos++;
        else if (vp.estado === "attention") atencion++;
        else if (vp.estado === "verified") aprobados++;
      }
      return { total: all.length, criticos, atencion, aprobados };
    },
    staleTime: 2 * 60 * 1000,
  });

  // 4. Drafts (Hermes preparó N respuestas)
  const { data: rawDrafts = [] } = useQuery({
    queryKey: ["inicio_drafts_preview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_suggestions")
        .select("id, payload, contexto, institucion_id, tipo, created_at")
        .in("tipo", ["email_draft", "whatsapp_followup"])
        .eq("estado", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  // 5. Privacidad — total de contactos en lista PPS
  const { data: totalChatsPps = 0 } = useQuery({
    queryKey: ["inicio_total_chats_pps"],
    queryFn: async () => {
      const { count } = await supabase
        .from("whatsapp_contactos")
        .select("chat_jid", { count: "exact", head: true })
        .neq("tipo", "ignorado");
      return count ?? 0;
    },
    staleTime: 30 * 60 * 1000,
  });

  // ── Cómputos derivados ─────────────────────────────────────────────────────

  const briefPayload = (brief?.payload as Record<string, unknown> | undefined) ?? {};
  const rawBullets = (briefPayload.bullets as Array<unknown>) || [];
  const bullets = rawBullets.filter(
    (
      b
    ): b is {
      prioridad?: string;
      titulo?: string;
      por_que?: string;
      accion_sugerida?: string;
      recurso?: string;
      ref?: { tipo?: string; id?: string };
    } => typeof b === "object" && b !== null && !Array.isArray(b)
  );
  const briefingResumen =
    (briefPayload.resumen as string) ||
    (brief
      ? "Hermes todavía no generó el brief de hoy. Mostramos el análisis anterior hasta que llegue el nuevo."
      : "Hermes todavía no generó ningún brief. Aparecerá automáticamente a las 8am, o tocá \u201cReanalizar todo\u201d.");

  const ingresoActivas = solicitudesActivas.length;
  const ingresoSinMov = solicitudesActivas.filter((s) => {
    const ref = s.actualizacion ?? s.created_at;
    if (!ref) return false;
    const days = (Date.now() - new Date(ref).getTime()) / 86400000;
    return days > 4;
  }).length;
  const instNombres = new Set(instituciones.map((i) => (i.nombre || "").toLowerCase().trim()));
  const ingresoNoCat = solicitudesActivas.filter((s) => {
    const n = (s.nombre_institucion || "").toLowerCase().trim();
    return n && !instNombres.has(n);
  }).length;

  const detectionMetrics: DetectionMetric[] = [
    {
      id: "m-resp",
      tone: gmailEsperando > 0 ? "warn" : "accent",
      icon: "reply",
      n: gmailEsperando,
      label: "Te toca responder",
      sub: "Mails esperando respuesta",
      href: "/admin/gestion?view=mails&filter=esperando",
    },
    {
      id: "m-esp",
      tone: "accent",
      icon: "schedule_send",
      n: gmailEsperando5d,
      label: "Esperando +5 días",
      sub: "Te deben respuesta",
      href: "/admin/gestion?view=mails&filter=esperando5d",
    },
    {
      id: "m-dec",
      tone: "ai",
      icon: "pan_tool",
      n: clasifPending,
      label: "Requieren tu criterio",
      sub: "Hermes no decide esto",
      href: "/admin/gestion?view=contactos",
    },
    {
      id: "m-new",
      tone: "ok",
      icon: "person_add",
      n: contactosSinConvenio,
      label: "Instituciones nuevas",
      sub: `${contactosSinVincular} chats sin vincular`,
      href: "/admin/gestion?view=contactos",
    },
  ];

  const egresoNote =
    egresoMetrics.criticos > 0
      ? {
          note: `${egresoMetrics.criticos} con problemas críticos`,
          noteTone: "crit" as Tone,
          noteIcon: "error",
        }
      : egresoMetrics.atencion > 0
        ? {
            note: `${egresoMetrics.atencion} con observaciones`,
            noteTone: "warn" as Tone,
            noteIcon: "warning",
          }
        : egresoMetrics.aprobados > 0
          ? {
              note: `${egresoMetrics.aprobados} verificadas por Hermes`,
              noteTone: "ai" as Tone,
              noteIcon: "verified",
            }
          : { note: null, noteTone: null as Tone | null, noteIcon: null };

  const solicitudesMetrics: DetectionMetric[] = [
    {
      id: "s-ing",
      tone: ingresoSinMov > 0 ? "warn" : "accent",
      icon: "login",
      n: ingresoActivas,
      label: "Ingreso · PPS propuestas",
      sub: `${ingresoSinMov} sin movimiento +4d`,
      note: ingresoNoCat > 0 ? `${ingresoNoCat} sin catalogar` : null,
      noteTone: "warn",
      noteIcon: "help",
      href: "/admin/solicitudes?tab=ingreso",
    },
    {
      id: "s-egr",
      tone: egresoMetrics.criticos > 0 ? "crit" : egresoMetrics.atencion > 0 ? "warn" : "ok",
      icon: "logout",
      n: egresoMetrics.total,
      label: "Egreso · finalizaciones",
      sub: "Por acreditar",
      href: "/admin/solicitudes?tab=egreso",
      ...egresoNote,
    },
    {
      id: "s-cor",
      tone: "accent",
      icon: "edit_note",
      n: pendingCorrecciones,
      label: "Correcciones",
      sub: "Modificaciones y nuevas PPS",
      href: "/admin/solicitudes?tab=correcciones",
    },
  ];

  const drafts: DraftPreview[] = rawDrafts.slice(0, 3).map((d) => {
    const payload = (d.payload as Record<string, unknown>) || {};
    const contexto = (d.contexto as Record<string, unknown>) || {};
    const instId = (d.institucion_id as string | null) ?? null;
    const nombre =
      (instId && instituciones.find((i) => i.id === instId)?.nombre) ||
      (contexto.remitente as string) ||
      "Contacto";
    return {
      id: d.id,
      canal: d.tipo === "whatsapp_followup" ? "whatsapp" : "mail",
      nombre,
      borrador: (payload.borrador as string) || "",
      institucionId: instId,
      threadId: (contexto.thread_id as string) || null,
    };
  });

  const totalDrafts = rawDrafts.length;

  // Priorities — mapean desde bullets del daily_brief. Resolución de destino en
  // orden de confiabilidad:
  //   1. ref estructurado (id verificado por Hermes) → deep-link puntual.
  //   2. match por texto contra solicitudes reales (briefs viejos sin ref).
  //   3. destino genérico inferido del texto (último recurso).
  const priorities: PriorityItem[] = bullets.slice(0, 3).map((b, i) => {
    let href = hrefFromRef(b.ref, solicitudesActivas as SolicitudRef[]);
    if (!href) {
      const matched = matchSolicitud(
        { titulo: b.titulo, porQue: b.por_que },
        solicitudesActivas as SolicitudRef[]
      );
      if (matched) {
        const estado = (matched.estado_seguimiento || "").toLowerCase();
        const tab =
          estado.includes("finaliz") || estado.includes("acredita") ? "egreso" : "ingreso";
        href = `/admin/solicitudes?tab=${tab}&focus=${matched.id}`;
      }
    }
    if (!href) {
      href = resolvePriorityHref(b.recurso, {
        titulo: b.titulo,
        porQue: b.por_que,
        accion: b.accion_sugerida,
      });
    }
    return {
      id: `p-${i}`,
      tone: b.prioridad === "alta" ? "warn" : b.prioridad === "baja" ? "ok" : "accent",
      eyebrow: b.prioridad === "alta" ? "Urgente" : "Atención",
      title: b.titulo || "Sin título",
      detail: b.por_que || b.accion_sugerida || "",
      cta: "Revisar",
      href,
    };
  });

  // Briefing lead computed
  const totalSolicitudes = ingresoActivas + egresoMetrics.total + pendingCorrecciones;
  const novedadesInst = gmailEsperando + clasifPending;
  const lead =
    briefingResumen ||
    `Buenos días. Tenés ${totalSolicitudes} solicitudes esperando y ${novedadesInst} novedades de instituciones.`;

  const briefingBody: string[] = [];
  if (briefingResumen) {
    // si Hermes ya escribió el resumen, lo dejamos como lead — el body se arma de bullets si hay
    if (bullets.length > 0) {
      briefingBody.push(
        ...bullets.slice(0, 3).map((b) => b.por_que || b.accion_sugerida || b.titulo || "")
      );
    }
  } else {
    briefingBody.push(
      `Activá el daily brief de Hermes para recibir el resumen editorial cada mañana a las 8.`
    );
  }

  // Etiqueta de cuándo se generó el brief que estamos mostrando.
  // Si es de hoy: "generado 08:00 · hace 2 h". Si es de un día anterior (porque
  // el de hoy aún no llegó): lo marcamos con la fecha para que se note que es el
  // análisis previo, no uno nuevo.
  let generadoAgo = "todavía sin generar";
  if (brief?.created_at) {
    const created = new Date(brief.created_at);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const esDeHoy = created.getTime() >= todayStart.getTime();
    const hora = created.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    if (esDeHoy) {
      generadoAgo = `generado ${hora} · ${timeAgo(brief.created_at)}`;
    } else {
      const fecha = created.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
      generadoAgo = `del ${fecha} ${hora} · ${timeAgo(brief.created_at)} (esperando el de hoy)`;
    }
  }

  return {
    briefing: {
      lead,
      body: briefingBody.filter(Boolean),
      generadoAgo,
      totalChats: totalChatsPps,
      listaNombre: "PPS",
    },
    detectionMetrics,
    solicitudesMetrics,
    drafts,
    totalDrafts,
    priorities,
    loaded: !!brief !== undefined,
  };
}
