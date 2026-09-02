import { supabase } from "../../lib/supabaseClient";
import type {
  AnalyticsSnapshot,
  ManagementAgreement,
  ManagementAgreementContribution,
  ManagementNetworkInstitution,
  ManagementReportData,
  ManagementValidity,
} from "./executiveReport.types";

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

export const equivalentCutoff = (year: number, cutoffISO: string): string => {
  const [, rawMonth = "12", rawDay = "31"] = cutoffISO.split("-");
  const month = Math.min(12, Math.max(1, Number(rawMonth) || 12));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(lastDay, Math.max(1, Number(rawDay) || lastDay));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const recordValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const arrayValue = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const numberValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const validityValue = (value: unknown): ManagementValidity => {
  const parsed = stringValue(value);
  return [
    "confirmed",
    "expired",
    "pending_mapping",
    "pending_agreement",
    "inconsistent_expiry",
  ].includes(parsed)
    ? (parsed as ManagementValidity)
    : "pending_agreement";
};

const contributionValue = (value: unknown): ManagementAgreementContribution => {
  const row = recordValue(value);
  return {
    year: numberValue(row.year),
    launches: numberValue(row.launches),
    fixedOffered: numberValue(row.fixed_offered),
    realized: numberValue(row.realized),
    applicants: numberValue(row.applicants),
    practiceStudents: numberValue(row.practice_students),
  };
};

const agreementValue = (value: unknown): ManagementAgreement => {
  const row = recordValue(value);
  return {
    id: stringValue(row.id),
    institutionId: stringValue(row.institution_id),
    institution: stringValue(row.institution, "Institución sin identificar"),
    type: typeof row.type === "string" ? row.type : null,
    signedAt: stringValue(row.signed_at),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    datePrecision: row.date_precision === "day" ? "day" : "year",
    validity: validityValue(row.validity),
    agreementCount: Math.max(1, numberValue(row.agreement_count)),
    orientations: arrayValue(row.orientations)
      .map((item) => stringValue(item))
      .filter(Boolean),
    contributions: arrayValue(row.contributions).map(contributionValue),
    totalLaunches: numberValue(row.total_launches),
    totalFixedOffered: numberValue(row.total_fixed_offered),
    totalRealized: numberValue(row.total_realized),
    totalApplicants: numberValue(row.total_applicants),
    totalPracticeStudents: numberValue(row.total_practice_students),
  };
};

const networkValue = (value: unknown): ManagementNetworkInstitution => {
  const row = recordValue(value);
  const launchesByYear = recordValue(row.launches_by_year);
  return {
    key: stringValue(row.key),
    institutionId: typeof row.institution_id === "string" ? row.institution_id : null,
    institution: stringValue(row.institution, "Institución sin identificar"),
    orientations: arrayValue(row.orientations)
      .map((item) => stringValue(item))
      .filter(Boolean),
    launchesByYear: Object.fromEntries(
      Object.entries(launchesByYear).map(([key, count]) => [key, numberValue(count)])
    ),
    totalLaunches: numberValue(row.total_launches),
    lastActivity: stringValue(row.last_activity),
    agreementDate: typeof row.agreement_date === "string" ? row.agreement_date : null,
    agreementExpiry: typeof row.agreement_expiry === "string" ? row.agreement_expiry : null,
    validity: validityValue(row.validity),
    mappingComplete: row.mapping_complete === true,
  };
};

export const parseManagementReportData = (raw: unknown): ManagementReportData => {
  const payload = recordValue(raw);
  const population = recordValue(payload.population);
  const currentStock = recordValue(population.current_stock);
  const quality = recordValue(payload.quality);
  const access = recordValue(payload.access);
  return {
    reportVersion: stringValue(payload.report_version, "management-report-v1"),
    cutoffISO: stringValue(payload.cutoff),
    generatedAtISO: stringValue(payload.generated_at),
    managementStartISO: stringValue(payload.management_start, "2024-09-01"),
    agreementCount: numberValue(payload.agreement_count),
    institutionCount: numberValue(payload.institution_count),
    access: {
      year: numberValue(access.year),
      applicants: numberValue(access.applicants),
      started: numberValue(access.started),
      withAnyPps: numberValue(access.with_any_pps),
      withoutStart: numberValue(access.without_start),
      withoutAnyPps: numberValue(access.without_any_pps),
      startRatePct: nullableNumber(access.start_rate_pct),
      pendingApplicationDistribution: arrayValue(access.pending_application_distribution).map(
        (value) => {
          const row = recordValue(value);
          return {
            applications: numberValue(row.applications),
            students: numberValue(row.students),
            withoutAnyPps: numberValue(row.without_any_pps),
          };
        }
      ),
    },
    population: {
      accountStateAsOfISO: stringValue(population.account_state_as_of),
      accountHistoryStartISO:
        typeof population.account_history_start === "string"
          ? population.account_history_start
          : null,
      accountCohorts: arrayValue(population.account_cohorts).map((value) => {
        const row = recordValue(value);
        return {
          year: numberValue(row.year),
          accountsCreated: nullableNumber(row.accounts_created),
          currentlyActive: nullableNumber(row.currently_active),
          available: row.available === true,
        };
      }),
      currentStock: {
        activeStudents: numberValue(currentStock.active_students),
        activeStudentsWithCurrentPps: numberValue(currentStock.active_students_with_current_pps),
        historicallyComparable: currentStock.historically_comparable === true,
      },
      administrativeEnrollment: arrayValue(population.administrative_enrollment).map((value) => {
        const row = recordValue(value);
        return {
          year: numberValue(row.year),
          cycle: stringValue(row.cycle),
          students: numberValue(row.students),
        };
      }),
      administrativeSource: stringValue(population.administrative_source),
    },
    agreements: arrayValue(payload.agreements).map(agreementValue),
    recentNetwork: arrayValue(payload.recent_network).map(networkValue),
    quality: {
      recentLaunches: numberValue(quality.recent_launches),
      resolvedInstitutionLaunches: numberValue(quality.resolved_institution_launches),
      unresolvedInstitutionLaunches: numberValue(quality.unresolved_institution_launches),
      institutionMappingCoveragePct: nullableNumber(quality.institution_mapping_coverage_pct),
    },
  };
};

export const fetchManagementReportData = async (
  cutoffISO: string
): Promise<ManagementReportData> => {
  const { data, error } = await supabase.rpc("get_management_report_v1", {
    p_cutoff: cutoffISO,
  });
  if (error) throw error;
  return parseManagementReportData(data);
};

export const testingManagementReportData = (cutoffISO: string): ManagementReportData => {
  const year = Number(cutoffISO.slice(0, 4));
  const years = Array.from({ length: Math.max(1, year - 2024 + 1) }, (_, index) => 2024 + index);
  const contributions = (
    rows: Partial<ManagementAgreementContribution>[]
  ): ManagementAgreementContribution[] =>
    years.map((item) => ({
      year: item,
      launches: 0,
      fixedOffered: 0,
      realized: 0,
      applicants: 0,
      practiceStudents: 0,
      ...rows.find((row) => row.year === item),
    }));
  return {
    reportVersion: "management-report-v1-test",
    cutoffISO,
    generatedAtISO: new Date().toISOString(),
    managementStartISO: "2024-09-01",
    agreementCount: 6,
    institutionCount: 2,
    access: {
      year,
      applicants: 218,
      started: 210,
      withAnyPps: 215,
      withoutStart: 8,
      withoutAnyPps: 3,
      startRatePct: 96.3,
      pendingApplicationDistribution: [
        { applications: 1, students: 6, withoutAnyPps: 2 },
        { applications: 2, students: 1, withoutAnyPps: 1 },
        { applications: 3, students: 1, withoutAnyPps: 0 },
      ],
    },
    population: {
      accountStateAsOfISO: new Date().toISOString(),
      accountHistoryStartISO: "2025-11-29",
      accountCohorts: years.map((item) => ({
        year: item,
        accountsCreated: item === 2024 ? null : item === 2025 ? 139 : item === 2026 ? 141 : 0,
        currentlyActive: item === 2024 ? null : item === 2025 ? 92 : item === 2026 ? 128 : 0,
        available: item >= 2025,
      })),
      currentStock: {
        activeStudents: 220,
        activeStudentsWithCurrentPps: 178,
        historicallyComparable: false,
      },
      administrativeEnrollment: [
        { year: 2022, cycle: "2022/1", students: 39 },
        { year: 2023, cycle: "2023/1", students: 87 },
        { year: 2024, cycle: "2024/1", students: 101 },
        { year: 2025, cycle: "2025/1", students: 242 },
      ],
      administrativeSource: "Registro administrativo informado por la Facultad",
    },
    agreements: [
      {
        id: "agreement-1",
        institutionId: "institution-1",
        institution: "Subsecretaría de Familia",
        type: "Convenio marco",
        signedAt: "2025-01-01",
        expiresAt: "2027-01-01",
        datePrecision: "year",
        validity: "confirmed",
        agreementCount: 3,
        orientations: ["clinica", "comunitaria"],
        contributions: contributions([
          {
            year: 2025,
            launches: 4,
            fixedOffered: 9,
            applicants: 45,
            practiceStudents: 9,
          },
        ]),
        totalLaunches: year >= 2025 ? 4 : 0,
        totalFixedOffered: year >= 2025 ? 9 : 0,
        totalRealized: 0,
        totalApplicants: year >= 2025 ? 45 : 0,
        totalPracticeStudents: year >= 2025 ? 9 : 0,
      },
      {
        id: "agreement-2",
        institutionId: "institution-2",
        institution: "Institución Fernando Ulloa",
        type: "Convenio específico",
        signedAt: "2025-01-01",
        expiresAt: "2027-01-01",
        datePrecision: "year",
        validity: "confirmed",
        agreementCount: 3,
        orientations: ["clinica"],
        contributions: contributions([
          {
            year: 2025,
            launches: 4,
            realized: 176,
            applicants: 96,
            practiceStudents: 86,
          },
          {
            year: 2026,
            launches: 2,
            fixedOffered: 50,
            realized: 69,
            applicants: 86,
            practiceStudents: 82,
          },
        ]),
        totalLaunches: year >= 2026 ? 6 : year >= 2025 ? 4 : 0,
        totalFixedOffered: year >= 2026 ? 50 : 0,
        totalRealized: year >= 2026 ? 245 : year >= 2025 ? 176 : 0,
        totalApplicants: year >= 2026 ? 175 : year >= 2025 ? 96 : 0,
        totalPracticeStudents: year >= 2026 ? 164 : year >= 2025 ? 86 : 0,
      },
    ],
    recentNetwork: [
      {
        key: "institution-1",
        institutionId: "institution-1",
        institution: "Subsecretaría de Familia",
        orientations: ["clinica", "comunitaria"],
        launchesByYear: { "2025": 4, "2026": 0 },
        totalLaunches: 4,
        lastActivity: "2025-11-01",
        agreementDate: "2025-01-01",
        agreementExpiry: "2027-01-01",
        validity: "confirmed",
        mappingComplete: true,
      },
      {
        key: "institution-2",
        institutionId: "institution-2",
        institution: "Institución Fernando Ulloa",
        orientations: ["clinica"],
        launchesByYear: { "2025": 4, "2026": 2 },
        totalLaunches: 6,
        lastActivity: "2026-08-01",
        agreementDate: "2025-01-01",
        agreementExpiry: "2027-01-01",
        validity: "confirmed",
        mappingComplete: true,
      },
    ],
    quality: {
      recentLaunches: 131,
      resolvedInstitutionLaunches: 128,
      unresolvedInstitutionLaunches: 3,
      institutionMappingCoveragePct: 97.7,
    },
  };
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
        ppsStarted: managementBaseline ? 105 : 118,
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
        ppsStarted: fullYear ? 196 : 105,
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
