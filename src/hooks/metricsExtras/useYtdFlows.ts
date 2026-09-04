import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { parseToUTCDate } from "../../utils/formatters";

// ════════════════════════════════════════════════════════════════════════════
// FLUJOS ACUMULADOS AL MISMO DÍA DEL AÑO (comparativo YTD)
// Cuenta actividad del año acotada al mismo día del calendario que hoy, para
// comparar dos ciclos "hasta el mismo momento" y no un año completo contra otro
// en curso. Sólo métricas de flujo (se acumulan): postulaciones, alumnos
// postulados y finalizados. Las de stock (matrícula activa, etc.) no se pueden
// recortar sin snapshots históricos, así que quedan fuera del modo YTD.
// ════════════════════════════════════════════════════════════════════════════
export interface YtdFlows {
  year: number;
  cutoffISO: string;
  metricVersion: string;
  postulaciones: number;
  postulados: number;
  /** false cuando la migración histórica no conserva demanda completa. */
  demandaDisponible: boolean;
  finalizados: number;
  /** Estudiantes distintos con práctica iniciada hasta el corte. */
  enPps: number;
  capacity: {
    fixedOffered: number;
    realized: number;
    operational: number;
    launches: number;
    fixedOverCapacityLaunches: number;
    fixedOverCapacityAvailable: boolean;
    source: string;
    dateBasis: string;
    capacityComplete: boolean;
    comparable: boolean;
    finiteOfferCoveragePct: number | null;
    documentedFiniteOffers: number | null;
    unknownOrRealizedOffers: number;
  };
  quality: {
    selectedAtN: number;
    selectedTotalN: number;
    selectedAtCoveragePct: number | null;
    practiceLaunchLinkCoveragePct: number | null;
    launchInstitutionLinkCoveragePct: number | null;
  };
}

// Límite superior exclusivo: inicio del día siguiente al mismo día/mes de hoy,
// en el año pedido, acotado al fin de ese año. Se calcula en UTC para alinear
// con las fechas de la base (parseToUTCDate devuelve medianoche UTC).
export const ytdCutoff = (year: number, now = new Date()): Date => {
  const cut = new Date(Date.UTC(year, now.getMonth(), now.getDate() + 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  return cut < yearEnd ? cut : yearEnd;
};

export const useYtdFlows = ({
  year,
  isTestingMode = false,
  fullYear = false,
}: {
  year: number;
  isTestingMode?: boolean;
  /** Usa el cierre anual; por defecto corta al mismo día/mes para comparar YTD. */
  fullYear?: boolean;
}) => {
  return useQuery({
    queryKey: ["ytdFlows", year, fullYear, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<YtdFlows> => {
      const exclusiveCutoff = fullYear ? new Date(Date.UTC(year + 1, 0, 1)) : ytdCutoff(year);
      const cutoffDate = new Date(exclusiveCutoff.getTime() - 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("get_analytics_v2", {
        p_year: year,
        p_cutoff: cutoffDate,
      });
      if (error) throw error;
      const payload = (data || {}) as Record<string, unknown>;
      const flows = (payload.flows || {}) as Record<string, unknown>;
      const capacity = (payload.capacity || {}) as Record<string, unknown>;
      const quality = (payload.quality || {}) as Record<string, unknown>;
      const nullableNumber = (value: unknown): number | null => {
        if (value == null) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      return {
        year,
        cutoffISO: cutoffDate,
        metricVersion: String(payload.metric_version || "analytics-v2"),
        postulaciones: Number(flows.applications) || 0,
        postulados: Number(flows.applicants) || 0,
        demandaDisponible: flows.demand_available === true,
        finalizados: Number(flows.finalized) || 0,
        enPps: Number(flows.pps_started) || 0,
        capacity: {
          fixedOffered: Number(capacity.fixed_offered) || 0,
          realized: Number(capacity.realized) || 0,
          operational: Number(capacity.operational) || 0,
          launches: Number(capacity.launches) || 0,
          fixedOverCapacityLaunches: Number(capacity.fixed_over_capacity_launches) || 0,
          fixedOverCapacityAvailable: capacity.fixed_over_capacity_available !== false,
          source: String(capacity.source || "operational_launches"),
          dateBasis: String(capacity.date_basis || "launch_start_date"),
          capacityComplete: capacity.capacity_complete !== false,
          comparable: capacity.comparable !== false,
          finiteOfferCoveragePct: nullableNumber(capacity.finite_offer_coverage_pct),
          documentedFiniteOffers: nullableNumber(capacity.documented_finite_offers),
          unknownOrRealizedOffers: Number(capacity.unknown_or_realized_offers) || 0,
        },
        quality: {
          selectedAtN: Number(quality.selected_at_n) || 0,
          selectedTotalN: Number(quality.selected_total_n) || 0,
          selectedAtCoveragePct: nullableNumber(quality.selected_at_coverage_pct),
          practiceLaunchLinkCoveragePct: nullableNumber(quality.practice_launch_link_coverage_pct),
          launchInstitutionLinkCoveragePct: nullableNumber(
            quality.launch_institution_link_coverage_pct
          ),
        },
      };
    },
  });
};
