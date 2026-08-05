import { describe, expect, it } from "@jest/globals";
import { evaluarIngesta } from "../useWhatsappIngestHealth";

const AHORA = new Date("2026-08-03T12:00:00Z").getTime();

const horasAtras = (n: number) => new Date(AHORA - n * 3600 * 1000).toISOString();

const done = (horas: number) => ({
  tool: "wa_sync.done",
  timestamp: horasAtras(horas),
  error: null,
  input: null,
});

const fail = (horas: number, step = "wabdd_decrypt", error = "Databases not found") => ({
  tool: "wa_sync.error",
  timestamp: horasAtras(horas),
  error,
  input: { step },
});

const start = (horas: number) => ({
  tool: "wa_sync.start",
  timestamp: horasAtras(horas),
  error: null,
  input: { since_days: 7 },
});

describe("evaluarIngesta", () => {
  it("sin eventos devuelve desconocido, no un falso OK", () => {
    const r = evaluarIngesta([], AHORA);
    expect(r.estado).toBe("desconocido");
    expect(r.tone).toBe("mute");
  });

  it("corrida reciente exitosa está al día", () => {
    const r = evaluarIngesta([done(7), start(7)], AHORA);
    expect(r.estado).toBe("ok");
    expect(r.tone).toBe("ok");
    expect(r.label).toBe("WhatsApp al día");
  });

  it("marca atrasado cuando se perdió una corrida diaria", () => {
    const r = evaluarIngesta([done(31), start(31)], AHORA);
    expect(r.estado).toBe("atrasado");
    expect(r.tone).toBe("warn");
    expect(r.label).toContain("hace 1 día");
  });

  it("escala a crítico pasados tres días sin éxito", () => {
    const r = evaluarIngesta([done(80), start(80)], AHORA);
    expect(r.estado).toBe("error");
    expect(r.tone).toBe("danger");
  });

  it("un error reciente gana sobre un éxito anterior", () => {
    // El caso real de agosto 2026: falló tres días seguidos después de
    // semanas andando bien. Ordenado del más nuevo al más viejo.
    const r = evaluarIngesta([fail(4), fail(28), fail(52), done(76), start(76)], AHORA);
    expect(r.estado).toBe("error");
    expect(r.tone).toBe("danger");
    expect(r.ultimoExitoAt).toBe(horasAtras(76));
  });

  it("expone el paso y el motivo del fallo para el tooltip", () => {
    const r = evaluarIngesta([fail(4)], AHORA);
    expect(r.ultimoErrorDetalle).toContain("wabdd_decrypt");
    expect(r.ultimoErrorDetalle).toContain("Databases not found");
  });

  it("un éxito posterior a un fallo vuelve a estado OK", () => {
    const r = evaluarIngesta([done(2), fail(26)], AHORA);
    expect(r.estado).toBe("ok");
    expect(r.ultimoErrorAt).toBe(horasAtras(26));
  });

  it("si sólo hay starts sin desenlace no inventa un estado sano", () => {
    const r = evaluarIngesta([start(3), start(27)], AHORA);
    expect(r.estado).toBe("desconocido");
  });

  it("recorta el detalle del error para que no desborde el tooltip", () => {
    const r = evaluarIngesta([fail(1, "parse", "x".repeat(900))], AHORA);
    expect((r.ultimoErrorDetalle as string).length).toBeLessThanOrEqual(300);
  });
});
