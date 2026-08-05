import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";

/**
 * El panel NO debe tocar `estudiantes.estado` al cargarse.
 *
 * Había un "saneo" que, al ver un alumno en 'Nuevo (Sin cuenta)' con datos de
 * contacto, le escribía 'Inactivo'. Ese estado corta la inscripción con
 * "Comunicate con coordinación de PPS", un cartel sin salida — y la escritura
 * salía de un camino de lectura, sobre la fila que estuviera cargada. Un admin
 * abriendo /admin/student/:legajo desactivaba a ese alumno de paso.
 *
 * Caso real: Paula Gerez (legajo 26786), 4 ago 2026.
 */

const updateSpy = jest.fn(async () => ({}));

const studentRow = {
  id: "est-1",
  nombre: "Paula Gerez",
  legajo: "26786",
  estado: "Nuevo (Sin cuenta)",
  correo: "paula@example.com",
  dni: 35596147,
  telefono: "",
};

jest.mock("../../services", () => ({
  fetchStudentData: jest.fn(async () => ({
    studentDetails: { ...studentRow },
    studentId: "est-1",
  })),
}));

jest.mock("../../lib/db", () => ({
  db: { estudiantes: { update: (...args: unknown[]) => updateSpy(...(args as [])) } },
}));

jest.mock("../../contexts/ModalContext", () => ({
  useModal: () => ({ showModal: jest.fn() }),
}));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) } },
}));

const { useStudentData } = require("../useStudentData");

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useStudentData — no toca el estado del alumno", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    sessionStorage.clear();
  });

  it("no escribe 'Inactivo' al cargar un alumno en 'Nuevo (Sin cuenta)'", async () => {
    const { result } = renderHook(() => useStudentData("26786"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.studentId).toBe("est-1"));
    // Margen para que cualquier efecto pendiente llegue a dispararse.
    await new Promise((r) => setTimeout(r, 50));

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("devuelve el estado tal cual vino de la base, sin reescribirlo", async () => {
    const { result } = renderHook(() => useStudentData("26786"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.studentDetails).toBeTruthy());
    expect(result.current.studentDetails.estado).toBe("Nuevo (Sin cuenta)");
  });
});
