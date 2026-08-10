import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/supabase";

type LinkRow = Database["public"]["Tables"]["lanzamiento_moodle_tareas"]["Row"];
type AulaEntregaRow = Pick<
  Database["public"]["Tables"]["aula_entregas"]["Row"],
  "academic_year" | "activo" | "area" | "institucion" | "moodle_id" | "moodle_name"
>;

interface LinkRowWithTask extends LinkRow {
  aula_entregas: AulaEntregaRow | null;
}

export interface MoodleTaskLink {
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
      const { data: rows, error } = await supabase
        .from("lanzamiento_moodle_tareas")
        .select(
          "lanzamiento_id, orientacion_key, validation_status, aula_entregas!inner(academic_year, activo, area, institucion, moodle_id, moodle_name)"
        )
        .eq("validation_status", "confirmed")
        .eq("aula_entregas.activo", true);

      if (error) throw error;

      return ((rows ?? []) as unknown as LinkRowWithTask[])
        .map((row): MoodleTaskLink | null => {
          const task = row.aula_entregas;
          if (!task?.moodle_id) return null;
          return {
            launchId: row.lanzamiento_id,
            orientationKey: row.orientacion_key,
            moodleId: String(task.moodle_id),
            name: task.moodle_name || task.institucion,
            area: task.area,
            academicYear: task.academic_year,
          };
        })
        .filter((row): row is MoodleTaskLink => row !== null);
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  return { links: data, isLoading };
}
