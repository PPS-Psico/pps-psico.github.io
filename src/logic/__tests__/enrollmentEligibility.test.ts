import { describe, it, expect } from "@jest/globals";
import type { LanzamientoPPS } from "../../types";
import {
  getCompletedEnrollmentLabel,
  getEnrollmentEligibility,
  type CompletedHistory,
} from "../enrollmentEligibility";

const makeLanzamiento = (overrides: Partial<LanzamientoPPS> = {}): LanzamientoPPS =>
  ({
    id: "lanz-1",
    nombre_pps: "Fundación Lanna",
    orientacion: "Clínica",
    ...overrides,
  }) as LanzamientoPPS;

const makeHistory = (overrides: Partial<CompletedHistory> = {}): CompletedHistory => ({
  completedLanzamientoIds: new Set<string>(),
  completedOrientationsByInstitution: new Map<string, Set<string>>(),
  ...overrides,
});

describe("getEnrollmentEligibility", () => {
  it("deja anotarse a una PPS que el estudiante nunca hizo", () => {
    const result = getEnrollmentEligibility(makeLanzamiento(), makeHistory());
    expect(result.isCompleted).toBe(false);
  });

  it("bloquea si ya hizo ese mismo lanzamiento", () => {
    const history = makeHistory({ completedLanzamientoIds: new Set(["lanz-1"]) });
    expect(getEnrollmentEligibility(makeLanzamiento(), history).isCompleted).toBe(true);
  });

  it("bloquea el relanzamiento del año siguiente, que tiene otro id pero el mismo nombre", () => {
    const history = makeHistory({ completedLanzamientoIds: new Set(["fundacion lanna"]) });
    const relanzamiento = makeLanzamiento({ id: "lanz-2026", nombre_pps: "Fundación Lanna" });
    expect(getEnrollmentEligibility(relanzamiento, history).isCompleted).toBe(true);
  });

  it("habilita una institución multi-orientación mientras quede una sin cursar", () => {
    const lanzamiento = makeLanzamiento({ orientacion: "Clínica, Educacional" });
    const history = makeHistory({
      completedLanzamientoIds: new Set(["lanz-1", "fundacion lanna"]),
      completedOrientationsByInstitution: new Map([["fundacion lanna", new Set(["clinica"])]]),
    });

    const result = getEnrollmentEligibility(lanzamiento, history);
    expect(result.isCompleted).toBe(false);
    expect(result.completedOrientaciones).toEqual(["Clínica"]);
  });

  it("bloquea la institución multi-orientación cuando ya cursó todas", () => {
    const lanzamiento = makeLanzamiento({ orientacion: "Clínica, Educacional" });
    const history = makeHistory({
      completedOrientationsByInstitution: new Map([
        ["fundacion lanna", new Set(["clinica", "educacional"])],
      ]),
    });

    const result = getEnrollmentEligibility(lanzamiento, history);
    expect(result.isCompleted).toBe(true);
    expect(result.completedOrientaciones).toEqual(["Clínica", "Educacional"]);
  });

  it("cruza el historial contra la institución, ignorando el sufijo de orientación del nombre", () => {
    const lanzamiento = makeLanzamiento({
      nombre_pps: "Fundación Lanna - Clínica",
      orientacion: "Clínica, Laboral",
    });
    const history = makeHistory({
      completedOrientationsByInstitution: new Map([
        ["fundacion lanna", new Set(["clinica", "laboral"])],
      ]),
    });

    expect(getEnrollmentEligibility(lanzamiento, history).isCompleted).toBe(true);
  });

  it("no bloquea a otra institución con orientación homónima", () => {
    const history = makeHistory({
      completedLanzamientoIds: new Set(["hospital alvarez"]),
      completedOrientationsByInstitution: new Map([["hospital alvarez", new Set(["clinica"])]]),
    });

    expect(getEnrollmentEligibility(makeLanzamiento(), history).isCompleted).toBe(false);
  });
});

describe("getCompletedEnrollmentLabel", () => {
  it("usa el copy multi-orientación cuando el lanzamiento ofrece más de una", () => {
    const lanzamiento = makeLanzamiento({ orientacion: "Clínica, Educacional" });
    const history = makeHistory({
      completedOrientationsByInstitution: new Map([
        ["fundacion lanna", new Set(["clinica", "educacional"])],
      ]),
    });

    expect(getCompletedEnrollmentLabel(getEnrollmentEligibility(lanzamiento, history))).toBe(
      "Ya cursaste estas orientaciones"
    );
  });

  it("usa el copy simple cuando el lanzamiento tiene una sola orientación", () => {
    const history = makeHistory({ completedLanzamientoIds: new Set(["lanz-1"]) });

    expect(getCompletedEnrollmentLabel(getEnrollmentEligibility(makeLanzamiento(), history))).toBe(
      "Ya realizaste esta PPS"
    );
  });
});
