import * as C from "../constants";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import type { FinalizacionPPS } from "../types";
import { Database } from "../types/supabase";
import { fetchStudentData } from "./estudiantesService";
import { logger } from "../utils/logger";
import type { DetallePracticas } from "../utils/acreditacion";

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
    logger.warn("Suppressing error in fetchFinalizacionRequest:", error);
    return null;
  }
};

export const uploadFinalizationFile = async (
  file: File,
  studentId: string,
  type: "informe" | "horas" | "asistencia",
  practicaId?: string
): Promise<string> => {
  if (!studentId) throw new Error("No student ID");
  const fileExt = file.name.split(".").pop();
  const scope = practicaId ? `${studentId}/${practicaId}` : studentId;
  const fileName = `${scope}/${type}_${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage
    .from("documentos_finalizacion")
    .upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("documentos_finalizacion").getPublicUrl(fileName);
  return data.publicUrl;
};

/**
 * Trámite de acreditación por PPS (flujo guiado nuevo).
 * Guarda el snapshot `detalle_practicas`, agrega los informes/asistencias a las
 * columnas legacy (para el ZIP y retrocompat), y hace write-through de nota +
 * fecha de finalización a cada práctica.
 */
export const submitFinalizationRequest = async (
  studentId: string,
  data: {
    detalle: DetallePracticas;
    sugerencias?: string | null;
  }
) => {
  const { detalle } = data;

  // Agregados legacy: todos los informes / asistencias en un solo array.
  const informesAgg = detalle.items
    .filter((i) => i.informe)
    .map((i) => ({ url: i.informe!.url, filename: i.informe!.filename }));
  const asistenciasAgg = detalle.items
    .filter((i) => i.asistencia)
    .map((i) => ({ url: i.asistencia!.url, filename: i.asistencia!.filename }));

  const record: Database["public"]["Tables"]["finalizacion_pps"]["Insert"] = {
    [C.FIELD_ESTUDIANTE_FINALIZACION]: studentId,
    [C.FIELD_FECHA_SOLICITUD_FINALIZACION]: new Date().toISOString(),
    [C.FIELD_ESTADO_FINALIZACION]: "Pendiente",
    [C.FIELD_DETALLE_PRACTICAS_FINALIZACION]:
      detalle as unknown as Database["public"]["Tables"]["finalizacion_pps"]["Insert"]["detalle_practicas"],
    [C.FIELD_INFORME_FINAL_FINALIZACION]: JSON.stringify(informesAgg),
    [C.FIELD_PLANILLA_ASISTENCIA_FINALIZACION]: JSON.stringify(asistenciasAgg),
    [C.FIELD_PLANILLA_HORAS_FINALIZACION]: JSON.stringify([]),
    [C.FIELD_SUGERENCIAS_MEJORAS_FINALIZACION]: data.sugerencias ?? null,
  };

  await db.finalizacion.create(record);

  // Write-through: nota + fecha de finalización a cada práctica.
  await Promise.all(
    detalle.items.map((item) =>
      db.practicas
        .update(item.practicaId, {
          [C.FIELD_NOTA_PRACTICAS]: item.nota || null,
          ...(item.fechaFinalizacion
            ? { [C.FIELD_FECHA_FIN_PRACTICAS]: item.fechaFinalizacion }
            : {}),
        })
        .catch((e) => logger.warn(`No se pudo actualizar la práctica ${item.practicaId}:`, e))
    )
  );
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
