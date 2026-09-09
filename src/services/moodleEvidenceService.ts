import { z } from "zod";
import { supabase } from "../lib/supabaseClient";
import type { MoodleTasksResult } from "../lib/moodleBridge";
import type { Json } from "../types/supabase";

export const evidenceCaseSchema = z.object({
  id: z.string(),
  revision: z.number(),
  cmid: z.number(),
  studentId: z.string().nullable(),
  studentName: z.string().nullable(),
  taskName: z.string().nullable(),
  evidenceId: z.string(),
  observedAt: z.string(),
  source: z.string(),
  versionCount: z.number(),
  applications: z
    .array(
      z.object({
        id: z.string(),
        practica_id: z.string(),
        action: z.enum(["apply", "revert"]),
        previous_academic: z.object({ nota: z.string().nullable() }),
        applied_academic: z.object({ nota: z.string().nullable() }),
        reason: z.string(),
        created_at: z.string(),
      })
    )
    .optional(),
  history: z.array(
    z.object({
      id: z.string(),
      observed_at: z.string(),
      source: z.string(),
      legacy_practica_id: z.string().nullable(),
      content: z
        .object({
          gradeDisplay: z.string().nullable().optional(),
          feedbackComment: z.string().nullable().optional(),
          status: z.string(),
        })
        .passthrough(),
    })
  ),
  content: z
    .object({
      status: z.string(),
      gradeDisplay: z.string().nullable().optional(),
      feedbackComment: z.string().nullable().optional(),
    })
    .passthrough(),
  decisions: z.array(
    z.object({
      id: z.string(),
      evidence_id: z.string(),
      practica_id: z.string(),
      revision: z.number(),
      action: z.enum(["allocate", "revoke"]),
      grade: z.number().nullable(),
      reason: z.string(),
      created_at: z.string(),
    })
  ),
  practices: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      area: z.string().nullable(),
      grade: z.string().nullable(),
      start: z.string().nullable(),
      state: z.string().nullable(),
      exactLink: z.boolean(),
      academic: z.record(z.string(), z.unknown()).optional(),
      applicationId: z.string().nullable().optional(),
      appliedDecisionId: z.string().nullable().optional(),
      effectiveSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
    })
  ),
});
export type MoodleEvidenceCase = z.infer<typeof evidenceCaseSchema>;
const inboxSchema = z.object({
  total: z.number(),
  mode: z.enum(["shadow", "review_and_apply"]),
  cases: z.array(evidenceCaseSchema),
});
export const evidenceReceiptSchema = z.object({
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
});

export async function fetchMoodleEvidenceInbox(offset: number) {
  const { data, error } = await supabase.rpc("moodle_evidence_inbox_v2", {
    p_offset: offset,
    p_limit: 30,
  });
  if (error) throw error;
  return inboxSchema.parse(data);
}

export async function applyMoodleEvidence(
  item: MoodleEvidenceCase,
  practiceId: string,
  decisionId: string,
  action: "apply" | "revert",
  reason: string
) {
  const practice = item.practices.find((p) => p.id === practiceId);
  if (!practice?.academic) throw new Error("Reload academic record before applying");
  const { error } = await supabase.rpc("apply_moodle_evidence_decision_v1", {
    p_decision: decisionId,
    p_expected_academic: practice.academic as Json,
    p_expected_application: practice.applicationId ?? undefined,
    p_action: action,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function decideMoodleEvidence(
  item: MoodleEvidenceCase,
  practiceId: string,
  action: "allocate" | "revoke",
  reason: string,
  grade: number | null
) {
  const { error } = await supabase.rpc("decide_moodle_evidence_v1", {
    p_case: item.id,
    p_evidence: item.evidenceId,
    p_practice: practiceId,
    p_revision: item.revision,
    p_action: action,
    p_reason: reason,
    p_grade: grade ?? undefined,
  });
  if (error) throw error;
}

export async function captureStudentMoodleEvidence(result: MoodleTasksResult) {
  const { data, error } = await supabase.rpc("ingest_student_moodle_evidence_v1", {
    p_request: result.requestId,
    p_course: result.courseId,
    p_observed: result.observedAt,
    p_moodle_user: result.moodleUserId,
    p_username: result.moodleUsername,
    p_tasks: result.tasks,
  });
  if (error) throw error;
  const receipt = evidenceReceiptSchema.parse(data);
  if (receipt.accepted + receipt.rejected !== result.tasks.length)
    throw new Error("Incomplete evidence receipt");
  return receipt;
}
