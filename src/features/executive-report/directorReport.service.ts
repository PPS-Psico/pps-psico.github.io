import { supabase } from "../../lib/supabaseClient";
import type {
  AccreditationStudent,
  DirectorNearReasonCode,
  DirectorReportSnapshot,
  DirectorStudentIdentity,
  NearCompletionStudent,
  PressureLevel,
  PressureOffer,
  ReadyToRequestStudent,
  WithoutPpsStudent,
} from "./directorReport.types";

type JsonObject = Record<string, unknown>;

const objectValue = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const arrayValue = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const numberValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const nullableNumber = (value: unknown): number | null =>
  value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;

const parseIdentity = (raw: JsonObject): DirectorStudentIdentity => ({
  studentId: stringValue(raw.student_id),
  fullName: stringValue(raw.full_name, "Estudiante sin nombre"),
  legajo: nullableString(raw.legajo),
  cohort: nullableNumber(raw.cohort),
  selectedOrientation: nullableString(raw.selected_orientation),
});

const nearReason = (value: unknown): DirectorNearReasonCode => {
  if (value === "missing_one_orientation" || value === "specialty_gap_20_or_less") return value;
  return "total_hours_230_249";
};

const pressureLevel = (value: unknown): PressureLevel => {
  if (value === "moderate" || value === "high" || value === "saturated") return value;
  return "low";
};

export const parseDirectorReportSnapshot = (raw: unknown): DirectorReportSnapshot => {
  const payload = objectValue(raw);
  const criteria = objectValue(payload.criteria);
  const summary = objectValue(payload.student_summary);
  const nearByReason = objectValue(summary.near_by_reason);
  const pressure = objectValue(payload.pressure);

  const withoutPpsStudents: WithoutPpsStudent[] = arrayValue(payload.without_pps_students).map(
    (item) => {
      const row = objectValue(item);
      return {
        ...parseIdentity(row),
        applicationCount: numberValue(row.application_count),
        pendingApplications: numberValue(row.pending_applications),
      };
    }
  );

  const nearCompletionStudents: NearCompletionStudent[] = arrayValue(
    payload.near_completion_students
  ).map((item) => {
    const row = objectValue(item);
    return {
      ...parseIdentity(row),
      totalHours: numberValue(row.total_hours),
      specialtyHours: numberValue(row.specialty_hours),
      rotations: numberValue(row.rotations),
      orientations: arrayValue(row.orientations).map((orientation) => stringValue(orientation)),
      activePractices: numberValue(row.active_practices),
      reasonCode: nearReason(row.reason_code),
      reasonLabel: stringValue(row.reason_label),
      totalHoursGap: numberValue(row.total_hours_gap),
      specialtyHoursGap: numberValue(row.specialty_hours_gap),
      rotationsGap: numberValue(row.rotations_gap),
    };
  });

  const readyToRequestStudents: ReadyToRequestStudent[] = arrayValue(
    payload.ready_to_request_students
  ).map((item) => {
    const row = objectValue(item);
    return {
      ...parseIdentity(row),
      totalHours: numberValue(row.total_hours),
      specialtyHours: numberValue(row.specialty_hours),
      rotations: numberValue(row.rotations),
    };
  });

  const accreditationStudents: AccreditationStudent[] = arrayValue(
    payload.accreditation_students
  ).map((item) => {
    const row = objectValue(item);
    return { ...parseIdentity(row), status: nullableString(row.status) };
  });

  const offers: PressureOffer[] = arrayValue(pressure.offers).map((item) => {
    const row = objectValue(item);
    return {
      offerId: stringValue(row.offer_id),
      offerName: stringValue(row.offer_name, "Oferta sin nombre"),
      orientation: nullableString(row.orientation),
      capacity: numberValue(row.capacity),
      selected: numberValue(row.selected),
      remainingPlaces: numberValue(row.remaining_places),
      pendingApplications: numberValue(row.pending_applications),
      pendingStudents: numberValue(row.pending_students),
      pendingPerRemainingPlace: nullableNumber(row.pending_per_remaining_place),
      pressureLevel: pressureLevel(row.pressure_level),
    };
  });

  return {
    metricVersion: "director-report-v1",
    annualYear: numberValue(payload.annual_year),
    snapshotDateISO: stringValue(payload.snapshot_date),
    generatedAtISO: stringValue(payload.generated_at),
    criteria: {
      totalHoursTarget: numberValue(criteria.total_hours_target),
      specialtyHoursTarget: numberValue(criteria.specialty_hours_target),
      rotationsTarget: numberValue(criteria.rotations_target),
      nearTotalHoursMin: numberValue(criteria.near_total_hours_min),
      nearSpecialtyHoursMin: numberValue(criteria.near_specialty_hours_min),
    },
    studentSummary: {
      activeStudents: numberValue(summary.active_students),
      studentsWithPps: numberValue(summary.students_with_pps),
      withoutPps: numberValue(summary.without_pps),
      nearCompletion: numberValue(summary.near_completion),
      nearByReason: {
        total_hours_230_249: numberValue(nearByReason.total_hours_230_249),
        missing_one_orientation: numberValue(nearByReason.missing_one_orientation),
        specialty_gap_20_or_less: numberValue(nearByReason.specialty_gap_20_or_less),
      },
      readyToRequest: numberValue(summary.ready_to_request),
      inAccreditation: numberValue(summary.in_accreditation),
      criteriaCompleteActive: numberValue(summary.criteria_complete_active),
    },
    withoutPpsStudents,
    nearCompletionStudents,
    readyToRequestStudents,
    accreditationStudents,
    pressure: {
      openOffers: numberValue(pressure.open_offers),
      finiteCapacity: numberValue(pressure.finite_capacity),
      selected: numberValue(pressure.selected),
      remainingPlaces: numberValue(pressure.remaining_places),
      pendingApplications: numberValue(pressure.pending_applications),
      pendingStudents: numberValue(pressure.pending_students),
      pendingPerRemainingPlace: nullableNumber(pressure.pending_per_remaining_place),
      highPressureOffers: numberValue(pressure.high_pressure_offers),
      offers,
    },
  };
};

