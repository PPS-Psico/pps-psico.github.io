import { describe, expect, it, beforeEach } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { useFinalizacionLogic } from "../useFinalizacionLogic";
import { mockDb } from "../../services/mockDb";
import { FIELD_ESTADO_FINALIZACION } from "../../constants";

/**
 * Integración de useFinalizacionLogic (Acreditaciones / Egreso).
 *
 * Prueba el hook + React Query + capa de datos en `isTestingMode` (mockDb).
 * Datos de mockData:
 *   - fin_1 (st_5, estado "Pendiente")  -> activeList
 *   - fin_2 (st_3, estado "Cargado")    -> historyList
 */

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFinalizacionLogic (Integration)", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("separa solicitudes activas (pendientes) del historial (cargadas)", async () => {
    const { result } = renderHook(() => useFinalizacionLogic(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // fin_1 está Pendiente -> activa; fin_2 está Cargado -> historial
    expect(result.current.activeList.some((r) => r.id === "fin_1")).toBe(true);
    expect(result.current.activeList.some((r) => r.id === "fin_2")).toBe(false);
    expect(result.current.historyList.some((r) => r.id === "fin_2")).toBe(true);
  });

  it("enriquece cada solicitud con datos del estudiante", async () => {
    const { result } = renderHook(() => useFinalizacionLogic(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.activeList.length).toBeGreaterThan(0));

    const req = result.current.activeList.find((r) => r.id === "fin_1")!;
    expect(typeof req.studentName).toBe("string");
    expect(req.studentName.length).toBeGreaterThan(0);
    expect(req.studentName).not.toBe("Desconocido");
  });

  it("al marcar 'Cargado' persiste el nuevo estado en la capa de datos", async () => {
    const { result } = renderHook(() => useFinalizacionLogic(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.activeList.some((r) => r.id === "fin_1")).toBe(true));

    act(() => {
      result.current.updateStatusMutation.mutate({ id: "fin_1", status: "Cargado" });
    });

    await waitFor(() => expect(result.current.updateStatusMutation.isSuccess).toBe(true));

    const persisted = mockDb.data.finalizacion_pps.find((f) => f.id === "fin_1");
    expect(persisted![FIELD_ESTADO_FINALIZACION]).toBe("Cargado");
  });

  it("filtra por término de búsqueda (nombre del estudiante)", async () => {
    const { result } = renderHook(() => useFinalizacionLogic(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.activeList.length).toBeGreaterThan(0));

    const nombre = result.current.activeList[0].studentName;

    act(() => result.current.setSearchTerm(nombre));
    await waitFor(() =>
      expect(result.current.activeList.every((r) => r.studentName === nombre)).toBe(true)
    );

    // Un término inexistente vacía ambas listas
    act(() => result.current.setSearchTerm("zzz-no-existe-zzz"));
    await waitFor(() => {
      expect(result.current.activeList.length).toBe(0);
      expect(result.current.historyList.length).toBe(0);
    });
  });
});
