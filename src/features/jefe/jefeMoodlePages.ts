import { z } from "zod";
import { supabase } from "../../lib/supabaseClient";
import type { JefeMoodlePage } from "../../lib/moodleBridge";
import type { Json } from "../../types/supabase";

const taskSchema = z.object({
  cmid: z.number().int().positive(),
  task_name: z.string(),
  next_page: z.number().int().nonnegative(),
});
const queueSchema = z.object({
  pending: z.number().int().nonnegative(),
  paused: z.number().int().nonnegative(),
  tasks: z.array(taskSchema).max(4),
});
const claimSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("claimed"),
    lease: z.string().uuid(),
    cycle: z.string().uuid(),
    cmid: z.number().int().positive(),
    page: z.number().int().min(0).max(23),
    rowsSeen: z.number().int().nonnegative(),
  }),
  z.object({ status: z.enum(["busy", "fresh", "paused"]) }),
]);
const receiptSchema = z.object({
  status: z.enum(["paused", "complete", "progress"]),
  nextPage: z.number().int().nonnegative(),
  rowsSeen: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  error: z.string().nullable(),
  observedAt: z.string(),
});

export async function fetchJefePageQueue(preview?: string, history = false, manual = false) {
  const { data, error } = await supabase
    .rpc("moodle_scan_queue_v2", { p_preview: preview, p_history: history, p_manual: manual })
    .abortSignal(AbortSignal.timeout(15_000));
  if (error) throw error;
  return queueSchema.parse(data);
}

export async function claimJefePage(cmid: number, preview?: string, manual = false) {
  const { data, error } = await supabase
    .rpc("claim_moodle_scan_page_v2", { p_cmid: cmid, p_preview: preview, p_manual: manual })
    .abortSignal(AbortSignal.timeout(15_000));
  if (error) throw error;
  return claimSchema.parse(data);
}

export async function commitJefePage(lease: string, payload: JefeMoodlePage, preview?: string) {
  // If acknowledgement is lost, retry this exact payload and lease. Never fetch
  // another page or generate a new request ID before the receipt is confirmed.
  const { data, error } = await supabase
    .rpc("commit_moodle_scan_page_v2", {
      p_lease: lease,
      p_payload: payload as unknown as Json,
      p_preview: preview,
    })
    .abortSignal(AbortSignal.timeout(20_000));
  if (error) throw error;
  return receiptSchema.parse(data);
}

export async function failJefePage(lease: string, preview?: string) {
  const { error } = await supabase
    .rpc("fail_moodle_scan_page_v2", { p_lease: lease, p_preview: preview })
    .abortSignal(AbortSignal.timeout(10_000));
  if (error) throw error;
}
