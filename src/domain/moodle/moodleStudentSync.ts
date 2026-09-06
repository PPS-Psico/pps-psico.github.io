import type { MoodleTasksResult } from "../../lib/moodleBridge";

export const STUDENT_TASK_BATCH_SIZE = 3;
export const STUDENT_OBSERVATION_BATCH_SIZE = 20;

/** Ambos límites importan: una tarea compartida produce varias observaciones. */
export function buildStudentMoodleBatches(assignments: ReadonlyMap<string, string[]>) {
  const batches: Map<string, string[]>[] = [];
  let batch = new Map<string, string[]>();
  let observations = 0;
  for (const [cmid, practiceIds] of assignments) {
    for (const practiceId of new Set(practiceIds)) {
      if (
        observations === STUDENT_OBSERVATION_BATCH_SIZE ||
        (!batch.has(cmid) && batch.size === STUDENT_TASK_BATCH_SIZE)
      ) {
        batches.push(batch);
        batch = new Map();
        observations = 0;
      }
      batch.set(cmid, [...(batch.get(cmid) ?? []), practiceId]);
      observations += 1;
    }
  }
  if (batch.size) batches.push(batch);
  return batches;
}

export function buildStudentMoodleObservations(
  result: MoodleTasksResult,
  assignments: ReadonlyMap<string, string[]>
) {
  return result.tasks.flatMap((task) =>
    (assignments.get(String(task.cmid)) ?? []).map((practicaId) => ({
      practicaId,
      cmid: task.cmid,
      status: task.status,
      submitted: task.submitted,
      gradeValue: task.gradeValue,
      gradeMax: task.gradeMax,
      gradeDisplay: task.gradeDisplay,
      gradedAtDisplay: task.gradedAtDisplay,
      feedbackComment: task.feedbackComment ?? null,
      submittedAt: task.submittedAt ?? null,
      submittedAtDisplay: task.submittedAtDisplay ?? null,
      submissionFiles: task.submissionFiles ?? null,
    }))
  );
}

/** Un fallo de una tanda no impide leer y guardar las restantes. */
export async function syncStudentMoodleBatches(
  assignments: ReadonlyMap<string, string[]>,
  request: (cmids: string[]) => Promise<MoodleTasksResult>,
  persist: (
    result: MoodleTasksResult,
    observations: ReturnType<typeof buildStudentMoodleObservations>
  ) => Promise<number>
) {
  let persistedBatches = 0;
  let failedTasks = 0;
  let rejectedObservations = 0;
  let lastError: unknown = null;
  for (const batch of buildStudentMoodleBatches(assignments)) {
    try {
      const result = await request([...batch.keys()]);
      const observations = buildStudentMoodleObservations(result, batch);
      if (observations.length === 0) throw new Error("empty_moodle_observations");
      rejectedObservations += await persist(result, observations);
      persistedBatches += 1;
      failedTasks += result.tasks.filter(
        (task) => task.status === "no_access" || task.status === "parse_error"
      ).length;
    } catch (error) {
      failedTasks += batch.size;
      lastError = error;
    }
  }
  return { persistedBatches, failedTasks, rejectedObservations, lastError };
}
