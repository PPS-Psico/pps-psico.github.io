import {
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
} from "../../constants/dbConstants";
import { classifyDbError } from "../../lib/dbError";
import { supabase } from "../../lib/supabaseClient";
import type { Database } from "../../types/supabase";

export const STUDENT_SEARCH_PAGE_SIZE = 20;
export const normalizeStudentSearch = (term: string) => term.trim().slice(0, 100);
export type StudentSearchResult = Pick<
  Database["public"]["Tables"]["estudiantes"]["Row"],
  "id" | "nombre" | "legajo"
>;
export interface StudentSearchPage {
  students: StudentSearchResult[];
  hasNextPage: boolean;
}

export const studentSearchKeys = {
  all: ["studentSearch"] as const,
  page: (term: string, page: number) => ["studentSearch", "active", term, page] as const,
};

/** Valor entre comillas PostgREST: la entrada no puede introducir operadores OR. */
export function studentSearchFilter(term: string): string {
  const pattern = `%${term.replace(/[\\%_*]/g, "\\$&")}%`;
  const value = JSON.stringify(pattern);
  return [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES]
    .map((field) => `${field}.ilike.${value}`)
    .join(",");
}

export async function searchStudents(
  term: string,
  page: number,
  signal?: AbortSignal
): Promise<StudentSearchPage> {
  const normalized = normalizeStudentSearch(term);
  if (normalized.length < 2) return { students: [], hasNextPage: false };
  if (!Number.isInteger(page) || page < 1) throw new RangeError("Página de búsqueda inválida");
  const start = (page - 1) * STUDENT_SEARCH_PAGE_SIZE;
  // El wrapper no expone proyección, doble orden ni AbortSignal. Esta lectura
  // acotada no usa getAll ni solicita un count exacto de toda la tabla.
  let query = supabase
    .from("estudiantes")
    .select(`id, ${FIELD_NOMBRE_ESTUDIANTES}, ${FIELD_LEGAJO_ESTUDIANTES}`)
    .ilike(FIELD_ESTADO_ESTUDIANTES, "activo")
    .or(studentSearchFilter(normalized))
    .order(FIELD_NOMBRE_ESTUDIANTES, { ascending: true })
    .order("id", { ascending: true })
    .range(start, start + STUDENT_SEARCH_PAGE_SIZE);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw classifyDbError(error, { table: "estudiantes", operation: "search" });
  const rows = (data ?? []) as unknown as StudentSearchResult[];
  return {
    students: rows.slice(0, STUDENT_SEARCH_PAGE_SIZE),
    hasNextPage: rows.length > STUDENT_SEARCH_PAGE_SIZE,
  };
}
