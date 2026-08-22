/**
 * Tests de `fetchSeleccionados` (agrupado de estudiantes seleccionados por horario).
 *
 * Reescrito: la versión anterior mockeaba `supabaseService` (capa que esta
 * función ya no usa) y no tenía assertions, dando falsa cobertura. Ahora se
 * mockea la capa `db` real y el cliente `supabase` para la query de compromisos.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import * as C from "../../constants";
import type { LanzamientoPPS } from "../../types";

const mockConvocatoriasGetAll = jest.fn<(opts?: unknown) => Promise<unknown[]>>();
const mockEstudiantesGetAll = jest.fn<(opts?: unknown) => Promise<unknown[]>>();

jest.mock("../../lib/db", () => ({
  db: {
    convocatorias: { getAll: (opts?: unknown) => mockConvocatoriasGetAll(opts) },
    estudiantes: { getAll: (opts?: unknown) => mockEstudiantesGetAll(opts) },
  },
}));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  },
}));

import { fetchSeleccionados } from "../convocatoriasService";

const lanzamiento = { id: "lanz-1" } as unknown as LanzamientoPPS;

beforeEach(() => {
  jest.clearAllMocks();
  mockEstudiantesGetAll.mockResolvedValue([]);
});

describe("fetchSeleccionados", () => {
  it("agrupa los estudiantes seleccionados con nombre y legajo resueltos", async () => {
    mockConvocatoriasGetAll.mockResolvedValue([
      {
        id: "conv-1",
        [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
        [C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: "est-1",
        [C.FIELD_HORARIO_ASIGNADO_CONVOCATORIAS]: "Lunes 9 a 12",
      },
    ]);
    mockEstudiantesGetAll.mockResolvedValue([
      {
        id: "est-1",
        [C.FIELD_NOMBRE_ESTUDIANTES]: "Ana Lopez",
        [C.FIELD_LEGAJO_ESTUDIANTES]: "555",
      },
    ]);

    const result = await fetchSeleccionados(lanzamiento);

    expect(result).not.toBeNull();
    const students = Object.values(result!).flat();
    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({ nombre: "Ana Lopez", legajo: "555" });
  });

  it("ignora inscripciones que no están en estado seleccionado/asignado", async () => {
    mockConvocatoriasGetAll.mockResolvedValue([
      {
        id: "conv-2",
        [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto",
        [C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: "est-2",
      },
    ]);

    const result = await fetchSeleccionados(lanzamiento);
    expect(result).toBeNull();
  });

  it("devuelve null cuando no hay inscripciones para el lanzamiento", async () => {
    mockConvocatoriasGetAll.mockResolvedValue([]);
    const result = await fetchSeleccionados(lanzamiento);
    expect(result).toBeNull();
  });

  it("filtra las convocatorias por el lanzamiento recibido", async () => {
    mockConvocatoriasGetAll.mockResolvedValue([]);
    await fetchSeleccionados(lanzamiento);
    expect(mockConvocatoriasGetAll).toHaveBeenCalledWith({
      filters: { [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: "lanz-1" },
    });
  });
});
