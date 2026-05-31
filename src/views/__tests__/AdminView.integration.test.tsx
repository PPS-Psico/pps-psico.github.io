import { describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { ModalProvider } from "../../contexts/ModalContext";
import { useStudentPracticas } from "../../hooks/useStudentPracticas";
import { mockDb } from "../../services/mockDb";
import { FIELD_NOTA_PRACTICAS } from "../../constants";

/**
 * Integración del panel de estudiante visto por un administrador.
 *
 * El flujo "admin abre el panel de un alumno y edita una nota" se apoya en
 * `useStudentPracticas`, que en modo testing (legajo "99999") opera contra
 * mockDb sobre el estudiante st_999. Probamos la carga de prácticas y la
 * edición de nota con persistencia real, sin depender del JSX.
 */

const TEST_LEGAJO = "99999";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>{children}</ModalProvider>
    </QueryClientProvider>
  );
};

describe("Flujo de Panel de Administración (Integration Test)", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("carga las prácticas del alumno seleccionado", async () => {
    const { result } = renderHook(() => useStudentPracticas(TEST_LEGAJO), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isPracticasLoading).toBe(false));

    // st_999 tiene al menos una práctica (prac_1 en Garrahan)
    expect(result.current.practicas.length).toBeGreaterThan(0);
    expect(result.current.practicas.some((p) => p.id === "prac_1")).toBe(true);
  });

  it("permite editar la nota de una práctica y la persiste", async () => {
    const { result } = renderHook(() => useStudentPracticas(TEST_LEGAJO), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.practicas.length).toBeGreaterThan(0));

    const practica = result.current.practicas.find((p) => p.id === "prac_1")!;
    expect(practica[FIELD_NOTA_PRACTICAS]).toBe("Sin calificar");

    act(() => {
      result.current.updateNota.mutate({ practicaId: "prac_1", nota: "10" });
    });

    // La mutation termina correctamente
    await waitFor(() => expect(result.current.updateNota.isSuccess).toBe(true));

    // Y la nota quedó persistida en la capa de datos
    const persisted = mockDb.data.practicas.find((p: any) => p.id === "prac_1");
    expect(persisted[FIELD_NOTA_PRACTICAS]).toBe("10");
  });

  it("refleja la nota actualizada al refrescar las prácticas", async () => {
    const { result } = renderHook(() => useStudentPracticas(TEST_LEGAJO), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.practicas.length).toBeGreaterThan(0));

    act(() => {
      result.current.updateNota.mutate({ practicaId: "prac_1", nota: "8" });
    });
    await waitFor(() => expect(result.current.updateNota.isSuccess).toBe(true));

    await act(async () => {
      await result.current.refetchPracticas();
    });

    await waitFor(() => {
      const practica = result.current.practicas.find((p) => p.id === "prac_1");
      expect(practica?.[FIELD_NOTA_PRACTICAS]).toBe("8");
    });
  });
});
