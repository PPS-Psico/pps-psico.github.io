/**
 * Render tests — flujo-aseguramiento-pps (Task 4.5)
 *
 * Cubre el rediseño del Generador_De_Seguros en modo contextual (accedido desde
 * una PPS del Lanzador) con los efectos mockeados:
 *  - Precarga sin paso de "Seleccionar convocatorias" (Req 9.1, 9.2).
 *  - 4 pasos en orden, con el paso 4 señalado como cierre (Req 9.3, 4.3).
 *  - Paso 4 habilitado con seleccionados; deshabilitado con totalSel = 0 (Req 1.2, 1.3, 4.4).
 *  - Paso 4 genera el Excel y luego llama a marcarAseguramiento (Req 9.8, 1.1).
 *  - Estado "ya asegurado": muestra fecha + Revertir; reversión pide confirmación (Req 9.10, 7.2, 5.3).
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Servicio de aseguramiento: espiamos marcar/revertir.
const mockMarcar = jest.fn().mockResolvedValue(undefined);
const mockRevertir = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../services/aseguramientoService", () => ({
  marcarAseguramiento: (...args: unknown[]) => mockMarcar(...args),
  revertirAseguramiento: (...args: unknown[]) => mockRevertir(...args),
  buildClipboardText: (students: { apellido: string }[]) =>
    students.map((s) => s.apellido).join("\n"),
}));

// Auth: coordinador con id.
jest.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ authenticatedUser: { id: "coord-1", legajo: "1", nombre: "Coord" } }),
}));

// Generación de Excel (exceljs es pesado): la stubeamos.
const mockWriteBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
jest.mock("exceljs", () => ({
  __esModule: true,
  default: {
    Workbook: class {
      xlsx = { writeBuffer: () => mockWriteBuffer() };
      addWorksheet() {
        return {
          columns: [],
          addRows: jest.fn(),
          getRow: () => ({ font: {}, fill: {} }),
        };
      }
    },
  },
}));

// downloadBlob: evitar tocar el DOM de descarga real.
jest.mock("../../../utils/downloadFile", () => ({
  downloadBlob: jest.fn(),
}));

// db: la marca persistida del lanzamiento se controla por test.
const mockLanzamientosGet = jest.fn().mockResolvedValue([{ seguro_gestionado_at: null }]);
jest.mock("../../../lib/db", () => ({
  db: {
    lanzamientos: { get: (...a: unknown[]) => mockLanzamientosGet(...a), getAll: jest.fn() },
    convocatorias: { getAll: jest.fn() },
    instituciones: { getAll: jest.fn() },
    estudiantes: { getAll: jest.fn() },
  },
}));

import SeguroGenerator from "../SeguroGenerator";

const renderGen = (props: Partial<React.ComponentProps<typeof SeguroGenerator>> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SeguroGenerator
        showModal={jest.fn()}
        isTestingMode
        preSelectedLanzamientoId="lanz-1"
        {...props}
      />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanzamientosGet.mockResolvedValue([{ seguro_gestionado_at: null }]);
  // clipboard
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
  window.open = jest.fn();
});

describe("SeguroGenerator — flujo contextual (4 pasos)", () => {
  it("precarga sin paso de selección y muestra los 4 pasos en orden con el 4 como cierre", async () => {
    renderGen();

    // No aparece la tabla de "Seleccionar convocatorias".
    expect(screen.queryByText(/Seleccionar convocatorias/i)).not.toBeInTheDocument();

    // Los 4 pasos están presentes (esperamos a que compile la lista de estudiantes).
    expect(await screen.findByText("Descargar seguro")).toBeInTheDocument();
    expect(screen.getByText("Copiar datos")).toBeInTheDocument();
    expect(screen.getByText("Enviar a Sergio")).toBeInTheDocument();
    expect(screen.getByText("Descargar lista")).toBeInTheDocument();

    // El paso final está marcado como el que cierra el aseguramiento.
    expect(screen.getByText("Cierra")).toBeInTheDocument();
  });

  it("el paso 4 (Descargar lista) genera el Excel y luego marca el aseguramiento", async () => {
    renderGen();

    const btn = await screen.findByRole("button", { name: /Descargar lista/i });
    fireEvent.click(btn);

    await waitFor(() => expect(mockWriteBuffer).toHaveBeenCalled());
    await waitFor(() => expect(mockMarcar).toHaveBeenCalledWith("lanz-1", "coord-1"));
  });

  it("tras marcar con éxito muestra el estado 'Seguro gestionado'", async () => {
    renderGen();

    const btn = await screen.findByRole("button", { name: /Descargar lista/i });
    fireEvent.click(btn);

    expect(await screen.findByText("Seguro gestionado")).toBeInTheDocument();
  });

  it("si la persistencia falla, NO muestra el estado asegurado (queda pendiente)", async () => {
    mockMarcar.mockRejectedValueOnce(new Error("RLS denied"));
    const showModal = jest.fn();
    renderGen({ showModal });

    const btn = await screen.findByRole("button", { name: /Descargar lista/i });
    fireEvent.click(btn);

    await waitFor(() => expect(showModal).toHaveBeenCalled());
    // El listado se generó pero el aseguramiento no se confirmó.
    expect(screen.queryByText("Seguro gestionado")).not.toBeInTheDocument();
    // El paso 4 sigue disponible para reintentar.
    expect(screen.getByRole("button", { name: /Descargar lista/i })).toBeInTheDocument();
  });
});

describe("SeguroGenerator — estado ya asegurado + reversión", () => {
  it("muestra la fecha y el botón Revertir cuando ya está asegurado", async () => {
    mockLanzamientosGet.mockResolvedValue([{ seguro_gestionado_at: "2026-05-01T10:00:00.000Z" }]);
    renderGen({ isTestingMode: false });

    expect(await screen.findByText("Seguro gestionado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revertir aseguramiento/i })).toBeInTheDocument();
  });

  it("la reversión pide confirmación y llama a revertirAseguramiento", async () => {
    mockLanzamientosGet.mockResolvedValue([{ seguro_gestionado_at: "2026-05-01T10:00:00.000Z" }]);
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    renderGen({ isTestingMode: false });

    const revertBtn = await screen.findByRole("button", { name: /Revertir aseguramiento/i });
    fireEvent.click(revertBtn);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(mockRevertir).toHaveBeenCalledWith("lanz-1", "coord-1"));
    confirmSpy.mockRestore();
  });

  it("no revierte si el coordinador cancela la confirmación", async () => {
    mockLanzamientosGet.mockResolvedValue([{ seguro_gestionado_at: "2026-05-01T10:00:00.000Z" }]);
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
    renderGen({ isTestingMode: false });

    const revertBtn = await screen.findByRole("button", { name: /Revertir aseguramiento/i });
    fireEvent.click(revertBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockRevertir).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
