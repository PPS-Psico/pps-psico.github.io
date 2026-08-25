import type { Practica } from "../../../types";
import { collectGradeIssues, resolveGradeReadiness } from "../gradeReadiness";

const practica = (overrides: Partial<Practica>): Practica =>
  ({
    id: overrides.id ?? "p-1",
    nota: null,
    nota_moodle: null,
    nota_fuente: null,
    informe_estado: null,
    ...overrides,
  }) as Practica;

describe("resolveGradeReadiness", () => {
  it("acepta una nota verificada desde Campus", () => {
    const r = resolveGradeReadiness(
      practica({ nota: "8", nota_moodle: 8, nota_fuente: "moodle_session_observed" })
    );
    expect(r).toMatchObject({ severity: "ok", ready: true, blocking: false, nota: "8" });
  });

  it("recorta los decimales sobrantes de la nota de Campus", () => {
    const r = resolveGradeReadiness(
      practica({ nota: "10", nota_moodle: 10.0, nota_fuente: "moodle_session_observed" })
    );
    expect(r.nota).toBe("10");
  });

  it("acepta el veredicto Aprobado de una tarea pass/fail", () => {
    const r = resolveGradeReadiness(practica({ nota: "Aprobado", nota_fuente: "admin" }));
    expect(r).toMatchObject({ severity: "ok", ready: true });
  });

  it("bloquea una PPS desaprobada", () => {
    const r = resolveGradeReadiness(practica({ nota: "Desaprobado", nota_fuente: "admin" }));
    expect(r).toMatchObject({ severity: "block", blocking: true, reason: "desaprobada" });
  });

  it("bloquea cuando Campus devolvio algo que no es una nota", () => {
    const r = resolveGradeReadiness(
      practica({ nota: "", nota_moodle: null, nota_fuente: "moodle_session_observed" })
    );
    expect(r).toMatchObject({ severity: "block", blocking: true, reason: "nota_invalida" });
  });

  it("acepta una nota historica cargada sin procedencia", () => {
    const r = resolveGradeReadiness(practica({ nota: "9", nota_fuente: null }));
    expect(r).toMatchObject({ severity: "ok", ready: true, nota: "9" });
  });

  it("ignora 'legacy' como procedencia valida pero conserva el numero", () => {
    const r = resolveGradeReadiness(practica({ nota: "7", nota_fuente: "legacy" }));
    expect(r).toMatchObject({ severity: "ok", nota: "7" });
  });

  it("avisa -sin cortar- cuando la catedra todavia no corrigio", () => {
    const r = resolveGradeReadiness(practica({ nota: "Sin calificar" }));
    expect(r).toMatchObject({ severity: "warn", blocking: false, reason: "sin_correccion" });
  });

  it("avisa cuando no hay ninguna nota registrada", () => {
    const r = resolveGradeReadiness(practica({ nota: null }));
    expect(r).toMatchObject({ severity: "warn", blocking: false, reason: "sin_verificar" });
  });

  it("trata 'Entregado (sin corregir)' como estado, no como nota", () => {
    const r = resolveGradeReadiness(practica({ nota: "Entregado (sin corregir)" }));
    expect(r.severity).toBe("warn");
  });
});

describe("collectGradeIssues", () => {
  it("separa lo que corta el envio de lo que solo se avisa", () => {
    const { blocking, warnings } = collectGradeIssues([
      practica({ id: "ok", nota: "10", nota_moodle: 10, nota_fuente: "moodle_session_observed" }),
      practica({ id: "desaprobada", nota: "Desaprobado", nota_fuente: "admin" }),
      practica({ id: "pendiente", nota: "Sin calificar" }),
    ]);

    expect(blocking.map((i) => i.practica.id)).toEqual(["desaprobada"]);
    expect(warnings.map((i) => i.practica.id)).toEqual(["pendiente"]);
  });

  it("no reporta nada cuando estan todas corregidas", () => {
    const { blocking, warnings } = collectGradeIssues([
      practica({ id: "a", nota: "8", nota_moodle: 8, nota_fuente: "moodle_session_observed" }),
      practica({ id: "b", nota: "9" }),
    ]);
    expect(blocking).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
