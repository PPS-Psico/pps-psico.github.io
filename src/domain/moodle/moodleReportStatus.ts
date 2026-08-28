/** Canonical Moodle/report states shared by the student and staff views. */

export type MoodleTaskMode = "legacy_shared" | "dedicated";
export type MoodleGradeConversionMode = "percentage" | "direct_10" | "pass_fail";

export type MoodleProvisioningStatus =
  | "pending"
  | "claimed"
  | "reconciling"
  | "verified"
  | "needs_attention"
  | "error"
  | "disabled"
  | "cancelled";

export type MoodleMonitoringStatus = "not_started" | "hot" | "cold" | "settled" | "needs_attention";

export type MoodleParticipantMembershipStatus =
  | "expected"
  | "withdrawn"
  | "institution_failed"
  | "waived"
  | "replaced";

export type MoodleReportStatus =
  | "not_applicable"
  | "unlinked_legacy"
  | "not_open"
  | "awaiting_submission"
  | "under_review"
  | "revision_required"
  | "passed"
  | "failed_final"
  | "waived"
  | "unknown";

export type MoodlePresentationStatus =
  | "En curso"
  | "Informe pendiente"
  | "En corrección"
  | "Reentrega solicitada"
  | "Finalizada"
  | "Desaprobada"
  | "No corresponde"
  | "Por verificar";

export interface PracticeReportContext {
  practiceState?: string | null;
  practiceEndDate?: string | null;
  hasLinkedTask?: boolean;
  isUnlinkedLegacy?: boolean;
  membershipStatus?: MoodleParticipantMembershipStatus | null;
  taskOpenDate?: string | null;
  submitted?: boolean | null;
  gradeValue?: number | null;
  gradeMax?: number | null;
  gradeConversionMode?: MoodleGradeConversionMode | null;
  taskStatus?: string | null;
  isReopened?: boolean;
  isExplicitWaived?: boolean;
  isExplicitFailed?: boolean;
  referenceDate?: Date;
}

export interface ReportStatusEvaluation {
  reportStatus: MoodleReportStatus;
  presentationStatus: MoodlePresentationStatus;
  isTerminal: boolean;
  isPassing: boolean;
  requiresActionBy: "student" | "jefe" | "admin" | "none";
  detail: string;
}

const normalizeLabel = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Nota mínima de aprobación en la escala 1–10. */
export const MOODLE_PASSING_GRADE = 4;

/**
 * Cómo debe leerse el número que informa Moodle.
 *
 * `unusable` no es "desaprobado": es "esto no es una nota". En PPS un informe
 * insuficiente se rehace, nunca se califica por debajo de 4, así que un valor
 * que cae debajo de ese piso delata un problema de carga y no un resultado.
 */
export type MoodleGradeReading =
  | { kind: "score"; value: number }
  | { kind: "pass_fail"; passed: boolean }
  | { kind: "unusable" };

const UNUSABLE: MoodleGradeReading = { kind: "unusable" };

/**
 * Interpreta la nota de Moodle según el contrato de escala de la tarea.
 * Es la única fuente de verdad: la usan tanto la aprobación como la pantalla,
 * para que el número que ve el estudiante y su estado no puedan discrepar.
 *
 * En tareas `percentage` hay un caso extra. Varias quedaron configuradas sobre
 * 100 pero el docente cargó la nota en escala 1–10 ("10,00 / 100,00" para un
 * diez). Como nada por debajo de 4 es una nota posible, un valor entre 4 y 10
 * que al prorratearse caería debajo del piso se lee en escala 1–10; cualquier
 * otro caso queda como `unusable` para que alguien lo revise.
 */
