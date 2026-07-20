import { describe, expect, it } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { ModalProvider, useModal } from "../../contexts/ModalContext";
import { useConvocatorias } from "../../hooks/useConvocatorias";
import { mockDb } from "../../services/mockDb";
import { normalizeStringForComparison } from "../../utils/formatters";
import {
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
} from "../../constants";
import type { LanzamientoPPS } from "../../types";

/**
 * Integración del flujo de inscripción del estudiante.
 *
 * En modo testing (legajo "99999") `useConvocatorias` opera contra mockDb.
 * Verificamos el ciclo real: cargar convocatorias disponibles -> abrir el
 * formulario de inscripción (vía ModalContext) -> enviar -> persistir la
 * nueva convocatoria. Esto prueba la integración hook + contexto + datos sin
 * acoplarse al JSX, que cambia con los rediseños.
 */

const TEST_LEGAJO = "99999";
const TEST_STUDENT_ID = "st_999";

// Hook combinado: expone la lógica de convocatorias y el modal a la vez.
const useStudentEnrollmentHarness = () => {
  const convocatorias = useConvocatorias(TEST_LEGAJO, TEST_STUDENT_ID, null, false);
  const modal = useModal();
  return { convocatorias, modal };
};

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

describe("Flujo de Inscripción de Estudiante (Integration Test)", () => {
  beforeEach(() => {
    mockDb.reset();
  });

  it("carga las convocatorias disponibles para el estudiante", async () => {
    const { result } = renderHook(() => useStudentEnrollmentHarness(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.convocatorias.isConvocatoriasLoading).toBe(false));

    // mockData tiene varios lanzamientos no ocultos disponibles
    expect(result.current.convocatorias.lanzamientos.length).toBeGreaterThan(0);
  });

  it("abre el formulario de inscripción al postularse a un lanzamiento", async () => {
    const { result } = renderHook(() => useStudentEnrollmentHarness(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.convocatorias.lanzamientos.length).toBeGreaterThan(0)
    );

    const lanzamiento = result.current.convocatorias.lanzamientos[0] as LanzamientoPPS;
    act(() => result.current.convocatorias.enrollStudent.mutate(lanzamiento));

    await waitFor(() => expect(result.current.modal.isEnrollmentFormOpen).toBe(true));
    expect(result.current.modal.selectedLanzamientoForEnrollment?.id).toBe(lanzamiento.id);
    expect(typeof result.current.modal.onSubmitEnrollment).toBe("function");
  });

  it("crea una nueva convocatoria al enviar el formulario de inscripción", async () => {
    const { result } = renderHook(() => useStudentEnrollmentHarness(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.convocatorias.lanzamientos.length).toBeGreaterThan(0)
    );

    // Elegimos un lanzamiento al que el estudiante de prueba no esté inscripto
    const lanzamiento = result.current.convocatorias.lanzamientos.find(
      (l: any) => l.id === "lanz_3"
    ) as LanzamientoPPS;
    expect(lanzamiento).toBeDefined();

    const convocatoriasAntes = mockDb.data.convocatorias.length;

    act(() => result.current.convocatorias.enrollStudent.mutate(lanzamiento));
    await waitFor(() => expect(result.current.modal.isEnrollmentFormOpen).toBe(true));

    // Disparamos el submit del formulario tal como lo haría EnrollmentForm
    const formData = {
      horarios: ["Sábados 10 a 14hs"],
      terminoDeCursar: true,
      cursandoElectivas: false,
      finalesAdeudados: "1 Final",
      otraSituacionAcademica: "Prueba de integración.",
      trabaja: false,
    };

    await act(async () => {
      await result.current.modal.onSubmitEnrollment!(formData);
    });

    // Se persistió una nueva convocatoria en la capa de datos (mockDb)
    await waitFor(() => expect(mockDb.data.convocatorias.length).toBe(convocatoriasAntes + 1));

    const nueva = mockDb.data.convocatorias.find(
      (c) =>
        c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] === "lanz_3" &&
        (c.id as string).startsWith("mock_")
    );
    expect(nueva).toBeDefined();
    expect(nueva![FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]).toBe(TEST_STUDENT_ID);
    expect(normalizeStringForComparison(nueva![FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS])).toBe(
      "inscripto"
    );

    // La UI se actualiza en el mismo ciclo de la mutación, sin esperar el refetch.
    await waitFor(() =>
      expect(
        result.current.convocatorias.myEnrollments.some(
          (enrollment) => enrollment[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] === lanzamiento.id
        )
      ).toBe(true)
    );
    expect(result.current.modal.modalInfo).toMatchObject({
      title: "Inscripción confirmada",
      tone: "success",
    });
  });
});
