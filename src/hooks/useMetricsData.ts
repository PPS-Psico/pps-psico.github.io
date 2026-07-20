import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { fetchStartedOrientationDistribution } from "../services/metricsLists";
import {
  fetchAnalyticsSnapshot,
  reportCutoff,
} from "../features/executive-report/executiveReport.service";
import type { AnalyticsSnapshot } from "../features/executive-report/executiveReport.types";
import { fetchDirectorReportSnapshot } from "../features/executive-report/directorReport.service";
import type { DirectorReportSnapshot } from "../features/executive-report/directorReport.types";

export interface MetricsKPIs {
  analytics_version: string;
  matricula_generada: number;
  estudiantes_en_pps: number;
  estudiantes_en_pps_prev: number;
  alumnos_finalizados: number;
  alumnos_finalizados_prev: number;
  postulaciones: number | null;
  estudiantes_postulados: number | null;
  demanda_disponible: boolean;
  matricula_activa: number;
  sin_pps: number;
  proximos_finalizar: number;
  listos_solicitar: number;
  en_acreditacion: number;
  haciendo_pps: number;
  pps_lanzadas: number;
  pps_lanzadas_prev: number;
  instituciones_activas: number;
  cupos_ofrecidos: number;
  cupos_ofrecidos_prev: number;
  cupos_fijos: number;
  cupos_realizados: number;
  capacity_source: string;
  capacity_date_basis: string;
  capacity_complete: boolean;
  capacity_comparable: boolean;
  capacity_finite_offer_coverage_pct: number | null;
  capacity_documented_finite_offers: number | null;
  capacity_unknown_or_realized_offers: number;
  nuevos_convenios: number;
  orientation_distribution: Record<string, number>;
  enrollment_evolution: { year: string; value: number }[];
  finalization_evolution: { year: string; value: number }[];
  trend_data: { year: string; value: number }[];
  trends: {
    matricula_generada: number;
    estudiantes_en_pps: number;
    acreditados: number;
    activos: number;
  };
  target_year: number;
  cutoff_iso: string;
  analytics_snapshot: AnalyticsSnapshot | null;
  comparison_snapshot: AnalyticsSnapshot | null;
  operational_snapshot: DirectorReportSnapshot | null;
}

const emptyKPIs = (year: number): MetricsKPIs => ({
  analytics_version: "analytics-v2",
  matricula_generada: 0,
  estudiantes_en_pps: 0,
  estudiantes_en_pps_prev: 0,
  alumnos_finalizados: 0,
  alumnos_finalizados_prev: 0,
  postulaciones: null,
  estudiantes_postulados: null,
  demanda_disponible: false,
  matricula_activa: 0,
  sin_pps: 0,
  proximos_finalizar: 0,
  listos_solicitar: 0,
  en_acreditacion: 0,
  haciendo_pps: 0,
  pps_lanzadas: 0,
  pps_lanzadas_prev: 0,
  instituciones_activas: 0,
  cupos_ofrecidos: 0,
  cupos_ofrecidos_prev: 0,
  cupos_fijos: 0,
  cupos_realizados: 0,
  capacity_source: "operational_launches",
  capacity_date_basis: "launch_start_date",
  capacity_complete: true,
  capacity_comparable: true,
  capacity_finite_offer_coverage_pct: null,
  capacity_documented_finite_offers: null,
  capacity_unknown_or_realized_offers: 0,
  nuevos_convenios: 0,
  orientation_distribution: {},
  enrollment_evolution: [],
  finalization_evolution: [],
  trend_data: [],
  trends: { matricula_generada: 0, estudiantes_en_pps: 0, acreditados: 0, activos: 0 },
  target_year: year,
  cutoff_iso: `${year}-12-31`,
  analytics_snapshot: null,
  comparison_snapshot: null,
  operational_snapshot: null,
});

const percentChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

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

      const legacy = data as unknown as MetricsKPIs;
      const currentYear = new Date().getFullYear();
      const comparableYtd = targetYear === currentYear;
      const seriesYears = Array.from(
        new Set([
          targetYear,
          targetYear - 1,
          ...(legacy.enrollment_evolution || []).map((entry) => Number(entry.year)),
        ])
      )
        .filter((year) => Number.isInteger(year) && year >= 2018 && year <= currentYear)
        .sort((a, b) => a - b);

      // analytics-v2 es la fuente autoritativa de los flujos y de la capacidad.
      // Para el año en curso todas las series se recortan al mismo día/mes,
      // evitando comparar un YTD contra ciclos completos.
      const analyticsByYear = new Map<number, AnalyticsSnapshot>();
      const [payloads, orientationDistribution, directorSnapshot] = await Promise.all([
        Promise.all(
          seriesYears.map(async (year) => ({
            year,
            payload: await fetchAnalyticsSnapshot(year, reportCutoff(year, !comparableYtd)),
          }))
        ),
        fetchStartedOrientationDistribution(targetYear),
        fetchDirectorReportSnapshot(targetYear, reportCutoff(currentYear, false)),
      ]);
      payloads.forEach(({ year, payload }) => analyticsByYear.set(year, payload));

      const current = analyticsByYear.get(targetYear);
      const previous = analyticsByYear.get(targetYear - 1);
      if (!current) throw new Error(`analytics-v2 no devolvio el ciclo ${targetYear}`);
      const started = current.flows.ppsStarted;
      const startedPrevious = previous?.flows.ppsStarted || 0;
      const finalized = current.flows.finalized;
      const finalizedPrevious = previous?.flows.finalized || 0;
      const finiteCoverage = current.capacity.finiteOfferCoveragePct;
      const documentedFiniteOffers = current.capacity.documentedFiniteOffers;

      return {
        ...legacy,
        analytics_version: current.metricVersion,
        estudiantes_en_pps: started,
        estudiantes_en_pps_prev: startedPrevious,
        alumnos_finalizados: finalized,
        alumnos_finalizados_prev: finalizedPrevious,
        matricula_activa: directorSnapshot.studentSummary.activeStudents,
        sin_pps: directorSnapshot.studentSummary.withoutPps,
        proximos_finalizar: directorSnapshot.studentSummary.nearCompletion,
        listos_solicitar: directorSnapshot.studentSummary.readyToRequest,
        en_acreditacion: directorSnapshot.studentSummary.inAccreditation,
        postulaciones: current.flows.applications,
        estudiantes_postulados: current.flows.applicants,
        demanda_disponible: current.flows.demandAvailable,
        pps_lanzadas: current.capacity.launches,
        pps_lanzadas_prev: previous?.capacity.launches || 0,
        cupos_ofrecidos: current.capacity.operational,
        cupos_ofrecidos_prev: previous?.capacity.operational || 0,
        cupos_fijos: current.capacity.fixedOffered,
        cupos_realizados: current.capacity.realized,
        capacity_source: current.capacity.source,
        capacity_date_basis: current.capacity.dateBasis,
        capacity_complete: current.capacity.complete,
        capacity_comparable: current.capacity.comparable,
        capacity_finite_offer_coverage_pct:
          finiteCoverage == null || !Number.isFinite(Number(finiteCoverage))
            ? null
            : Number(finiteCoverage),
        capacity_documented_finite_offers:
          documentedFiniteOffers == null || !Number.isFinite(Number(documentedFiniteOffers))
            ? null
            : Number(documentedFiniteOffers),
        capacity_unknown_or_realized_offers: current.capacity.unknownOrRealizedOffers,
        orientation_distribution: orientationDistribution,
        enrollment_evolution: seriesYears.map((year) => ({
          year: String(year),
          value: analyticsByYear.get(year)?.flows.ppsStarted || 0,
        })),
        finalization_evolution: seriesYears.map((year) => ({
          year: String(year),
          value: analyticsByYear.get(year)?.flows.finalized || 0,
        })),
        trends: {
          ...legacy.trends,
          estudiantes_en_pps: percentChange(started, startedPrevious),
          acreditados: percentChange(finalized, finalizedPrevious),
        },
        cutoff_iso: current.cutoffISO,
        analytics_snapshot: current,
        comparison_snapshot: previous || null,
        operational_snapshot: directorSnapshot,
      };
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
