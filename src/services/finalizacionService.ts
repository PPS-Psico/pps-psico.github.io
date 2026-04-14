import * as C from "../constants";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import type { FinalizacionPPS } from "../types";
import { Database } from "../types/supabase";
import { fetchStudentData } from "./estudiantesService";

export const fetchFinalizacionRequest = async (
  legajo: string,
  studentId: string | null
): Promise<FinalizacionPPS | null> => {
  try {
    let targetId = studentId;
    if (!targetId) {
      const { studentId: fetchedId } = await fetchStudentData(legajo);
      targetId = fetchedId;
    }
    if (!targetId) return null;

    const records = await db.finalizacion.get({
      filters: { [C.FIELD_ESTUDIANTE_FINALIZACION]: targetId },
      sort: [{ field: "created_at", direction: "desc" }],
      maxRecords: 1,
    });

    if (!records || records.length === 0) return null;
    return records[0];
  } catch (error) {
    console.warn("Suppressing error in fetchFinalizacionRequest:", error);
    return null;
  }
};

export const uploadFinalizationFile = async (
  file: File,
  studentId: string,
  type: "informe" | "horas" | "asistencia"
): Promise<string> => {
  if (!studentId) throw new Error("No student ID");
  const fileExt = file.name.split(".").pop();
  const fileName = `${studentId}/${type}_${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage
    .from("documentos_finalizacion")
    .upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("documentos_finalizacion").getPublicUrl(fileName);
  return data.publicUrl;
};

export const submitFinalizationRequest = async (studentId: string, data: any) => {
  const record: Database["public"]["Tables"]["finalizacion_pps"]["Insert"] = {
    [C.FIELD_ESTUDIANTE_FINALIZACION]: studentId,
    [C.FIELD_FECHA_SOLICITUD_FINALIZACION]: new Date().toISOString(),
    [C.FIELD_ESTADO_FINALIZACION]: "Pendiente",
    [C.FIELD_INFORME_FINAL_FINALIZACION]: JSON.stringify(data.informes),
    [C.FIELD_PLANILLA_HORAS_FINALIZACION]: JSON.stringify(data.horas),
    [C.FIELD_PLANILLA_ASISTENCIA_FINALIZACION]: JSON.stringify(data.asistencias),
    [C.FIELD_SUGERENCIAS_MEJORAS_FINALIZACION]: data.sugerencias,
  };
  await db.finalizacion.create(record);
};

export const deleteFinalizationRequest = async (
  id: string
): Promise<{ success: boolean; error: any }> => {
  try {
    await db.finalizacion.delete(id);
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e };
  }
};
