import {
  readMoodleGrade,
  type MoodleGradeConversionMode,
} from "../domain/moodle/moodleReportStatus";

export type MoodleGradeStatus =
  | "no_access"
  | "not_submitted"
  | "submitted"
  | "graded"
  | "parse_error";

export interface MoodleGradeLike {
  task_status: string;
  submitted: boolean;
  grade_value: number | null;
  grade_max: number | null;
  grade_display: string | null;
  graded_at_display?: string | null;
  observed_at: string;
  scan_closed?: boolean;
  /** Versión de la evidencia de adjuntos; una nota vieja puede necesitar un único reescaneo. */
  submission_classifier_version?: string | null;
  last_task_status?: string | null;
  last_observed_at?: string | null;
  /** Contrato de escala de la tarea, tomado de aula_entregas. */
  grade_conversion_mode?: MoodleGradeConversionMode | null;
  /**
   * La lectura vino de la PPS hermana porque comparten el espacio de entrega.
   * Sirve para saber que se entrego, nunca para atribuir una nota: en esas
   * tareas el numero de Moodle no es la nota de ninguna de las dos.
   */
  inheritedFromSharedTask?: boolean;
  reviewedAllocation?: boolean;
  reviewRequired?: boolean;
  academicGrade?: string | null;
  academicGradeSource?: string | null;
}

export type MoodleGradeTone = "neutral" | "info" | "ok" | "warn";

export interface MoodleGradePresentation {
  label: string;
  detail: string;
  compact: string;
  tone: MoodleGradeTone;
  hasGrade: boolean;
}

type FinalMoodleGrade = MoodleGradeLike & {
  task_status: "graded";
  grade_value: number;
  grade_max: number;
};

/** Una nota completa es terminal: queda guardada y la tarea deja de escanearse. */
export function isFinalMoodleGrade(
  snapshot: MoodleGradeLike | null | undefined
): snapshot is FinalMoodleGrade {
  return Boolean(
    snapshot?.task_status === "graded" &&
    snapshot.grade_value !== null &&
    snapshot.grade_max !== null &&
    snapshot.grade_max > 0 &&
    snapshot.scan_closed !== false
  );
}

function hasCompleteMoodleGrade(
  snapshot: MoodleGradeLike | null | undefined
): snapshot is FinalMoodleGrade {
  return Boolean(
    snapshot?.task_status === "graded" &&
    snapshot.grade_value !== null &&
    snapshot.grade_max !== null &&
    snapshot.grade_max > 0
  );
}

export function formatMoodleObservationTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function presentMoodleGrade(
  snapshot: MoodleGradeLike | null | undefined
): MoodleGradePresentation | null {
  if (!snapshot) return null;
  const academic = snapshot.academicGrade?.trim();
  if (
    academic &&
    (/^(10|[0-9])([.,][0-9]{1,2})?$/.test(academic) || /^(aprobado|desaprobado)$/i.test(academic))
  ) {
    return {
      label: snapshot.reviewedAllocation
        ? "Calificación confirmada por coordinación"
        : "Calificación registrada en Mi Panel",
      detail: snapshot.reviewRequired
        ? "Hay cambios posteriores por revisar. Se conserva la calificación actual del expediente."
        : "Esta es la calificación del expediente. El estado de entrega en Campus se conserva por separado.",
      compact: academic,
      tone: snapshot.reviewRequired ? "warn" : "ok",
      hasGrade: true,
    };
  }
  if (snapshot.reviewedAllocation) {
    const graded = snapshot.grade_value !== null;
    return {
      label: graded
        ? "Calificación confirmada por coordinación"
        : "Entrega confirmada por coordinación",
      detail: snapshot.reviewRequired
        ? "Hay cambios posteriores por revisar. Se conserva la última decisión aplicada."
        : "Coordinación revisó la evidencia y confirmó que corresponde a esta PPS.",
      compact: graded ? String(snapshot.grade_value) : "Entregado",
      tone: snapshot.reviewRequired ? "warn" : graded ? "ok" : "info",
      hasGrade: graded,
    };
  }

  // La entrega es real -el informe entro por el espacio compartido- pero la
  // nota de esta PPS no esta en el numero de Moodle, sino en el comentario de
  // retroalimentacion, donde la catedra reparte una por informe.
  if (snapshot.inheritedFromSharedTask) {
    return {
      label: "Entrega compartida con otra PPS",
      detail:
        "El informe se entregó en un espacio que recibe dos PPS. La nota de cada una está en el comentario de la tarea, no en el número.",
      compact: "Ver comentario",
      tone: "info",
      hasGrade: false,
    };
  }

  if (hasCompleteMoodleGrade(snapshot)) {
    const reading = readMoodleGrade(
      snapshot.grade_value,
      snapshot.grade_max,
      snapshot.grade_conversion_mode ?? "percentage"
    );

    if (reading.kind === "pass_fail") {
      return {
        label: "Calificación en Campus",
        detail: reading.passed
          ? "La tarea se corrige por aprobado/desaprobado y quedó aprobada."
          : "La tarea se corrige por aprobado/desaprobado y no quedó aprobada.",
        compact: reading.passed ? "Aprobada" : "No aprobada",
        tone: reading.passed ? "ok" : "warn",
        hasGrade: true,
      };
    }

    // Nunca mostramos un número imposible como si fuera la nota: en PPS no
    // existe una calificación por debajo de 4, así que un 0 en Campus señala
    // una corrección incompleta o mal cargada, no un resultado del estudiante.
    if (reading.kind === "unusable") {
      return {
        label: "Calificación a revisar",
        detail: `Campus informa "${snapshot.grade_display ?? snapshot.grade_value}", que no es una nota posible. Verificá la corrección en Moodle.`,
        compact: "Revisar",
        tone: "warn",
        hasGrade: false,
      };
    }

    const scaledGrade = reading.value;
    return {
      label: "Calificación en Campus",
      detail:
        snapshot.scan_closed === false
          ? "Coordinación reabrió la verificación. Conservamos esta nota hasta recibir una nueva corrección."
          : snapshot.graded_at_display
            ? `Corregida: ${snapshot.graded_at_display}. Registro final guardado.`
            : "La calificación quedó guardada y esta tarea ya no requiere nuevas consultas.",
      compact: String(scaledGrade),
      tone: snapshot.scan_closed === false ? "info" : "ok",
      hasGrade: true,
    };
  }

  if (snapshot.task_status === "submitted" || snapshot.submitted) {
    return {
      label: "Entregado · en corrección",
      detail: "Moodle registra la entrega; todavía no hay una calificación disponible.",
      compact: "En corrección",
      tone: "info",
      hasGrade: false,
    };
  }

  if (snapshot.task_status === "not_submitted") {
    return {
      label: "Sin entrega detectada",
      detail: "Moodle no registra una entrega en este espacio.",
      compact: "Sin entrega",
      tone: "neutral",
      hasGrade: false,
    };
  }

  return {
    label: "Estado a revisar",
    detail: "No pudimos leer esta tarea con suficiente precisión. Abrila en Moodle para revisarla.",
    compact: "Revisar",
    tone: "warn",
    hasGrade: false,
  };
}
