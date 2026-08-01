import { describe, it, expect } from "@jest/globals";
import {
  computeFrecuenciaSemanal,
  isNotaPermitidaParaPps,
  parseHorasSemanalesDeHorario,
  permiteNotaAprobado,
  resolveFrecuenciaSemanal,
} from "../acreditacion";

describe("notas por año de PPS", () => {
  it("ofrece Aprobado para PPS iniciadas en 2024 o antes", () => {
    expect(permiteNotaAprobado("2024-12-31")).toBe(true);
    expect(permiteNotaAprobado("2023-03-01")).toBe(true);
    expect(isNotaPermitidaParaPps("Aprobado", "2024-08-10")).toBe(true);
  });

  it("exige una nota numérica desde 2025", () => {
    expect(permiteNotaAprobado("2025-01-01")).toBe(false);
    expect(permiteNotaAprobado("2026-04-15T00:00:00Z")).toBe(false);
    expect(isNotaPermitidaParaPps("Aprobado", "2025-01-01")).toBe(false);
    expect(isNotaPermitidaParaPps("8", "2025-01-01")).toBe(true);
  });

  it("aplica el esquema numérico si falta una fecha de inicio válida", () => {
    expect(permiteNotaAprobado(null)).toBe(false);
    expect(permiteNotaAprobado("fecha-desconocida")).toBe(false);
    expect(isNotaPermitidaParaPps("Aprobado", null)).toBe(false);
    expect(isNotaPermitidaParaPps("10", null)).toBe(true);
  });
});

describe("computeFrecuenciaSemanal", () => {
  it("reparte las horas entre las semanas del período", () => {
    // 80 hs en 8 semanas exactas → 10 hs/sem
    expect(computeFrecuenciaSemanal(80, "2026-03-02", "2026-04-27")).toBe(10);
  });

  it("redondea a un decimal cuando no da entero", () => {
    // 25 hs en 3 semanas → 8.33...
    expect(computeFrecuenciaSemanal(25, "2026-03-02", "2026-03-23")).toBe(8.3);
  });

  it("cuenta una práctica de un solo día como una semana", () => {
    expect(computeFrecuenciaSemanal(6, "2026-03-02", "2026-03-02")).toBe(6);
  });

  it("devuelve null si falta alguna fecha", () => {
    expect(computeFrecuenciaSemanal(80, null, "2026-04-27")).toBeNull();
    expect(computeFrecuenciaSemanal(80, "2026-03-02", null)).toBeNull();
  });

  it("devuelve null si no hay horas cargadas", () => {
    expect(computeFrecuenciaSemanal(0, "2026-03-02", "2026-04-27")).toBeNull();
    expect(computeFrecuenciaSemanal(null, "2026-03-02", "2026-04-27")).toBeNull();
  });

  it("devuelve null si las fechas son inválidas o están invertidas", () => {
    expect(computeFrecuenciaSemanal(80, "no-es-fecha", "2026-04-27")).toBeNull();
    expect(computeFrecuenciaSemanal(80, "2026-04-27", "2026-03-02")).toBeNull();
  });

  it("tolera horas que vienen como string desde el snapshot", () => {
    expect(computeFrecuenciaSemanal("80", "2026-03-02", "2026-04-27")).toBe(10);
  });
});

