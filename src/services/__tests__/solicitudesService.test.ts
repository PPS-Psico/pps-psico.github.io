/**
 * Tests de red de seguridad para `solicitudesService`.
 *
 * Cubren los guardrails de negocio del flujo admin de solicitudes (el que vive
 * en el monolito `SolicitudesManager.tsx`) ANTES de refactorizarlo:
 *  - idempotencia: no reprocesar una solicitud ya resuelta;
 *  - aprobación de modificación de horas -> propaga horas a la práctica;
 *  - una baja no puede pasar por la aprobación genérica;
 *  - creación y resolución de bajas -> usan las RPC atómicas dedicadas;
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
const mockRpc = jest.fn<(...args: unknown[]) => Promise<Resp>>();

jest.mock("../../lib/supabaseClient", () => ({
  supabase: { from: mockFrom, rpc: mockRpc, storage: {} },
}));

import {
  approveSolicitudModificacion,
  rejectSolicitudModificacion,
  approveSolicitudNuevaPPS,
  rejectSolicitudNuevaPPS,
  resolveSolicitudBajaPps,
  submitSolicitudBajaPps,
} from "../solicitudesService";

beforeEach(() => {
  jest.clearAllMocks();
  mockState.selectResponses = [];
  mockState.writeResponses = [];
  mockState.captured = { froms: [], updates: [], inserts: [] };
});

/*
  Las guardas de negocio de la aprobación (estado pendiente, no tocar una baja,
  bloquear la fila, no duplicar la práctica) dejaron de vivir acá: ahora son una
  transacción en Postgres. Un mock del cliente no puede demostrar atomicidad ni
  exclusión, así que estos tests cubren lo único que le queda al servicio —
  delegar en la RPC correcta con los parámetros correctos— y las guardas se
  verifican contra la base real.
*/
describe("approveSolicitudModificacion", () => {
  it("delega en la RPC atómica con las horas que definió coordinación", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "s2", estado: "aprobada" }, error: null });

    await approveSolicitudModificacion({
      solicitudId: "s2",
      horasAprobadas: 90,
      notasAdmin: "ok admin",
    });

    expect(mockRpc).toHaveBeenCalledWith("aprobar_solicitud_modificacion_pps", {
      p_solicitud_id: "s2",
      p_horas_aprobadas: 90,
      p_notas: "ok admin",
    });
    // Ninguna escritura suelta por fuera de la transacción.
    expect(mockState.captured.updates).toHaveLength(0);
    expect(mockState.captured.froms).not.toContain("practicas");
  });

  it("omite las horas cuando la modificación no es de horas", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "s4", estado: "aprobada" }, error: null });

    await approveSolicitudModificacion({ solicitudId: "s4" });

    expect(mockRpc).toHaveBeenCalledWith("aprobar_solicitud_modificacion_pps", {
      p_solicitud_id: "s4",
    });
  });

  it("propaga el rechazo de la base en vez de darlo por aprobado", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error("La solicitud ya fue procesada (estado: aprobada)."),
    });

    await expect(approveSolicitudModificacion({ solicitudId: "s1" })).rejects.toThrow(
      "ya fue procesada"
    );
  });
});

