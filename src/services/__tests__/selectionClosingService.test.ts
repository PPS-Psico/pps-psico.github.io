import { describe, expect, it, jest } from "@jest/globals";
import type { LanzamientoPPS } from "../../types";
import {
  closeSelectionAndQueueNotifications,
  type NotifySelectionResult,
  type SelectionClosingDependencies,
} from "../selectionClosingService";

const launch = {
  id: "launch-test-1",
  nombre_pps: "PPS de prueba",
} as LanzamientoPPS;

const okResult: NotifySelectionResult = {
  success: true,
  requested: 1,
  sent: 1,
  failed: 0,
};

function buildDependencies(
  overrides: Partial<SelectionClosingDependencies> = {}
): SelectionClosingDependencies {
  return {
    closeSelection: jest.fn(async () => ({
      data: { selected: 1, not_selected: 2 },
      error: null,
    })),
    notifySelected: jest.fn(async () => okResult),
    ...overrides,
  };
}

describe("closeSelectionAndQueueNotifications", () => {
  it("cierra primero y luego pide el aviso a los seleccionados", async () => {
    const dependencies = buildDependencies();

    const result = await closeSelectionAndQueueNotifications(launch, dependencies);
    await result.notificationTask;

    expect(dependencies.closeSelection).toHaveBeenCalledWith(launch.id);
    expect(dependencies.notifySelected).toHaveBeenCalledWith(launch.id);
    expect(result.closeResult).toEqual({ selected: 1, not_selected: 2 });
  });

  it("omite el aviso cuando el cierre no requiere consentimiento", async () => {
    const dependencies = buildDependencies({
      closeSelection: jest.fn(async () => ({
        data: { selected: 1, not_selected: 0, consentimiento_requerido: false },
        error: null,
      })),
    });

    const result = await closeSelectionAndQueueNotifications(launch, dependencies);
    await result.notificationTask;

    expect(dependencies.notifySelected).not.toHaveBeenCalled();
  });

  it("no avisa a nadie si falla el cierre atómico", async () => {
    const dependencies = buildDependencies({
      closeSelection: jest.fn(async () => ({
        data: null,
        error: { message: "RLS denied" },
      })),
    });

    await expect(closeSelectionAndQueueNotifications(launch, dependencies)).rejects.toThrow(
      "RLS denied"
    );
    expect(dependencies.notifySelected).not.toHaveBeenCalled();
  });

  it("mantiene el cierre exitoso aunque el aviso falle", async () => {
    // El cierre de la mesa y el aviso son dos actos separados: que el segundo
    // falle no debe deshacer el primero. Los estudiantes quedan en la cola de
    // pendientes y la sala de firmas ofrece reintentar.
    const dependencies = buildDependencies({
      notifySelected: jest.fn(async () => {
        throw new Error("notification provider unavailable");
      }),
    });

    const result = await closeSelectionAndQueueNotifications(launch, dependencies);

    expect(result.closeResult).toEqual({ selected: 1, not_selected: 2 });
    await expect(result.notificationTask).rejects.toThrow("notification provider unavailable");
  });

  it("propaga el resumen del envío para que la UI informe cuántos quedaron sin aviso", async () => {
    const parcial: NotifySelectionResult = {
      success: false,
      requested: 5,
      sent: 3,
      failed: 2,
      failures: [
        { convocatoriaId: "c1", name: "Ana", reason: "No tiene un correo válido." },
        { convocatoriaId: "c2", name: "Beto", reason: "SMTP timeout" },
      ],
    };
    const dependencies = buildDependencies({ notifySelected: jest.fn(async () => parcial) });

    const result = await closeSelectionAndQueueNotifications(launch, dependencies);

    await expect(result.notificationTask).resolves.toEqual(parcial);
  });
});
