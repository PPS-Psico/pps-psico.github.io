import * as C from "../constants";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import type { Estudiante, SolicitudPPS } from "../types";
import { Database } from "../types/supabase";
import { fetchStudentData } from "./estudiantesService";

export const fetchSolicitudes = async (
  legajo: string,
  studentId: string | null
): Promise<SolicitudPPS[]> => {
  let targetId = studentId;
  if (!targetId) {
    const { studentId: fetchedId } = await fetchStudentData(legajo);
    targetId = fetchedId;
  }
  if (!targetId) return [];

  const { data, error } = await supabase
    .from(C.TABLE_NAME_PPS)
    .select(
      `
          *,
          estudiante:estudiantes!fk_solicitud_estudiante (
            nombre, legajo, correo
          )
      `
    )
    .eq(C.FIELD_LEGAJO_PPS, targetId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching solicitudes:", error);
    return [];
  }

  type RawSolicitudJoin = SolicitudPPS & { estudiante: Estudiante | Estudiante[] | null };

  const mappedRecords = (data as unknown as RawSolicitudJoin[]).map((r) => {
    const student = Array.isArray(r.estudiante) ? r.estudiante[0] : r.estudiante;
    return {
      ...r,
      [C.FIELD_SOLICITUD_NOMBRE_ALUMNO]:
        student?.nombre || r[C.FIELD_SOLICITUD_NOMBRE_ALUMNO] || "Estudiante",
      [C.FIELD_SOLICITUD_LEGAJO_ALUMNO]: student?.legajo || r[C.FIELD_SOLICITUD_LEGAJO_ALUMNO],
      [C.FIELD_SOLICITUD_EMAIL_ALUMNO]: student?.correo || r[C.FIELD_SOLICITUD_EMAIL_ALUMNO],
    };
  });

  return mappedRecords.filter((r) => r[C.FIELD_ESTADO_PPS] !== "Archivado") as SolicitudPPS[];
};

