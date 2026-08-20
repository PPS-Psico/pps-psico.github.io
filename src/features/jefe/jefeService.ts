import { supabase } from "../../lib/supabaseClient";
import type { JefeDashboardData, JefePreviewProfile } from "./types";
import type { JefeMoodleTasksResult } from "../../lib/moodleBridge";
import type { JefeMoodleSyncResult, JefeMoodleSyncTask } from "./types";

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
  return data as unknown as JefeMoodleSyncResult;
};
