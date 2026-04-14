import * as C from "../constants";
import { supabase } from "../lib/supabaseClient";
import type { InformeCorreccionPPS } from "../types";
import { cleanInstitutionName, safeGetId } from "../utils/formatters";

export const fetchCorrectionPanelData = async (): Promise<Map<string, InformeCorreccionPPS>> => {
  const { data: convocatoriasData, error: convError } = await supabase
    .from(C.TABLE_NAME_CONVOCATORIAS)
    .select(
      `
            *,
            estudiante:estudiantes!fk_convocatoria_estudiante (id, nombre, legajo),
            lanzamiento:lanzamientos_pps!fk_convocatoria_lanzamiento (id, nombre_pps, orientacion, informe, fecha_finalizacion, fecha_inicio)
        `
    )
    .ilike(C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS, "%seleccionado%");

  if (convError) throw convError;
  if (!convocatoriasData) return new Map();

  const studentIds = new Set<string>();
  const lanzamientoIds = new Set<string>();

  interface RawConvocatoriaJoin {
    estudiante_id?: unknown;
    lanzamiento_id?: unknown;
    id: string;
    [key: string]: any;
    estudiante:
      | { id: string; nombre: string | null; legajo: string | null }
      | { id: string; nombre: string | null; legajo: string | null }[]
      | null;
    lanzamiento:
      | {
          id: string;
          nombre_pps: string | null;
          orientacion: string | null;
          informe: string | null;
          fecha_finalizacion: string | null;
          fecha_inicio: string | null;
        }
      | {
          id: string;
          nombre_pps: string | null;
          orientacion: string | null;
          informe: string | null;
          fecha_finalizacion: string | null;
          fecha_inicio: string | null;
        }[]
      | null;
  }

  (convocatoriasData as unknown as RawConvocatoriaJoin[]).forEach((c) => {
    const sId =
      (Array.isArray(c.estudiante) ? c.estudiante[0]?.id : c.estudiante?.id) ||
      safeGetId(c.estudiante_id);
    const lId =
      (Array.isArray(c.lanzamiento) ? c.lanzamiento[0]?.id : c.lanzamiento?.id) ||
      safeGetId(c.lanzamiento_id);

    if (sId) studentIds.add(sId);
    if (lId) lanzamientoIds.add(lId);
  });

  let practicasData: any[] = [];
  if (studentIds.size > 0 && lanzamientoIds.size > 0) {
    const { data: pData } = await supabase
      .from(C.TABLE_NAME_PRACTICAS)
      .select("*")
      .in(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, Array.from(studentIds))
      .in(C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, Array.from(lanzamientoIds));
    if (pData) practicasData = pData;
  }

  const practicasMap = new Map<string, any>();
  practicasData.forEach((p: any) => {
    const sId = safeGetId(p[C.FIELD_ESTUDIANTE_LINK_PRACTICAS]);
    const lId = safeGetId(p[C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]);
    if (sId && lId) practicasMap.set(`${sId}-${lId}`, p);
  });

  const ppsGroups = new Map<string, InformeCorreccionPPS>();
  (convocatoriasData as unknown as RawConvocatoriaJoin[]).forEach((conv) => {
    const lanzamiento = Array.isArray(conv.lanzamiento) ? conv.lanzamiento[0] : conv.lanzamiento;
    const student = Array.isArray(conv.estudiante) ? conv.estudiante[0] : conv.estudiante;

    if (!lanzamiento || !student) return;

    const lId = lanzamiento.id;
    if (!ppsGroups.has(lId)) {
      ppsGroups.set(lId, {
        lanzamientoId: lId,
        ppsName: cleanInstitutionName(lanzamiento.nombre_pps),
        orientacion: lanzamiento.orientacion,
        informeLink: lanzamiento.informe,
        fechaFinalizacion: lanzamiento.fecha_finalizacion,
        students: [],
      });
    }

    const practicaRecord = practicasMap.get(`${student.id}-${lId}`);
    ppsGroups.get(lId)!.students.push({
      studentId: student.id,
      studentName: student.nombre || "Desconocido",
      convocatoriaId: conv.id,
      practicaId: practicaRecord?.id || null,
      informeSubido: conv[C.FIELD_INFORME_SUBIDO_CONVOCATORIAS] || false,
      nota: practicaRecord?.[C.FIELD_NOTA_PRACTICAS] || "Sin calificar",
      lanzamientoId: lId,
      orientacion: lanzamiento.orientacion,
      fechaFinalizacionPPS: lanzamiento.fecha_finalizacion,
      fechaEntregaInforme: conv[C.FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS],
    });
  });

  return ppsGroups;
};
