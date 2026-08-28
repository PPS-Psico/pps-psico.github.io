import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

/**
 * useInstitucionContexto
 *
 * Lee, en modo solo-lectura, el contexto que Hermes/n8n ya dejan en Supabase
 * para una institución concreta:
 *   · institucion_resumen → la "nota de Hermes" (resumen + pendientes concretos).
 *   · whatsapp_mensajes + gmail_hilos → hilo unificado de conversación.
 *
 * Shadow mode: el panel sólo hace SELECT. No envía, no escribe, no resuelve nada.
 */

export interface PendienteConcreto {
  accion: string;
  vencimiento?: string | null;
}

export interface HermesResumen {
  resumen: string;
  pendientes: PendienteConcreto[];
  ultimoCanal: string | null;
  ultimoContactoAt: string | null;
  actualizadoAt: string | null;
}

export type Canal = "whatsapp" | "mail";

export interface ConversationEntry {
  id: string;
  canal: Canal;
  fromMe: boolean;
  autor: string | null;
  texto: string;
  ts: number; // epoch ms para ordenar
  asunto?: string | null;
}

export interface ContactoValidado {
  chatJid: string;
  phone: string | null;
  nombre: string | null;
  tipo: string | null;
  validadoAt: string | null;
}

export interface InstitucionContexto {
  resumen: HermesResumen | null;
  conversacion: ConversationEntry[];
  contactosValidados: ContactoValidado[];
}

// ─── Parsers defensivos ───────────────────────────────────────────────────────

function parsePendientes(raw: unknown): PendienteConcreto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p): PendienteConcreto | null => {
      if (typeof p === "string") return { accion: p };
      if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        const accion = (o.accion || o.titulo || o.texto || o.descripcion) as string | undefined;
        if (!accion) return null;
        return {
          accion,
          vencimiento: (o.vencimiento || o.fecha || o.due) as string | null | undefined,
        };
      }
      return null;
    })
    .filter((p): p is PendienteConcreto => !!p);
}

