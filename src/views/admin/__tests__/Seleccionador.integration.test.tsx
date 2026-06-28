import { describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { useSeleccionadorLogic } from "../../../hooks/useSeleccionadorLogic";
import { mockDb } from "../../../services/mockDb";
import { normalizeStringForComparison } from "../../../utils/formatters";

/**
 * Integración del Seleccionador de candidatos.
 *
 * Verifica la integración real hook + React Query + capa de datos en
 * `isTestingMode` (usa mockDb). Probar el hook en vez del JSX hace el test
 * resiliente a los rediseños visuales del Lanzador.
 *
 * Datos relevantes de mockData (en modo testing):
 *   - lanz_1 (Hospital Garrahan, "Abierta") con inscriptos:
 *       conv_1 (st_999 -> Seleccionado), conv_2 (st_1 -> Seleccionado),
 *       conv_3 (st_2 -> Inscripto)
 */

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("Seleccionador de Candidatos (Integration Test)", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("carga solo las convocatorias abiertas como lanzamientos disponibles", async () => {
    const { result } = renderHook(() => useSeleccionadorLogic(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.openLaunches.length).toBeGreaterThan(0));

    // Todas las cargadas deben estar abiertas (lanz_2 está "Cerrado" y no debe aparecer)
    const allOpen = result.current.openLaunches.every(
      (l) => normalizeStringForComparison(l.estado_convocatoria) === "abierta"
    );
    expect(allOpen).toBe(true);
    expect(result.current.openLaunches.some((l) => l.id === "lanz_2")).toBe(false);
    expect(result.current.openLaunches.some((l) => l.id === "lanz_1")).toBe(true);
  });

  it("enriquece y ordena los candidatos al seleccionar un lanzamiento", async () => {
    const { result } = renderHook(() => useSeleccionadorLogic(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.openLaunches.length).toBeGreaterThan(0));

    const garrahan = result.current.openLaunches.find((l) => l.id === "lanz_1")!;
    act(() => result.current.setSelectedLanzamiento(garrahan));

    await waitFor(() => expect(result.current.candidates.length).toBe(3));

    // Ordenados por puntaje descendente
    const scores = result.current.candidates.map((c) => c.puntajeTotal);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);

    // Dos ya están seleccionados (conv_1, conv_2)
    expect(result.current.selectedCandidates.length).toBe(2);
  });

  it("permite seleccionar un candidato inscripto y actualiza su estado a Seleccionado", async () => {
    const { result } = renderHook(() => useSeleccionadorLogic(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.openLaunches.length).toBeGreaterThan(0));

    const garrahan = result.current.openLaunches.find((l) => l.id === "lanz_1")!;
    act(() => result.current.setSelectedLanzamiento(garrahan));

    await waitFor(() => expect(result.current.candidates.length).toBe(3));

    // El candidato inscripto (conv_3 / st_2) aún no está seleccionado
    const inscripto = result.current.candidates.find((c) => c.enrollmentId === "conv_3")!;
    expect(normalizeStringForComparison(inscripto.status)).toBe("inscripto");

    // Lo seleccionamos
    act(() => result.current.handleToggle(inscripto));

    // Optimistic update inmediato
    await waitFor(() => {
      const updated = result.current.candidates.find((c) => c.enrollmentId === "conv_3");
      expect(normalizeStringForComparison(updated!.status)).toBe("seleccionado");
    });

    // Y queda persistido en la capa de datos (mockDb)
    await waitFor(() => {
      const persisted = mockDb.data.convocatorias.find((c) => c.id === "conv_3");
      expect(normalizeStringForComparison(persisted!.estado_inscripcion)).toBe("seleccionado");
    });

    // Ahora hay 3 seleccionados
    await waitFor(() => expect(result.current.selectedCandidates.length).toBe(3));
  });

  it("permite deseleccionar un candidato ya seleccionado (vuelve a Inscripto)", async () => {
    const { result } = renderHook(() => useSeleccionadorLogic(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.openLaunches.length).toBeGreaterThan(0));

    const garrahan = result.current.openLaunches.find((l) => l.id === "lanz_1")!;
    act(() => result.current.setSelectedLanzamiento(garrahan));

    await waitFor(() => expect(result.current.candidates.length).toBe(3));

    const seleccionado = result.current.candidates.find((c) => c.enrollmentId === "conv_1")!;
    expect(normalizeStringForComparison(seleccionado.status)).toBe("seleccionado");

    act(() => result.current.handleToggle(seleccionado));

    await waitFor(() => {
      const persisted = mockDb.data.convocatorias.find((c) => c.id === "conv_1");
      expect(normalizeStringForComparison(persisted!.estado_inscripcion)).toBe("inscripto");
    });
  });
});
