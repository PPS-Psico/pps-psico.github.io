import { FIELD_ESPECIALIDAD_PRACTICAS, FIELD_LANZAMIENTO_VINCULADO_PRACTICAS } from "../constants";
import type { MoodleTaskLink } from "../hooks/useMoodleTaskLinks";
import type { Practica } from "../types";
import { cleanDbValue, normalizeStringForComparison } from "./formatters";
import { isFinalMoodleGrade, type MoodleGradeLike } from "./moodleGradePresentation";

export function normalizeMoodleOrientationKey(value: unknown): string | null {
  const normalized = normalizeStringForComparison(cleanDbValue(value));
  if (!normalized) return null;

  const matches = new Set<string>();
  if (normalized.includes("educ")) matches.add("educacional");
  if (normalized.includes("clinic")) matches.add("clinica");
  if (normalized.includes("comunit")) matches.add("comunitaria");
  if (normalized.includes("labor") || normalized.includes("organiz")) matches.add("laboral");

  return matches.size === 1 ? [...matches][0] : null;
}

/**
 * Única regla canónica práctica → tarea. No aproxima por nombre: sólo acepta
 * relaciones confirmadas del mismo lanzamiento y orientación.
 */
export function resolveExactMoodleTaskLink(
  practice: Practica,
  links: MoodleTaskLink[]
): MoodleTaskLink | null {
  const practiceLinks = links.filter((link) => link.practiceId === practice.id);
  if (practiceLinks.length > 0) {
    return practiceLinks.length === 1 ? practiceLinks[0] : null;
  }

  const launchId = cleanDbValue(practice[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]);
  if (!launchId) return null;

  const launchLinks = links.filter((link) => link.launchId === launchId);
  if (launchLinks.length === 0) return null;

  const orientationKey = normalizeMoodleOrientationKey(practice[FIELD_ESPECIALIDAD_PRACTICAS]);
  if (orientationKey) {
    const exact = launchLinks.filter((link) => link.orientationKey === orientationKey);
    return exact.length === 1 ? exact[0] : null;
  }
  return launchLinks.length === 1 ? launchLinks[0] : null;
}

/**
 * Agrupa solamente las tareas que todavía pueden avanzar. Una calificación
 * completa es terminal y se excluye de todas las lecturas posteriores.
 */
export function buildPendingMoodleAssignments(
  practices: Practica[],
  links: MoodleTaskLink[],
  snapshotsByPractice: ReadonlyMap<string, MoodleGradeLike>
): Map<string, string[]> {
  const byCmid = new Map<string, string[]>();

  practices.forEach((practice) => {
    if (isFinalMoodleGrade(snapshotsByPractice.get(practice.id))) return;
    const task = resolveExactMoodleTaskLink(practice, links);
    if (!task) return;
    const practiceIds = byCmid.get(task.moodleId) ?? [];
    practiceIds.push(practice.id);
    byCmid.set(task.moodleId, practiceIds);
  });

  return byCmid;
}

/** Cuánto informa un snapshot: una nota manda sobre una entrega sin corregir. */
function moodleSnapshotPriority(snapshot: MoodleGradeLike): number {
  if (snapshot.task_status === "graded") return 3;
  if (snapshot.task_status === "submitted" || snapshot.submitted) return 2;
  if (snapshot.task_status === "not_submitted") return 1;
  return 0;
}

/**
 * El snapshot visible debe pertenecer a la tarea confirmada vigente. Así una
 * nota terminal de un cmid anterior no cierra una tarea que fue remapeada.
 *
 * Una misma tarea de Moodle puede cubrir dos PPS del mismo alumno: en Fundación
 * Tiempo, Adultos y Niños se entregan como dos archivos dentro de un único
 * espacio, que registra una sola entrega y una sola nota. El ledger guarda ese
 * dato contra una sola de las prácticas, así que la otra aparecía sin nota para
 * siempre. Cuando la práctica no tiene snapshot propio se usa el de la tarea,
 * limitado a prácticas de esta misma lista (el llamador ya acota por alumno).
 */
export function selectCurrentMoodleSnapshots<
  T extends MoodleGradeLike & { practica_id: string; cmid: number },
>(practices: Practica[], links: MoodleTaskLink[], snapshots: T[]): Map<string, T> {
  const snapshotsByKey = new Map<string, T>(
    snapshots.map((snapshot) => [`${snapshot.practica_id}:${snapshot.cmid}`, snapshot] as const)
  );

  const practiceIds = new Set(practices.map((practice) => practice.id));
  const bestByCmid = new Map<string, T>();
  snapshots.forEach((snapshot) => {
    if (!practiceIds.has(snapshot.practica_id)) return;
    const key = String(snapshot.cmid);
    const current = bestByCmid.get(key);
    if (
      !current ||
      moodleSnapshotPriority(snapshot) > moodleSnapshotPriority(current) ||
      (moodleSnapshotPriority(snapshot) === moodleSnapshotPriority(current) &&
        snapshot.observed_at > current.observed_at)
    ) {
      bestByCmid.set(key, snapshot);
    }
  });

  const result = new Map<string, T>();

  practices.forEach((practice) => {
    const task = resolveExactMoodleTaskLink(practice, links);
    if (!task) return;
    const own = snapshotsByKey.get(`${practice.id}:${task.moodleId}`);
    if (own) {
      result.set(practice.id, own);
      return;
    }

    // Cuando una tarea recibe dos informes -Fundacion Tiempo, Ateneos Ulloa-
    // Moodle guarda una sola entrega y la observacion queda contra una sola de
    // las practicas. La hermana hereda que SE ENTREGO, porque es cierto, pero
    // nunca el numero: en esa tarea el numero no es la nota de ninguna de las
    // dos (la catedra reparte las notas en el comentario, y suelen diferir).
    // Antes se heredaba entero y el panel repetia la misma nota en las dos
    // filas. Son 189 pares (alumno, tarea) en esa situacion.
    const shared = bestByCmid.get(String(task.moodleId));
    if (!shared) return;
    result.set(practice.id, {
      ...shared,
      grade_value: null,
      grade_max: null,
      grade_display: null,
      graded_at_display: null,
      inheritedFromSharedTask: true,
    } as T);
  });

  return result;
}
