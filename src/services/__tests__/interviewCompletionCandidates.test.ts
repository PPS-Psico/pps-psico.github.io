import {
  parseInterviewCompletionCandidates,
  testingInterviewCompletionCandidates,
} from "../interviewCompletionCandidates";

describe("interview-completion-candidates-v1", () => {
  it("adapta la cohorte nominal sin incorporar datos de contacto", () => {
    const candidates = parseInterviewCompletionCandidates([
      {
        id: "student-1",
        nombre: "Campos, Lucía",
        legajo: "33020",
        cohorte: 2023,
        orientacion_elegida: "Clínica",
        horas_total: 240,
        horas_especialidad: 70,
        orientaciones: 3,
        orientaciones_cubiertas: ["Clínica", "Educacional", "Laboral"],
        motivo_codigo: "total_hours_230_249",
        motivo: "Le faltan 10 horas",
        horas_faltantes_total: 10,
        horas_faltantes_especialidad: 0,
        orientaciones_faltantes: 0,
        practicas_activas: 1,
        correo: "no-debe-copiarse@example.com",
        dni: "12345678",
      },
    ]);

    expect(candidates[0]).toEqual(
      expect.objectContaining({
        fullName: "Campos, Lucía",
        totalHours: 240,
        reasonCode: "total_hours_230_249",
      })
    );
    expect(JSON.stringify(candidates)).not.toMatch(/correo|dni|telefono|direccion/i);
  });

  it("mantiene representados los tres motivos en el fixture visual", () => {
    const reasons = new Set(testingInterviewCompletionCandidates().map((row) => row.reasonCode));

    expect(reasons).toEqual(
      new Set(["total_hours_230_249", "missing_one_orientation", "specialty_gap_20_or_less"])
    );
  });
});
