/**
 * Helpers puros compartidos por los editores de base de datos (admin).
 */

/**
 * Suma las horas realizadas de un conjunto de prácticas, agrupadas por el id de
 * estudiante al que están vinculadas.
 *
 * Maneja el `linkField` tanto si viene como string (`"st_1"`) como si viene
 * como array (`["st_1"]`) — formatos que conviven por el legado de Airtable.
 *
 * @returns Un `Map<idEstudiante, totalHoras>`.
 */
export function sumHoursByStudent(
  practicas: Record<string, unknown>[],
  linkField: string,
  hoursField: string
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of practicas) {
    const link = p[linkField];
    const ids = Array.isArray(link) ? link.map((x) => String(x)) : [String(link)];
    const hs = Number(p[hoursField]) || 0;
    for (const id of ids) {
      totals.set(id, (totals.get(id) || 0) + hs);
    }
  }
  return totals;
}
