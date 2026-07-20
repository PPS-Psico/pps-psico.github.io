import { describe, expect, it, jest } from "@jest/globals";
import type { LanzamientoPPS } from "../../types";
import {
  closeSelectionAndQueueNotifications,
  type SelectionClosingDependencies,
} from "../selectionClosingService";
import type { SelectionCandidate } from "../selectionNotificationService";

const launch = {
  id: "launch-test-1",
  nombre_pps: "PPS de prueba",
} as LanzamientoPPS;

const candidates: SelectionCandidate[] = [
  {
    nombre: "Estudiante de prueba",
    correo: "test@example.invalid",
    horarioSeleccionado: "Lunes 10:00",
    studentId: "student-test-1",
  },
];

function buildDependencies(
  overrides: Partial<SelectionClosingDependencies> = {}
): SelectionClosingDependencies {
  return {
    closeSelection: jest.fn(async () => ({
      data: { selected: 1, not_selected: 2 },
      error: null,
    })),
    fetchCandidates: jest.fn(async () => candidates),
    notifyCandidates: jest.fn(async () => ({ sent: 1, errors: 0 })),
    ...overrides,
  };
}

describe("closeSelectionAndQueueNotifications", () => {
  it("cierra primero y luego notifica a los seleccionados", async () => {
    const dependencies = buildDependencies();

    const result = await closeSelectionAndQueueNotifications(launch, dependencies);
    await result.notificationTask;

    expect(dependencies.closeSelection).toHaveBeenCalledWith(launch.id);
    expect(dependencies.fetchCandidates).toHaveBeenCalledWith(launch.id);
    expect(dependencies.notifyCandidates).toHaveBeenCalledWith(launch, candidates);
    expect(result.closeResult).toEqual({ selected: 1, not_selected: 2 });
  });

  it("no invoca notificaciones cuando no hay seleccionados", async () => {
    const dependencies = buildDependencies({
      fetchCandidates: jest.fn(async () => []),
    });

    const result = await closeSelectionAndQueueNotifications(launch, dependencies);
    await result.notificationTask;

    expect(dependencies.notifyCandidates).not.toHaveBeenCalled();
  });

  it("no consulta candidatos si falla el cierre atómico", async () => {
    const dependencies = buildDependencies({
      closeSelection: jest.fn(async () => ({
        data: null,
        error: { message: "RLS denied" },
      })),
    });

    await expect(closeSelectionAndQueueNotifications(launch, dependencies)).rejects.toThrow(
      "RLS denied"
    );
    expect(dependencies.fetchCandidates).not.toHaveBeenCalled();
    expect(dependencies.notifyCandidates).not.toHaveBeenCalled();
  });

  it("mantiene el cierre exitoso aunque la tarea de notificación falle", async () => {
    const dependencies = buildDependencies({
      notifyCandidates: jest.fn(async () => {
        throw new Error("notification provider unavailable");
      }),
    });

    const result = await closeSelectionAndQueueNotifications(launch, dependencies);

    expect(result.closeResult).toEqual({ selected: 1, not_selected: 2 });
    await expect(result.notificationTask).rejects.toThrow("notification provider unavailable");
  });
});
