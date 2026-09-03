import {
  FIELD_ES_ONLINE_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
} from "../../constants";
import { resolveGradeReadiness } from "../../domain/finalizacion/gradeReadiness";
import type { DeliveryArea, DeliveryInstitution } from "../../hooks/useAulaEntregas";
import type { MoodleTaskLink } from "../../hooks/useMoodleTaskLinks";
import { isPracticeDisapproved } from "../../logic/studentRules";
import type { InformeTask, Practica } from "../../types";
import { cleanDbValue, normalizeStringForComparison, parseToUTCDate } from "../../utils/formatters";
import { resolveExactMoodleTaskLink } from "../../utils/moodleTaskResolution";

export type DeliveryStatusTone = "neutral" | "info" | "ok" | "warn";

export interface GuidedDelivery {
  id: string;
  practiceName: string;
  areaId: string | null;
  areaName: string;
  areaColor: string;
  institution: DeliveryInstitution | null;
  task: InformeTask | null;
  /**
   * Nota e informe_estado cargados directamente en la práctica, sin pasar por
   * una tarea de Moodle. Actividades cortas (una jornada, un relevamiento)
   * suelen calificarse a mano y no tienen `task` -- sin este campo, el panel
   * las trataba como sin corregir y les mostraba un contador de días de
   * atraso creciendo indefinidamente aunque ya tuvieran nota.
   */
  gradedDirectly: boolean;
  startDate: Date | null;
  endDate: Date | null;
  deadline: Date | null;
  deadlineLabel: string;
  hours: number | null;
  isOnline: boolean;
  isOpenEnded: boolean;
  academicYear: number | null;
  statusLabel: string;
  statusDetail: string;
  statusTone: DeliveryStatusTone;
  resolutionSource: "exact" | "none";
}

const GENERIC_INSTITUTION_WORDS =
  /\b(pps|practica|practicas|profesional|profesionales|supervisada|supervisadas|area|hospital|fundacion|centro|programa|clinica|laboral|comunitaria|educacional|online|presencial)\b/g;

function normalizeInstitutionName(value: unknown): string {
  return normalizeStringForComparison(cleanDbValue(value))
    .replace(GENERIC_INSTITUTION_WORDS, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(left: unknown, right: unknown): boolean {
  const a = normalizeInstitutionName(left);
  const b = normalizeInstitutionName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a));
}