describe("solicitudes de baja de PPS", () => {
  it("crea la solicitud con motivo obligatorio mediante la RPC del estudiante", async () => {
    mockRpc.mockResolvedValueOnce({ data: "sol-baja-1", error: null });

    const result = await submitSolicitudBajaPps(
      "est-ignorado-por-seguridad",
      "prac-1",
      "academico",
      "Se superpone con una materia obligatoria."
    );

    expect(result).toBe("sol-baja-1");
    expect(mockRpc).toHaveBeenCalledWith("create_my_solicitud_baja_pps_v1", {
      p_practica_id: "prac-1",
      p_motivo_baja: "academico",
      p_motivo_baja_detalle: "Se superpone con una materia obligatoria.",
    });
  });

  it("aprueba la baja y delega eliminación + penalización en una única RPC", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          estado: "aprobada",
          penalizacion_id: "pen-1",
          practicas_eliminadas: 1,
        },
      ],
      error: null,
    });

    const result = await resolveSolicitudBajaPps({
      solicitudId: "sol-baja-1",
      decision: "aprobar",
      tipoIncumplimiento: "Baja Anticipada",
      notasAdmin: "Corresponde según la fecha de solicitud.",
    });

    expect(result).toEqual({
      estado: "aprobada",
      penalizacionId: "pen-1",
      practicasEliminadas: 1,
    });
    expect(mockRpc).toHaveBeenCalledWith("resolver_solicitud_baja_pps_v1", {
      p_solicitud_id: "sol-baja-1",
      p_decision: "aprobar",
      p_tipo_incumplimiento: "Baja Anticipada",
      p_notas_admin: "Corresponde según la fecha de solicitud.",
    });
  });

  it("rechaza la baja sin enviar un tipo de penalización", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ estado: "rechazada", penalizacion_id: null, practicas_eliminadas: 0 }],
      error: null,
    });

    await resolveSolicitudBajaPps({
      solicitudId: "sol-baja-2",
      decision: "rechazar",
      comentarioRechazo: "La práctica ya fue finalizada.",
    });

    expect(mockRpc).toHaveBeenCalledWith("resolver_solicitud_baja_pps_v1", {
      p_solicitud_id: "sol-baja-2",
      p_decision: "rechazar",
      p_comentario_rechazo: "La práctica ya fue finalizada.",
    });
  });
});

describe("rejectSolicitudModificacion", () => {
  it("delega en la RPC, que exige que la solicitud siga pendiente", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "s4", estado: "rechazada" }, error: null });

    await rejectSolicitudModificacion("s4", "Faltan horas certificadas", "revisar");

    expect(mockRpc).toHaveBeenCalledWith("rechazar_solicitud_modificacion_pps", {
      p_solicitud_id: "s4",
      p_comentario_rechazo: "Faltan horas certificadas",
      p_notas: "revisar",
    });
    // El UPDATE directo que podía rechazar una solicitud ya aprobada ya no existe.
    expect(mockState.captured.updates).toHaveLength(0);
  });

  it("propaga el error de la base sin tragárselo", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "RLS denied" } });
    await expect(rejectSolicitudModificacion("s5", "motivo")).rejects.toBeTruthy();
  });
});

describe("approveSolicitudNuevaPPS", () => {
  it("delega en la RPC atómica, que crea la práctica y resuelve la solicitud juntas", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "prac-new" }, error: null });

    const practica = await approveSolicitudNuevaPPS({
      solicitudId: "n1",
      horasAprobadas: 70,
      notasAdmin: "alta ok",
    });

    expect(mockRpc).toHaveBeenCalledWith("aprobar_solicitud_nueva_pps", {
      p_solicitud_id: "n1",
      p_horas_aprobadas: 70,
      p_notas: "alta ok",
    });
    expect(practica).toMatchObject({ id: "prac-new" });
    // El INSERT suelto que antes podía duplicarse al reintentar ya no existe.
    expect(mockState.captured.inserts).toHaveLength(0);
  });

  it("no llama a la base si no se indicaron las horas a acreditar", async () => {
    await expect(approveSolicitudNuevaPPS({ solicitudId: "n2" })).rejects.toThrow(
      "cuántas horas se acreditan"
    );
    await expect(
      approveSolicitudNuevaPPS({ solicitudId: "n2", horasAprobadas: 0 })
    ).rejects.toThrow("cuántas horas se acreditan");

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("propaga el rechazo de la base en vez de darlo por aprobado", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error("La solicitud ya fue procesada (estado: rechazada)."),
    });

    await expect(
      approveSolicitudNuevaPPS({ solicitudId: "n3", horasAprobadas: 70 })
    ).rejects.toThrow("ya fue procesada");
  });
});

describe("rejectSolicitudNuevaPPS", () => {
  it("delega en la RPC, que exige que la solicitud siga pendiente", async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: "n4", estado: "rechazada" }, error: null });

    await rejectSolicitudNuevaPPS("n4", "No corresponde", "nota");

    expect(mockRpc).toHaveBeenCalledWith("rechazar_solicitud_nueva_pps", {
      p_solicitud_id: "n4",
      p_comentario_rechazo: "No corresponde",
      p_notas: "nota",
    });
    expect(mockState.captured.updates).toHaveLength(0);
  });
});
