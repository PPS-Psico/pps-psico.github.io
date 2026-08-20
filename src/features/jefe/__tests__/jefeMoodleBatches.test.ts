import { describe, expect, it } from "@jest/globals";
import { buildJefeMoodleBatches, JEFE_MOODLE_BATCH_SIZE } from "../jefeMoodleBatches";

describe("buildJefeMoodleBatches", () => {
  it("divide 13 tareas en cuatro lecturas secuenciales", () => {
    const cmids = Array.from({ length: 13 }, (_, index) => 1_000 + index);

    expect(JEFE_MOODLE_BATCH_SIZE).toBe(4);
    expect(buildJefeMoodleBatches(cmids)).toEqual([
      [1000, 1001, 1002, 1003],
      [1004, 1005, 1006, 1007],
      [1008, 1009, 1010, 1011],
      [1012],
    ]);
  });

  it("elimina duplicados y cmids inválidos antes de consultar Moodle", () => {
    expect(buildJefeMoodleBatches([10, 10, 0, -2, 11, Number.NaN], 2)).toEqual([[10, 11]]);
  });

  it("rechaza tamaños de lote inválidos", () => {
    expect(() => buildJefeMoodleBatches([10], 0)).toThrow("positive integer");
  });
});
