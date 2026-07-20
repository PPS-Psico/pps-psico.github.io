import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import ConfirmModal from "../ConfirmModal";

describe("ConfirmModal", () => {
  it("presenta una confirmación destructiva con el lenguaje visual semántico", () => {
    const onClose = jest.fn();

    render(
      <ConfirmModal
        isOpen
        title="Cancelar inscripción"
        message="Esta acción no se puede deshacer."
        confirmText="Sí, cancelar inscripción"
        onConfirm={jest.fn()}
        onClose={onClose}
        type="danger"
      />
    );

    expect(screen.getByRole("dialog")).toHaveClass("ui-modal-overlay--danger");
    expect(screen.getByText("Esta acción es irreversible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("confirma y cierra desde la acción principal", () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    render(
      <ConfirmModal
        isOpen
        title="Confirmar acción"
        message="Revisá los datos antes de continuar."
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
