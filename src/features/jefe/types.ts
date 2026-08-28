export type JefeArea = {
  key: "clinica" | "educacional" | "laboral" | "comunitaria";
  label: string;
};

export type JefeReportStatus = "pending" | "waiting" | "stale" | "corrected";
export type JefeReportUrgency =
  "critical" | "soon" | "on_time" | "undated" | "waiting" | "stale" | "corrected";

export type JefeReport = {
  practica_id: string;
  estudiante_id: string;
  student_name: string;
  legajo: string | null;
  lanzamiento_id: string | null;
  pps_name: string;
  institution_name: string;
  orientation: string;
  submitted: boolean;
  submitted_at: string | null;
  deadline_at: string | null;
  days_remaining: number | null;
  grade: string | null;
  report_status: JefeReportStatus;
  urgency: JefeReportUrgency;
  campus_url: string | null;
};

export type JefeQueueSummary = {
  pending: number;
  critical: number;
  soon: number;
  on_time: number;
  undated: number;
  waiting: number;
  corrected: number;
};

export type JefeInstitutionMetric = {
  institution_name: string;
  offer_count: number;
  fixed_capacity: number;
  realized_capacity: number;
};

export type JefeMonthMetric = {
  month_number: number;
  offers: number;
};

export type JefeAreaMetric = {
  area_key: string;
  area_label: string;
  offers: number;
  registered_capacity: number;
};

export type JefePanorama = {
  year: number;
  cutoff: string;
  source: "historical_documented" | "operational_live";
  offers: number;
  capacity: {
    total: number;
    fixed: number;
    realized: number;
    unknown_offers: number;
  };
  institutions_count: number;
  institutions: JefeInstitutionMetric[];
  students_started: number;
  applications: number;
  applicants: number;
  months: JefeMonthMetric[];
  areas: JefeAreaMetric[];
};

export type JefeDashboardData = {
  generated_at: string;
  profile: {
    name: string;
    dni: number;
    areas: JefeArea[];
  };
  queue: JefeQueueSummary;
  reports: JefeReport[];
  panorama: JefePanorama;
  current: {
    as_of: string;
    active_practices: number;
    open_offers: number;
    pending_reports: number;
    critical_reports: number;
  };
};

export type JefePreviewProfile = {
  preview_key: string;
  name: string;
  area_labels: string[];
};

export type JefeMoodleSyncTask = {
  academic_year: number;
  course_id: number;
  cmid: number;
  task_name: string;
  area_keys: string[];
};

export type JefeMoodleSyncResult = {
  success: boolean;
  academic_year: number;
  task_count: number;
  rows_received: number;
  accepted: number;
  stored: number;
  snapshot_updated: number;
  ambiguous: number;
  unmatched: number;
  unmatched_external?: number;
  deduplicated?: number;
  invalid: number;
  observed_at: string;
  already_processed?: boolean;
};

export type JefeMoodleSyncStatus =
  "idle" | "loading" | "syncing" | "synced" | "partial" | "complete" | "unavailable" | "error";

export type JefeMoodleSyncState = {
  status: JefeMoodleSyncStatus;
  taskCount: number;
  accepted: number;
  ambiguous: number;
  unmatched: number;
  unmatchedInternal: number;
  deduplicated: number;
  failedTasks: number;
  lastObservedAt: string | null;
  errorMessage: string | null;
  retry: () => Promise<void>;
};

export type JefeViewId = "inicio" | "informes" | "panorama" | "practicas" | "estudiantes";
