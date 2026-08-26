import { getPenaltyScore, type PenaltyType } from "./penalties";

export const PPS_WITHDRAWAL_REASONS = [
  { value: "salud", label: "Motivos de salud" },
  { value: "personal_familiar", label: "Situación personal o familiar" },
  { value: "laboral", label: "Incompatibilidad laboral" },
  { value: "academico", label: "Situación académica" },
  { value: "inconveniente_institucional", label: "Inconveniente con la institución" },
  { value: "otro", label: "Otro motivo" },
] as const;

export type PpsWithdrawalReason = (typeof PPS_WITHDRAWAL_REASONS)[number]["value"];

export const PPS_WITHDRAWAL_DETAIL_MIN_LENGTH = 10;
export const PPS_WITHDRAWAL_DETAIL_MAX_LENGTH = 2000;

export const isPpsWithdrawalReason = (value: unknown): value is PpsWithdrawalReason =>
  typeof value === "string" && PPS_WITHDRAWAL_REASONS.some((reason) => reason.value === value);

export const getPpsWithdrawalReasonLabel = (value: unknown): string =>
  PPS_WITHDRAWAL_REASONS.find((reason) => reason.value === value)?.label || "Motivo no informado";

export type WithdrawalTiming = "before_start" | "start_day" | "after_start" | "unknown";

export interface WithdrawalPenaltySuggestion {
  timing: WithdrawalTiming;
  type: PenaltyType;
  score: number;
  daysFromStart: number | null;
  label: string;
}

const dateOnlyInBuenosAires = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const utcDayNumber = (dateOnly: string): number => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

export const getWithdrawalPenaltySuggestion = (
  requestedAt: string | null | undefined,
  ppsStartDate: string | null | undefined
): WithdrawalPenaltySuggestion => {
  const requestDay = dateOnlyInBuenosAires(requestedAt);
  const startDay = dateOnlyInBuenosAires(ppsStartDate);

  if (!requestDay || !startDay) {
    const type: PenaltyType = "Baja Anticipada";
    return {
      timing: "unknown",
      type,
      score: getPenaltyScore(type),
      daysFromStart: null,
      label: "Fecha de inicio pendiente de revisión",
    };
  }

  const daysFromStart = utcDayNumber(requestDay) - utcDayNumber(startDay);
  if (daysFromStart < 0) {
    const type: PenaltyType = "Baja Anticipada";
    const daysBefore = Math.abs(daysFromStart);
    return {
      timing: "before_start",
      type,
      score: getPenaltyScore(type),
      daysFromStart,
      label: `Solicitada ${daysBefore} ${daysBefore === 1 ? "día" : "días"} antes del inicio`,
    };
  }

  if (daysFromStart === 0) {
    const type: PenaltyType = "Baja sobre la Fecha / Ausencia en Inicio";
    return {
      timing: "start_day",
      type,
      score: getPenaltyScore(type),
      daysFromStart,
      label: "Solicitada el mismo día del inicio",
    };
  }

  const type: PenaltyType = "Abandono durante la PPS";
  return {
    timing: "after_start",
    type,
    score: getPenaltyScore(type),
    daysFromStart,
    label: `Solicitada ${daysFromStart} ${daysFromStart === 1 ? "día" : "días"} después del inicio`,
  };
};
