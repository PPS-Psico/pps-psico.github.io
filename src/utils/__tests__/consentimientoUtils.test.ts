import {
  formatConsentimientoDeadline,
  getConsentimientoDeadline,
  isConsentimientoRequiredOnClose,
  parsePpsStartAtBuenosAires,
} from "../consentimientoUtils";

describe("contrato temporal del consentimiento PPS", () => {
  it("interpreta la fecha de inicio como medianoche de Buenos Aires", () => {
    expect(parsePpsStartAtBuenosAires("2026-08-21")?.toISOString()).toBe(
      "2026-08-21T03:00:00.000Z"
    );
  });

  it("requiere consentimiento si la mesa cierra antes del día de inicio", () => {
    expect(
      isConsentimientoRequiredOnClose("2026-08-25", new Date("2026-08-24T15:00:00.000Z"))
    ).toBe(true);
  });

  it("omite consentimiento si la mesa cierra el mismo día o después del inicio", () => {
    expect(
      isConsentimientoRequiredOnClose("2026-08-24", new Date("2026-08-24T15:00:00.000Z"))
    ).toBe(false);
    expect(
      isConsentimientoRequiredOnClose("2026-08-23", new Date("2026-08-24T15:00:00.000Z"))
    ).toBe(false);
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

  it("otorga 24 horas completas si la selección ocurre después del inicio", () => {
    expect(getConsentimientoDeadline("2026-08-24", "2026-08-24T13:42:00.000Z")?.toISOString()).toBe(
      "2026-08-25T13:42:00.000Z"
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

  it("otorga 24 horas exactas desde el último recordatorio", () => {
    expect(
      getConsentimientoDeadline(
        "2026-08-21",
        "2026-08-05T15:00:00.000Z",
        null,
        "2026-08-07T16:45:00.000Z"
      )?.toISOString()
    ).toBe("2026-08-08T16:45:00.000Z");
  });

  it("no inventa un vencimiento sin fecha de inicio o de selección", () => {
    expect(getConsentimientoDeadline(null, "2026-08-05T15:00:00.000Z")).toBeNull();
    expect(getConsentimientoDeadline("2026-08-21", null)).toBeNull();
  });

  it("formatea la hora en el huso institucional", () => {
    expect(formatConsentimientoDeadline(new Date("2026-08-20T03:00:00.000Z"))).toContain("00:00");
  });
});