export function readMoodleGrade(
  gradeValue: number | null | undefined,
  gradeMax: number | null | undefined = 10,
  mode: MoodleGradeConversionMode = "percentage"
): MoodleGradeReading {
  if (!isFiniteNumber(gradeValue)) return UNUSABLE;

  if (mode === "pass_fail") return { kind: "pass_fail", passed: gradeValue > 0 };

  // El piso se compara contra el valor crudo: un 3,99 no puede redondearse
  // hasta convertirse en un 4 aprobado.
  if (mode === "direct_10") {
    return gradeValue >= MOODLE_PASSING_GRADE && gradeValue <= 10
      ? { kind: "score", value: Math.round(gradeValue) }
      : UNUSABLE;
  }

  if (!isFiniteNumber(gradeMax) || gradeMax <= 0 || gradeValue < 0 || gradeValue > gradeMax) {
    return UNUSABLE;
  }

  // El umbral se evalúa sin redondear: un 39/100 no puede volverse un 4.
  const prorated = (gradeValue / gradeMax) * 10;
  if (prorated >= MOODLE_PASSING_GRADE) return { kind: "score", value: Math.round(prorated) };
  if (gradeValue >= MOODLE_PASSING_GRADE && gradeValue <= 10) {
    return { kind: "score", value: Math.round(gradeValue) };
  }
  return UNUSABLE;
}

/** Uses the explicit scale contract stored on aula_entregas. */
export function isPassingGrade(
  gradeValue: number | null | undefined,
  gradeMax: number | null | undefined = 10,
  mode: MoodleGradeConversionMode = "percentage"
): boolean {
  const reading = readMoodleGrade(gradeValue, gradeMax, mode);
  if (reading.kind === "pass_fail") return reading.passed;
  if (reading.kind === "score") return reading.value >= MOODLE_PASSING_GRADE;
  return false;
}

function hasReachedDate(value: string | null | undefined, referenceDate: Date): boolean {
  if (!value) return false;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const timestamp = dateOnly
    ? Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 3, 0, 0)
    : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= referenceDate.getTime();
}

/**
 * State precedence is deliberate: administrative exceptions, linkage/data
 * integrity, grade, submission and finally calendar state.
 */
