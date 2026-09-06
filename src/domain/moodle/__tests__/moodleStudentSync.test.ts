import { buildStudentMoodleBatches, syncStudentMoodleBatches } from "../moodleStudentSync";
import type { MoodleTasksResult } from "../../../lib/moodleBridge";

function response(cmids: string[]): MoodleTasksResult {
  return {
    type: "PPS_MOODLE_TASKS_RESULT",
    version: 1,
    courseId: 3615,
    requestId: "550e8400-e29b-41d4-a716-446655440000",
    observedAt: "2026-09-05T12:00:00Z",
    moodleUserId: 1,
    moodleUsername: "12345678",
    tasks: cmids.map((cmid) => ({
      cmid: Number(cmid),
      status: "submitted",
      submitted: true,
      gradeValue: null,
      gradeMax: null,
      gradeDisplay: null,
      gradedAtDisplay: null,
      submittedAt: "2026-07-07T12:00:00Z",
      feedbackComment: "Adultos: 8; Niños: 9",
    })),
  };
}

describe("sincronización del estudiante por tandas", () => {
  it("conserva todos los pares y respeta ambos límites en tareas compartidas", () => {
    const assignments = new Map([
      ["10", Array.from({ length: 27 }, (_, i) => `shared-${i}`)],
      ...Array.from({ length: 10 }, (_, i): [string, string[]] => [String(20 + i), [`p-${i}`]]),
    ]);
    const batches = buildStudentMoodleBatches(assignments);
    const pairs = (batch: Map<string, string[]>) =>
      [...batch].flatMap(([cmid, ids]) => ids.map((id) => `${cmid}:${id}`));
    expect(batches.flatMap(pairs)).toEqual(pairs(assignments));
    batches.forEach((batch) => {
      expect(batch.size).toBeLessThanOrEqual(3);
      expect(pairs(batch).length).toBeLessThanOrEqual(20);
    });
  });

  it("guarda las tandas anterior y posterior a un timeout sin perder comentarios ni fechas", async () => {
    const assignments = new Map(
      Array.from({ length: 7 }, (_, i): [string, string[]] => [String(i + 1), [`p-${i}`]])
    );
    const request = jest.fn(async (cmids: string[]) => {
      if (cmids.includes("4")) throw new Error("timeout");
      return response(cmids);
    });
    const persist = jest.fn(async () => 0);
    const outcome = await syncStudentMoodleBatches(assignments, request, persist);
    expect(outcome).toMatchObject({ persistedBatches: 2, failedTasks: 3, rejectedObservations: 0 });
    expect(request).toHaveBeenNthCalledWith(3, ["7"]);
    expect(persist).toHaveBeenNthCalledWith(2, expect.anything(), [
      expect.objectContaining({
        practicaId: "p-6",
        feedbackComment: "Adultos: 8; Niños: 9",
        submittedAt: "2026-07-07T12:00:00Z",
      }),
    ]);
  });

  it("cuenta una respuesta sin acceso como parcial, aunque el servidor la guarde", async () => {
    const failed = response(["1"]);
    failed.tasks[0] = {
      ...failed.tasks[0],
      status: "no_access",
      submitted: false,
      submittedAt: null,
    };
    const outcome = await syncStudentMoodleBatches(
      new Map([["1", ["p"]]]),
      async () => failed,
      async () => 0
    );
    expect(outcome).toMatchObject({ persistedBatches: 1, failedTasks: 1 });
  });

  it("continúa después de un fallo de persistencia y suma rechazos individuales", async () => {
    const assignments = new Map(
      Array.from({ length: 4 }, (_, i): [string, string[]] => [String(i + 1), [`p-${i}`]])
    );
    const persist = jest
      .fn()
      .mockRejectedValueOnce(new Error("server_error"))
      .mockResolvedValueOnce(1);
    expect(
      await syncStudentMoodleBatches(assignments, async (cmids) => response(cmids), persist)
    ).toMatchObject({
      persistedBatches: 1,
      failedTasks: 3,
      rejectedObservations: 1,
    });
  });
});