export const uploadSolicitudFile = async (
  file: File,
  studentId: string,
  type: "modificacion" | "nueva_pps",
  category: string
): Promise<string> => {
  if (!studentId) throw new Error("No student ID");
  const fileExt = file.name.split(".").pop();
  const fileName = `${studentId}/${type}/${category}_${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage
    .from("documentos_estudiantes")
    .upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("documentos_estudiantes").getPublicUrl(fileName);
  return data.publicUrl;
};

export const submitSolicitudModificacion = async (
  studentId: string,
  practicaId: string,
  tipoModificacion: "horas" | "eliminacion",
  horasNuevas: number | null,
  planillaAsistenciaUrl: string | null
) => {
  const record: Database["public"]["Tables"]["solicitudes_modificacion_pps"]["Insert"] = {
    estudiante_id: studentId,
    practica_id: practicaId,
    tipo_modificacion: tipoModificacion,
    horas_nuevas: horasNuevas,
    planilla_asistencia_url: planillaAsistenciaUrl,
    estado: "pendiente",
    comentario_rechazo: null,
    notas_admin: null,
  };
  const { data, error } = await supabase
    .from("solicitudes_modificacion_pps")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const submitSolicitudNuevaPPS = async (
  studentId: string,
  data: {
    institucionId: string | null;
    nombreInstitucionManual: string | null;
    orientacion: string;
    fechaInicio: string;
    fechaFinalizacion: string;
    horasEstimadas: number;
    planillaAsistenciaUrl: string | null;
    informeFinalUrl: string;
    esOnline: boolean;
  }
) => {
  const record: Database["public"]["Tables"]["solicitudes_nueva_pps"]["Insert"] = {
    estudiante_id: studentId,
    institucion_id: data.institucionId,
    nombre_institucion_manual: data.nombreInstitucionManual,
    orientacion: data.orientacion,
    fecha_inicio: data.fechaInicio,
    fecha_finalizacion: data.fechaFinalizacion,
    horas_estimadas: data.horasEstimadas,
    planilla_asistencia_url: data.planillaAsistenciaUrl,
    informe_final_url: data.informeFinalUrl,
    es_online: data.esOnline,
    estado: "pendiente",
    comentario_rechazo: null,
    notas_admin: null,
  };
  const { data: inserted, error } = await supabase
    .from("solicitudes_nueva_pps")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return inserted;
};

export const fetchSolicitudesModificacionByStudent = async (studentId: string) => {
  const { data, error } = await supabase
    .from("solicitudes_modificacion_pps")
    .select(
      `
      *,
      practica:practicas(*)
    `
    )
    .eq("estudiante_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchSolicitudesNuevaPPSByStudent = async (studentId: string) => {
  const { data, error } = await supabase
    .from("solicitudes_nueva_pps")
    .select(
      `
      *,
      institucion:instituciones(id, nombre)
    `
    )
    .eq("estudiante_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchAllSolicitudesModificacion = async (estado?: string) => {
  let query = supabase
    .from("solicitudes_modificacion_pps")
    .select(
      `
      *,
      estudiante:estudiantes(id, nombre, legajo, correo),
      practica:practicas(*)
    `
    )
    .order("created_at", { ascending: false });

  if (estado) {
    query = query.eq("estado", estado);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const fetchAllSolicitudesNuevaPPS = async (estado?: string) => {
  let query = supabase
    .from("solicitudes_nueva_pps")
    .select(
      `
      *,
      estudiante:estudiantes(id, nombre, legajo, correo),
      institucion:instituciones(id, nombre)
    `
    )
    .order("created_at", { ascending: false });

  if (estado) {
    query = query.eq("estado", estado);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const approveSolicitudModificacion = async (solicitudId: string, notasAdmin?: string) => {
  const { data: solicitud, error: fetchError } = await supabase
    .from("solicitudes_modificacion_pps")
    .select("*, practica:practicas(*)")
    .eq("id", solicitudId)
    .single();

  if (fetchError) throw fetchError;
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "pendiente") throw new Error("La solicitud ya fue procesada");

  const { error: updateError } = await supabase
    .from("solicitudes_modificacion_pps")
    .update({ estado: "aprobada", notas_admin: notasAdmin })
    .eq("id", solicitudId);

  if (updateError) throw updateError;

  if (solicitud.tipo_modificacion === "horas" && solicitud.horas_nuevas) {
    const { error: practicaError } = await supabase
      .from("practicas")
      .update({ horas_realizadas: solicitud.horas_nuevas })
      .eq("id", solicitud.practica_id);

    if (practicaError) throw practicaError;
  }

  return solicitud;
};

export const rejectSolicitudModificacion = async (
  solicitudId: string,
  comentarioRechazo: string,
  notasAdmin?: string
) => {
  const { error } = await supabase
    .from("solicitudes_modificacion_pps")
    .update({
      estado: "rechazada",
      comentario_rechazo: comentarioRechazo,
      notas_admin: notasAdmin,
    })
    .eq("id", solicitudId);

  if (error) throw error;
};

export const approveSolicitudNuevaPPS = async (solicitudId: string, notasAdmin?: string) => {
  const { data: solicitud, error: fetchError } = await supabase
    .from("solicitudes_nueva_pps")
    .select(
      `
      *,
      institucion:instituciones(nombre)
    `
    )
    .eq("id", solicitudId)
    .single();

  if (fetchError) throw fetchError;
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "pendiente") throw new Error("La solicitud ya fue procesada");

  const instData = (solicitud as any).institucion;
  const nombreInstitucion =
    (Array.isArray(instData) ? instData[0]?.nombre : instData?.nombre) ||
    solicitud.nombre_institucion_manual ||
    "Institución desconocida";

  const practicaRecord: Database["public"]["Tables"]["practicas"]["Insert"] = {
    estudiante_id: solicitud.estudiante_id,
    especialidad: solicitud.orientacion,
    fecha_inicio: solicitud.fecha_inicio,
    fecha_finalizacion: solicitud.fecha_finalizacion,
    horas_realizadas: solicitud.horas_estimadas,
    estado: "Finalizada",
    nota: null,
    lanzamiento_id: null,
    nombre_institucion: nombreInstitucion,
  };

  const { data: practica, error: practicaError } = await supabase
    .from("practicas")
    .insert(practicaRecord)
    .select()
    .single();

  if (practicaError) throw practicaError;

  const { error: updateError } = await supabase
    .from("solicitudes_nueva_pps")
    .update({ estado: "aprobada", notas_admin: notasAdmin })
    .eq("id", solicitudId);

  if (updateError) throw updateError;

  return { solicitud, practica };
};

export const rejectSolicitudNuevaPPS = async (
  solicitudId: string,
  comentarioRechazo: string,
  notasAdmin?: string
) => {
  const { error } = await supabase
    .from("solicitudes_nueva_pps")
    .update({
      estado: "rechazada",
      comentario_rechazo: comentarioRechazo,
      notas_admin: notasAdmin,
    })
    .eq("id", solicitudId);

  if (error) throw error;
};
