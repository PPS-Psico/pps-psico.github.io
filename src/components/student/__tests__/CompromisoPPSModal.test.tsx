import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

jest.mock("../home/atlas/atlasHome.css", () => ({}));

import CompromisoPPSModal from "../CompromisoPPSModal";

const student = {
  id: "student-1",
  nombre: "Ana Pérez",
  dni: 30111222,
  legajo: "12345",
} as never;

const lanzamiento = {
  id: "launch-1",
  nombre_pps: "Fundación Tiempo - Clínica Niños",
  fecha_inicio: "2026-08-21",
  lista_estudiantes_entregada_at: null,
} as never;

const enrollment = {
  id: "enrollment-1",
  estudiante_id: "student-1",
  lanzamiento_id: "launch-1",
  selected_at: "2026-08-05T12:00:00.000Z",
} as never;

async function reachSignatureStep() {
  const user = userEvent.setup();
  for (let step = 0; step < 3; step += 1) {
    await user.click(screen.getByRole("button", { name: /continuar/i }));
  }
  for (const checkbox of screen.getAllByRole("checkbox")) {
    await user.click(checkbox);
  }
  return user;
}

describe("CompromisoPPSModal", () => {
  it("mantiene el error dentro de la interfaz nueva y oculta detalles de RLS", async () => {
    const onSubmit = jest.fn(async () => {
      throw new Error('new row violates row-level security policy for table "compromisos_pps"');
    });

    render(
      <CompromisoPPSModal
        isOpen
        onClose={jest.fn()}
        student={student}
        lanzamiento={lanzamiento}
        enrollment={enrollment}
        onSubmit={onSubmit}
      />
    );

    const user = await reachSignatureStep();
    await user.click(screen.getByRole("button", { name: /confirmar participación y firmar/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos validar tu sesión");
    expect(alert).not.toHaveTextContent("row-level security");
    expect(alert).not.toHaveTextContent("compromisos_pps");
    expect(screen.queryByText("Información")).not.toBeInTheDocument();
  });

  it("confirma dentro del mismo asistente y no abre el modal global", async () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn(async () => undefined);

    render(
      <CompromisoPPSModal
        isOpen
        onClose={onClose}
        student={student}
        lanzamiento={lanzamiento}
        enrollment={enrollment}
        onSubmit={onSubmit}
      />
    );

    const user = await reachSignatureStep();
    await user.click(screen.getByRole("button", { name: /confirmar participación y firmar/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Compromiso registrado");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /volver a mi panel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
