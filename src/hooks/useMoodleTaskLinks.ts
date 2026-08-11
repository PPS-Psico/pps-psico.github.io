import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/supabase";

type LinkRow = Database["public"]["Tables"]["lanzamiento_moodle_tareas"]["Row"];
type PracticeLinkRow = Database["public"]["Tables"]["practica_moodle_tareas"]["Row"];
type AulaEntregaRow = Pick<
  Database["public"]["Tables"]["aula_entregas"]["Row"],
  "academic_year" | "activo" | "area" | "institucion" | "moodle_id" | "moodle_name"
>;

interface LinkRowWithTask extends LinkRow {
  aula_entregas: AulaEntregaRow | null;
}

interface PracticeLinkRowWithTask extends PracticeLinkRow {
  aula_entregas: AulaEntregaRow | null;
}

export interface MoodleTaskLink {
  practiceId?: string | null;
  launchId: string;
  orientationKey: string;
  moodleId: string;
  name: string;
  area: string;
  academicYear: number | null;
}

export function useMoodleTaskLinks(enabled = true): {
  links: MoodleTaskLink[];
  isLoading: boolean;
} {
  const { data = [], isLoading } = useQuery({
    queryKey: ["lanzamiento_moodle_tareas", "confirmed"],
    enabled,
    queryFn: async () => {
      const [launchResult, practiceResult] = await Promise.all([
        supabase
          .from("lanzamiento_moodle_tareas")
          .select(
            "lanzamiento_id, orientacion_key, validation_status, aula_entregas!inner(academic_year, activo, area, institucion, moodle_id, moodle_name)"
          )
          .eq("validation_status", "confirmed")
          .eq("aula_entregas.activo", true),
        supabase
          .from("practica_moodle_tareas")
          .select(
            "practica_id, validation_status, aula_entregas!inner(academic_year, activo, area, institucion, moodle_id, moodle_name)"
          )
          .eq("validation_status", "confirmed")
          .eq("aula_entregas.activo", true),
      ]);

      if (launchResult.error) throw launchResult.error;
      if (practiceResult.error) throw practiceResult.error;

      const launchLinks = ((launchResult.data ?? []) as unknown as LinkRowWithTask[])
        .map((row): MoodleTaskLink | null => {
          const task = row.aula_entregas;
          if (!task?.moodle_id) return null;
          return {
            practiceId: null,
            launchId: row.lanzamiento_id,
            orientationKey: row.orientacion_key,
            moodleId: String(task.moodle_id),
            name: task.moodle_name || task.institucion,
            area: task.area,
            academicYear: task.academic_year,
          };
        })
        .filter((row): row is MoodleTaskLink => row !== null);

      const practiceLinks = ((practiceResult.data ?? []) as unknown as PracticeLinkRowWithTask[])
        .map((row): MoodleTaskLink | null => {
          const task = row.aula_entregas;
          if (!task?.moodle_id) return null;
          return {
            practiceId: row.practica_id,
            launchId: "",
            orientationKey: "",
            moodleId: String(task.moodle_id),
            name: task.moodle_name || task.institucion,
            area: task.area,
            academicYear: task.academic_year,
          };
        })
        .filter((row): row is MoodleTaskLink => row !== null);

      return [...practiceLinks, ...launchLinks];
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  return { links: data, isLoading };
}
