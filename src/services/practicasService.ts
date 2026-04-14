import * as C from "../constants";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import type { Practica } from "../types";
import { cleanDbValue } from "../utils/formatters";
import { fetchStudentData } from "./estudiantesService";

export const fetchPracticas = async (legajo: string): Promise<Practica[]> => {
  const { studentId } = await fetchStudentData(legajo);
  if (!studentId) return [];

  const { data, error } = await supabase
    .from("practicas")
    .select(
      `
          *,
          lanzamiento:lanzamientos_pps!fk_practica_lanzamiento (
              nombre_pps,
              orientacion,
              fecha_inicio,
              fecha_finalizacion
          )
      `
    )
    .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentId);

  if (error || !data) {
    console.error("Error fetching practicas:", error);
    return [];
  }

  type RawPracticaRow = Practica & {
    lanzamiento:
      | {
          nombre_pps: string | null;
          orientacion: string | null;
          fecha_inicio: string | null;
          fecha_finalizacion: string | null;
        }
      | {
          nombre_pps: string | null;
          orientacion: string | null;
          fecha_inicio: string | null;
          fecha_finalizacion: string | null;
        }[]
      | null;
  };

  return (data as unknown as RawPracticaRow[]).map((row) => {
    type JoinedLanzamiento = {
      nombre_pps: string | null;
      orientacion: string | null;
      fecha_inicio: string | null;
      fecha_finalizacion: string | null;
    };

    let lanzamiento: JoinedLanzamiento | null = null;
    if (row.lanzamiento) {
      if (Array.isArray(row.lanzamiento)) {
        lanzamiento = row.lanzamiento[0] as JoinedLanzamiento;
      } else {
        lanzamiento = row.lanzamiento as unknown as JoinedLanzamiento;
      }
    }

    const rawName =
      row[C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] ||
      lanzamiento?.nombre_pps ||
      "Institución desconocida";
    const finalName = cleanDbValue(rawName);

    const updatedRow = { ...row } as Practica;

    if (!updatedRow[C.FIELD_FECHA_INICIO_PRACTICAS] && lanzamiento?.fecha_inicio) {
      updatedRow[C.FIELD_FECHA_INICIO_PRACTICAS] = lanzamiento.fecha_inicio;
    }
    if (!updatedRow[C.FIELD_FECHA_FIN_PRACTICAS] && lanzamiento?.fecha_finalizacion) {
      updatedRow[C.FIELD_FECHA_FIN_PRACTICAS] = lanzamiento.fecha_finalizacion;
    }
    if (!updatedRow[C.FIELD_ESPECIALIDAD_PRACTICAS] && lanzamiento?.orientacion) {
      updatedRow[C.FIELD_ESPECIALIDAD_PRACTICAS] = lanzamiento.orientacion;
    }

    updatedRow[C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] = finalName;

    return updatedRow;
  });
};

export const deletePractica = async (practicaId: string) => {
  const { error } = await supabase.from("practicas").delete().eq("id", practicaId);

  if (error) throw error;
};

export const updatePracticaFromSchedule = async (
  studentId: string,
  lanzamientoId: string,
  newSchedule: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const match = newSchedule.match(/\[(.*)\]/);
    if (!match) return { success: true };

    const newOrientacion = cleanDbValue(match[1].trim());

    const { error } = await supabase
      .from("practicas")
      .update({ [C.FIELD_ESPECIALIDAD_PRACTICAS]: newOrientacion })
      .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentId)
      .eq(C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, lanzamientoId);

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error(`[DATA SERVICE] Error updating practice orientation:`, e);
    return { success: false, error: (e as Error).message };
  }
};
