import { isFinalMoodleGrade, presentMoodleGrade } from "../moodleGradePresentation";

describe("presentMoodleGrade", () => {
  it("convierte la escala de Moodle a 1–10 redondeada", () => {
    const presentation = presentMoodleGrade({
      task_status: "graded",
      submitted: true,
      grade_value: 83,
      grade_max: 100,
      grade_display: "83,00 / 100,00",
      observed_at: "2026-08-10T14:09:00.000Z",
    });

    expect(presentation).toMatchObject({
      compact: "8",
      label: "Calificación en Campus",
      hasGrade: true,
    });
    expect(presentation?.detail).toContain("ya no requiere nuevas consultas");
    expect(
      isFinalMoodleGrade({
        task_status: "graded",
        submitted: true,
        grade_value: 83,
        grade_max: 100,
        grade_display: null,
        observed_at: "2026-08-10T14:09:00.000Z",
      })
    ).toBe(true);
  });

  it("distingue una entrega pendiente de corrección", () => {
    expect(
      presentMoodleGrade({
        task_status: "submitted",
        submitted: true,
        grade_value: null,
        grade_max: 100,
        grade_display: null,
        observed_at: "2026-08-10T14:09:00.000Z",
      })
    ).toMatchObject({ compact: "En corrección", hasGrade: false });
  });

  it("no cierra una tarea con entrega pendiente o calificación incompleta", () => {
    expect(
      isFinalMoodleGrade({
        task_status: "submitted",
        submitted: true,
        grade_value: null,
        grade_max: 100,
        grade_display: null,
        observed_at: "2026-08-10T14:09:00.000Z",
      })
    ).toBe(false);
    expect(
      isFinalMoodleGrade({
        task_status: "graded",
        submitted: true,
        grade_value: null,
        grade_max: 100,
        grade_display: null,
        observed_at: "2026-08-10T14:09:00.000Z",
      })
    ).toBe(false);
  });

  it("conserva visible la nota reabierta pero vuelve a habilitar su lectura", () => {
    const snapshot = {
      task_status: "graded",
      submitted: true,
      grade_value: 8,
      grade_max: 10,
      grade_display: "8 / 10",
      observed_at: "2026-08-10T14:09:00.000Z",
      scan_closed: false,
    };

    expect(isFinalMoodleGrade(snapshot)).toBe(false);
    expect(presentMoodleGrade(snapshot)).toMatchObject({
      compact: "8",
      hasGrade: true,
      tone: "info",
    });
    expect(presentMoodleGrade(snapshot)?.detail).toContain("reabrió");
  });
});