export const fetchDirectorReportSnapshot = async (
  year: number,
  snapshotDateISO: string
): Promise<DirectorReportSnapshot> => {
  const { data, error } = await supabase.rpc("get_director_report_v1", {
    p_year: year,
    p_snapshot_date: snapshotDateISO,
  });
  if (error) throw error;
  return parseDirectorReportSnapshot(data);
};

const fixtureIdentity = (index: number, prefix: string): DirectorStudentIdentity => ({
  studentId: `fixture-${prefix}-${index}`,
  fullName: `${["Campos", "Domínguez", "Fernández", "Gómez", "Lagos", "Molina"][index % 6]}, ${["Lucía", "Mateo", "Sofía", "Tomás", "Valentina", "Bruno"][index % 6]}`,
  legajo: String(33000 + index),
  cohort: 2022 + (index % 4),
  selectedOrientation: ["Clínica", "Laboral", "Educacional", "Comunitaria"][index % 4],
});

export const testingDirectorSnapshot = (
  year: number,
  snapshotDateISO: string
): DirectorReportSnapshot => {
  const withoutPpsStudents: WithoutPpsStudent[] = Array.from({ length: 3 }, (_, index) => ({
    ...fixtureIdentity(index, "without"),
    applicationCount: index + 1,
    pendingApplications: index % 3 === 0 ? 1 : 0,
  }));
  const nearCompletionStudents: NearCompletionStudent[] = Array.from({ length: 13 }, (_, index) => {
    const missingOrientation = index >= 11;
    return {
      ...fixtureIdentity(index + 20, "near"),
      totalHours: missingOrientation ? 255 : 230 + (index % 20),
      specialtyHours: missingOrientation ? 90 : 60 + (index % 30),
      rotations: missingOrientation ? 2 : 3,
      orientations: missingOrientation
        ? ["Clínica", "Laboral"]
        : ["Clínica", "Laboral", "Educacional"],
      activePractices: index % 5 === 0 ? 1 : 0,
      reasonCode: missingOrientation ? "missing_one_orientation" : "total_hours_230_249",
      reasonLabel: missingOrientation
        ? "Alcanzó 250 horas y le falta una orientación para completar las tres"
        : "Le faltan 20 horas o menos para alcanzar las 250 horas totales",
      totalHoursGap: missingOrientation ? 0 : 250 - (230 + (index % 20)),
      specialtyHoursGap: 0,
      rotationsGap: missingOrientation ? 1 : 0,
    };
  });

  return {
    metricVersion: "director-report-v1",
    annualYear: year,
    snapshotDateISO,
    generatedAtISO: `${snapshotDateISO}T12:00:00Z`,
    criteria: {
      totalHoursTarget: 250,
      specialtyHoursTarget: 70,
      rotationsTarget: 3,
      nearTotalHoursMin: 230,
      nearSpecialtyHoursMin: 50,
    },
    studentSummary: {
      activeStudents: 234,
      studentsWithPps: 217,
      withoutPps: 3,
      nearCompletion: 13,
      nearByReason: {
        total_hours_230_249: 11,
        missing_one_orientation: 2,
        specialty_gap_20_or_less: 0,
      },
      readyToRequest: 3,
      inAccreditation: 8,
      criteriaCompleteActive: 32,
    },
    withoutPpsStudents,
    nearCompletionStudents,
    readyToRequestStudents: Array.from({ length: 3 }, (_, index) => ({
      ...fixtureIdentity(index + 50, "ready"),
      totalHours: 250 + index * 10,
      specialtyHours: 70 + index * 5,
      rotations: 3,
    })),
    accreditationStudents: Array.from({ length: 8 }, (_, index) => ({
      ...fixtureIdentity(index + 60, "accreditation"),
      status: index < 6 ? "Cargado" : "En proceso",
    })),
    pressure: {
      openOffers: 3,
      finiteCapacity: 28,
      selected: 17,
      remainingPlaces: 11,
      pendingApplications: 23,
      pendingStudents: 23,
      pendingPerRemainingPlace: 2.09,
      highPressureOffers: 2,
      offers: [
        {
          offerId: "fixture-randstad",
          offerName: "Randstad",
          orientation: "Laboral",
          capacity: 8,
          selected: 8,
          remainingPlaces: 0,
          pendingApplications: 10,
          pendingStudents: 10,
          pendingPerRemainingPlace: null,
          pressureLevel: "saturated",
        },
        {
          offerId: "fixture-fernandez-oro",
          offerName: "Municipalidad de General Fernández Oro",
          orientation: "Laboral",
          capacity: 12,
          selected: 9,
          remainingPlaces: 3,
          pendingApplications: 7,
          pendingStudents: 7,
          pendingPerRemainingPlace: 2.33,
          pressureLevel: "high",
        },
        {
          offerId: "fixture-ciudades-saludables",
          offerName: "Subsecretaría de Ciudades Saludables y Prevención de Consumos Problemáticos",
          orientation: "Comunitaria",
          capacity: 8,
          selected: 0,
          remainingPlaces: 8,
          pendingApplications: 6,
          pendingStudents: 6,
          pendingPerRemainingPlace: 0.75,
          pressureLevel: "low",
        },
      ],
    },
  };
};