describe("parseHorasSemanalesDeHorario", () => {
  it("lee un tramo simple", () => {
    expect(parseHorasSemanalesDeHorario("Lunes de 9 a 13")).toBe(4);
  });

  it("suma varios tramos separados por punto y coma", () => {
    expect(parseHorasSemanalesDeHorario("Lunes de 9 a 13; Jueves de 14 a 18")).toBe(8);
  });

  it("entiende medias horas", () => {
    expect(parseHorasSemanalesDeHorario("Martes de 9:30 a 13")).toBe(3.5);
  });

  it("tolera variantes de escritura", () => {
    expect(parseHorasSemanalesDeHorario("Miércoles 14hs a 18hs")).toBe(4);
    expect(parseHorasSemanalesDeHorario("Viernes 10 - 13")).toBe(3);
  });

  it("devuelve null si algún tramo no se entiende, en vez de sumar de menos", () => {
    expect(parseHorasSemanalesDeHorario("Lunes de 9 a 13; a convenir")).toBeNull();
    expect(parseHorasSemanalesDeHorario("Horario rotativo")).toBeNull();
  });

  it("rechaza rangos imposibles", () => {
    expect(parseHorasSemanalesDeHorario("Lunes de 13 a 9")).toBeNull();
    expect(parseHorasSemanalesDeHorario("Lunes de 9 a 30")).toBeNull();
  });

  it("devuelve null si no hay horario", () => {
    expect(parseHorasSemanalesDeHorario(null)).toBeNull();
    expect(parseHorasSemanalesDeHorario("")).toBeNull();
  });
});

describe("resolveFrecuenciaSemanal", () => {
  const periodo = { fechaInicio: "2026-03-02", fechaFinalizacion: "2026-04-27" }; // 8 semanas

  it("usa el horario declarado cuando cierra con las horas acreditadas", () => {
    // 10 hs/sem x 8 semanas = 80, y se acreditaron 80.
    const r = resolveFrecuenciaSemanal({
      ...periodo,
      horas: 80,
      horarioDeclarado: "Lunes de 9 a 14; Jueves de 9 a 14",
    });
    expect(r).toEqual({ valor: 10, origen: "horario" });
  });

  it("tolera que sobre un poco por inasistencias", () => {
    // 10 hs/sem x 8 = 80 declaradas contra 70 acreditadas: ratio 1.14, dentro de banda.
    const r = resolveFrecuenciaSemanal({
      ...periodo,
      horas: 70,
      horarioDeclarado: "Lunes de 9 a 14; Jueves de 9 a 14",
    });
    expect(r.origen).toBe("horario");
    expect(r.valor).toBe(10);
  });

  it("descarta el horario cuando implicaría muchas más horas de las acreditadas", () => {
    // 20 hs/sem x 8 = 160 contra 25 acreditadas: imposible.
    const r = resolveFrecuenciaSemanal({
      ...periodo,
      horas: 25,
      horarioDeclarado: "Lunes de 9 a 19; Jueves de 9 a 19",
    });
    expect(r.origen).toBe("calculo");
    expect(r.valor).toBe(3.1); // 25 / 8
    expect(r.advertencia).toContain("se acreditaron 25 hs");
  });

  it("descarta el horario cuando se queda muy corto", () => {
    // 2 hs/sem x 8 = 16 contra 80 acreditadas.
    const r = resolveFrecuenciaSemanal({
      ...periodo,
      horas: 80,
      horarioDeclarado: "Lunes de 9 a 11",
    });
    expect(r.origen).toBe("calculo");
    expect(r.valor).toBe(10);
    expect(r.advertencia).toBeDefined();
  });

  it("cae al cálculo si no hay horario declarado o no se entiende", () => {
    expect(resolveFrecuenciaSemanal({ ...periodo, horas: 80 })).toEqual({
      valor: 10,
      origen: "calculo",
    });
    expect(
      resolveFrecuenciaSemanal({ ...periodo, horas: 80, horarioDeclarado: "a convenir" })
    ).toEqual({ valor: 10, origen: "calculo" });
  });

  it("se queda con el horario si no hay período contra el cual contrastar", () => {
    const r = resolveFrecuenciaSemanal({
      horas: 80,
      fechaInicio: null,
      fechaFinalizacion: null,
      horarioDeclarado: "Lunes de 9 a 13",
    });
    expect(r).toEqual({ valor: 4, origen: "horario" });
  });

  it("no inventa nada cuando no hay datos", () => {
    expect(
      resolveFrecuenciaSemanal({ horas: null, fechaInicio: null, fechaFinalizacion: null })
    ).toEqual({ valor: null, origen: null });
  });
});
