// ──────────────────────────────────────────────────────────────────────────
// useGmailHilos — bandeja de correos institucionales (tabla `gmail_hilos`)
//
// Es la MISMA fuente que alimenta las tarjetas del dashboard "Te toca responder"
// y "Esperando +5 días", para que el número de la tarjeta y la lista del destino
// sean siempre coherentes:
//
//   · esperando_respuesta  → estado = "esperando_respuesta"  (te toca responder)
//   · esperando_5d         → estado = "respondido_por_nos" y último mensaje > 5 días
//
// Shadow mode: solo SELECT. No envía ni cambia estados.
// ──────────────────────────────────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { mockDb } from "../services/mockDb";

export type GmailFilter = "todos" | "esperando" | "esperando5d";

export interface GmailHilo {
  thread_id: string;
  asunto: string | null;
  estado: string;
  clasificacion: string | null;
  institucion_id: string | null;
  email_institucion?: string | null;
  participantes: unknown;
  primer_mensaje_at: string | null;
  ultimo_mensaje_at: string | null;
  ultimo_mensaje_de: string | null;
  /** Últimos mensajes del hilo (para previsualización local sin pedir al backend). */
  raw_mensajes?: Array<Record<string, unknown>> | null;
}

const FIVE_DAYS_MS = 5 * 86400 * 1000;

/** Devuelve true si el hilo cae en el filtro pedido (misma lógica que el dashboard). */
export const matchesGmailFilter = (h: GmailHilo, filter: GmailFilter): boolean => {
  // Los hilos archivados / en papelera nunca aparecen en la bandeja activa.
  if (h.estado === "archivado" || h.estado === "trash") return false;
  if (filter === "todos") return true;
  if (filter === "esperando") return h.estado === "esperando_respuesta";
  if (filter === "esperando5d") {
    if (h.estado !== "respondido_por_nos") return false;
    const ts = h.ultimo_mensaje_at ? new Date(h.ultimo_mensaje_at).getTime() : 0;
    return ts > 0 && Date.now() - ts > FIVE_DAYS_MS;
  }
  return true;
};

export const useGmailHilos = (isTestingMode = false) => {
  return useQuery<GmailHilo[]>({
    queryKey: ["gmailHilos", isTestingMode],
    enabled: !isTestingMode,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (isTestingMode) {
        const rows = await mockDb.getAll("gmail_hilos");
        return (rows || []) as unknown as GmailHilo[];
      }
      const { data, error } = await supabase
        .from("gmail_hilos")
        .select("*")
        .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as GmailHilo[];
    },
  });
};
