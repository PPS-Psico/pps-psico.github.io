import type { LanzamientoOpcion } from "../../types";
import { getOptionCapacity, getOptionScheduleSlots } from "../launchOptions";

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
});
