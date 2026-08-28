import type { ExecutiveReportModel } from "./executiveReport.types";

export type DirectorNearReasonCode =
  | "total_hours_230_249"
  | "missing_one_orientation"
  | "specialty_gap_20_or_less";

export type PressureLevel = "low" | "moderate" | "high" | "saturated";

export interface DirectorStudentIdentity {
  studentId: string;
  fullName: string;
  legajo: string | null;
  cohort: number | null;
  selectedOrientation: string | null;
}

export interface WithoutPpsStudent extends DirectorStudentIdentity {
  applicationCount: number;
  pendingApplications: number;
}

export interface NearCompletionStudent extends DirectorStudentIdentity {
  totalHours: number;
  specialtyHours: number;
  rotations: number;
  orientations: string[];
  activePractices: number;
  reasonCode: DirectorNearReasonCode;
  reasonLabel: string;
  totalHoursGap: number;
  specialtyHoursGap: number;
  rotationsGap: number;
}

export interface ReadyToRequestStudent extends DirectorStudentIdentity {
  totalHours: number;
  specialtyHours: number;
  rotations: number;
}

export interface AccreditationStudent extends DirectorStudentIdentity {
  status: string | null;
}

export interface PressureOffer {
  offerId: string;
  offerName: string;
  orientation: string | null;
  capacity: number;
  selected: number;
  remainingPlaces: number;
  pendingApplications: number;
  pendingStudents: number;
  pendingPerRemainingPlace: number | null;
  pressureLevel: PressureLevel;
}

export interface DirectorReportSnapshot {
  metricVersion: "director-report-v1";
  annualYear: number;
  snapshotDateISO: string;
  generatedAtISO: string;
  criteria: {
    totalHoursTarget: number;
    specialtyHoursTarget: number;
    rotationsTarget: number;
    nearTotalHoursMin: number;
    nearSpecialtyHoursMin: number;
  };
  studentSummary: {
    activeStudents: number;
    studentsWithPps: number;
    withoutPps: number;
    nearCompletion: number;
    nearByReason: Record<DirectorNearReasonCode, number>;
    readyToRequest: number;
    inAccreditation: number;
    criteriaCompleteActive: number;
  };
  withoutPpsStudents: WithoutPpsStudent[];
  nearCompletionStudents: NearCompletionStudent[];
  readyToRequestStudents: ReadyToRequestStudent[];
  accreditationStudents: AccreditationStudent[];
  pressure: {
    openOffers: number;
    finiteCapacity: number;
    selected: number;
    remainingPlaces: number;
    pendingApplications: number;
    pendingStudents: number;
    pendingPerRemainingPlace: number | null;
    highPressureOffers: number;
    offers: PressureOffer[];
  };
}

export interface DirectorReportModel {
  annual: ExecutiveReportModel;
  snapshot: DirectorReportSnapshot;
  recipient: {
    name: "Agostina Reale Berrueta";
    role: "Directora de la Carrera";
  };
  privacyLabel: "Circulación interna · contiene datos personales";
}
