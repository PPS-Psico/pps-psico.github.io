import {
  buildObserverBatches,
  calculateQueuePriority,
  distributeObservationsToParticipants,
  type ExpectedParticipantMatch,
  type ObservedSubmissionRow,
  type QueueCandidateTask,
} from "../moodleObserverQueue";

describe("moodleObserverQueue", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  const baseTask: QueueCandidateTask = {
    intentId: "i-1",
    launchId: "l-1",
    orientationKey: "educacional",
    mode: "legacy_shared",
    courseId: 3615,
    cmid: 1_109_159,
    monitoringStatus: "hot",
    hasPendingSubmissions: true,
    hasReSubmissions: false,
    oldestSubmissionAt: "2026-07-15T10:00:00Z",
    missingSubmissionsCount: 2,
  };

  it("prioritizes attention, overdue correction and re-entry before cold monitoring", () => {
    const attention = calculateQueuePriority(
      { ...baseTask, monitoringStatus: "needs_attention" },
      now
    );
    const overdue = calculateQueuePriority(baseTask, now);
    const reentry = calculateQueuePriority(
      {
        ...baseTask,
        hasPendingSubmissions: false,
        hasReSubmissions: true,
        oldestSubmissionAt: null,
      },
      now
    );
    const cold = calculateQueuePriority(
      {
        ...baseTask,
        monitoringStatus: "cold",
        hasPendingSubmissions: false,
        hasReSubmissions: false,
      },
      now
    );
    expect(attention).toBeGreaterThan(overdue);
    expect(overdue).toBeGreaterThan(reentry);
    expect(reentry).toBeGreaterThan(cold);
  });

  it("deduplicates by course and cmid while retaining all intent consumers", () => {
    const tasks: QueueCandidateTask[] = [
      baseTask,
      { ...baseTask, intentId: "i-2", launchId: "l-2" },
      { ...baseTask, intentId: "i-3", courseId: 9999 },
      { ...baseTask, intentId: "i-4", monitoringStatus: "settled", cmid: 123 },
    ];
    const batches = buildObserverBatches(tasks, 5, now);
    expect(batches).toHaveLength(1);
    expect(batches[0].targets).toEqual([
      { courseId: 3615, cmid: 1_109_159 },
      { courseId: 9999, cmid: 1_109_159 },
    ]);
    expect(batches[0].tasks).toHaveLength(3);
  });

  const participant = (
    overrides: Partial<ExpectedParticipantMatch> = {}
  ): ExpectedParticipantMatch => ({
    studentId: "s-1",
    practiceId: "p-1",
    intentId: "i-1",
    courseId: 3615,
    cmid: 1_109_159,
    dni: "38.123.456",
    membershipStatus: "expected",
    ...overrides,
  });

  const submission = (overrides: Partial<ObservedSubmissionRow> = {}): ObservedSubmissionRow => ({
    courseId: 3615,
    cmid: 1_109_159,
    moodleUserId: 1001,
    moodleUsername: "38123456",
    status: "submitted",
    ...overrides,
  });

  it("matches within the exact task, preferring a confirmed Moodle user ID", () => {
    const expected = [
      participant({ moodleUserId: 1001, dni: "99999999" }),
      participant({ studentId: "s-2", practiceId: "p-2", dni: "38123456" }),
    ];
    const result = distributeObservationsToParticipants([submission()], expected);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].participant.practiceId).toBe("p-1");
    expect(result.missingParticipants.map(({ practiceId }) => practiceId)).toEqual(["p-2"]);
  });

  it("does not match the same DNI in another cmid", () => {
    const result = distributeObservationsToParticipants(
      [submission({ cmid: 999_999 })],
      [participant()]
    );
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedSubmissions).toHaveLength(1);
  });

  it("rejects empty identities and ambiguous repeated practices", () => {
    const ambiguous = [
      participant(),
      participant({ intentId: "i-2", practiceId: "p-2", studentId: "s-1" }),
    ];
    const result = distributeObservationsToParticipants(
      [submission(), submission({ moodleUserId: 1002, moodleUsername: "sin-dni" })],
      ambiguous
    );
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedSubmissions).toHaveLength(2);
    expect(result.missingParticipants).toHaveLength(2);
  });

  it("excludes waived and withdrawn participants from the missing denominator", () => {
    const result = distributeObservationsToParticipants(
      [],
      [
        participant({ membershipStatus: "waived" }),
        participant({ practiceId: "p-2", membershipStatus: "withdrawn" }),
        participant({ practiceId: "p-3", membershipStatus: "expected" }),
      ]
    );
    expect(result.missingParticipants.map(({ practiceId }) => practiceId)).toEqual(["p-3"]);
  });
});
