import { describe, expect, it } from "@jest/globals";
import { hasJefeMoodleSyncProblems } from "../jefeMoodleSyncStatus";

describe("hasJefeMoodleSyncProblems", () => {
  it("no marca como parcial una lectura completa con filas aisladas para auditoría", () => {
    expect(
      hasJefeMoodleSyncProblems({
        failedTasks: 0,
        ambiguous: 0,
        invalid: 0,
      })
    ).toBe(false);
  });

  it.each([
    { failedTasks: 1, ambiguous: 0, invalid: 0 },
    { failedTasks: 0, ambiguous: 1, invalid: 0 },
    { failedTasks: 0, ambiguous: 0, invalid: 1 },
  ])("mantiene el estado parcial ante un problema real: %o", (input) => {
    expect(hasJefeMoodleSyncProblems(input)).toBe(true);
  });
});
