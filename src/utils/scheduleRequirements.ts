import {
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS,
} from "../constants";

type ScheduleSource = Record<string, unknown> | null | undefined;

const uniqueTrimmed = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const parseLaunchSchedules = (raw: unknown): string[] =>
  typeof raw === "string" ? uniqueTrimmed(raw.split(/[;\n]/)) : [];

/**
 * Resuelve las franjas obligatorias de una convocatoria.
 *
 * Un array explícito (incluso vacío) usa el modelo nuevo. Si la columna es
 * NULL, se conserva la semántica histórica: `horarios_fijos=true` significa
 * que todas las franjas publicadas son obligatorias.
 */
export const getMandatoryLaunchSchedules = (
  launch: ScheduleSource,
  availableSchedules?: string[]
): string[] => {
  if (!launch) return [];

  const available = uniqueTrimmed(
    availableSchedules ?? parseLaunchSchedules(launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS])
  );
  const explicit = launch[FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS];
  const configured = Array.isArray(explicit)
    ? uniqueTrimmed(explicit.filter((value): value is string => typeof value === "string"))
    : launch[FIELD_HORARIOS_FIJOS_LANZAMIENTOS]
      ? available
      : [];

  const availableSet = new Set(available);
  return configured.filter((schedule) => availableSet.has(schedule));
};

export const mergeMandatorySchedules = (
  selectedSchedules: string[],
  mandatorySchedules: string[],
  availableSchedules: string[]
): string[] => {
  const available = uniqueTrimmed(availableSchedules);
  const requested = new Set(uniqueTrimmed([...mandatorySchedules, ...selectedSchedules]));
  return available.filter((schedule) => requested.has(schedule));
};
