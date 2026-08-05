import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

/**
 * El modal pide exactamente los datos que la inscripción exige y todavía
 * faltan. Antes pedía sólo el DNI, así que quien tenía DNI pero no teléfono
 * pasaba de largo y se enteraba al chocar contra la inscripción — el caso de
 * Paula Gerez (legajo 26786), 4 ago 2026.
 */

let perfil: Record<string, unknown> = {};
const updateSpy = jest.fn((_payload: Record<string, unknown>) => ({
  eq: async () => ({ error: null }),
}));

jest.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: perfil, error: null }) }),
      }),
      update: (payload: Record<string, unknown>) => updateSpy(payload),
    }),
  },
}));

const DataCompletionModal = require("../DataCompletionModal").default;

const renderModal = (onComplete = jest.fn()) =>
  render(<DataCompletionModal studentId="est-1" legajo="26786" onComplete={onComplete} />);

describe("DataCompletionModal", () => {
  beforeEach(() => {
    updateSpy.mockClear();
  });

  it("pide sólo el celular cuando es el único dato que falta", async () => {
    perfil = { dni: 35596147, telefono: "", correo: "paula@example.com", estado: "Activo" };
    renderModal();

    expect(await screen.findByLabelText(/celular/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/DNI/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/correo/i)).not.toBeInTheDocument();
  });

  it("pide DNI y celular juntos cuando faltan los dos", async () => {
    perfil = { dni: null, telefono: "", correo: "alguien@example.com", estado: "Inactivo" };
    renderModal();

    expect(await screen.findByLabelText(/DNI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/celular/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/correo/i)).not.toBeInTheDocument();
  });

  it("guarda el dato faltante y deja al alumno Activo", async () => {
    perfil = { dni: 35596147, telefono: "", correo: "paula@example.com", estado: "Inactivo" };
    const onComplete = jest.fn();
    renderModal(onComplete);

    const input = await screen.findByLabelText(/celular/i);
    await userEvent.type(input, "2994567890");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ telefono: "2994567890", estado: "Activo" })
    );
  });

  it("no reactiva a un alumno que ya egresó", async () => {
    perfil = { dni: 35596147, telefono: "", correo: "paula@example.com", estado: "Finalizado" };
    renderModal();

    await userEvent.type(await screen.findByLabelText(/celular/i), "2994567890");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty("estado");
  });

  it("rechaza un celular demasiado corto, como un legajo pegado por error", async () => {
    perfil = { dni: 35596147, telefono: "", correo: "paula@example.com", estado: "Activo" };
    renderModal();

    await userEvent.type(await screen.findByLabelText(/celular/i), "35575");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/celular válido/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
