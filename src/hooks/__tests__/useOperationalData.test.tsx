import { describe, expect, it, beforeEach } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { useOperationalData } from "../useOperationalData";
import { mockDb } from "../../services/mockDb";
import { FIELD_ESTADO_FINALIZACION } from "../../constants";

/**
 * Integración de useOperationalData (datos operativos del dashboard admin).
 *
 * En `isTestingMode` agrega contra mockDb. Verificamos el contrato de salida y
 * el filtrado determinista (acreditaciones pendientes, solicitudes no terminales).
 */

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useOperationalData (Integration)", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("devuelve el contrato esperado de datos operativos", async () => {
    const { result } = renderHook(() => useOperationalData(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data!;

    expect(Array.isArray(data.endingLaunches)).toBe(true);
    expect(Array.isArray(data.pendingRequests)).toBe(true);
    expect(Array.isArray(data.pendingFinalizations)).toBe(true);
    expect(Array.isArray(data.closingAlerts)).toBe(true);
    expect(typeof data.pendingCorrectionsCount).toBe("number");
  });

  it("solo incluye acreditaciones en estado 'Pendiente'", async () => {
    const { result } = renderHook(() => useOperationalData(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // fin_1 está Pendiente -> incluido; fin_2 está Cargado -> excluido.
    const finals = result.current.data!.pendingFinalizations;
    expect(finals.every((f) => f[FIELD_ESTADO_FINALIZACION] === "Pendiente")).toBe(true);
    expect(finals.some((f) => f.id === "fin_1")).toBe(true);
    expect(finals.some((f) => f.id === "fin_2")).toBe(false);
  });

  it("excluye solicitudes en estados terminales de pendingRequests", async () => {
    const { result } = renderHook(() => useOperationalData(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const terminal = ["finalizada", "cancelada", "rechazada", "archivado", "realizada"];
    const hayTerminal = result.current.data!.pendingRequests.some((r) =>
      terminal.includes(String(r.estado_seguimiento || "").toLowerCase())
    );
    expect(hayTerminal).toBe(false);
  });
});
