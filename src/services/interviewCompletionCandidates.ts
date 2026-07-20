import { supabase } from "../lib/supabaseClient";

export type InterviewCompletionReason =
  | "total_hours_230_249"
  | "missing_one_orientation"
  | "specialty_gap_20_or_less";

export interface InterviewCompletionCandidate {
  id: string;
  fullName: string;
  legajo: string;
  cohort: number | null;
  selectedOrientation: string | null;
  totalHours: number;
  specialtyHours: number;
  rotations: number;
  coveredOrientations: string[];
  reasonCode: InterviewCompletionReason;
  reasonLabel: string;
  totalHoursGap: number;
  specialtyHoursGap: number;
  rotationsGap: number;
  activePractices: number;
}

const numberValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const textValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const reasonValue = (value: unknown): InterviewCompletionReason => {
  if (value === "missing_one_orientation" || value === "specialty_gap_20_or_less") return value;
  return "total_hours_230_249";
};

export const parseInterviewCompletionCandidates = (
  payload: unknown
): InterviewCompletionCandidate[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((entry) => {
    const row = (entry || {}) as Record<string, unknown>;
    return {
      id: textValue(row.id),
      fullName: textValue(row.nombre, "Estudiante sin nombre"),
      legajo: textValue(row.legajo, "—"),
      cohort: row.cohorte == null ? null : numberValue(row.cohorte),
      selectedOrientation: textValue(row.orientacion_elegida) || null,
      totalHours: numberValue(row.horas_total),
      specialtyHours: numberValue(row.horas_especialidad),
      rotations: numberValue(row.orientaciones),
      coveredOrientations: Array.isArray(row.orientaciones_cubiertas)
        ? row.orientaciones_cubiertas.map((value) => String(value))
        : [],
      reasonCode: reasonValue(row.motivo_codigo),
      reasonLabel: textValue(row.motivo),
      totalHoursGap: numberValue(row.horas_faltantes_total),
      specialtyHoursGap: numberValue(row.horas_faltantes_especialidad),
      rotationsGap: numberValue(row.orientaciones_faltantes),
      activePractices: numberValue(row.practicas_activas),
    };
  });
};

export const fetchInterviewCompletionCandidates = async (): Promise<
  InterviewCompletionCandidate[]
> => {
  const { data, error } = await supabase.rpc("get_interview_completion_candidates_v1");
  if (error) throw error;
  return parseInterviewCompletionCandidates(data);
};

export const testingInterviewCompletionCandidates = (): InterviewCompletionCandidate[] => [
  {
    id: "candidate-1",
    fullName: "Campos, Lucía",
    legajo: "33020",
    cohort: 2023,
    selectedOrientation: "Clínica",
    totalHours: 240,
    specialtyHours: 70,
    rotations: 3,
    coveredOrientations: ["Clínica", "Educacional", "Laboral"],
    reasonCode: "total_hours_230_249",
    reasonLabel: "Le faltan 10 horas para alcanzar las 250 horas totales",
    totalHoursGap: 10,
    specialtyHoursGap: 0,
    rotationsGap: 0,
    activePractices: 1,
  },
  {
    id: "candidate-2",
    fullName: "Gómez, Tomás",
    legajo: "33021",
    cohort: 2022,
    selectedOrientation: "Laboral",
    totalHours: 260,
    specialtyHours: 90,
    rotations: 2,
    coveredOrientations: ["Clínica", "Laboral"],
    reasonCode: "missing_one_orientation",
    reasonLabel: "Alcanzó 250 horas y le falta una orientación para completar las tres",
    totalHoursGap: 0,
    specialtyHoursGap: 0,
    rotationsGap: 1,
    activePractices: 0,
  },
  {
    id: "candidate-3",
    fullName: "Lagos, Valentina",
    legajo: "33022",
    cohort: 2024,
    selectedOrientation: "Educacional",
    totalHours: 250,
    specialtyHours: 60,
    rotations: 3,
    coveredOrientations: ["Clínica", "Educacional", "Comunitaria"],
    reasonCode: "specialty_gap_20_or_less",
    reasonLabel: "Alcanzó 250 horas y le faltan 10 horas de su especialidad",
    totalHoursGap: 0,
    specialtyHoursGap: 10,
    rotationsGap: 0,
    activePractices: 0,
  },
];
