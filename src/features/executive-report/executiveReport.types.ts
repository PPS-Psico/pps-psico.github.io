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

export interface ManagementAccountCohort {
  year: number;
  accountsCreated: number | null;
  currentlyActive: number | null;
  available: boolean;
}

export interface ManagementAdministrativeEnrollment {
  year: number;
  cycle: string;
  students: number;
}

export interface ManagementAgreementContribution {
  year: number;
  launches: number;
  fixedOffered: number;
  realized: number;
  applicants: number;
  practiceStudents: number;
}

export type ManagementValidity =
  | "confirmed"
  | "expired"
  | "pending_mapping"
  | "pending_agreement"
  | "inconsistent_expiry";

export interface ManagementAgreement {
  id: string;
  institutionId: string;
  institution: string;
  type: string | null;
  signedAt: string;
  expiresAt: string | null;
  datePrecision: "day" | "year";
  validity: ManagementValidity;
  agreementCount: number;
  orientations: string[];
  contributions: ManagementAgreementContribution[];
  totalLaunches: number;
  totalFixedOffered: number;
  totalRealized: number;
  totalApplicants: number;
  totalPracticeStudents: number;
}

export interface ManagementAccess {
  year: number;
  applicants: number;
  started: number;
  withAnyPps: number;
  withoutStart: number;
  withoutAnyPps: number;
  startRatePct: number | null;
  pendingApplicationDistribution: Array<{
    applications: number;
    students: number;
    withoutAnyPps: number;
  }>;
}

export interface ManagementNetworkInstitution {
  key: string;
  institutionId: string | null;
  institution: string;
  orientations: string[];
  launchesByYear: Record<string, number>;
  totalLaunches: number;
  lastActivity: string;
  agreementDate: string | null;
  agreementExpiry: string | null;
  validity: ManagementValidity;
  mappingComplete: boolean;
}

export interface ManagementReportData {
  reportVersion: string;
  cutoffISO: string;
  generatedAtISO: string;
  managementStartISO: string;
  agreementCount: number;
  institutionCount: number;
  access: ManagementAccess;
  population: {
    accountStateAsOfISO: string;
    accountHistoryStartISO: string | null;
    accountCohorts: ManagementAccountCohort[];
    currentStock: {
      activeStudents: number;
      activeStudentsWithCurrentPps: number;
      historicallyComparable: boolean;
    };
    administrativeEnrollment: ManagementAdministrativeEnrollment[];
    administrativeSource: string;
  };
  agreements: ManagementAgreement[];
  recentNetwork: ManagementNetworkInstitution[];
  quality: {
    recentLaunches: number;
    resolvedInstitutionLaunches: number;
    unresolvedInstitutionLaunches: number;
    institutionMappingCoveragePct: number | null;
  };
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
    data: ManagementReportData | null;
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
  managementData?: ManagementReportData | null;
  generatedAt?: Date;
}