export function resolveDeliveryAreaId(rawArea: unknown, areas: DeliveryArea[]): string | null {
  const area = normalizeStringForComparison(cleanDbValue(rawArea));
  if (!area) return null;

  const direct = areas.find((candidate) => {
    const id = normalizeStringForComparison(candidate.id);
    const name = normalizeStringForComparison(candidate.name);
    return area === id || area === name || name.includes(area) || area.includes(id);
  });
  if (direct) return direct.id;

  if (area.includes("clinic"))
    return areas.find((candidate) => candidate.id === "clinica")?.id ?? null;
  if (area.includes("educa"))
    return areas.find((candidate) => candidate.id === "educacional")?.id ?? null;
  if (area.includes("comunit")) {
    return (
      areas.find((candidate) => candidate.id === "comunitaria")?.id ??
      areas.find((candidate) => candidate.id === "laboral")?.id ??
      null
    );
  }
  if (area.includes("labor") || area.includes("organiz")) {
    return areas.find((candidate) => candidate.id === "laboral")?.id ?? null;
  }
  return null;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDeadline(date: Date | null): string {
  if (!date) return "Sin fecha de cierre";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildStatus(
  practice: Practica,
  task: InformeTask | null,
  deadline: Date | null,
  now: Date
): Pick<GuidedDelivery, "statusLabel" | "statusDetail" | "statusTone"> {
  const note = normalizeStringForComparison(task?.nota);
  const hasStudentReportedGrade =
    note && note !== "sin calificar" && note !== "no entregado" && !note.includes("entregado");

  if (hasStudentReportedGrade) {
    return {
      statusLabel: "Nota informada",
      statusDetail:
        "Es un dato cargado en Mi Panel y no una confirmación del Campus. Verificá allí la corrección oficial.",
      statusTone: "info",
    };
  }
  if (task?.informeSubido || note.includes("entregado")) {
    return {
      statusLabel: "Marcada en Mi Panel",
      statusDetail:
        "Esta marca fue informada en Mi Panel; todavía no está verificada automáticamente con el Campus.",
      statusTone: "info",
    };
  }

  const practiceState = normalizeStringForComparison(practice[FIELD_ESTADO_PRACTICA]);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const practiceEnd = parseToUTCDate(practice[FIELD_FECHA_FIN_PRACTICAS]);

  if (practiceState.includes("curso") && practiceEnd && practiceEnd > today) {
    return {
      statusLabel: "Todavía en cursada",
      statusDetail: `La práctica finaliza el ${formatDeadline(practiceEnd)}. Mi Panel no consulta todavía el estado del Campus.`,
      statusTone: "neutral",
    };
  }
  if (!deadline) {
    return {
      statusLabel: "Estado no sincronizado",
      statusDetail:
        "Mi Panel no puede confirmar si el informe fue entregado. Revisá el estado directamente en el Campus.",
      statusTone: "neutral",
    };
  }

  const deadlineMoment = deadline < today ? "fue" : "es";
  return {
    statusLabel: "Verificar en el Campus",
    statusDetail: `Mi Panel no puede confirmar si ya entregaste. El plazo orientativo ${deadlineMoment} el ${formatDeadline(deadline)}.`,
    statusTone: "neutral",
  };
}

export function buildGuidedDeliveries(
  practicas: Practica[],
  informeTasks: InformeTask[],
  areas: DeliveryArea[],
  now = new Date(),
  exactTaskLinks: MoodleTaskLink[] = []
): GuidedDelivery[] {
  const taskByPractice = new Map(
    informeTasks.filter((task) => task.practicaId).map((task) => [task.practicaId as string, task])
  );

  return practicas
    .filter((practice) => {
      if (isPracticeDisapproved(practice[FIELD_ESTADO_PRACTICA])) return false;
      const isSpecial = practice[FIELD_TIPO_ACTIVIDAD_PRACTICAS] === "actividad_especial";
      const state = normalizeStringForComparison(practice[FIELD_ESTADO_PRACTICA]);
      return !(isSpecial && (state.includes("cancel") || state.includes("no se pudo concretar")));
    })
    .map((practice) => {
      const practiceName =
        cleanDbValue(practice[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) || "Práctica";
      const areaId = resolveDeliveryAreaId(practice[FIELD_ESPECIALIDAD_PRACTICAS], areas);
      const area = areas.find((candidate) => candidate.id === areaId);
      const task =
        taskByPractice.get(practice.id) ??
        informeTasks.find((candidate) => namesMatch(candidate.ppsName, practiceName)) ??
        null;
      const exactTaskLink = resolveExactMoodleTaskLink(practice, exactTaskLinks);
      const institution = exactTaskLink
        ? { name: exactTaskLink.name, moodleId: exactTaskLink.moodleId }
        : null;
      const resolutionSource: GuidedDelivery["resolutionSource"] = exactTaskLink ? "exact" : "none";
      const startDate = parseToUTCDate(practice[FIELD_FECHA_INICIO_PRACTICAS]);
      const endDate = parseToUTCDate(practice[FIELD_FECHA_FIN_PRACTICAS]);
      const isOpenEnded = practice[FIELD_TIPO_ACTIVIDAD_PRACTICAS] === "actividad_especial";
      // Una actividad corta calificada a mano (una jornada, un relevamiento)
      // suele no tener tarea de Moodle vinculada, así que `task` queda null y
      // el chequeo de "ya entregado" -- que sólo mira task.nota -- nunca la ve
      // corregida. Sin este corte aparte, el plazo de 30 días sigue corriendo
      // para siempre y el alumno ve un contador de atraso creciendo con una
      // nota ya cargada.
      const gradedDirectly = resolveGradeReadiness(practice).ready;
      const deadline = !isOpenEnded && !gradedDirectly && endDate ? addDays(endDate, 30) : null;
      const rawHours = Number(practice[FIELD_HORAS_PRACTICAS]);
      const hours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : null;

      return {
        id: practice.id,
        practiceName,
        areaId,
        areaName: area?.name || cleanDbValue(practice[FIELD_ESPECIALIDAD_PRACTICAS]) || "Sin área",
        areaColor: area?.color || "var(--primary-500)",
        institution,
        task,
        gradedDirectly,
        startDate,
        endDate,
        deadline,
        deadlineLabel: formatDeadline(deadline),
        hours,
        isOnline: Boolean(practice[FIELD_ES_ONLINE_PRACTICAS]),
        isOpenEnded,
        academicYear:
          exactTaskLink?.academicYear ??
          endDate?.getUTCFullYear() ??
          startDate?.getUTCFullYear() ??
          null,
        ...buildStatus(practice, task, deadline, now),
        resolutionSource,
      };
    })
    .sort(
      (left, right) =>
        (right.deadline?.getTime() ?? Number.MIN_SAFE_INTEGER) -
        (left.deadline?.getTime() ?? Number.MIN_SAFE_INTEGER)
    );
}
