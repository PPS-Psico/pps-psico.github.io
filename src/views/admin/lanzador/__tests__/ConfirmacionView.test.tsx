import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

/**
 * Test de la sala de firmas (paso 3).
 *
 * Cubre las decisiones independientes de la sala: pasar al seguro cuando
 * Coordinación decide, cerrar la nómina entregada a la institución, y perdonar
 * la firma de un estudiante.
 */

jest.mock("../shared", () => ({
  CanvasHeader: () => null,
  Loader: () => null,
  Stat: () => null,
  StatGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  // El título del Banner es contenido, no decoración: varios avisos de esta
  // vista dicen lo importante ahí (cuántos quedaron sin notificar, por ejemplo).
  Banner: ({
    title,
    children,
    action,
  }: {
    title?: React.ReactNode;
    children?: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div>
      {title}
      {children}
      {action}
    </div>
  ),
  useLaunchEditor: () => ({ openEdit: () => {}, modal: null }),
  SeleccionadorConvocatorias: () => null,
}));

// El roster es mutable para poder mover una sola cosa por test (p. ej. dejar a
// alguien sin avisar) sin duplicar el mock entero.
const mockRosterRow = {
  id: "conv_1",
  estudiante_id: "student_1",
  estado_inscripcion: "Seleccionado",
  horario_asignado: "Viernes 13:30",
  horario_seleccionado: null,
  selected_at: "2099-08-05T12:00:00.000Z",
  baja_automatica_at: null,
  consentimiento_exceptuado_at: null,
  seleccion_notificada_at: "2099-08-05T12:05:00.000Z" as string | null,
  reminder_sent_at: null,
  final_reminder_sent_at: null,
  created_at: null,
};
let mockRoster = [{ ...mockRosterRow }];

jest.mock("../useLaunchData", () => ({
  useLaunchRoster: () => ({
    data: mockRoster,
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

const mockEximir = jest.fn(async () => {});
jest.mock("../../../../services", () => ({
  eximirConsentimiento: (...args: unknown[]) => mockEximir(...(args as [])),
  revertirExencionConsentimiento: jest.fn(async () => {}),
}));

jest.mock("../../../../contexts/ModalContext", () => ({
  useModal: () => ({ showModal: jest.fn() }),
}));

import ConfirmacionView from "../ConfirmacionView";

const renderView = (
  onGenerarSeguro: (pendientes: number) => void,
  onListaEntregada = jest.fn(),
  onFinalReminder = jest.fn(),
  consentimientoRequerido = true,
  onReintentarAvisos = jest.fn()
) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const launch = {
    id: "lanz_1",
    nombre_pps: "Hospital X",
    fecha_inicio: "2099-08-21",
    lista_estudiantes_entregada_at: null,
    consentimiento_requerido: consentimientoRequerido,
  } as never;
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmacionView
        launch={launch}
        onGenerarSeguro={onGenerarSeguro}
        onListaEntregada={onListaEntregada}
        onFinalReminder={onFinalReminder}
        onReintentarAvisos={onReintentarAvisos}
      />
    </QueryClientProvider>
  );
};

describe("ConfirmacionView — sala de firmas", () => {
  beforeEach(() => {
    mockRoster = [{ ...mockRosterRow }];
  });

  it("ofrece pasar al seguro, no activar la PPS", async () => {
    renderView(() => {});
    expect(await screen.findByText("Generar seguro y listado")).toBeInTheDocument();
    expect(screen.queryByText("Activar PPS")).not.toBeInTheDocument();
  });

  it("pasa al seguro informando cuántos siguen sin firmar", async () => {
    const onGenerarSeguro = jest.fn();
    renderView(onGenerarSeguro);
    fireEvent.click(await screen.findByText("Generar seguro y listado"));
    expect(onGenerarSeguro).toHaveBeenCalledWith(1);
  });

  it("perdona la firma de un estudiante pendiente", async () => {
    mockEximir.mockClear();
    renderView(() => {});

    fireEvent.click(await screen.findByRole("button", { name: /perdonar la firma/i }));

    await waitFor(() => expect(mockEximir).toHaveBeenCalledWith("conv_1"));
  });

  it("no muestra el aviso de pendientes cuando ya se notificó a todos", async () => {
    renderView(() => {});
    await screen.findByText("Generar seguro y listado");
    expect(screen.queryByText(/sin aviso de selección/i)).not.toBeInTheDocument();
  });

  it("avisa que quedó gente sin notificar y permite reintentar", async () => {
    // El caso que motivó toda la fase: el envío se cortó a mitad y hay que poder
    // retomarlo sabiendo a quién le falta.
    mockRoster = [{ ...mockRosterRow, seleccion_notificada_at: null }];
    const onReintentarAvisos = jest.fn();
    renderView(() => {}, jest.fn(), jest.fn(), true, onReintentarAvisos);

    expect(await screen.findByText(/1 estudiante sin aviso de selección/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Enviar los avisos que faltan"));
    expect(onReintentarAvisos).toHaveBeenCalledTimes(1);
  });

  it("advierte cuántos pendientes cerrará al registrar la entrega", async () => {
    const onListaEntregada = jest.fn();
    renderView(() => {}, onListaEntregada);

    fireEvent.click(await screen.findByText("Cerrar lista (1 sin firma)"));

    expect(onListaEntregada).toHaveBeenCalledWith(1);
  });

  it("identifica el envío como último recordatorio y pasa la cantidad pendiente", async () => {
    const onFinalReminder = jest.fn();
    renderView(() => {}, jest.fn(), onFinalReminder);

    fireEvent.click(await screen.findByRole("button", { name: /último recordatorio por email/i }));

    expect(onFinalReminder).toHaveBeenCalledWith(1);
  });

  it("muestra la omisión y oculta acciones de firma cuando cerró el día de inicio", async () => {
    renderView(() => {}, jest.fn(), jest.fn(), false);

    expect(await screen.findByText(/La mesa cerró el mismo día/i)).toBeInTheDocument();
    expect(screen.queryByText(/Último recordatorio por email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cerrar lista/i)).not.toBeInTheDocument();
  });
});
