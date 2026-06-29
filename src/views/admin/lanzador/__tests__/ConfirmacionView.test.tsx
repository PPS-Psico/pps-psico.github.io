import { describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

/**
 * Test de la transición Confirmación → Activa.
 *
 * Cubre el cableado del botón "Activar PPS" agregado en el rediseño: la vista
 * de Confirmación debe disparar el callback `onActivar` (que en producción
 * mueve el lanzamiento a estado "Activa"). Se mockean las dependencias pesadas
 * (datos/seleccionador) para aislar el comportamiento de la vista.
 */

// CanvasHeader real es pesado; lo stubbeamos exponiendo la acción primaria como
// un botón, que es justo lo que queremos verificar.
jest.mock("../shared", () => ({
  CanvasHeader: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void } }) =>
    primaryAction ? <button onClick={primaryAction.onClick}>{primaryAction.label}</button> : null,
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

// Roster vacío → total = 0 (sólo aparece el botón "Activar PPS" del header).
jest.mock("../useLaunchData", () => ({
  useLaunchRoster: () => ({ data: [] }),
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

const renderView = (onActivar: () => void) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const launch = { id: "lanz_1", nombre_institucion: "Hospital X" } as never;
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmacionView launch={launch} showModal={() => {}} onActivar={onActivar} />
    </QueryClientProvider>
  );
};

describe("ConfirmacionView — transición a Activa", () => {
  it("renderiza el botón 'Activar PPS'", () => {
    renderView(() => {});
    expect(screen.getByText("Activar PPS")).toBeInTheDocument();
  });

  it("dispara onActivar al hacer clic en 'Activar PPS'", () => {
    const onActivar = jest.fn();
    renderView(onActivar);
    fireEvent.click(screen.getByText("Activar PPS"));
    expect(onActivar).toHaveBeenCalledTimes(1);
  });
});
