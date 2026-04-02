export function normalizeSchedule(s: string): string {
  return s
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("; ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function cleanSchedule(s: string): string {
  return s
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("; ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSchedules(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getHorarioEfectivo(enrollment: {
  horario_asignado?: string | null;
  horario_seleccionado?: string | null;
}): string {
  return cleanSchedule(enrollment.horario_asignado || enrollment.horario_seleccionado || "");
}

export function findMatchingGroupKey(horario: string, existingKeys: string[]): string | null {
  const normalized = normalizeSchedule(horario);
  for (const key of existingKeys) {
    if (normalizeSchedule(key) === normalized) {
      return key;
    }
  }
  return null;
}
