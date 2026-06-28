/**
 * Tests de red de seguridad para `solicitudesService`.
 *
 * Cubren los guardrails de negocio del flujo admin de solicitudes (el que vive
 * en el monolito `SolicitudesManager.tsx`) ANTES de refactorizarlo:
 *  - idempotencia: no reprocesar una solicitud ya resuelta;
 *  - aprobación de modificación de horas -> propaga horas a la práctica;
 *  - aprobación de modificación de eliminación -> no toca prácticas;
 *  - aprobación de nueva PPS -> crea práctica "Finalizada" con nombre resuelto;
 *  - rechazos -> persisten estado + comentario.
 *
 * Estos servicios usan el cliente `supabase` directamente (cadenas
 * `.from().select().eq().single()` / `.update().eq()`), así que mockeamos el
 * cliente con un builder encadenable que consume colas ordenadas de respuestas.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

type Resp = { data?: unknown; error?: unknown };

// Estado del mock (nombres con prefijo `mock` para que jest permita referenciarlos
// dentro de la factory hoisteada de jest.mock).
const mockState = {
  selectResponses: [] as Resp[], // consumidas por .single()/.maybeSingle()
  writeResponses: [] as Resp[], // consumidas al await-ear cadenas update/delete
  captured: {
    froms: [] as string[],
    updates: [] as unknown[],
    inserts: [] as unknown[],
  },
};

const mockBuilder: Record<string, unknown> = {};
const returnBuilder = () => mockBuilder;
mockBuilder.select = jest.fn(returnBuilder);
mockBuilder.eq = jest.fn(returnBuilder);
mockBuilder.order = jest.fn(returnBuilder);
mockBuilder.delete = jest.fn(returnBuilder);
mockBuilder.update = jest.fn((payload: unknown) => {
  mockState.captured.updates.push(payload);
  return mockBuilder;
});
mockBuilder.insert = jest.fn((payload: unknown) => {
  mockState.captured.inserts.push(payload);
  return mockBuilder;
});
mockBuilder.single = jest.fn(() =>
  Promise.resolve(mockState.selectResponses.shift() ?? { data: null, error: null })
);
mockBuilder.maybeSingle = jest.fn(() =>
  Promise.resolve(mockState.selectResponses.shift() ?? { data: null, error: null })
);
// Hace al builder "thenable": al await-ear una cadena de escritura resuelve la
// siguiente respuesta de writeResponses.
mockBuilder.then = (resolve: (v: Resp) => unknown) =>
  resolve(mockState.writeResponses.shift() ?? { data: null, error: null });

const mockFrom = jest.fn((table: string) => {
  mockState.captured.froms.push(table);
  return mockBuilder;
});
const mockRpc = jest.fn();

jest.mock("../../lib/supabaseClient", () => ({
  supabase: { from: mockFrom, rpc: mockRpc, storage: {} },
}));

import {
  approveSolicitudModificacion,
  rejectSolicitudModificacion,
  approveSolicitudNuevaPPS,
  rejectSolicitudNuevaPPS,
} from "../solicitudesService";

const lastUpdate = () =>
  mockState.captured.updates[mockState.captured.updates.length - 1] as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockState.selectResponses = [];
  mockState.writeResponses = [];
  mockState.captured = { froms: [], updates: [], inserts: [] };
});

describe("approveSolicitudModificacion", () => {
  it("rechaza reprocesar una solicitud que no está pendiente", async () => {
    mockState.selectResponses = [{ data: { id: "s1", estado: "aprobada" }, error: null }];

    await expect(approveSolicitudModificacion("s1")).rejects.toThrow("ya fue procesada");
    // No debe escribir nada si ya estaba procesada.
    expect(mockState.captured.updates).toHaveLength(0);
  });

  it("lanza si la solicitud no existe", async () => {
    mockState.selectResponses = [{ data: null, error: null }];
    await expect(approveSolicitudModificacion("nope")).rejects.toThrow("no encontrada");
  });

  it("aprueba modificación de horas y propaga las horas a la práctica", async () => {
    mockState.selectResponses = [
      {
        data: {
          id: "s2",
          estado: "pendiente",
          tipo_modificacion: "horas",
          horas_nuevas: 120,
          practica_id: "prac-9",
        },
        error: null,
      },
    ];
    mockState.writeResponses = [{ error: null }, { error: null }];

    await approveSolicitudModificacion("s2", "ok admin");

    // Marca la solicitud como aprobada con notas.
    expect(mockState.captured.updates[0]).toMatchObject({
      estado: "aprobada",
      notas_admin: "ok admin",
    });
    // Actualiza horas_realizadas en practicas.
    expect(mockState.captured.updates[1]).toMatchObject({ horas_realizadas: 120 });
    expect(mockState.captured.froms).toContain("practicas");
  });

  it("aprueba modificación de eliminación sin tocar la tabla de prácticas", async () => {
    mockState.selectResponses = [
      {
        data: {
          id: "s3",
          estado: "pendiente",
          tipo_modificacion: "eliminacion",
          horas_nuevas: null,
          practica_id: "prac-3",
        },
        error: null,
      },
    ];
    mockState.writeResponses = [{ error: null }];

    await approveSolicitudModificacion("s3");

    expect(mockState.captured.updates).toHaveLength(1);
    expect(mockState.captured.froms).not.toContain("practicas");
  });
});

describe("rejectSolicitudModificacion", () => {
  it("persiste estado rechazada y el comentario de rechazo", async () => {
    mockState.writeResponses = [{ error: null }];

    await rejectSolicitudModificacion("s4", "Faltan horas certificadas", "revisar");

    expect(lastUpdate()).toMatchObject({
      estado: "rechazada",
      comentario_rechazo: "Faltan horas certificadas",
      notas_admin: "revisar",
    });
  });

  it("propaga el error de la base sin tragárselo", async () => {
    mockState.writeResponses = [{ error: { message: "RLS denied" } }];
    await expect(rejectSolicitudModificacion("s5", "motivo")).rejects.toBeTruthy();
  });
});

describe("approveSolicitudNuevaPPS", () => {
  it("crea una práctica Finalizada resolviendo el nombre de institución (join)", async () => {
    mockState.selectResponses = [
      // 1) fetch de la solicitud
      {
        data: {
          id: "n1",
          estado: "pendiente",
          estudiante_id: "est-1",
          orientacion: "Clínica",
          fecha_inicio: "2026-03-01",
          fecha_finalizacion: "2026-06-01",
          horas_estimadas: 250,
          es_online: true,
          nombre_institucion_manual: null,
          institucion: { nombre: "Hospital Italiano" },
        },
        error: null,
      },
      // 2) insert de la práctica -> .select().single()
      { data: { id: "prac-new" }, error: null },
    ];
    mockState.writeResponses = [{ error: null }]; // update de la solicitud

    const result = await approveSolicitudNuevaPPS("n1", "alta ok");

    const practicaInsert = mockState.captured.inserts[0] as Record<string, unknown>;
    expect(practicaInsert).toMatchObject({
      estudiante_id: "est-1",
      especialidad: "Clínica",
      horas_realizadas: 250,
      estado: "Finalizada",
      nombre_institucion: "Hospital Italiano",
      es_online: true,
    });
    expect(result.practica).toMatchObject({ id: "prac-new" });
  });

  it("usa el nombre manual cuando no hay institución vinculada", async () => {
    mockState.selectResponses = [
      {
        data: {
          id: "n2",
          estado: "pendiente",
          estudiante_id: "est-2",
          orientacion: "Laboral",
          fecha_inicio: "2026-03-01",
          fecha_finalizacion: "2026-06-01",
          horas_estimadas: 100,
          es_online: false,
          nombre_institucion_manual: "Consultorio Externo",
          institucion: null,
        },
        error: null,
      },
      { data: { id: "prac-new2" }, error: null },
    ];
    mockState.writeResponses = [{ error: null }];

    await approveSolicitudNuevaPPS("n2");

    const practicaInsert = mockState.captured.inserts[0] as Record<string, unknown>;
    expect(practicaInsert).toMatchObject({ nombre_institucion: "Consultorio Externo" });
  });

  it("rechaza reprocesar una nueva PPS ya resuelta", async () => {
    mockState.selectResponses = [{ data: { id: "n3", estado: "rechazada" }, error: null }];
    await expect(approveSolicitudNuevaPPS("n3")).rejects.toThrow("ya fue procesada");
    expect(mockState.captured.inserts).toHaveLength(0);
  });
});

describe("rejectSolicitudNuevaPPS", () => {
  it("persiste estado rechazada y comentario", async () => {
    mockState.writeResponses = [{ error: null }];
    await rejectSolicitudNuevaPPS("n4", "No corresponde", "nota");
    expect(lastUpdate()).toMatchObject({
      estado: "rechazada",
      comentario_rechazo: "No corresponde",
      notas_admin: "nota",
    });
  });
});
