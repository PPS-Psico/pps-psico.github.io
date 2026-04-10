import { supabase } from "../lib/supabaseClient";
import { Database, Json } from "../types/supabase";

type AdminActionLogInsert = Database["public"]["Tables"]["admin_action_log"]["Insert"];

const toJsonObject = (value?: Record<string, unknown>): Json => (value as Json | undefined) ?? {};

export interface AdminActorSnapshot {
  userId?: string;
  name?: string;
  legajo?: string;
}

export interface AdminActionLogInput {
  actor?: AdminActorSnapshot | null;
  actionType: string;
  targetTable: string;
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export const logAdminAction = async ({
  actor,
  actionType,
  targetTable,
  targetId,
  summary,
  metadata,
}: AdminActionLogInput): Promise<void> => {
  try {
    const payload: AdminActionLogInsert = {
      actor_user_id: actor?.userId ?? null,
      actor_name: actor?.name ?? null,
      actor_legajo: actor?.legajo ?? null,
      action_type: actionType,
      target_table: targetTable,
      target_id: targetId,
      summary,
      metadata: toJsonObject(metadata),
    };

    const { error } = await supabase.from("admin_action_log").insert(payload);
    if (error) {
      console.warn("[adminActionLog] Could not persist action log:", error.message);
    }
  } catch (error) {
    console.warn("[adminActionLog] Unexpected error while logging action:", error);
  }
};
