/** Contenido académico y documental; la hora de consulta no es un cambio. */
export const MOODLE_OBSERVATION_CONTENT_FIELDS = [
  "task_status",
  "submitted",
  "submitted_at",
  "submitted_at_display",
  "grade_value",
  "grade_max",
  "grade_display",
  "graded_at_display",
  "feedback_comment",
  "submission_file_count",
  "submission_logical_file_count",
  "submission_file_types",
  "attendance_evidence",
  "attendance_confidence",
  "attendance_evidence_reasons",
  "submission_classifier_version",
] as const;

function canonical(value: unknown): string {
  if (value == null) return "null";
  if (Array.isArray(value)) return JSON.stringify(value.map(canonical));
  if (typeof value === "object") {
    return JSON.stringify(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)])
    );
  }
  return JSON.stringify(value);
}

export function hasSameMoodleObservationContent(
  previous: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): boolean {
  if (!previous) return false;
  return MOODLE_OBSERVATION_CONTENT_FIELDS.every((key) => {
    const before = previous[key];
    const after = incoming[key];
    if (key === "submitted_at" && typeof before === "string" && typeof after === "string") {
      return Number.isFinite(Date.parse(before)) && Date.parse(before) === Date.parse(after);
    }
    return canonical(before) === canonical(after);
  });
}
