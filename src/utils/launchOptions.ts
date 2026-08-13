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
