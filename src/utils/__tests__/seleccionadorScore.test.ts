import { describe, it, expect } from "@jest/globals";
import { calculateScore, SCORE_WEIGHTS } from "../seleccionadorScore";
import {
  FIELD_TERMINO_CURSAR_CONVOCATORIAS,
  FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS,
} from "../../constants";

const enrollment = (overrides: Record<string, any> = {}): any => ({
  id: "c1",
  created_at: "",
  ...overrides,
});

describe("calculateScore", () => {
  it("asigna el puntaje académico máximo a quien terminó de cursar", () => {
    const score = calculateScore(
      enrollment({ [FIELD_TERMINO_CURSAR_CONVOCATORIAS]: "Sí" }),
      0,
      0,
      false
    );
    expect(score).toBe(SCORE_WEIGHTS.TERMINO_CURSAR);
  });

  it("prioriza terminó de cursar por sobre cursando electivas", () => {
    const score = calculateScore(
      enrollment({
        [FIELD_TERMINO_CURSAR_CONVOCATORIAS]: "Sí",
        [FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS]: "Sí",
      }),
      0,
      0,
      false
    );
    expect(score).toBe(SCORE_WEIGHTS.TERMINO_CURSAR);
  });

  it("usa el puntaje de electivas cuando no terminó de cursar", () => {
    const score = calculateScore(
      enrollment({ [FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS]: "Sí" }),
      0,
      0,
      false
    );
    expect(score).toBe(SCORE_WEIGHTS.CURSANDO_ELECTIVAS);
  });

  it("usa el puntaje base cuando adeuda finales", () => {
    const score = calculateScore(enrollment(), 0, 0, false);
    expect(score).toBe(SCORE_WEIGHTS.BASE_FINALES);
  });

  it("suma 0.5 por cada hora acumulada", () => {
    // base 30 + 100h * 0.5 = 80
    const score = calculateScore(enrollment(), 100, 0, false);
    expect(score).toBe(80);
  });

  it("suma el bono por trabajar", () => {
    // base 30 + bono 20 = 50
    const score = calculateScore(enrollment(), 0, 0, true);
    expect(score).toBe(SCORE_WEIGHTS.BASE_FINALES + SCORE_WEIGHTS.TRABAJA);
  });

  it("descuenta las penalizaciones", () => {
    // base 30 - 10 = 20
    const score = calculateScore(enrollment(), 0, 10, false);
    expect(score).toBe(20);
  });

  it("combina todos los factores y redondea", () => {
    // terminó 100 + 45h*0.5=22.5 + trabaja 20 - 5 pen = 137.5 -> 138
    const score = calculateScore(
      enrollment({ [FIELD_TERMINO_CURSAR_CONVOCATORIAS]: "Sí" }),
      45,
      5,
      true
    );
    expect(score).toBe(138);
  });

  it("puede dar negativo si las penalizaciones superan el puntaje", () => {
    const score = calculateScore(enrollment(), 0, 100, false);
    expect(score).toBe(-70);
  });

  it("trata cualquier valor distinto de 'Sí' como no cumplido", () => {
    const score = calculateScore(
      enrollment({
        [FIELD_TERMINO_CURSAR_CONVOCATORIAS]: "No",
        [FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS]: "tal vez",
      }),
      0,
      0,
      false
    );
    expect(score).toBe(SCORE_WEIGHTS.BASE_FINALES);
  });
});
