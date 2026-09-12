/**
 * El valor de horas que ofrece el formulario de alta de PPS.
 *
 * Tres cosas que se rompieron de maneras distintas y ninguna la agarraba un test:
 *  - de dónde sale el número que se sugiere (una institución puede tener
 *    convocatorias con horas muy distintas: Barriletes va de 60 a 173);
 *  - que la sugerencia no se pierda si los lanzamientos tardan en llegar;
 *  - que, una vez que el estudiante escribió una cantidad, nada se la pise.
 */
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const mockRunQuery = jest.fn<(builder: unknown, meta: { operation: string }) => Promise<unknown>>();

jest.mock("../../../lib/dbQuery", () => ({
  runQuery: (builder: unknown, meta: { operation: string }) => mockRunQuery(builder, meta),
}));

const encadenable: Record<string, unknown> = {};
["from", "select", "order", "eq"].forEach((m) => {
  encadenable[m] = () => encadenable;
});
jest.mock("../../../lib/supabaseClient", () => ({ supabase: encadenable }));

jest.mock("../../../contexts/NotificationContext", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));
jest.mock("../../../contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
jest.mock("../../../services", () => ({
  submitSolicitudNuevaPPS: jest.fn(),
  uploadSolicitudFile: jest.fn(),
}));

import SolicitudNuevaPPSModal from "../SolicitudNuevaPPSModal";

const INSTITUCION = { id: "inst-1", nombre: "Asociación Civil Pensar - Barriletes" };

/** Dos convocatorias de la misma institución con horas muy distintas. */
const LANZAMIENTO_VIEJO = {
  id: "lanz-viejo",
  institucion_uuid: "inst-1",
  horas_acreditadas: 60,
  orientacion: "Comunitaria",
  created_at: "2024-03-01T00:00:00Z",
};
const LANZAMIENTO_RECIENTE = {
  id: "lanz-reciente",
  institucion_uuid: "inst-1",
  horas_acreditadas: 173,
  orientacion: "Comunitaria",
  created_at: "2026-03-01T00:00:00Z",
};

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SolicitudNuevaPPSModal isOpen onClose={jest.fn()} studentId="est-1" />
    </QueryClientProvider>
  );
}

const campoHoras = () => screen.getByPlaceholderText("Ej: 80") as HTMLInputElement;

async function elegirInstitucion(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/buscar institución/i), "Barriletes");
  await user.click(await screen.findByText(INSTITUCION.nombre));
}

beforeEach(() => {
  mockRunQuery.mockReset();
});

describe("horas sugeridas en el alta de PPS", () => {
  it("sugiere las horas de la última convocatoria y las presenta como referencia", async () => {
    mockRunQuery.mockImplementation((_b, meta) =>
      Promise.resolve(
        meta.operation === "institucionesParaSolicitud"
          ? [INSTITUCION]
          : [LANZAMIENTO_RECIENTE, LANZAMIENTO_VIEJO]
      )
    );

    const user = userEvent.setup();
    renderModal();
    await elegirInstitucion(user);

    await waitFor(() => expect(campoHoras().value).toBe("173"));
    // El número es de la última convocatoria, no necesariamente de la que hizo:
    // el texto no puede afirmar que "esta PPS acredita" esa cantidad.
    expect(screen.getByText(/última convocatoria de esta institución acreditó 173/i)).toBeTruthy();
  });

  it("no pierde la sugerencia si los lanzamientos llegan después de elegir la institución", async () => {
    let entregarLanzamientos: (v: unknown) => void = () => {};
    const lanzamientosLentos = new Promise((resolve) => {
      entregarLanzamientos = resolve;
    });
    mockRunQuery.mockImplementation((_b, meta) =>
      meta.operation === "institucionesParaSolicitud"
        ? Promise.resolve([INSTITUCION])
        : (lanzamientosLentos as Promise<unknown>)
    );

    const user = userEvent.setup();
    renderModal();
    await elegirInstitucion(user);

    // Con la consulta todavía en vuelo el campo sigue vacío.
    expect(campoHoras().value).toBe("");

    entregarLanzamientos([LANZAMIENTO_RECIENTE, LANZAMIENTO_VIEJO]);

    await waitFor(() => expect(campoHoras().value).toBe("173"));
  });

  it("conserva la cantidad que escribió el estudiante", async () => {
    let entregarLanzamientos: (v: unknown) => void = () => {};
    const lanzamientosLentos = new Promise((resolve) => {
      entregarLanzamientos = resolve;
    });
    mockRunQuery.mockImplementation((_b, meta) =>
      meta.operation === "institucionesParaSolicitud"
        ? Promise.resolve([INSTITUCION])
        : (lanzamientosLentos as Promise<unknown>)
    );

    const user = userEvent.setup();
    renderModal();
    await elegirInstitucion(user);

    await user.type(campoHoras(), "95");
    expect(campoHoras().value).toBe("95");

    entregarLanzamientos([LANZAMIENTO_RECIENTE, LANZAMIENTO_VIEJO]);

    // El autocompletado llega tarde y no debe pisar lo que ya escribió.
    await waitFor(() =>
      expect(screen.getByText(/última convocatoria de esta institución acreditó 173/i)).toBeTruthy()
    );
    expect(campoHoras().value).toBe("95");
  });
});
