import { describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

/**
 * Test de la transición Confirmación → Activa.
 *
 * Cubre las dos decisiones independientes de la sala: activar la PPS y cerrar
 * la nómina cuando la lista fue entregada a la institución.
 */

jest.mock("../shared", () => ({
  CanvasHeader: () => null,
  Loader: () => null,
  Stat: () => null,
  StatGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Banner: ({ children, action }: { children?: React.ReactNode; action?: React.ReactNode }) => (
    <div>
      {children}
      {action}
    </div>
  ),
  useLaunchEditor: () => ({ openEdit: () => {}, modal: null }),
  SeleccionadorConvocatorias: () => null,
}));

jest.mock("../useLaunchData", () => ({
  useLaunchRoster: () => ({
    data: [
      {
        id: "conv_1",
        estudiante_id: "student_1",
        estado_inscripcion: "Seleccionado",
        horario_asignado: "Viernes 13:30",
        horario_seleccionado: null,
        selected_at: "2026-08-05T12:00:00.000Z",
        baja_automatica_at: null,
        reminder_sent_at: null,
        created_at: null,
      },
    ],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

// Cliente supabase encadenable y "thenable" que resuelve a { data: [] }.
jest.mock("../../../../lib/supabaseClient", () => {
  const chain: Record<string, unknown> = {};
  ["select", "eq", "in", "or", "order"].forEach((m) => {
    chain[m] = () => chain;
  });
  (chain as { then: (r: (v: { data: unknown[] }) => void) => void }).then = (resolve) =>
    resolve({ data: [] });
  return { supabase: { from: () => chain } };
});

import ConfirmacionView from "../ConfirmacionView";

const renderView = (onActivar: () => void, onListaEntregada = jest.fn()) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const launch = {
    id: "lanz_1",
    nombre_pps: "Hospital X",
    fecha_inicio: "2026-08-21",
    lista_estudiantes_entregada_at: null,
  } as never;
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmacionView launch={launch} onActivar={onActivar} onListaEntregada={onListaEntregada} />
    </QueryClientProvider>
  );
};

describe("ConfirmacionView — transición a Activa", () => {
  it("renderiza el botón 'Activar PPS'", async () => {
    renderView(() => {});
    expect(await screen.findByText("Activar PPS")).toBeInTheDocument();
  });

  it("dispara onActivar al hacer clic en 'Activar PPS'", async () => {
    const onActivar = jest.fn();
    renderView(onActivar);
    fireEvent.click(await screen.findByText("Activar PPS"));
    expect(onActivar).toHaveBeenCalledTimes(1);
  });

  it("advierte cuántos pendientes cerrará al registrar la entrega", async () => {
    const onListaEntregada = jest.fn();
    renderView(() => {}, onListaEntregada);

    fireEvent.click(await screen.findByText("Cerrar lista (1 sin firma)"));

    expect(onListaEntregada).toHaveBeenCalledWith(1);
  });
});