const tsOf = (v: unknown): number => {
  if (!v) return 0;
  const t = new Date(v as string).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** gmail_hilos.raw_mensajes tiene forma incierta; extraemos lo mejor posible. */
function parseGmailMensajes(hilo: Record<string, unknown>): ConversationEntry[] {
  const threadId = String(hilo.thread_id || "");
  const asunto = (hilo.asunto as string) || null;
  const raw = hilo.raw_mensajes;

  const fromArray = (arr: unknown[]): ConversationEntry[] =>
    arr
      .map((m, i): ConversationEntry | null => {
        if (!m || typeof m !== "object") return null;
        const o = m as Record<string, unknown>;
        const texto = (o.texto || o.snippet || o.body || o.cuerpo || o.preview) as
          | string
          | undefined;
        if (!texto) return null;
        const fecha = o.fecha || o.date || o.timestamp || o.received_at;
        const de = (o.de || o.from || o.remitente || o.autor) as string | undefined;
        const fromMe =
          typeof o.from_me === "boolean"
            ? (o.from_me as boolean)
            : typeof o.fromMe === "boolean"
              ? (o.fromMe as boolean)
              : /coordinacion|uflo|psicolog/i.test(de || "");
        return {
          id: `${threadId}-${i}`,
          canal: "mail",
          fromMe,
          autor: de || null,
          texto: String(texto),
          ts: tsOf(fecha) || tsOf(hilo.ultimo_mensaje_at),
          asunto,
        };
      })
      .filter((e): e is ConversationEntry => !!e);

  if (Array.isArray(raw) && raw.length > 0) {
    const parsed = fromArray(raw);
    if (parsed.length > 0) return parsed;
  }
  // Fallback: una entrada a nivel hilo
  const de = (hilo.ultimo_mensaje_de as string) || null;
  return [
    {
      id: `${threadId}-thread`,
      canal: "mail",
      fromMe: /coordinacion|uflo|psicolog/i.test(de || ""),
      autor: de,
      texto: asunto ? `(Mail) ${asunto}` : "(Hilo de mail sin cuerpo legible)",
      ts: tsOf(hilo.ultimo_mensaje_at) || tsOf(hilo.primer_mensaje_at),
      asunto,
    },
  ];
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useInstitucionContexto(institucionId: string | null, isTestingMode = false) {
  const enabled = !!institucionId && !isTestingMode;

  return useQuery<InstitucionContexto>({
    queryKey: ["institucion_contexto", institucionId],
    enabled,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<InstitucionContexto> => {
      if (!institucionId) return { resumen: null, conversacion: [], contactosValidados: [] };

      const [resumenRes, waRes, mailRes, contactosRes] = await Promise.all([
        supabase
          .from("institucion_resumen")
          .select("resumen, pendientes_concretos, ultimo_canal, ultimo_contacto_at, actualizado_at")
          .eq("institucion_id", institucionId)
          .maybeSingle(),
        supabase
          .from("whatsapp_mensajes")
          .select("id, from_me, texto, timestamp, autor, media_tipo")
          .eq("institucion_id", institucionId)
          .order("timestamp", { ascending: false })
          .limit(40),
        supabase
          .from("gmail_hilos")
          .select(
            "thread_id, asunto, raw_mensajes, ultimo_mensaje_at, ultimo_mensaje_de, primer_mensaje_at"
          )
          .eq("institucion_id", institucionId)
          .order("ultimo_mensaje_at", { ascending: false })
          .limit(10),
        // Contactos de WhatsApp ya validados y vinculados a esta institución
        // (los que se aprueban en la pestaña "Contactos"). Cierra el loop: el
        // teléfono/nombre validado aparece en la ficha.
        supabase
          .from("whatsapp_contactos")
          .select("chat_jid, phone, nombre_contacto, tipo, validado_at")
          .eq("institucion_id", institucionId)
          .order("validado_at", { ascending: false }),
      ]);

      // Resumen de Hermes
      let resumen: HermesResumen | null = null;
      if (resumenRes.data && resumenRes.data.resumen) {
        const d = resumenRes.data as Record<string, unknown>;
        resumen = {
          resumen: String(d.resumen),
          pendientes: parsePendientes(d.pendientes_concretos),
          ultimoCanal: (d.ultimo_canal as string) || null,
          ultimoContactoAt: (d.ultimo_contacto_at as string) || null,
          actualizadoAt: (d.actualizado_at as string) || null,
        };
      }

      // WhatsApp
      const wa: ConversationEntry[] = (waRes.data || []).map((m) => {
        const o = m as Record<string, unknown>;
        const media = o.media_tipo as string | null;
        return {
          id: String(o.id),
          canal: "whatsapp" as const,
          fromMe: !!o.from_me,
          autor: (o.autor as string) || null,
          texto: (o.texto as string) || (media ? `(${media})` : "(mensaje sin texto)"),
          ts: tsOf(o.timestamp),
        };
      });

      // Mail
      const mail: ConversationEntry[] = (mailRes.data || []).flatMap((h) =>
        parseGmailMensajes(h as Record<string, unknown>)
      );

      const conversacion = [...wa, ...mail].filter((e) => e.ts > 0).sort((a, b) => b.ts - a.ts);

      // Contactos validados vinculados a la institución (excluye ignorados)
      const contactosValidados: ContactoValidado[] = (contactosRes.data || [])
        .filter((c) => (c as Record<string, unknown>).tipo !== "ignorado")
        .map((c) => {
          const o = c as Record<string, unknown>;
          return {
            chatJid: String(o.chat_jid || ""),
            phone: (o.phone as string) || null,
            nombre: (o.nombre_contacto as string) || null,
            tipo: (o.tipo as string) || null,
            validadoAt: (o.validado_at as string) || null,
          };
        });

      return { resumen, conversacion, contactosValidados };
    },
  });
}
