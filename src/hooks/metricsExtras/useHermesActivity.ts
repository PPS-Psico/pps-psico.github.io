import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { range } from "./shared";

// ════════════════════════════════════════════════════════════════════════════
// ACTIVIDAD DE HERMES (fuente, no voz): conversaciones analizadas en el año.
// WhatsApp (mensajes) + Gmail (hilos). Solo lectura agregada.
// ════════════════════════════════════════════════════════════════════════════
export const useHermesActivity = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["hermesActivity", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<{ total: number; whatsapp: number; gmail: number }> => {
      const { start, end } = range(year);
      const [whatsappResult, gmailResult] = await Promise.all([
        supabase
          .from("whatsapp_mensajes")
          .select("id", { count: "exact", head: true })
          .gte("timestamp", start)
          .lt("timestamp", end),
        supabase
          .from("gmail_hilos")
          .select("thread_id", { count: "exact", head: true })
          .gte("ultimo_mensaje_at", start)
          .lt("ultimo_mensaje_at", end),
      ]);
      if (whatsappResult.error) throw whatsappResult.error;
      if (gmailResult.error) throw gmailResult.error;
      const whatsapp = whatsappResult.count || 0;
      const gmail = gmailResult.count || 0;
      return { total: whatsapp + gmail, whatsapp, gmail };
    },
  });
};
