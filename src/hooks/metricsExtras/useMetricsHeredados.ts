import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

// ════════════════════════════════════════════════════════════════════════════
// ESTUDIANTES HEREDADOS — con cuántos alumnos se arrancó el ciclo
// Alumnos de cohortes anteriores (2024+) que no habían finalizado al iniciar el
// año. Solo cohortes >= 2024 (los datos previos de Airtable no son confiables).
// ════════════════════════════════════════════════════════════════════════════
export const useMetricsHeredados = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsHeredados", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_heredados_count", { p_year: year });
      if (error) throw error;
      return Number(data) || 0;
    },
  });
};
