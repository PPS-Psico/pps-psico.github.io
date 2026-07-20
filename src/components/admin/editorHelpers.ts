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
  hoursField: string,
  stateField = "estado"
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of practicas) {
    const state = String(p[stateField] || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    if (state === "desaprobada" || state === "no se pudo concretar") continue;
    const link = p[linkField];
    const ids = Array.isArray(link) ? link.map((x) => String(x)) : [String(link)];
    const hs = Number(p[hoursField]) || 0;
    for (const id of ids) {
      totals.set(id, (totals.get(id) || 0) + hs);
    }
  }
  return totals;
}

/**
 * Devuelve la página `page` (1-based) de `records` con `pageSize` elementos.
 * Patrón compartido por los editores en modo testing (paginación local).
 */
export function paginate<T>(records: T[], page: number, pageSize: number): T[] {
  const from = (page - 1) * pageSize;
  return records.slice(from, from + pageSize);
}

/**
 * Quita un registro por id de una página cacheada y decrementa el total (sin
 * bajar de 0). Patrón de borrado optimista compartido por los editores en sus
 * mutaciones `onMutate`. Devuelve una copia nueva (no muta `page`).
 */
export function removeRecordById<P extends { records: { id: string }[]; total: number }>(
  page: P,
  id: string
): P {
  return {
    ...page,
    records: page.records.filter((r) => r.id !== id),
    total: Math.max(0, (page.total || 0) - 1),
  };
}
