import * as C from "../constants";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import type { Estudiante, SolicitudPPS } from "../types";
import { Database } from "../types/supabase";
import { getPenaltyScore, type PenaltyType, type PpsWithdrawalReason } from "../constants";
import { fetchStudentData } from "./estudiantesService";
import { logger } from "../utils/logger";

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
    logger.error("Error fetching solicitudes:", error);
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

import { mockDb } from "./mockDb";

export const uploadSolicitudFile = async (
  file: File,
  studentId: string,
  type: "modificacion" | "nueva_pps",
  category: string
): Promise<string> => {
  if (studentId === "st_999") {
    return `https://example.com/mock-documents/${category}_${Date.now()}.pdf`;
  }
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
  const record = {
    estudiante_id: studentId,
    practica_id: practicaId,
    tipo_modificacion: tipoModificacion,
    horas_nuevas: horasNuevas,
    planilla_asistencia_url: planillaAsistenciaUrl,
    estado: "pendiente" as const,
    comentario_rechazo: null,
    notas_admin: null,
  };
  if (studentId === "st_999") {
    return await mockDb.create("solicitudes_modificacion_pps", record);
  }
  const { data, error } = await supabase
    .from("solicitudes_modificacion_pps")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const submitSolicitudBajaPps = async (
  studentId: string,
  practicaId: string,
  motivoBaja: PpsWithdrawalReason,
  motivoBajaDetalle: string
) => {
  if (studentId === "st_999") {
    const practicas = await mockDb.getAll("practicas", { id: practicaId });
    const practica = practicas[0];
    if (!practica) throw new Error("No se encontró la PPS que intentás dar de baja.");

    return await mockDb.create("solicitudes_modificacion_pps", {
      estudiante_id: studentId,
      practica_id: practicaId,
      tipo_modificacion: "eliminacion",
      horas_nuevas: null,
      planilla_asistencia_url: null,
      estado: "pendiente",
      comentario_rechazo: null,
      notas_admin: null,
      motivo_baja: motivoBaja,
      motivo_baja_detalle: motivoBajaDetalle.trim(),
      lanzamiento_id: practica.lanzamiento_id ?? null,
      convocatoria_id: null,
      nombre_pps_snapshot: practica.nombre_institucion ?? "PPS",
      fecha_inicio_snapshot: practica.fecha_inicio?.slice(0, 10) ?? null,
      estado_practica_snapshot: practica.estado ?? "En curso",
      resuelta_at: null,
      resuelta_por: null,
      penalizacion_id: null,
      tipo_penalizacion_aplicada: null,
      puntaje_penalizacion_aplicado: null,
    });
  }

  const { data, error } = await supabase.rpc("create_my_solicitud_baja_pps_v1", {
    p_practica_id: practicaId,
    p_motivo_baja: motivoBaja,
    p_motivo_baja_detalle: motivoBajaDetalle.trim(),
  });

  if (error) throw error;
  return data;
};

export interface ResolveSolicitudBajaInput {
  solicitudId: string;
  decision: "aprobar" | "rechazar";
  tipoIncumplimiento?: PenaltyType;
  notasAdmin?: string;
  comentarioRechazo?: string;
}

export const resolveSolicitudBajaPps = async ({
  solicitudId,
  decision,
  tipoIncumplimiento,
  notasAdmin,
  comentarioRechazo,
}: ResolveSolicitudBajaInput) => {
  if (solicitudId.startsWith("mock_")) {
    const requests = await mockDb.getAll("solicitudes_modificacion_pps", { id: solicitudId });
    const request = requests[0];
    if (!request) throw new Error("No se encontró la solicitud de baja.");
    if (request.estado !== "pendiente") throw new Error("La solicitud ya fue procesada.");

    if (decision === "rechazar") {
      if (!comentarioRechazo?.trim()) throw new Error("Ingresá el motivo del rechazo.");
      await mockDb.update("solicitudes_modificacion_pps", solicitudId, {
        estado: "rechazada",
        comentario_rechazo: comentarioRechazo.trim(),
        notas_admin: notasAdmin?.trim() || null,
        resuelta_at: new Date().toISOString(),
      });
      return { estado: "rechazada", penalizacionId: null, practicasEliminadas: 0 };
    }

    if (!tipoIncumplimiento) throw new Error("Elegí un tipo de baja válido.");
    if (request.practica_id) await mockDb.delete("practicas", request.practica_id);
    if (request.convocatoria_id) {
      await mockDb.update("convocatorias", request.convocatoria_id, {
        estado_inscripcion: "No Seleccionado",
      });
    }
    const penalty = await mockDb.create("penalizaciones", {
      estudiante_id: request.estudiante_id,
      tipo_incumplimiento: tipoIncumplimiento,
      fecha_incidente: String(request.created_at || new Date().toISOString()).slice(0, 10),
      notas: [request.motivo_baja_detalle, notasAdmin].filter(Boolean).join("\n\n"),
      puntaje_penalizacion: getPenaltyScore(tipoIncumplimiento),
      convocatoria_afectada: request.nombre_pps_snapshot || "PPS",
      convocatoria_id: request.convocatoria_id ?? null,
      lanzamiento_id: request.lanzamiento_id ?? null,
      estado: "Activa",
    });
    await mockDb.update("solicitudes_modificacion_pps", solicitudId, {
      estado: "aprobada",
      notas_admin: notasAdmin?.trim() || null,
      resuelta_at: new Date().toISOString(),
      practica_id: null,
      penalizacion_id: penalty.id,
      tipo_penalizacion_aplicada: tipoIncumplimiento,
      puntaje_penalizacion_aplicado: getPenaltyScore(tipoIncumplimiento),
    });
    return { estado: "aprobada", penalizacionId: penalty.id, practicasEliminadas: 1 };
  }

  const { data, error } = await supabase.rpc("resolver_solicitud_baja_pps_v1", {
    p_solicitud_id: solicitudId,
    p_decision: decision,
    ...(tipoIncumplimiento ? { p_tipo_incumplimiento: tipoIncumplimiento } : {}),
    ...(notasAdmin?.trim() ? { p_notas_admin: notasAdmin.trim() } : {}),
    ...(comentarioRechazo?.trim() ? { p_comentario_rechazo: comentarioRechazo.trim() } : {}),
  });

  if (error) throw error;
  const result = data?.[0];
  if (!result) throw new Error("La base no confirmó la resolución de la solicitud.");
  return {
    estado: result.estado,
    penalizacionId: result.penalizacion_id || null,
    practicasEliminadas: result.practicas_eliminadas,
  };
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
    informeFinalUrl: string | null;
    esOnline: boolean;
  }
) => {
  const record = {
    estudiante_id: studentId,
    institucion_id: data.institucionId,
    nombre_institucion_manual: data.nombreInstitucionManual,
    orientacion: data.orientacion,
    fecha_inicio: data.fechaInicio,
    fecha_finalizacion: data.fechaFinalizacion,
    horas_estimadas: data.horasEstimadas,
    planilla_asistencia_url: data.planillaAsistenciaUrl,
    informe_final_url: data.informeFinalUrl ?? "",
    es_online: data.esOnline,
    estado: "pendiente" as const,
    comentario_rechazo: null,
    notas_admin: null,
  };
  if (studentId === "st_999") {
    return await mockDb.create("solicitudes_nueva_pps", record);
  }
  const { data: inserted, error } = await supabase
    .from("solicitudes_nueva_pps")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return inserted;
};

