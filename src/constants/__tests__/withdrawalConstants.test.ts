import { describe, expect, it } from "@jest/globals";
import { getWithdrawalPenaltySuggestion } from "../withdrawalConstants";

describe("getWithdrawalPenaltySuggestion", () => {
  it("sugiere la penalización menor cuando la solicitud es anterior al inicio", () => {
    expect(getWithdrawalPenaltySuggestion("2026-03-01T23:30:00Z", "2026-03-05")).toMatchObject({
      timing: "before_start",
      type: "Baja Anticipada",
      score: 30,
      daysFromStart: -4,
    });
  });

  it("usa la fecha de Buenos Aires para clasificar el mismo día", () => {
    expect(getWithdrawalPenaltySuggestion("2026-03-05T02:30:00Z", "2026-03-04")).toMatchObject({
      timing: "start_day",
      type: "Baja sobre la Fecha / Ausencia en Inicio",
      score: 50,
      daysFromStart: 0,
    });
  });

  it("sugiere abandono cuando la PPS ya comenzó", () => {
    expect(getWithdrawalPenaltySuggestion("2026-03-08T15:00:00Z", "2026-03-05")).toMatchObject({
      timing: "after_start",
      type: "Abandono durante la PPS",
      score: 70,
      daysFromStart: 3,
    });
  });

  it("deja la fecha marcada para revisión cuando falta el inicio", () => {
    expect(getWithdrawalPenaltySuggestion("2026-03-08T15:00:00Z", null)).toMatchObject({
      timing: "unknown",
      type: "Baja Anticipada",
      score: 30,
      daysFromStart: null,
    });
  });
});
