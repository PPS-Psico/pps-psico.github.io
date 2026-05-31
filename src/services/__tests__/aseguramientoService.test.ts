/**
 * Unit tests — flujo-aseguramiento-pps
 *
 * Cubre los efectos de persistencia de marcar/revertir aseguramiento con
 * `db.lanzamientos.update` mockeado.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS,
} from "../../constants";

// Mock de la capa db: solo necesitamos lanzamientos.update.
const mockUpdate = jest.fn<(id: string, fields: Record<string, unknown>) => Promise<unknown>>();
jest.mock("../../lib/db", () => ({
  db: {
    lanzamientos: {
      update: (...args: [string, Record<string, unknown>]) => mockUpdate(...args),
    },
  },
}));

import { marcarAseguramiento, revertirAseguramiento } from "../aseguramientoService";

describe("aseguramientoService — mutaciones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it("marcarAseguramiento escribe seguro_gestionado_at (ISO) y seguro_gestionado_por", async () => {
    const before = Date.now();
    await marcarAseguramiento("lanz-1", "coord-99");
    const after = Date.now();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [id, fields] = mockUpdate.mock.calls[0];
    expect(id).toBe("lanz-1");
    expect(fields[FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS]).toBe("coord-99");

    const at = fields[FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS] as string;
    expect(typeof at).toBe("string");
    const ts = Date.parse(at);
    expect(Number.isNaN(ts)).toBe(false);
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(after + 1000);
  });

  it("marcarAseguramiento acepta coordinadorId null (queda informativo)", async () => {
    await marcarAseguramiento("lanz-2", null);
    const [, fields] = mockUpdate.mock.calls[0];
    expect(fields[FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS]).toBeNull();
    expect(fields[FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]).not.toBeNull();
  });

  it("revertirAseguramiento envía seguro_gestionado_at: null y registra el coordinador", async () => {
    await revertirAseguramiento("lanz-3", "coord-7");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [id, fields] = mockUpdate.mock.calls[0];
    expect(id).toBe("lanz-3");
    expect(fields[FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]).toBeNull();
    expect(fields[FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS]).toBe("coord-7");
  });

  it("marcarAseguramiento propaga el error si el update rechaza (no lo traga)", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("RLS denied"));
    await expect(marcarAseguramiento("lanz-4", "coord-1")).rejects.toThrow("RLS denied");
  });

  it("revertirAseguramiento propaga el error si el update rechaza", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("network"));
    await expect(revertirAseguramiento("lanz-5", "coord-1")).rejects.toThrow("network");
  });
});
