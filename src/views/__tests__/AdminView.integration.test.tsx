import { describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { ModalProvider } from "../../contexts/ModalContext";
import { useStudentPracticas } from "../../hooks/useStudentPracticas";
import { mockDb } from "../../services/mockDb";

/**
 * Contrato del panel estudiantil sobre prácticas.
 *
 * La sesión del alumno sólo carga antecedentes y puede corregir la fecha de
 * finalización. Las notas llegan desde Moodle y el borrado queda reservado a
 * coordinación, por lo que esas mutaciones no deben exponerse desde el hook.
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
    const { result } = renderHook(() => useStudentPracticas(TEST_LEGAJO, null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isPracticasLoading).toBe(false));

    // st_999 tiene al menos una práctica (prac_1 en Garrahan)
    expect(result.current.practicas.length).toBeGreaterThan(0);
    expect(result.current.practicas.some((p: any) => p.id === "prac_1")).toBe(true);
  });

  it("no expone mutaciones estudiantiles de nota ni de borrado", async () => {
    const { result } = renderHook(() => useStudentPracticas(TEST_LEGAJO, null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.practicas.length).toBeGreaterThan(0));

    expect(result.current).not.toHaveProperty("updateNota");
    expect(result.current).not.toHaveProperty("deletePractica");
  });
});
