import type { LanzamientoOpcion, LanzamientoOpcionHorario } from "../../types";
import {
  getOptionCapacity,
  getOptionScheduleCapacities,
  getOptionScheduleSlots,
  getPreferredOptionScheduleChoices,
} from "../launchOptions";

const option = (overrides: Partial<LanzamientoOpcion> = {}): LanzamientoOpcion =>
  ({
    id: "option-1",
    lanzamiento_id: "launch-1",
    nombre: "Dispositivo",
    orientacion: "Laboral",
    cupos: 5,
    horarios: ["8 a 12", "9 a 13"],
    actividades: [],
    requisitos: [],
    ubicacion: null,
    orden: 1,
    activa: true,
    created_at: "2026-08-13T00:00:00Z",
    updated_at: "2026-08-13T00:00:00Z",
    ...overrides,
  }) as LanzamientoOpcion;

describe("launchOptions", () => {
  it("usa y ordena las franjas con capacidad propia", () => {
    const value = option({
      franjas: [
        {
          id: "slot-2",
          opcion_id: "option-1",
          horario: "Tarde",
          cupos: 2,
          orden: 2,
          activa: true,
          created_at: "2026-08-13T00:00:00Z",
          updated_at: "2026-08-13T00:00:00Z",
        },
        {
          id: "slot-1",
          opcion_id: "option-1",
          horario: "Mañana",
          cupos: 3,
          orden: 1,
          activa: true,
          created_at: "2026-08-13T00:00:00Z",
          updated_at: "2026-08-13T00:00:00Z",
        },
      ],
    });

    expect(getOptionScheduleSlots(value).map((schedule) => schedule.id)).toEqual([
      "slot-1",
      "slot-2",
    ]);
    expect(getOptionCapacity(value)).toBe(5);
  });

  it("mantiene los horarios legacy como un único cupo compartido", () => {
    const value = option();
    const schedules = getOptionScheduleSlots(value);

    expect(schedules).toHaveLength(1);
    expect(schedules[0].horario).toBe("8 a 12 · 9 a 13");
    expect(schedules[0].cupos).toBe(5);
    expect(getOptionCapacity(value)).toBe(5);
  });

  it("calcula los cupos restantes por franja con las asignaciones seleccionadas", () => {
    const value = option({
      franjas: [
        {
          id: "slot-1",
          opcion_id: "option-1",
          horario: "Mañana",
          cupos: 3,
          orden: 1,
          activa: true,
          created_at: "2026-08-13T00:00:00Z",
          updated_at: "2026-08-13T00:00:00Z",
        },
        {
          id: "slot-2",
          opcion_id: "option-1",
          horario: "Tarde",
          cupos: 1,
          orden: 2,
          activa: true,
          created_at: "2026-08-13T00:00:00Z",
          updated_at: "2026-08-13T00:00:00Z",
        },
      ],
    });

    expect(
      getOptionScheduleCapacities([value], ["slot-1", "slot-1", "slot-2", "desconocido", null])
    ).toEqual({
      "slot-1": { total: 3, assigned: 2, remaining: 1 },
      "slot-2": { total: 1, assigned: 1, remaining: 0 },
    });
  });

  it("nunca informa cupos restantes negativos si una franja queda excedida", () => {
    const value = option({ cupos: 1 });
    const legacyId = `${value.id}-legacy`;

    expect(getOptionScheduleCapacities([value], [legacyId, legacyId])[legacyId]).toEqual({
      total: 1,
      assigned: 2,
      remaining: 0,
    });
  });

  it("muestra solo los dispositivos elegidos y conserva su prioridad", () => {
    const firstOption = option({ id: "option-1", nombre: "Dispositivo uno" });
    const secondOption = option({ id: "option-2", nombre: "Dispositivo dos" });
    const notPreferred = option({ id: "option-3", nombre: "No elegido" });
    const schedule = (id: string, opcionId: string): LanzamientoOpcionHorario => ({
      id,
      opcion_id: opcionId,
      horario: "De 8 a 12",
      cupos: 2,
      orden: 1,
      activa: true,
      created_at: "2026-08-13T00:00:00Z",
      updated_at: "2026-08-13T00:00:00Z",
    });

    const choices = getPreferredOptionScheduleChoices(
      [firstOption, secondOption, notPreferred],
      [schedule("slot-2", secondOption.id), schedule("slot-1", firstOption.id)]
    );

    expect(choices.map(({ option: preferredOption }) => preferredOption.nombre)).toEqual([
      "Dispositivo dos",
      "Dispositivo uno",
    ]);
    expect(choices.map(({ priority }) => priority)).toEqual([1, 2]);
    expect(
      choices.some(({ option: preferredOption }) => preferredOption.id === notPreferred.id)
    ).toBe(false);
  });
});
