import { supabase } from "../../lib/supabaseClient";
import type { JefeDashboardData, JefePreviewProfile } from "./types";
import type { JefeMoodleTasksResult } from "../../lib/moodleBridge";
import type { JefeMoodleSyncResult, JefeMoodleSyncTask } from "./types";
import { evidenceReceiptSchema } from "../../services/moodleEvidenceService";

const dateForYear = (year: number): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (year < currentYear) return `${year}-12-31`;
  return now.toISOString().slice(0, 10);
};

export const fetchJefeDashboard = async (year: number): Promise<JefeDashboardData> => {
  const { data, error } = await supabase.rpc("get_jefe_dashboard_v1", {
    p_year: year,
    p_cutoff: dateForYear(year),
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("El panel de jefatura devolvió una respuesta vacía.");
  }

  return data as unknown as JefeDashboardData;
};

export const fetchJefeDashboardPreview = async (
  previewKey: string,
  year: number
): Promise<JefeDashboardData> => {
  const { data, error } = await supabase.rpc("get_jefe_dashboard_preview_v2", {
    p_preview_key: previewKey,
    p_year: year,
    p_cutoff: dateForYear(year),
  });

  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("La previsualización de jefatura devolvió una respuesta vacía.");
  }

  return data as unknown as JefeDashboardData;
};

export const listJefePreviewProfiles = async (): Promise<JefePreviewProfile[]> => {
  const { data, error } = await supabase.rpc("list_jefe_preview_profiles_v1");

  if (error) throw error;
  return (data || []) as JefePreviewProfile[];
};

export const updateJefeReportGrade = async (practicaId: string, grade: string): Promise<void> => {
  const { error } = await supabase.rpc("update_jefe_report_grade_v1", {
    p_practica_id: practicaId,
    p_grade: grade,
  });

  if (error) throw error;
};

export const fetchJefeMoodleSyncTasks = async (
  previewKey?: string
): Promise<JefeMoodleSyncTask[]> => {
  const { data, error } = await supabase.rpc("moodle_evidence_scan_queue_v1", {
    p_preview_key: previewKey,
  });
  if (error) throw error;
  return (data ?? []) as JefeMoodleSyncTask[];
};

const fetchLegacyJefeMoodleTasks = async (previewKey?: string): Promise<JefeMoodleSyncTask[]> => {
  const { data, error } = previewKey
    ? await supabase.rpc("get_jefe_moodle_sync_tasks_preview_v1", {
        p_preview_key: previewKey,
      })
    : await supabase.rpc("get_jefe_moodle_sync_tasks_v1");
  if (error) throw error;
  return (data ?? []) as JefeMoodleSyncTask[];
};

export const syncJefeMoodleReports = async (
  academicYear: number,
  result: JefeMoodleTasksResult,
  previewKey?: string
): Promise<JefeMoodleSyncResult> => {
  const commonArgs = {
    p_request_id: result.requestId,
    p_course_id: result.courseId,
    p_academic_year: academicYear,
    p_observed_at: result.observedAt,
    p_actor_moodle_user_id: result.moodleUserId,
    p_actor_moodle_username: result.moodleUsername,
    p_tasks: result.tasks,
  };
  // A separate committed request preserves even unmatched rows if attribution fails.
  // Full rosters can exceed 1,000 rows across four tasks. Commit each task's
  // positive and negative evidence together within the SQL limit of 500.
  const evidenceBatches = result.tasks.some((task) => task.negativeRows !== undefined)
    ? result.tasks.map((task) => [{ ...task, rows: [...task.rows, ...(task.negativeRows ?? [])] }])
    : [result.tasks];
  const receipt = { accepted: 0, rejected: 0 };
  for (const tasks of evidenceBatches) {
    const evidence = await supabase.rpc("capture_jefe_moodle_evidence_v1", {
      ...commonArgs,
      p_tasks: tasks,
      p_preview_key: previewKey ?? undefined,
    });
    if (evidence.error) throw evidence.error;
    const batchReceipt = evidenceReceiptSchema.parse(evidence.data);
    receipt.accepted += batchReceipt.accepted;
    receipt.rejected += batchReceipt.rejected;
  }
  if (receipt.rejected > 0)
    throw new Error("Se conservó evidencia parcial; algunas filas requieren relectura.");
  const legacyTasks = new Set(
    (await fetchLegacyJefeMoodleTasks(previewKey)).map((task) => task.cmid)
  );
  const deferred = result.tasks
    .filter((task) => !legacyTasks.has(task.cmid))
    .reduce((count, task) => count + task.rows.length, 0);
  commonArgs.p_tasks = result.tasks
    .filter((task) => legacyTasks.has(task.cmid))
    .map(({ negativeRows: _negativeRows, ...task }) => task);
  if (commonArgs.p_tasks.length === 0)
    return {
      success: true,
      academic_year: academicYear,
      task_count: result.tasks.length,
      rows_received: receipt.accepted,
      accepted: 0,
      stored: 0,
      snapshot_updated: 0,
      ambiguous: 0,
      unmatched: deferred,
      invalid: 0,
      observed_at: result.observedAt,
    };
  const { data, error } = previewKey
    ? await supabase.rpc("sync_jefe_moodle_reports_preview_v1", {
        p_preview_key: previewKey,
        ...commonArgs,
      })
    : await supabase.rpc("sync_jefe_moodle_reports_v1", commonArgs);

  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("La sincronización Moodle devolvió una respuesta vacía.");
  }
  const projected = data as unknown as JefeMoodleSyncResult;
  return { ...projected, unmatched: projected.unmatched + deferred };
};
