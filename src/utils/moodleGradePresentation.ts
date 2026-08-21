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
  last_task_status?: string | null;
  last_observed_at?: string | null;
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

  if (hasCompleteMoodleGrade(snapshot)) {
    const scaledGrade = Math.round((snapshot.grade_value / snapshot.grade_max) * 10);
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