export function evaluateReportStatus(ctx: PracticeReportContext): ReportStatusEvaluation {
  const referenceDate = ctx.referenceDate ?? new Date();
  const practiceState = normalizeLabel(ctx.practiceState);
  const practiceFinished = hasReachedDate(ctx.practiceEndDate, referenceDate);

  if (ctx.isExplicitWaived || ctx.membershipStatus === "waived") {
    return {
      reportStatus: "waived",
      presentationStatus: "Finalizada",
      isTerminal: true,
      isPassing: true,
      requiresActionBy: "none",
      detail: "Obligación de informe exceptuada administrativamente.",
    };
  }

  if (
    ctx.isExplicitFailed ||
    ctx.membershipStatus === "institution_failed" ||
    ["desaprobada", "desaprobado", "cancelada", "cancelado"].includes(practiceState)
  ) {
    return {
      reportStatus: "failed_final",
      presentationStatus: "Desaprobada",
      isTerminal: true,
      isPassing: false,
      requiresActionBy: "none",
      detail: "La práctica quedó desaprobada o cancelada por una decisión institucional.",
    };
  }

  if (ctx.membershipStatus === "withdrawn" || ctx.membershipStatus === "replaced") {
    return {
      reportStatus: "not_applicable",
      presentationStatus: "No corresponde",
      isTerminal: true,
      isPassing: false,
      requiresActionBy: "none",
      detail: "La persona fue retirada o reemplazada; no integra este padrón de entrega.",
    };
  }

  if (ctx.isUnlinkedLegacy || ctx.hasLinkedTask === false) {
    return {
      reportStatus: "unlinked_legacy",
      presentationStatus: "Por verificar",
      isTerminal: false,
      isPassing: false,
      requiresActionBy: "admin",
      detail: "La tarea histórica todavía no tiene un vínculo confirmado.",
    };
  }

  if (["parse_error", "unknown", "ambiguous"].includes(normalizeLabel(ctx.taskStatus))) {
    return {
      reportStatus: "unknown",
      presentationStatus: "Por verificar",
      isTerminal: false,
      isPassing: false,
      requiresActionBy: "admin",
      detail: "Campus devolvió un dato ambiguo o no interpretable.",
    };
  }

  const hasGradeSignal =
    normalizeLabel(ctx.taskStatus) === "graded" ||
    (ctx.gradeValue !== null && ctx.gradeValue !== undefined);

  if (hasGradeSignal) {
    if (!isFiniteNumber(ctx.gradeValue)) {
      return {
        reportStatus: "unknown",
        presentationStatus: "Por verificar",
        isTerminal: false,
        isPassing: false,
        requiresActionBy: "admin",
        detail: "Campus informa que la tarea fue calificada, pero no entregó una nota verificable.",
      };
    }

    if (ctx.isReopened) {
      return {
        reportStatus: "under_review",
        presentationStatus: "En corrección",
        isTerminal: false,
        isPassing: false,
        requiresActionBy: "jefe",
        detail: "La calificación fue reabierta y espera una nueva corrección.",
      };
    }

    const passing = isPassingGrade(
      ctx.gradeValue,
      ctx.gradeMax,
      ctx.gradeConversionMode ?? "percentage"
    );
    if (passing) {
      return {
        reportStatus: "passed",
        presentationStatus: practiceFinished ? "Finalizada" : "En curso",
        isTerminal: practiceFinished,
        isPassing: true,
        requiresActionBy: "none",
        detail: practiceFinished
          ? "La práctica terminó y el informe está aprobado."
          : "El informe está aprobado; la práctica continúa hasta su fecha de finalización.",
      };
    }

    return {
      reportStatus: "revision_required",
      presentationStatus: "Reentrega solicitada",
      isTerminal: false,
      isPassing: false,
      requiresActionBy: "student",
      detail: "La calificación no alcanza el mínimo y requiere reentrega.",
    };
  }

  if (ctx.submitted === true || normalizeLabel(ctx.taskStatus) === "submitted") {
    return {
      reportStatus: "under_review",
      presentationStatus: "En corrección",
      isTerminal: false,
      isPassing: false,
      requiresActionBy: "jefe",
      detail: "Informe entregado y pendiente de corrección.",
    };
  }

  if (ctx.taskOpenDate && !hasReachedDate(ctx.taskOpenDate, referenceDate)) {
    return {
      reportStatus: "not_open",
      presentationStatus: "En curso",
      isTerminal: false,
      isPassing: false,
      requiresActionBy: "none",
      detail: "La actividad todavía no abrió en Campus.",
    };
  }

  return {
    reportStatus: "awaiting_submission",
    presentationStatus: practiceFinished ? "Informe pendiente" : "En curso",
    isTerminal: false,
    isPassing: false,
    requiresActionBy: "student",
    detail: practiceFinished
      ? "La práctica terminó y falta entregar el informe."
      : "La práctica sigue en curso; el informe aún no fue entregado.",
  };
}

export interface MoodleCalculatedDates {
  openAt: string | null;
  dueAt: string | null;
  cutoffAt: null;
}

/** Opens seven days before the end; due date is 30 calendar days after it. */
export function calculateMoodleTaskDates(
  practiceEndDate: string | null | undefined
): MoodleCalculatedDates {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(practiceEndDate?.trim() ?? "");
  if (!match) return { openAt: null, dueAt: null, cutoffAt: null };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { openAt: null, dueAt: null, cutoffAt: null };
  }

  const openDate = new Date(parsed);
  openDate.setUTCDate(openDate.getUTCDate() - 7);
  const dueDayAfter = new Date(parsed);
  dueDayAfter.setUTCDate(dueDayAfter.getUTCDate() + 31);

  return {
    openAt: `${openDate.toISOString().slice(0, 10)}T03:00:00.000Z`,
    dueAt: `${dueDayAfter.toISOString().slice(0, 10)}T02:59:59.000Z`,
    cutoffAt: null,
  };
}

export function calculateSlaDeadline(submittedAt: string | null | undefined): string | null {
  if (!submittedAt) return null;
  const timestamp = Date.parse(submittedAt);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export function isSlaBreached(
  submittedAt: string | null | undefined,
  referenceDate: Date = new Date()
): boolean {
  const deadline = calculateSlaDeadline(submittedAt);
  return deadline !== null && Date.parse(deadline) < referenceDate.getTime();
}

export function getDaysRemainingSla(
  submittedAt: string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  const deadline = calculateSlaDeadline(submittedAt);
  if (!deadline) return null;
  return Math.ceil((Date.parse(deadline) - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
}
