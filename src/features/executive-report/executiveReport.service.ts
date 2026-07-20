import { supabase } from "../../lib/supabaseClient";
import type { AnalyticsSnapshot } from "./executiveReport.types";

const nullableNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const reportCutoff = (year: number, fullYear: boolean, now = new Date()): string => {
  if (fullYear) return `${year}-12-31`;
  const month = now.getMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(now.getDate(), lastDay);
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
};

export const parseAnalyticsSnapshot = (
  year: number,
  cutoffISO: string,
  raw: unknown
): AnalyticsSnapshot => {
  const payload = (raw || {}) as Record<string, unknown>;
  const flows = (payload.flows || {}) as Record<string, unknown>;
  const capacity = (payload.capacity || {}) as Record<string, unknown>;
  const quality = (payload.quality || {}) as Record<string, unknown>;
  const demandAvailable = flows.demand_available === true;

  return {
    year,
    cutoffISO,
    metricVersion: String(payload.metric_version || "analytics-v2"),
    flows: {
      applications: demandAvailable ? Number(flows.applications) || 0 : null,
      applicants: demandAvailable ? Number(flows.applicants) || 0 : null,
      demandAvailable,
      finalized: Number(flows.finalized) || 0,
      ppsStarted: Number(flows.pps_started) || 0,
    },
    capacity: {
      fixedOffered: Number(capacity.fixed_offered) || 0,
      realized: Number(capacity.realized) || 0,
      operational: Number(capacity.operational) || 0,
      launches: Number(capacity.launches) || 0,
      fixedOverCapacityLaunches:
        capacity.fixed_over_capacity_available === false
          ? null
          : Number(capacity.fixed_over_capacity_launches) || 0,
      source: String(capacity.source || "operational_launches"),
      dateBasis: String(capacity.date_basis || "launch_start_date"),
      complete: capacity.capacity_complete !== false,
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
      historicalReconstructionReviewed:
        quality.historical_reconstruction_reviewed === true ||
        quality.historical_review_complete === true ||
        Number(quality.historical_offer_review_needed) === 0,
      historicalReconstructionMappedPct: nullableNumber(
        quality.historical_reconstruction_mapped_pct ??
          quality.historical_mapping_coverage_pct ??
          quality.historical_offer_mapping_coverage_pct
      ),
    },
  };
};

export const fetchAnalyticsSnapshot = async (
  year: number,
  cutoffISO: string
): Promise<AnalyticsSnapshot> => {
  const { data, error } = await supabase.rpc("get_analytics_v2", {
    p_year: year,
    p_cutoff: cutoffISO,
  });
  if (error) throw error;
  return parseAnalyticsSnapshot(year, cutoffISO, data);
};

export const testingSnapshot = (year: number, cutoffISO: string): AnalyticsSnapshot => {
  const fullYear = cutoffISO.endsWith("-12-31");
  const managementBaseline = year === 2024 && cutoffISO === "2024-08-31";
  const fixtures: Record<number, Partial<AnalyticsSnapshot>> = {
    2024: {
      flows: {
        applications: null,
        applicants: null,
        demandAvailable: false,
        finalized: managementBaseline ? 11 : 32,
        ppsStarted: managementBaseline ? 104 : 117,
      },
      capacity: {
        fixedOffered: managementBaseline ? 199 : 270,
        realized: 0,
        operational: managementBaseline ? 199 : 270,
        launches: managementBaseline ? 33 : 42,
        fixedOverCapacityLaunches: null,
        source: "historical_documented_offers",
        dateBasis: "announcement_at",
        complete: false,
        comparable: false,
        finiteOfferCoveragePct: managementBaseline ? 81.8 : 85.7,
        documentedFiniteOffers: managementBaseline ? 27 : 36,
        unknownOrRealizedOffers: 6,
      },
    },
    2025: {
      flows: {
        applications: fullYear ? 1379 : 661,
        applicants: fullYear ? 210 : 169,
        demandAvailable: true,
        finalized: fullYear ? 56 : 17,
        ppsStarted: fullYear ? 197 : 105,
      },
      capacity: {
        fixedOffered: fullYear ? 376 : 195,
        realized: fullYear ? 176 : 0,
        operational: fullYear ? 552 : 195,
        launches: fullYear ? 81 : 35,
        fixedOverCapacityLaunches: 0,
        source: "operational_launches",
        dateBasis: "launch_start_date",
        complete: true,
        comparable: true,
        finiteOfferCoveragePct: 100,
        documentedFiniteOffers: 35,
        unknownOrRealizedOffers: 0,
      },
    },
    2026: {
      flows: {
        applications: 779,
        applicants: 203,
        demandAvailable: true,
        finalized: 28,
        ppsStarted: 190,
      },
      capacity: {
        fixedOffered: 243,
        realized: 249,
        operational: 492,
        launches: 41,
        fixedOverCapacityLaunches: 2,
        source: "operational_launches",
        dateBasis: "launch_start_date",
        complete: true,
        comparable: true,
        finiteOfferCoveragePct: 100,
        documentedFiniteOffers: 41,
        unknownOrRealizedOffers: 0,
      },
    },
  };
  const base: AnalyticsSnapshot = {
    year,
    cutoffISO,
    metricVersion: "analytics-v2-test",
    flows: {
      applications: 0,
      applicants: 0,
      demandAvailable: true,
      finalized: 0,
      ppsStarted: 0,
    },
    capacity: {
      fixedOffered: 0,
      realized: 0,
      operational: 0,
      launches: 0,
      fixedOverCapacityLaunches: 0,
      source: "operational_launches",
      dateBasis: "launch_start_date",
      complete: true,
      comparable: true,
      finiteOfferCoveragePct: null,
      documentedFiniteOffers: null,
      unknownOrRealizedOffers: 0,
    },
    quality: {
      selectedAtN: year >= 2026 ? 199 : 0,
      selectedTotalN: year >= 2026 ? 454 : 0,
      selectedAtCoveragePct: year >= 2026 ? 43.8 : null,
      practiceLaunchLinkCoveragePct:
        year >= 2026 ? 98.8 : year === 2024 ? 100 : fullYear && year === 2025 ? 3.2 : 0,
      launchInstitutionLinkCoveragePct: year >= 2026 ? 95.1 : year === 2024 ? 100 : 0,
      historicalReconstructionReviewed: year === 2024,
      historicalReconstructionMappedPct: year === 2024 ? 100 : null,
    },
  };
  const fixture = fixtures[year];
  return fixture
    ? {
        ...base,
        ...fixture,
        flows: { ...base.flows, ...fixture.flows },
        capacity: { ...base.capacity, ...fixture.capacity },
      }
    : base;
};
