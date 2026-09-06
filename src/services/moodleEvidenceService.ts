import { z } from "zod";
import { supabase } from "../lib/supabaseClient";
import type { MoodleTasksResult } from "../lib/moodleBridge";

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
    })
  ),
});
export type MoodleEvidenceCase = z.infer<typeof evidenceCaseSchema>;
const inboxSchema = z.object({
  total: z.number(),
  mode: z.literal("shadow"),
  cases: z.array(evidenceCaseSchema),
});
export const evidenceReceiptSchema = z.object({
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
});

export async function fetchMoodleEvidenceInbox(offset: number) {
  const { data, error } = await supabase.rpc("moodle_evidence_inbox_v1", {
    p_offset: offset,
    p_limit: 30,
  });
  if (error) throw error;
  return inboxSchema.parse(data);
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
