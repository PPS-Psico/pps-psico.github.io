import { isFinalMoodleGrade, presentMoodleGrade } from "../moodleGradePresentation";

describe("presentMoodleGrade", () => {
  it("conserva la nota académica individual frente al número global de una tarea compartida", () => {
    const presentation = presentMoodleGrade({
      task_status: "graded",
      submitted: true,
      grade_value: 80,
      grade_max: 100,
      grade_display: "80/100",
      observed_at: "2026-09-06T00:00:00Z",
      academicGrade: "7",
      academicGradeSource: "admin",
    });
    expect(presentation).toMatchObject({
      compact: "7",
      hasGrade: true,
      label: "Calificación registrada en Mi Panel",
    });
  });
  it("una recorrección señala revisión sin reemplazar la nota aplicada", () => {
    const presentation = presentMoodleGrade({
      task_status: "graded",
      submitted: true,
      grade_value: 7,
      grade_max: 10,
      grade_display: "7",
      observed_at: "2026-09-06T00:00:00Z",
      academicGrade: "7",
      reviewedAllocation: true,
      reviewRequired: true,
    });
    expect(presentation).toMatchObject({ compact: "7", hasGrade: true, tone: "warn" });
    expect(presentation?.detail).toContain("posteriores por revisar");
  });
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

  it("no reescala una tarea configurada sobre 100 que se califica en escala 10", () => {
    // Caso real: 92 notas quedaron guardadas como "8,00 / 100,00" y similares
    // en tareas con grade_conversion_mode = direct_10. Dividirlas por el máximo
    // las mostraba todas como 1, sin importar si eran 7, 8, 9 o 10.
    const gradesOnTenScale = [7, 8, 9, 10];
    for (const value of gradesOnTenScale) {
      expect(
        presentMoodleGrade({
          task_status: "graded",
          submitted: true,
          grade_value: value,
          grade_max: 100,
          grade_display: `${value},00 / 100,00`,
          observed_at: "2026-08-10T14:09:00.000Z",
          grade_conversion_mode: "direct_10",
        })
      ).toMatchObject({ compact: String(value), hasGrade: true });
    }
  });

  it("sigue reescalando cuando la tarea informa un porcentaje real", () => {
    expect(
      presentMoodleGrade({
        task_status: "graded",
        submitted: true,
        grade_value: 80,
        grade_max: 100,
        grade_display: "80,00 / 100,00",
        observed_at: "2026-08-10T14:09:00.000Z",
        grade_conversion_mode: "percentage",
      })
    ).toMatchObject({ compact: "8", hasGrade: true });
  });

  it("lee como escala 1–10 un valor que prorrateado caería bajo el mínimo", () => {
    // "10,00 / 100,00" en una tarea sobre 100: como no existe una nota menor a
    // 4, el 10 sólo puede ser un diez cargado en escala 1–10.
    expect(
      presentMoodleGrade({
        task_status: "graded",
        submitted: true,
        grade_value: 10,
        grade_max: 100,
        grade_display: "10,00 / 100,00",
        observed_at: "2026-08-10T14:09:00.000Z",
        grade_conversion_mode: "percentage",
      })
    ).toMatchObject({ compact: "10", hasGrade: true });
  });

  it("nunca muestra un 0 como si fuera la nota del estudiante", () => {
    const presentation = presentMoodleGrade({
      task_status: "graded",
      submitted: true,
      grade_value: 0,
      grade_max: 100,
      grade_display: "0,00 / 100,00",
      observed_at: "2026-08-10T14:09:00.000Z",
      grade_conversion_mode: "percentage",
    });

    expect(presentation).toMatchObject({ compact: "Revisar", hasGrade: false, tone: "warn" });
    expect(presentation?.detail).toContain("no es una nota posible");
  });

  it("no rescata un porcentaje bajo que sí es centesimal", () => {
    // 39/100 se queda debajo del piso pero tampoco es una nota de escala 1–10.
    expect(
      presentMoodleGrade({
        task_status: "graded",
        submitted: true,
        grade_value: 39,
        grade_max: 100,
        grade_display: "39,00 / 100,00",
        observed_at: "2026-08-10T14:09:00.000Z",
        grade_conversion_mode: "percentage",
      })
    ).toMatchObject({ compact: "Revisar", hasGrade: false });
  });

  it("muestra aprobado/desaprobado cuando la tarea no lleva nota numérica", () => {
    expect(
      presentMoodleGrade({
        task_status: "graded",
        submitted: true,
        grade_value: 1,
        grade_max: 100,
        grade_display: "1,00 / 100,00",
        observed_at: "2026-08-10T14:09:00.000Z",
        grade_conversion_mode: "pass_fail",
      })
    ).toMatchObject({ compact: "Aprobada", hasGrade: true });
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
