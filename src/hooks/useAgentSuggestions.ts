import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../utils/logger";
import { learnFromFeedback } from "../services/hermesLearn";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyBriefMetrics {
  emails_procesados?: number;
  instituciones_respondidas?: number;
  borradores_generados?: number;
  borradores_pendientes?: number;
  tasa_confianza?: number;
  [key: string]: unknown;
}

export interface DailyBriefBullet {
  prioridad: "alta" | "media" | "baja";
  titulo: string;
  por_que: string;
  accion_sugerida: string;
  recurso?: string;
}

export interface DailyBrief {
  id: string;
  resumen: string;
  estado_operativo: "estable" | "alerta" | "critico";
  bullets: DailyBriefBullet[];
  metricas: DailyBriefMetrics;
  created_at: string;
}

export interface EmailDraft {
  id: string;
  to: string;
  subject: string;
  borrador: string;
  justificacion: string;
  confidence: number;
  thread_id?: string;
  institucion_id?: string;
  created_at: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentSuggestions(isTestingMode = false) {
  const queryClient = useQueryClient();

  // ── Daily Brief ──────────────────────────────────────────────────────────
  const { data: dailyBrief, isLoading: isBriefLoading } = useQuery<DailyBrief | null>({
    queryKey: ["daily_brief"],
    queryFn: async () => {
      if (isTestingMode) return null;

      // Traemos SIEMPRE el brief más reciente (sin filtrar por fecha): si el de
      // hoy todavía no se generó, seguimos mostrando el último disponible en vez
      // de quedarnos sin análisis.
      const { data, error } = await supabase
        .from("agent_suggestions")
        .select("id, payload, created_at")
        .eq("tipo", "daily_brief")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.error("[useAgentSuggestions] Error fetching daily brief:", error);
        return null;
      }
      if (!data) return null;

      const payload = data.payload as Record<string, unknown>;
      const bullets = Array.isArray(payload?.bullets)
        ? (payload.bullets as DailyBriefBullet[])
        : [];
      const highPriorityCount = bullets.filter((b) => b.prioridad === "alta").length;
      return {
        id: data.id,
        resumen: (payload?.resumen as string) || "Sin resumen disponible.",
        estado_operativo:
          (payload?.estado_operativo as DailyBrief["estado_operativo"]) ||
          (highPriorityCount >= 3 ? "critico" : highPriorityCount > 0 ? "alerta" : "estable"),
        bullets,
        metricas: (payload?.metricas as DailyBriefMetrics) || {},
        created_at: data.created_at,
      };
    },
    enabled: !isTestingMode,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // ── Email Drafts ─────────────────────────────────────────────────────────
  const { data: emailDrafts = [], isLoading: isDraftsLoading } = useQuery<EmailDraft[]>({
    queryKey: ["email_drafts_pending"],
    queryFn: async () => {
      if (isTestingMode) return [];

      const { data, error } = await supabase
        .from("agent_suggestions")
        .select("id, payload, contexto, institucion_id, created_at")
        .eq("tipo", "email_draft")
        .eq("estado", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[useAgentSuggestions] Error fetching email drafts:", error);
        return [];
      }
      if (!data || data.length === 0) return [];

      // Resolve institution names in a single extra query
      const instIds = [...new Set(data.map((d) => d.institucion_id).filter(Boolean))] as string[];
      let instMap: Record<string, string> = {};
      if (instIds.length > 0) {
        const { data: insts } = await supabase
          .from("instituciones")
          .select("id, nombre")
          .in("id", instIds);
        if (insts)
          insts.forEach((i) => {
            if (i.id) instMap[i.id] = i.nombre ?? "";
          });
      }

      return data.map((d) => {
        const payload = (d.payload as Record<string, unknown>) || {};
        const contexto = (d.contexto as Record<string, unknown>) || {};
        return {
          id: d.id,
          to: instMap[d.institucion_id ?? ""] || (contexto.remitente as string) || "Institución",
          subject: (payload.asunto as string) || "Sin asunto",
          borrador: (payload.borrador as string) || "",
          justificacion: (payload.justificacion as string) || "",
          confidence: (payload.confidence as number) || 0,
          thread_id: contexto.thread_id as string | undefined,
          institucion_id: d.institucion_id ?? undefined,
          created_at: d.created_at,
        };
      });
    },
    enabled: !isTestingMode,
    staleTime: 2 * 60 * 1000, // 2 min
  });

  // ── Approve Draft ─────────────────────────────────────────────────────────
  const approveDraft = useMutation({
    mutationFn: async ({ id, editedText }: { id: string; editedText?: string }) => {
      // Leemos el payload original (para el diff que aprende Hermes) y el tipo.
      const { data: existing } = await supabase
        .from("agent_suggestions")
        .select("payload, tipo")
        .eq("id", id)
        .single();
      const originalPayload = (existing?.payload as Record<string, unknown>) || {};
      const edited = editedText !== undefined;

      const updatePayload: Record<string, unknown> = { estado: edited ? "edited" : "approved" };
      if (edited) {
        // Persist edited text back into payload.borrador
        updatePayload.payload = {
          ...originalPayload,
          borrador: editedText,
          editado_por_humano: true,
        };
      }
      const { error } = await supabase.from("agent_suggestions").update(updatePayload).eq("id", id);
      if (error) throw error;

      // Cerramos el loop de aprendizaje (best-effort, no bloquea la UI).
      void learnFromFeedback({
        suggestionId: id,
        accion: edited ? "edited" : "approved",
        tipo: (existing?.tipo as string) || "email_draft",
        payloadOriginal: originalPayload,
        payloadFinal: edited ? { ...originalPayload, borrador: editedText } : null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["email_drafts_pending"] });
    },
  });

  // ── Discard Draft ─────────────────────────────────────────────────────────
  const discardDraft = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data: existing } = await supabase
        .from("agent_suggestions")
        .select("payload, tipo")
        .eq("id", id)
        .single();
      const basePayload = (existing?.payload as Record<string, unknown>) || {};

      const updatePayload: Record<string, unknown> = { estado: "discarded" };
      if (reason) {
        // Preservar payload original; sumar motivo_descarte sin sobreescribir
        updatePayload.payload = { ...basePayload, motivo_descarte: reason };
      }
      const { error } = await supabase.from("agent_suggestions").update(updatePayload).eq("id", id);
      if (error) throw error;

      void learnFromFeedback({
        suggestionId: id,
        accion: "discarded",
        tipo: (existing?.tipo as string) || "email_draft",
        payloadOriginal: basePayload,
        motivo: reason,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["email_drafts_pending"] });
    },
  });

  return {
    // Data
    dailyBrief,
    emailDrafts,
    // Loading states
    isBriefLoading,
    isDraftsLoading,
    // Mutations
    approveDraft,
    discardDraft,
  };
}
