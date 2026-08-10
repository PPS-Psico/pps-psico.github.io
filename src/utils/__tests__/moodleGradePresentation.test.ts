import { presentMoodleGrade } from "../moodleGradePresentation";

describe("presentMoodleGrade", () => {
  it("muestra la escala cruda de Moodle sin convertirla a 1–10", () => {
    const presentation = presentMoodleGrade({
      task_status: "graded",
      submitted: true,
      grade_value: 83,
      grade_max: 100,
      grade_display: "83,00 / 100,00",
      observed_at: "2026-08-10T14:09:00.000Z",
    });

    expect(presentation).toMatchObject({
      compact: "83,00 / 100,00",
      label: "Calificación en Campus",
      hasGrade: true,
    });
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
});
