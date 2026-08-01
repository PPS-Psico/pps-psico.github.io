import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

import RecordEditModal from "../RecordEditModal";

const tableConfig = {
  label: "Prácticas",
  schema: {},
  fieldConfig: [
    {
      key: "estudiante_id",
      label: "ID Estudiante",
      type: "text" as const,
      required: true,
      createOnly: true,
    },
    {
      key: "lanzamiento_id",
      label: "ID Lanzamiento",
      type: "text" as const,
      required: true,
      createOnly: true,
    },
    {
      key: "horas",
      label: "Horas",
      type: "number" as const,
    },
  ],
};

describe("RecordEditModal — campos exclusivos de creación", () => {
  it("no muestra ni valida los IDs internos al editar una práctica", () => {
    const onSave = jest.fn();

    render(
      <RecordEditModal
        isOpen
        onClose={jest.fn()}
        record={{ id: "practica-1", estudiante_id: "estudiante-1", horas: 18 }}
        tableConfig={tableConfig}
        onSave={onSave}
        isSaving={false}
      />
    );

    expect(screen.queryByText("ID Estudiante")).not.toBeInTheDocument();
    expect(screen.queryByText("ID Lanzamiento")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar$/ }));

    expect(onSave).toHaveBeenCalledWith("practica-1", {
      horas: 18,
    });
  });

  it("mantiene los vínculos disponibles y obligatorios al crear", () => {
    const onSave = jest.fn();

    render(
      <RecordEditModal
        isOpen
        onClose={jest.fn()}
        record={null}
        tableConfig={tableConfig}
        onSave={onSave}
        isSaving={false}
      />
    );

    expect(screen.getByText("ID Estudiante")).toBeInTheDocument();
    expect(screen.getByText("ID Lanzamiento")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Crear$/ }));

    expect(screen.getByText("ID Estudiante es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("ID Lanzamiento es obligatorio")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
