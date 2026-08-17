import { supabase } from "../../lib/supabaseClient";
import type { JefeDashboardData, JefePreviewProfile } from "./types";

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
