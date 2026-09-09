import { hasSameMoodleObservationContent } from "../moodleObservationContent";

const previous = {
  task_status: "submitted",
  submitted: true,
  grade_value: null,
  grade_max: 100,
  submitted_at: null,
  feedback_comment: null,
  submission_file_count: 2,
  submission_file_types: { pdf: 1, image: 1 },
};

describe("idempotencia del contenido Moodle", () => {
  it("guarda la fecha que antes faltaba aunque la nota y los archivos sean iguales", () => {
    expect(
      hasSameMoodleObservationContent(previous, {
        ...previous,
        submitted_at: "2026-07-07T12:00:00Z",
      })
    ).toBe(false);
  });
  it("guarda un comentario docente nuevo o corregido aunque no cambie la nota numérica", () => {
    expect(
      hasSameMoodleObservationContent(previous, { ...previous, feedback_comment: "Niños: 9" })
    ).toBe(false);
    expect(
      hasSameMoodleObservationContent(
        { ...previous, feedback_comment: "Niños: 8" },
        { ...previous, feedback_comment: "Niños: 9" }
      )
    ).toBe(false);
  });
  it("ignora la hora de consulta y el orden de claves JSON, no la evidencia nueva", () => {
    expect(
      hasSameMoodleObservationContent(previous, {
        ...previous,
        observed_at: "2026-09-05T12:00:00Z",
        submission_file_types: { image: 1, pdf: 1 },
      })
    ).toBe(true);
    expect(
      hasSameMoodleObservationContent(previous, {
        ...previous,
        submission_file_types: { image: 0, pdf: 2 },
      })
    ).toBe(false);
  });
  it("compara timestamps equivalentes y no descarta la primera observación", () => {
    expect(
      hasSameMoodleObservationContent(
        { ...previous, submitted_at: "2026-07-07T12:00:00Z" },
        { ...previous, submitted_at: "2026-07-07T09:00:00-03:00" }
      )
    ).toBe(true);
    expect(hasSameMoodleObservationContent(undefined, previous)).toBe(false);
  });
});
