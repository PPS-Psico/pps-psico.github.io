import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockDb } from "../../../services/mockDb";

const mockRpc = jest.fn();
const mockSendSmartEmail = jest.fn();

jest.mock("../../../utils/emailService", () => ({
  DISAPPROVAL_CC: "Agostina Reale Berrueta <agostina.reale@uflouniversidad.edu.ar>",
  sendSmartEmail: mockSendSmartEmail,
}));

jest.mock("../../../lib/supabaseClient", () => {
  const buildQuery = () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      neq: jest.fn(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: "prac_1",
            lanzamiento_id: "lanz_1",
            nombre_institucion: "Hospital Garrahan",
            fecha_inicio: "2026-03-01",
            fecha_finalizacion: "2026-07-01",
            estado: "En curso",
            horas_realizadas: 40,
          },
        ],
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.neq.mockReturnValue(query);
    return query;
  };

  const buildStudentQuery = () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { correo: "estudiante@example.com" },
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    return query;
  };

  return {
    supabase: {
      from: jest.fn((table: string) =>
        table === "estudiantes" ? buildStudentQuery() : buildQuery()
      ),
      rpc: mockRpc,
    },
  };
});

import PenalizationManager from "../PenalizationManager";

const renderManager = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PenalizationManager isTestingMode />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  mockDb.reset();
  mockRpc.mockReset().mockResolvedValue({ data: null, error: null });
  mockSendSmartEmail.mockReset().mockResolvedValue({ success: true });
});

describe("PenalizationManager — búsqueda unificada", () => {
  it("busca una PPS y muestra su nómina con las acciones disponibles", async () => {
    renderManager();

    fireEvent.click(screen.getByRole("tab", { name: "PPS" }));
    fireEvent.change(screen.getByLabelText("Buscar PPS"), {
      target: { value: "Garrahan" },
    });

    fireEvent.click(await screen.findByRole("button", { name: /Hospital Garrahan/i }));

    expect(await screen.findByText("2 alumnos")).toBeInTheDocument();
    expect(screen.getByText("Usuario de Prueba")).toBeInTheDocument();
    expect(screen.getByText("Sofía Martínez")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Desaprobar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sin práctica" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Desaprobar" }));
    expect(
      await screen.findByRole("heading", { name: "Registrar PPS desaprobada" })
    ).toBeInTheDocument();
    expect(document.getElementById("lv4-styles")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Participación y actitud profesional"));
    expect(screen.getByText("Informe institucional editable")).toBeInTheDocument();
    expect(screen.getByText(/Con copia visible a Agostina Reale Berrueta/)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Informe institucional para el estudiante") as HTMLTextAreaElement)
        .value
    ).toContain("La institución informó dificultades sostenidas");
    expect(screen.getByRole("button", { name: "Desaprobar y enviar informe" })).toBeEnabled();
    expect(screen.getByLabelText("Referencia interna (opcional)")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Desaprobar y enviar informe" }));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith(
        "registrar_desaprobacion_pps",
        expect.objectContaining({ p_informe_ref: "" })
      )
    );
    expect(mockSendSmartEmail).toHaveBeenCalled();
  });
});
