/** Pure queue/matching helpers for the persistent Moodle observer. */

import type {
  MoodleMonitoringStatus,
  MoodleParticipantMembershipStatus,
} from "./moodleReportStatus";

export const normalizeDni = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).replace(/\D/g, "");

export interface QueueCandidateTask {
  intentId: string;
  launchId: string;
  orientationKey: string;
  mode: "legacy_shared" | "dedicated";
  cmid: number;
  courseId: number;
  monitoringStatus: MoodleMonitoringStatus;
  lastScannedAt?: string | null;
  hasPendingSubmissions: boolean;
  hasReSubmissions: boolean;
  oldestSubmissionAt?: string | null;
  missingSubmissionsCount: number;
}

export interface ExpectedParticipantMatch {
  studentId: string;
  practiceId: string;
  intentId: string;
  courseId: number;
  cmid: number;
  dni: string;
  moodleUserId?: number | null;
  membershipStatus?: MoodleParticipantMembershipStatus;
}

export interface ObservedSubmissionRow {
  courseId: number;
  cmid: number;
  moodleUserId: number;
  moodleUsername: string;
  email?: string | null;
  status: "submitted" | "graded";
  gradeValue?: number | null;
  gradeMax?: number | null;
  gradeDisplay?: string | null;
  gradedAtDisplay?: string | null;
  submittedAt?: string | null;
  submittedAtDisplay?: string | null;
}

export interface DistributedObservation {
  participant: ExpectedParticipantMatch;
  submission: ObservedSubmissionRow;
}

export interface ObserverBatch {
  batchIndex: number;
  targets: Array<{ courseId: number; cmid: number }>;
  tasks: QueueCandidateTask[];
}

export function calculateQueuePriority(
  task: QueueCandidateTask,
  referenceDate: Date = new Date()
): number {
  if (task.monitoringStatus === "settled" || task.monitoringStatus === "not_started") return -1;

  let score = task.monitoringStatus === "needs_attention" ? 2_000 : 0;
  if (task.hasPendingSubmissions) {
    score += 1_000;
    const submittedAt = task.oldestSubmissionAt ? Date.parse(task.oldestSubmissionAt) : Number.NaN;
    if (Number.isFinite(submittedAt)) {
      const ageDays = Math.max(
        0,
        Math.floor((referenceDate.getTime() - submittedAt) / (24 * 60 * 60 * 1000))
      );
      score += Math.min(ageDays * 10, 500);
    }
  }
  if (task.hasReSubmissions) score += 800;

  if (task.monitoringStatus === "hot") {
    const lastScan = task.lastScannedAt ? Date.parse(task.lastScannedAt) : Number.NaN;
    if (!Number.isFinite(lastScan)) score += 500;
    else {
      const ageHours = Math.max(0, (referenceDate.getTime() - lastScan) / (60 * 60 * 1000));
      if (ageHours >= 24) score += 300 + Math.min(ageHours, 200);
    }
  }

  if (task.missingSubmissionsCount > 0) score += 100;
  if (task.monitoringStatus === "cold") score += 10;
  return score;
}

/** Deduplicates by (course, cmid), never by cmid alone. */
export function buildObserverBatches(
  tasks: QueueCandidateTask[],
  batchSize = 10,
  referenceDate: Date = new Date()
): ObserverBatch[] {
  const safeBatchSize = Math.max(1, Math.min(Math.trunc(batchSize) || 1, 20));
  const eligible = tasks
    .filter(
      (task) =>
        task.courseId > 0 && task.cmid > 0 && calculateQueuePriority(task, referenceDate) >= 0
    )
    .sort((left, right) => {
      const priority =
        calculateQueuePriority(right, referenceDate) - calculateQueuePriority(left, referenceDate);
      return priority || left.courseId - right.courseId || left.cmid - right.cmid;
    });

  const grouped = new Map<string, QueueCandidateTask[]>();
  for (const task of eligible) {
    const key = `${task.courseId}:${task.cmid}`;
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }

  const targets = [...grouped.values()].map((group) => ({
    courseId: group[0].courseId,
    cmid: group[0].cmid,
  }));
  const batches: ObserverBatch[] = [];
  for (let index = 0; index < targets.length; index += safeBatchSize) {
    const slice = targets.slice(index, index + safeBatchSize);
    batches.push({
      batchIndex: batches.length,
      targets: slice,
      tasks: slice.flatMap((target) => grouped.get(`${target.courseId}:${target.cmid}`) ?? []),
    });
  }
  return batches;
}

const participantKey = (participant: ExpectedParticipantMatch): string =>
  `${participant.intentId}:${participant.practiceId}`;
const taskKey = (courseId: number, cmid: number): string => `${courseId}:${cmid}`;

/**
 * Matches only inside the observed task. Moodle user ID is preferred when it
 * was previously confirmed; DNI is a fallback only when non-empty and unique.
 * Ambiguity is returned to the caller and never resolved heuristically.
 */
export function distributeObservationsToParticipants(
  submissions: ObservedSubmissionRow[],
  expectedParticipants: ExpectedParticipantMatch[]
): {
  matched: DistributedObservation[];
  unmatchedSubmissions: ObservedSubmissionRow[];
  missingParticipants: ExpectedParticipantMatch[];
} {
  const expected = expectedParticipants.filter(
    (participant) => !participant.membershipStatus || participant.membershipStatus === "expected"
  );
  const byTaskAndUserId = new Map<string, ExpectedParticipantMatch[]>();
  const byTaskAndDni = new Map<string, ExpectedParticipantMatch[]>();

  for (const participant of expected) {
    const task = taskKey(participant.courseId, participant.cmid);
    if (typeof participant.moodleUserId === "number" && participant.moodleUserId > 0) {
      const key = `${task}:uid:${participant.moodleUserId}`;
      byTaskAndUserId.set(key, [...(byTaskAndUserId.get(key) ?? []), participant]);
    }
    const dni = normalizeDni(participant.dni);
    if (dni) {
      const key = `${task}:dni:${dni}`;
      byTaskAndDni.set(key, [...(byTaskAndDni.get(key) ?? []), participant]);
    }
  }

  const matched: DistributedObservation[] = [];
  const unmatchedSubmissions: ObservedSubmissionRow[] = [];
  const matchedParticipants = new Set<string>();

  for (const submission of submissions) {
    if (submission.courseId <= 0 || submission.cmid <= 0 || submission.moodleUserId <= 0) {
      unmatchedSubmissions.push(submission);
      continue;
    }

    const task = taskKey(submission.courseId, submission.cmid);
    const userCandidates = byTaskAndUserId.get(`${task}:uid:${submission.moodleUserId}`) ?? [];
    const dni = normalizeDni(submission.moodleUsername);
    const dniCandidates = dni ? (byTaskAndDni.get(`${task}:dni:${dni}`) ?? []) : [];
    const candidates = userCandidates.length > 0 ? userCandidates : dniCandidates;

    if (candidates.length !== 1 || matchedParticipants.has(participantKey(candidates[0]))) {
      unmatchedSubmissions.push(submission);
      continue;
    }

    const participant = candidates[0];
    matchedParticipants.add(participantKey(participant));
    matched.push({ participant, submission });
  }

  return {
    matched,
    unmatchedSubmissions,
    missingParticipants: expected.filter(
      (participant) => !matchedParticipants.has(participantKey(participant))
    ),
  };
}
