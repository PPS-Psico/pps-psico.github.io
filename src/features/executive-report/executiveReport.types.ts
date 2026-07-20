import type {
  EsfuerzoPrimeraSeleccion,
  NewAgreement,
  ReportLaunch,
  TrayectoriaFinalizados,
} from "../../hooks/useMetricsExtras";

export type ExecutiveReportKind = "annual" | "management";

export interface AnalyticsSnapshot {
  year: number;
  cutoffISO: string;
  metricVersion: string;
  flows: {
    applications: number | null;
    applicants: number | null;
    demandAvailable: boolean;
    finalized: number;
    ppsStarted: number;
  };
  capacity: {
    fixedOffered: number;
    realized: number;
    operational: number;
    launches: number;
    fixedOverCapacityLaunches: number | null;
    source: string;
    dateBasis: string;
    complete: boolean;
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
    historicalReconstructionReviewed?: boolean;
    historicalReconstructionMappedPct?: number | null;
  };
}

export interface ReportDelta {
  current: number;
  previous: number;
  absolute: number;
  percent: number | null;
  comparable: boolean;
  referenceLabel?: string;
  reason?: string;
}

export interface ReportMetric {
  id: string;
  label: string;
  value: number | null;
  unit?: string;
  deltaUnit?: string;
  detail: string;
  delta?: ReportDelta;
  status?: "verified" | "partial" | "experimental" | "not-available";
}

export interface OrientationSummary {
  key: string;
  label: string;
  launches: number;
  capacity: number;
  sharePct: number | null;
}

export interface ExecutiveReportModel {
  kind: ExecutiveReportKind;
  generatedAtISO: string;
  asOfISO: string;
  year: number;
  previousYear: number | null;
  title: string;
  subtitle: string;
  periodLabel: string;
  headline: string;
  executiveSummary: string[];
  author: {
    name: "Blas Rivera";
    role: "Coordinador General";
    unit: "Psicología · Sede Comahue";
    email: "blas.rivera@uflouniversidad.edu.ar";
  };
  primaryMetrics: ReportMetric[];
  demandMetrics: ReportMetric[];
  outcomeMetrics: ReportMetric[];
  qualityMetrics: ReportMetric[];
  orientations: OrientationSummary[];
  realizedCapacityContext: string | null;
  launches: ReportLaunch[];
  agreements: NewAgreement[];
  trajectory: TrayectoriaFinalizados | null;
  selectionEffort: EsfuerzoPrimeraSeleccion | null;
  current: AnalyticsSnapshot;
  previous: AnalyticsSnapshot | null;
  comparisonContext: string | null;
  management: {
    startISO: "2024-09-01";
    baseline: AnalyticsSnapshot | null;
    series: AnalyticsSnapshot[];
    caveat: string;
  } | null;
  methodology: string[];
  limitations: string[];
}

export interface ExecutiveReportModelInput {
  kind: ExecutiveReportKind;
  selected: AnalyticsSnapshot;
  previous: AnalyticsSnapshot | null;
  managementBaseline?: AnalyticsSnapshot | null;
  managementSeries?: AnalyticsSnapshot[];
  launches?: ReportLaunch[];
  agreements?: NewAgreement[];
  trajectory?: TrayectoriaFinalizados | null;
  selectionEffort?: EsfuerzoPrimeraSeleccion | null;
  generatedAt?: Date;
}
