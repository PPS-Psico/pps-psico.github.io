import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

export interface MetricsKPIs {
  matricula_generada: number;
  alumnos_finalizados: number;
  matricula_activa: number;
  sin_pps: number;
  proximos_finalizar: number;
  haciendo_pps: number;
  pps_lanzadas: number;
  instituciones_activas: number;
  cupos_ofrecidos: number;
  nuevos_convenios: number;
  orientation_distribution: Record<string, number>;
  enrollment_evolution: { year: string; value: number }[];
  trend_data: { year: string; value: number }[];
  trends: {
    matricula_generada: number;
    acreditados: number;
    activos: number;
  };
  target_year: number;
}

const emptyKPIs = (year: number): MetricsKPIs => ({
  matricula_generada: 0,
  alumnos_finalizados: 0,
  matricula_activa: 0,
  sin_pps: 0,
  proximos_finalizar: 0,
  haciendo_pps: 0,
  pps_lanzadas: 0,
  instituciones_activas: 0,
  cupos_ofrecidos: 0,
  nuevos_convenios: 0,
  orientation_distribution: {},
  enrollment_evolution: [],
  trend_data: [],
  trends: { matricula_generada: 0, acreditados: 0, activos: 0 },
  target_year: year,
});

export const useMetricsData = ({
  targetYear,
  isTestingMode = false,
}: {
  targetYear: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsKPIs", targetYear, isTestingMode],
    queryFn: async (): Promise<MetricsKPIs> => {
      if (isTestingMode) return emptyKPIs(targetYear);
      const { data, error } = await supabase.rpc("get_admin_metrics_kpis", {
        p_year: targetYear,
      });
      if (error) throw error;
      return data as unknown as MetricsKPIs;
    },
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });
};

export const useMetricsYears = (isTestingMode = false) => {
  return useQuery({
    queryKey: ["metricsYears"],
    queryFn: async (): Promise<number[]> => {
      if (isTestingMode) {
        const now = new Date().getFullYear();
        return [now, now - 1, now - 2];
      }
      const { data, error } = await supabase.rpc("get_metrics_years");
      if (error) throw error;
      return ((data || []) as unknown as number[]).sort((a, b) => b - a);
    },
    staleTime: 1000 * 60 * 10,
  });
};
