import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import * as C from "../../constants";

const mockLanzamientosDelete = jest.fn<(id: string) => Promise<{ success: boolean }>>();
const mockFromEq = jest.fn<() => Promise<{ data: unknown; error: unknown }>>(() =>
  Promise.resolve({ data: [], error: null })
);
const mockFromUpdate = jest.fn(() => ({ eq: mockFromEq }));
const mockFromDelete = jest.fn(() => ({ eq: mockFromEq }));

jest.mock("../../lib/db", () => ({
  db: {
    lanzamientos: {
      delete: (id: string) => mockLanzamientosDelete(id),
    },
    convocatorias: { getAll: jest.fn() },
    estudiantes: { getAll: jest.fn() },
    instituciones: { getAll: jest.fn() },
    practicas: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: jest.fn((_table: string) => ({
      update: mockFromUpdate,
      delete: mockFromDelete,
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  },
}));

import { eliminarLanzamiento } from "../convocatoriasService";
import { supabase } from "../../lib/supabaseClient";

beforeEach(() => {
  jest.clearAllMocks();
  mockLanzamientosDelete.mockResolvedValue({ success: true });
  mockFromEq.mockResolvedValue({ data: [], error: null });
});

describe("eliminarLanzamiento", () => {
  it("arroja error si no se provee un ID", async () => {
    await expect(eliminarLanzamiento("")).rejects.toThrow("ID de lanzamiento no proporcionado.");
  });

  it("elimina las dependencias asociadas y el lanzamiento principal", async () => {
    const result = await eliminarLanzamiento("lanz-123");

    expect(result).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith("penalizaciones");
    expect(supabase.from).toHaveBeenCalledWith("solicitudes_modificacion_pps");
    expect(supabase.from).toHaveBeenCalledWith("practicas");
    expect(supabase.from).toHaveBeenCalledWith("convocatorias");
    expect(supabase.from).toHaveBeenCalledWith("lanzamiento_opciones");
    expect(mockLanzamientosDelete).toHaveBeenCalledWith("lanz-123");
  });

  it("propaga el error si falla la eliminación de convocatorias", async () => {
    mockFromEq
      .mockResolvedValueOnce({ data: [], error: null }) // penalizaciones update
      .mockResolvedValueOnce({ data: [], error: null }) // solicitudes delete
      .mockResolvedValueOnce({ data: [], error: null }) // agent suggestions delete
      .mockResolvedValueOnce({ data: [], error: null }) // practicas delete
      .mockResolvedValueOnce({ data: null, error: new Error("Error convocatorias") }); // convocatorias delete

    await expect(eliminarLanzamiento("lanz-fail")).rejects.toThrow("Error convocatorias");
  });
});
