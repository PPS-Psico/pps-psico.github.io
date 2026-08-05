import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { FIELD_ESTADO_PRACTICA } from "../../constants";
import type { Practica } from "../../types";

/**
 * El panel del estudiante NO puede cerrar prácticas en la base.
 *
 * `trg_check_practica_updates` revierte `estado` en silencio para toda sesión
 * donde `is_admin()` sea false, y ese hook corre en la sesión del alumno: el
 * UPDATE devolvía 200 y no guardaba nada. El cierre real lo hace el cron
 * `close_finished_practicas` (migración 20260804120000).
 *
 * Este test fija las dos mitades del contrato: el hook deriva el estado para
 * mostrarlo, y no intenta escribirlo.
 */

const practicaVencida = {
  id: "prac-vencida",
  estudiante_id: "est-1",
  estado: "En curso",
  fecha_finalizacion: "2020-01-01",
  horas_realizadas: 30,
} as Practica;

const practicaVigente = {
  id: "prac-vigente",
  estudiante_id: "est-1",
  estado: "En curso",
  fecha_finalizacion: "2999-01-01",
  horas_realizadas: 10,
} as Practica;

const updateSpy = jest.fn();

jest.mock("../../services", () => ({
  fetchPracticas: jest.fn(async () => [{ ...practicaVencida }, { ...practicaVigente }]),
  deletePractica: jest.fn(),
}));

jest.mock("../../lib/db", () => ({
  db: { practicas: { update: (...args: unknown[]) => updateSpy(...args) } },
}));

jest.mock("../../contexts/ModalContext", () => ({
  useModal: () => ({ showModal: jest.fn() }),
}));

jest.mock("../../lib/supabaseClient", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) } },
}));

const { useStudentPracticas } = require("../useStudentPracticas");

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useStudentPracticas — cierre por calendario", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    sessionStorage.clear();
  });

  it("muestra como Finalizada la práctica cuya fecha de fin ya pasó", async () => {
    const { result } = renderHook(() => useStudentPracticas("12345", "est-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.practicas.length).toBe(2));

    const vencida = result.current.practicas.find((p: Practica) => p.id === "prac-vencida");
    expect(vencida?.[FIELD_ESTADO_PRACTICA]).toBe("Finalizada");
  });

  it("deja intacta la práctica que sigue en curso", async () => {
    const { result } = renderHook(() => useStudentPracticas("12345", "est-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.practicas.length).toBe(2));

    const vigente = result.current.practicas.find((p: Practica) => p.id === "prac-vigente");
    expect(vigente?.[FIELD_ESTADO_PRACTICA]).toBe("En curso");
  });

  it("no intenta escribir el cierre en la base: el trigger lo descartaría", async () => {
    const { result } = renderHook(() => useStudentPracticas("12345", "est-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.practicas.length).toBe(2));

    expect(updateSpy).not.toHaveBeenCalled();
  });
});
