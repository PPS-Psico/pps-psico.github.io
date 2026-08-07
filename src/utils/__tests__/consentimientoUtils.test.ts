import {
  formatConsentimientoDeadline,
  getConsentimientoDeadline,
  parsePpsStartAtBuenosAires,
} from "../consentimientoUtils";

describe("contrato temporal del consentimiento PPS", () => {
  it("interpreta la fecha de inicio como medianoche de Buenos Aires", () => {
    expect(parsePpsStartAtBuenosAires("2026-08-21")?.toISOString()).toBe(
      "2026-08-21T03:00:00.000Z"
    );
  });

  it("cierra 24 horas antes del inicio para una selección normal", () => {
    expect(getConsentimientoDeadline("2026-08-21", "2026-08-05T15:00:00.000Z")?.toISOString()).toBe(
      "2026-08-20T03:00:00.000Z"
    );
  });

  it("mantiene abierta la firma hasta el inicio si la selección fue tardía", () => {
    expect(getConsentimientoDeadline("2026-08-21", "2026-08-20T12:00:00.000Z")?.toISOString()).toBe(
      "2026-08-21T03:00:00.000Z"
    );
  });

  it("cierra antes cuando Coordinación entrega la lista a la institución", () => {
    expect(
      getConsentimientoDeadline(
        "2026-08-21",
        "2026-08-05T15:00:00.000Z",
        "2026-08-10T18:30:00.000Z"
      )?.toISOString()
    ).toBe("2026-08-10T18:30:00.000Z");
  });

  it("no inventa un vencimiento sin fecha de inicio o de selección", () => {
    expect(getConsentimientoDeadline(null, "2026-08-05T15:00:00.000Z")).toBeNull();
    expect(getConsentimientoDeadline("2026-08-21", null)).toBeNull();
  });

  it("formatea la hora en el huso institucional", () => {
    expect(formatConsentimientoDeadline(new Date("2026-08-20T03:00:00.000Z"))).toContain("00:00");
  });
});
