import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const rpcMock = jest.fn();

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    functions: { invoke: jest.fn() },
  },
}));

import { submitCompromisoPPS } from "../compromisosService";

describe("submitCompromisoPPS", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("registra mediante el RPC seguro y no mediante un upsert directo", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { id: "commitment-1", accepted_at: "2026-08-07T12:00:00.000Z" },
      error: null,
    } as never);

    const result = await submitCompromisoPPS({
      studentId: "student-1",
      convocatoriaId: "enrollment-1",
      lanzamientoId: "launch-1",
      fullName: "Ana Pérez",
      dni: 30111222,
      legajo: "12345",
      signature: "Ana Pérez",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "submit_compromiso_pps",
      expect.objectContaining({
        p_convocatoria_id: "enrollment-1",
        p_lanzamiento_id: "launch-1",
        p_dni: 30111222,
        p_legajo: "12345",
      })
    );
    expect(result.id).toBe("commitment-1");
  });

  it("no envía una firma sin DNI al servidor", async () => {
    await expect(
      submitCompromisoPPS({
        studentId: "student-1",
        convocatoriaId: "enrollment-1",
        lanzamientoId: "launch-1",
        fullName: "Ana Pérez",
        dni: null,
        legajo: "12345",
        signature: "Ana Pérez",
      })
    ).rejects.toThrow("Ingresá tu DNI");

    expect(rpcMock).not.toHaveBeenCalled();
  });
});
