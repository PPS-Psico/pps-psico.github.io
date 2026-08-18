import type { LanzamientoOpcion, LanzamientoOpcionHorario } from "../types";

/**
 * Devuelve las franjas con capacidad propia. Las convocatorias anteriores a
 * este modelo se representan como una única franja de cupo compartido para no
 * multiplicar vacantes cuando `horarios` contenía alternativas.
 */
export function getOptionScheduleSlots(option: LanzamientoOpcion): LanzamientoOpcionHorario[] {
  const structured = (option.franjas || [])
    .filter((schedule) => schedule.activa)
    .slice()
    .sort((a, b) => a.orden - b.orden || a.horario.localeCompare(b.horario));

  if (structured.length > 0) return structured;

  return [
    {
      id: `${option.id}-legacy`,
      opcion_id: option.id,
      horario: option.horarios.join(" · ") || "Horario a convenir",
      cupos: option.cupos,
      orden: 1,
      activa: true,
      created_at: option.created_at,
      updated_at: option.updated_at,
    },
  ];
}

export function getOptionCapacity(option: LanzamientoOpcion): number {
  return getOptionScheduleSlots(option).reduce((total, schedule) => total + schedule.cupos, 0);
}

export interface OptionScheduleCapacity {
  total: number;
  assigned: number;
  remaining: number;
}

/**
 * Resume el cupo de cada franja a partir de las asignaciones ya seleccionadas.
 * Los ids nulos o desconocidos se ignoran para no descontar vacantes de otra
 * convocatoria.
 */
export function getOptionScheduleCapacities(
  options: LanzamientoOpcion[],
  assignedScheduleIds: Array<string | null | undefined>
): Record<string, OptionScheduleCapacity> {
  const assignedBySchedule = assignedScheduleIds.reduce<Record<string, number>>(
    (counts, scheduleId) => {
      if (scheduleId) counts[scheduleId] = (counts[scheduleId] || 0) + 1;
      return counts;
    },
    {}
  );

  return Object.fromEntries(
    options.flatMap((option) =>
      getOptionScheduleSlots(option).map((schedule) => {
        const total = Math.max(0, schedule.cupos);
        const assigned = assignedBySchedule[schedule.id] || 0;
        return [
          schedule.id,
          {
            total,
            assigned,
            remaining: Math.max(0, total - assigned),
          },
        ];
      })
    )
  );
}

export interface PreferredOptionScheduleChoice {
  option: LanzamientoOpcion;
  schedule: LanzamientoOpcionHorario;
  priority: number;
}

/** Conserva el orden elegido y excluye franjas ajenas a la inscripción. */
export function getPreferredOptionScheduleChoices(
  options: LanzamientoOpcion[],
  preferredSchedules: LanzamientoOpcionHorario[] = []
): PreferredOptionScheduleChoice[] {
  const optionById = new Map(options.map((option) => [option.id, option]));

  return preferredSchedules.flatMap((schedule, index) => {
    const option = optionById.get(schedule.opcion_id);
    return option ? [{ option, schedule, priority: index + 1 }] : [];
  });
}