export const fetchSolicitudesModificacionByStudent = async (studentId: string) => {
  if (studentId === "st_999") {
    return await mockDb.getAll("solicitudes_modificacion_pps", { estudiante_id: studentId });
  }
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
  if (studentId === "st_999") {
    const list = await mockDb.getAll("solicitudes_nueva_pps", { estudiante_id: studentId });
    for (const item of list) {
      if (item.institucion_id) {
        const insts = await mockDb.getAll("instituciones", { id: item.institucion_id });
        if (insts.length > 0) {
          item.institucion = { id: insts[0].id, nombre: insts[0].nombre };
        }
      }
    }
    return list;
  }
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

export const fetchAllSolicitudesModificacion = async (estado?: string, isTestingMode = false) => {
  if (isTestingMode) {
    let list = await mockDb.getAll("solicitudes_modificacion_pps");
    if (estado) {
      list = list.filter((r: any) => r.estado === estado);
    }
    for (const item of list) {
      const studs = await mockDb.getAll("estudiantes", { id: item.estudiante_id });
      if (studs.length > 0) {
        item.estudiante = {
          id: studs[0].id,
          nombre: studs[0].nombre,
          legajo: studs[0].legajo,
          correo: studs[0].correo,
        };
      }
      const practs = await mockDb.getAll("practicas", { id: item.practica_id });
      if (practs.length > 0) {
        item.practica = practs[0];
      }
    }
    return list;
  }
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

export const fetchAllSolicitudesNuevaPPS = async (estado?: string, isTestingMode = false) => {
  if (isTestingMode) {
    let list = await mockDb.getAll("solicitudes_nueva_pps");
    if (estado) {
      list = list.filter((r: any) => r.estado === estado);
    }
    for (const item of list) {
      const studs = await mockDb.getAll("estudiantes", { id: item.estudiante_id });
      if (studs.length > 0) {
        item.estudiante = {
          id: studs[0].id,
          nombre: studs[0].nombre,
          legajo: studs[0].legajo,
          correo: studs[0].correo,
        };
      }
      if (item.institucion_id) {
        const insts = await mockDb.getAll("instituciones", { id: item.institucion_id });
        if (insts.length > 0) {
          item.institucion = { id: insts[0].id, nombre: insts[0].nombre };
        }
      }
    }
    return list;
  }
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
  if (solicitudId.startsWith("mock_")) {
    const solicitudes = await mockDb.getAll("solicitudes_modificacion_pps", { id: solicitudId });
    const solicitud = solicitudes[0];
    if (!solicitud) throw new Error("Solicitud no encontrada");
    if (solicitud.tipo_modificacion === "eliminacion") {
      throw new Error("Las solicitudes de baja deben resolverse con su penalización asociada.");
    }
    await mockDb.update("solicitudes_modificacion_pps", solicitudId, {
      estado: "aprobada",
      notas_admin: notasAdmin,
    });
    if (solicitud.tipo_modificacion === "horas" && solicitud.horas_nuevas) {
      await mockDb.update("practicas", solicitud.practica_id, {
        horas_realizadas: solicitud.horas_nuevas,
      });
    }
    return solicitud;
  }
  const { data: solicitud, error: fetchError } = await supabase
    .from("solicitudes_modificacion_pps")
    .select("*, practica:practicas(*)")
    .eq("id", solicitudId)
    .single();

  if (fetchError) throw fetchError;
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "pendiente") throw new Error("La solicitud ya fue procesada");
  if (solicitud.tipo_modificacion === "eliminacion") {
    throw new Error("Las solicitudes de baja deben resolverse con su penalización asociada.");
  }
  const practicaId = solicitud.practica_id;
  if (solicitud.tipo_modificacion === "horas" && solicitud.horas_nuevas && !practicaId) {
    throw new Error("La solicitud de horas ya no tiene una práctica asociada.");
  }

  const { error: updateError } = await supabase
    .from("solicitudes_modificacion_pps")
    .update({ estado: "aprobada", notas_admin: notasAdmin })
    .eq("id", solicitudId);

  if (updateError) throw updateError;

  if (solicitud.tipo_modificacion === "horas" && solicitud.horas_nuevas) {
    const { error: practicaError } = await supabase
      .from("practicas")
      .update({ horas_realizadas: solicitud.horas_nuevas })
      .eq("id", practicaId as string);

    if (practicaError) throw practicaError;
  }

  return solicitud;
};

export const rejectSolicitudModificacion = async (
  solicitudId: string,
  comentarioRechazo: string,
  notasAdmin?: string
) => {
  if (solicitudId.startsWith("mock_")) {
    await mockDb.update("solicitudes_modificacion_pps", solicitudId, {
      estado: "rechazada",
      comentario_rechazo: comentarioRechazo,
      notas_admin: notasAdmin,
    });
    return;
  }
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
  if (solicitudId.startsWith("mock_")) {
    const solicitud = (await mockDb.update("solicitudes_nueva_pps", solicitudId, {
      estado: "aprobada",
      notas_admin: notasAdmin,
    })) as any;
    let nombreInstitucion = solicitud.nombre_institucion_manual || "Institución desconocida";
    if (solicitud.institucion_id) {
      const insts = await mockDb.getAll("instituciones", { id: solicitud.institucion_id });
      if (insts.length > 0) {
        nombreInstitucion = insts[0].nombre;
      }
    }
    const practicaRecord = {
      estudiante_id: solicitud.estudiante_id,
      especialidad: solicitud.orientacion,
      fecha_inicio: solicitud.fecha_inicio,
      fecha_finalizacion: solicitud.fecha_finalizacion,
      horas_realizadas: solicitud.horas_estimadas,
      estado: "Finalizada",
      nota: null,
      lanzamiento_id: null,
      nombre_institucion: nombreInstitucion,
      es_online: solicitud.es_online ?? false,
    };
    const practica = await mockDb.create("practicas", practicaRecord);
    return { solicitud, practica };
  }
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

  const instData = (
    solicitud as { institucion?: { nombre?: string } | { nombre?: string }[] | null }
  ).institucion;
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
    es_online: solicitud.es_online ?? false,
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
  if (solicitudId.startsWith("mock_")) {
    await mockDb.update("solicitudes_nueva_pps", solicitudId, {
      estado: "rechazada",
      comentario_rechazo: comentarioRechazo,
      notas_admin: notasAdmin,
    });
    return;
  }
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
