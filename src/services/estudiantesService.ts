import * as C from "../constants";
import { supabase } from "../lib/supabaseClient";
import type { Estudiante } from "../types";

export const fetchStudentData = async (
  legajo: string
): Promise<{ studentDetails: Estudiante | null; studentId: string | null }> => {
  const { data, error } = await supabase
    .from("estudiantes")
    .select("*")
    .eq(C.FIELD_LEGAJO_ESTUDIANTES, legajo)
    .maybeSingle();

  const studentData = data as Estudiante | null;
  if (error || !studentData) {
    console.warn("Estudiante no encontrado por legajo:", legajo);
    return { studentDetails: null, studentId: null };
  }

  return { studentDetails: studentData, studentId: studentData.id };
};
