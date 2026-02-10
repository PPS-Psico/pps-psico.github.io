import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import { Database } from "../types/supabase";
import {
  Practica,
  SolicitudPPS,
  LanzamientoPPS,
  Convocatoria,
  GroupedSeleccionados,
  FinalizacionPPS,
  Estudiante,
  InformeCorreccionPPS,
} from "../types";
import * as C from "../constants";
import {
  normalizeStringForComparison,
  safeGetId,
  cleanInstitutionName,
  cleanDbValue,
} from "../utils/formatters";

export const fetchStudentData = async (
  legajo: string
): Promise<{ studentDetails: Estudiante | null; studentAirtableId: string | null }> => {
  const { data, error } = await supabase
    .from("estudiantes")
    .select("*")
    .eq(C.FIELD_LEGAJO_ESTUDIANTES, legajo)
    .maybeSingle();

  const studentData = data as Estudiante | null;
  if (error || !studentData) {
    console.warn("Estudiante no encontrado por legajo:", legajo);
    return { studentDetails: null, studentAirtableId: null };
  }

  return { studentDetails: studentData, studentAirtableId: studentData.id };
};

export const fetchPracticas = async (legajo: string): Promise<Practica[]> => {
  const { studentAirtableId } = await fetchStudentData(legajo);
  if (!studentAirtableId) return [];

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
    .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentAirtableId);

  if (error || !data) {
    console.error("Error fetching practicas:", error);
    return [];
  }

  // define strict type for the raw row from supabase including the join
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

  // Strict type mapping without 'any'
  // We trust that the query structure matches our knowledge because we define it above.
  // The trick is to narrow the type of 'data' which Supabase types as generic record.
  return (data as unknown as RawPracticaRow[]).map((row) => {
    // Supabase returns relations as arrays or single objects depending on relationship (one-to-many vs many-to-one)
    // Since we know the schema, we can safely treat 'lanzamiento' as a potential object or null.
    // We cast 'lanzamiento' to a known shape to avoid TS errors about array checking on unknown types,
    // but we do NOT cast the whole row to 'any'.
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

    // Mutating a copy would be ideal, but for now we follow existing patterns ensuring properties exist
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

    // Set the institution name as a string
    updatedRow[C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] = finalName;

    return updatedRow;
  });
};

export const fetchSolicitudes = async (
  legajo: string,
  studentAirtableId: string | null
): Promise<SolicitudPPS[]> => {
  let targetId = studentAirtableId;
  if (!targetId) {
    const { studentAirtableId: fetchedId } = await fetchStudentData(legajo);
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

  // Use strict type from types.ts
  // Supabase returns arrays for joins sometimes, so we handle that safely
  type RawSolicitudJoin = SolicitudPPS & { estudiante: Estudiante | Estudiante[] | null };

  // Explicitly cast to the known join structure, but NOT to 'any' first.
  // The cast below is necessary because standard Supabase types don't know about our specific runtime Query
  // BUT we cast to a structurally compatible type, not 'any'.
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

export const fetchFinalizacionRequest = async (
  legajo: string,
  studentAirtableId: string | null
): Promise<FinalizacionPPS | null> => {
  try {
    let targetId = studentAirtableId;
    if (!targetId) {
      const { studentAirtableId: fetchedId } = await fetchStudentData(legajo);
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

// Removed unused arguments to fix linter
export const fetchConvocatoriasData = async (
  studentAirtableId: string | null
): Promise<{
  lanzamientos: LanzamientoPPS[];
  myEnrollments: Convocatoria[];
  allLanzamientos: LanzamientoPPS[];
  institutionAddressMap: Map<string, string>;
  institutionLogoMap: Map<string, { url: string; invert: boolean }>;
}> => {
  let myEnrollments: Convocatoria[] = [];
  const enrolledLaunchIds = new Set<string>();

  if (studentAirtableId) {
    const enrollments = await db.convocatorias.getAll({
      filters: { [C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentAirtableId },
    });
    myEnrollments = enrollments;

    myEnrollments.forEach((e) => {
      const lid = e[C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
      if (lid) {
        if (Array.isArray(lid)) lid.forEach((id: string) => enrolledLaunchIds.add(id));
        else enrolledLaunchIds.add(lid as string);
      }
    });
  }

  const openLaunches = await db.lanzamientos.getAll({
    filters: {
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: ["Abierta", "Abierto", "Cerrado"],
    },
    sort: [{ field: C.FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }],
  });

  const openLaunchIds = new Set(openLaunches.map((l) => l.id));
  const missingLaunchIds = Array.from(enrolledLaunchIds).filter((id) => !openLaunchIds.has(id));

  let historicalLaunches: LanzamientoPPS[] = [];
  if (missingLaunchIds.length > 0) {
    historicalLaunches = await db.lanzamientos.getAll({
      filters: { id: missingLaunchIds },
    });
  }

  const allRawLanzamientos = [...openLaunches, ...historicalLaunches];
  const launchesMap = new Map(allRawLanzamientos.map((l) => [l.id, l]));

  const hydratedEnrollments = myEnrollments.map((row) => {
    const launchId = row[C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
    const launch = launchId
      ? Array.isArray(launchId)
        ? launchesMap.get(launchId[0])
        : launchesMap.get(launchId)
      : null;

    return {
      ...row,
      [C.FIELD_NOMBRE_PPS_CONVOCATORIAS]: cleanInstitutionName(
        row[C.FIELD_NOMBRE_PPS_CONVOCATORIAS] || launch?.[C.FIELD_NOMBRE_PPS_LANZAMIENTOS]
      ),
      [C.FIELD_FECHA_INICIO_CONVOCATORIAS]:
        row[C.FIELD_FECHA_INICIO_CONVOCATORIAS] || launch?.[C.FIELD_FECHA_INICIO_LANZAMIENTOS],
      [C.FIELD_FECHA_FIN_CONVOCATORIAS]:
        row[C.FIELD_FECHA_FIN_CONVOCATORIAS] || launch?.[C.FIELD_FECHA_FIN_LANZAMIENTOS],
      [C.FIELD_DIRECCION_CONVOCATORIAS]:
        row[C.FIELD_DIRECCION_CONVOCATORIAS] || launch?.[C.FIELD_DIRECCION_LANZAMIENTOS],
      [C.FIELD_ORIENTACION_CONVOCATORIAS]:
        row[C.FIELD_ORIENTACION_CONVOCATORIAS] || launch?.[C.FIELD_ORIENTACION_LANZAMIENTOS],
      [C.FIELD_HORAS_ACREDITADAS_CONVOCATORIAS]:
        row[C.FIELD_HORAS_ACREDITADAS_CONVOCATORIAS] ||
        launch?.[C.FIELD_HORAS_ACREDITADAS_LANZAMIENTOS],
    } as Convocatoria;
  });

  // CLEAN LAUNCHES FOR UI: Clean the name right here so components get clean data
  const cleanedOpenLaunches = openLaunches.map((l) => ({
    ...l,
    [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: cleanInstitutionName(l[C.FIELD_NOMBRE_PPS_LANZAMIENTOS]),
  }));

  const lanzamientos = cleanedOpenLaunches.filter((l) => {
    const estadoConv = normalizeStringForComparison(l[C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
    const estadoGestion = l[C.FIELD_ESTADO_GESTION_LANZAMIENTOS];

    const publicationDate =
      l[C.FIELD_FECHA_PUBLICACION_LANZAMIENTOS] ||
      l[C.FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS] ||
      l[C.FIELD_FECHA_INICIO_LANZAMIENTOS];
    const isScheduledForFuture = publicationDate ? new Date(publicationDate) > new Date() : false;

    const isClosed =
      normalizeStringForComparison(estadoConv) === "cerrada" ||
      normalizeStringForComparison(estadoConv) === "cerrado";

    return (
      estadoConv !== "oculto" &&
      estadoGestion !== "Archivado" &&
      ["abierta", "abierto", "cerrado", "cerrada"].includes(estadoConv) &&
      (isClosed || !isScheduledForFuture)
    );
  });

  const institutionAddressMap = new Map<string, string>();
  allRawLanzamientos.forEach((l) => {
    const name = cleanInstitutionName(l[C.FIELD_NOMBRE_PPS_LANZAMIENTOS]);
    const address = l[C.FIELD_DIRECCION_LANZAMIENTOS];
    if (name && address) {
      institutionAddressMap.set(normalizeStringForComparison(name), address);
    }
  });

  // Fetch logos
  const institutions = await db.instituciones.getAll({
    fields: [
      C.FIELD_NOMBRE_INSTITUCIONES,
      C.FIELD_LOGO_URL_INSTITUCIONES,
      C.FIELD_LOGO_INVERT_DARK_INSTITUCIONES,
    ],
  });

  const institutionLogoMap = new Map<string, { url: string; invert: boolean }>();
  institutions.forEach((inst: any) => {
    const name = cleanInstitutionName(inst[C.FIELD_NOMBRE_INSTITUCIONES]);
    const url = inst[C.FIELD_LOGO_URL_INSTITUCIONES];
    const invert = inst[C.FIELD_LOGO_INVERT_DARK_INSTITUCIONES];
    if (name && url) {
      institutionLogoMap.set(normalizeStringForComparison(name), { url, invert: !!invert });
    }
  });

  return {
    lanzamientos,
    myEnrollments: hydratedEnrollments,
    allLanzamientos: allRawLanzamientos,
    institutionAddressMap,
    institutionLogoMap,
  };
};

export const fetchSeleccionados = async (
  lanzamiento: LanzamientoPPS
): Promise<GroupedSeleccionados | null> => {
  const lanzamientoId = lanzamiento.id;
  if (!lanzamientoId) return null;

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_postulantes_seleccionados", {
      lanzamiento_uuid: lanzamientoId,
    } as any);

    if (!rpcError && rpcData) {
      const grouped: GroupedSeleccionados = {};
      // Define RPC result type
      interface PostulanteRPC {
        horario?: string;
        nombre?: string;
        legajo?: string;
      }

      (rpcData as any as PostulanteRPC[]).forEach((row) => {
        const horario = row.horario || "No especificado";
        if (!grouped[horario]) grouped[horario] = [];

        grouped[horario].push({
          nombre: row.nombre || "Estudiante",
          legajo: row.legajo || "---",
        });
      });

      if (Object.keys(grouped).length === 0) return null;

      for (const horario in grouped) {
        grouped[horario].sort((a, b) => a.nombre.localeCompare(b.nombre));
      }
      return grouped;
    }
  } catch (e) {
    // Fallback or ignore RPC error
  }

  const enrollments = await db.convocatorias.getAll({
    filters: { [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzamientoId },
  });

  const selectedEnrollments = enrollments.filter((e) => {
    const status = String(e[C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "").toLowerCase();
    return status.includes("seleccionado") || status.includes("asignado");
  });

  if (selectedEnrollments.length === 0) return null;

  const studentIds = selectedEnrollments
    .map((e) => safeGetId(e[C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]))
    .filter(Boolean) as string[];
  const students = await db.estudiantes.getAll({ filters: { id: studentIds } });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const grouped: GroupedSeleccionados = {};
  selectedEnrollments.forEach((row) => {
    const horario = (row[C.FIELD_HORARIO_FORMULA_CONVOCATORIAS] as string) || "No especificado";
    const sId = safeGetId(row[C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
    const student = sId ? studentMap.get(sId) : null;
    const nombre = student ? (student[C.FIELD_NOMBRE_ESTUDIANTES] as string) : "Estudiante";
    const legajo = student ? String(student[C.FIELD_LEGAJO_ESTUDIANTES]) : "---";
    if (!grouped[horario]) grouped[horario] = [];
    grouped[horario].push({ nombre, legajo });
  });

  for (const h in grouped) grouped[h].sort((a, b) => a.nombre.localeCompare(b.nombre));
  return grouped;
};

export const toggleStudentSelection = async (
  convocatoriaId: string,
  isSelecting: boolean,
  studentId: string,
  lanzamiento: LanzamientoPPS
): Promise<{ success: boolean; error?: string }> => {
  const newStatus = isSelecting ? "Seleccionado" : "Inscripto";
  try {
    // 1. Actualizar estado en convocatoria
    await db.convocatorias.update(convocatoriaId, {
      [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: newStatus,
    });

    // 2. Sincronizar registro de Práctica automáticamente
    if (isSelecting) {
      // CLEAN NAME FOR DB
      let rawName = lanzamiento[C.FIELD_NOMBRE_PPS_LANZAMIENTOS];
      if (Array.isArray(rawName)) rawName = rawName[0];
      const cleanName = cleanDbValue(rawName);
      const cleanOrientacion = cleanDbValue(lanzamiento[C.FIELD_ORIENTACION_LANZAMIENTOS]);

      // ROOT CAUSE FIX: Check if the source Lanzamiento is dirty in the DB (contains { "Name" })
      // If so, attempt to clean the source record to prevent future issues
      if (rawName && rawName !== cleanName && cleanName.length > 2) {
        console.log(
          `[DATA SERVICE] 🚨 DETECTED DIRTY ROOT: Lanzamiento ${lanzamiento.id} has dirty name. Cleaning source...`
        );
        // Fire and forget update to clean the source table
        db.lanzamientos
          .update(lanzamiento.id, { [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: cleanName })
          .catch((err) => console.warn("Failed to clean source launch", err));
      }

      // Verificar si ya existe para no duplicar
      const { data: existing } = await supabase
        .from("practicas")
        .select(`id, ${C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS}`)
        .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentId)
        .eq(C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, lanzamiento.id)
        .maybeSingle();

      if (!existing) {
        console.log(`[DATA SERVICE] Creating Practica. Name="${cleanName}"`);

        // DEFENSIVE CLEAN: Ensure we strip any JSON [] or Postgres {} artifacts
        // incase cleanDbValue didn't catch them due to import/cache timing
        let finalName = cleanName;
        if (typeof finalName === "string") {
          // Remove enclosing braces {}, brackets [], and quotes
          finalName = finalName
            .replace(/^\{|^\[|\]$|\}$/g, "") // Remove start/end brackets/braces
            .replace(/^"|^'|"$|'$/g, ""); // Remove surrounding quotes
        }

        const payload = {
          [C.FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentId,
          [C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: lanzamiento.id,
          [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: finalName,
          [C.FIELD_ESPECIALIDAD_PRACTICAS]: cleanOrientacion,
          [C.FIELD_FECHA_INICIO_PRACTICAS]: lanzamiento[C.FIELD_FECHA_INICIO_LANZAMIENTOS],
          [C.FIELD_FECHA_FIN_PRACTICAS]: lanzamiento[C.FIELD_FECHA_FIN_LANZAMIENTOS],
          [C.FIELD_HORAS_PRACTICAS]: 0,
          [C.FIELD_ESTADO_PRACTICA]: "En curso",
          [C.FIELD_NOTA_PRACTICAS]: "Sin calificar",
        };

        // Cast payload to any to bypass strict type check on potential array fields
        await db.practicas.create(payload as any);
      } else {
        console.log(`[DATA SERVICE] Practica already exists. Checking data integrity...`);
        // SELF-HEALING: If exists but has dirty name, fix it now.
        const existingPractica = existing as Practica;
        const currentName = existingPractica[C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
        // Check first element of array vs string
        const currentNameStr = Array.isArray(currentName) ? currentName[0] : String(currentName);

        if (currentNameStr !== cleanName) {
          console.log(`[DATA SERVICE] Fixing dirty name: ${currentNameStr} -> ${cleanName}`);
          await db.practicas.update(existingPractica.id, {
            [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: cleanName,
            [C.FIELD_ESPECIALIDAD_PRACTICAS]: cleanOrientacion,
          });
        }
      }
    } else {
      // Si deselecciona, borrar la práctica asociada
      const { data: existing } = await supabase
        .from("practicas")
        .select("id")
        .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentId)
        .eq(C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, lanzamiento.id);

      if (existing && existing.length > 0) {
        const duplicates = existing as { id: string }[];
        for (const rec of duplicates) {
          await db.practicas.delete(rec.id);
        }
      }
    }

    return { success: true };
  } catch (e) {
    console.error(`[DATA SERVICE] ERROR:`, e);
    return { success: false, error: (e as Error).message };
  }
};

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
    [key: string]: any; // Allow other props
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
    // Safe access to foreign keys even if they are missing in the top level object but present in the joined object
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
        // Ensure clean name display for groups
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
  // Use correct Insert type
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

export const uploadInstitutionLogo = async (
  file: File,
  institutionName: string
): Promise<string> => {
  try {
    // Sanitize name for path
    const safeName = cleanDbValue(institutionName)
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const fileExt = file.name.split(".").pop();
    const fileName = `logos/${safeName}_${Date.now()}.${fileExt}`;

    // We assume 'public-content' bucket exists for general assets. If not, this might fail unless we default to a known one.
    // Trying 'documentos_finalizacion' is risky. Let's try 'institution-logos' specifically.
    const BUCKET_NAME = "institution-logos";

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error("Upload Error (institution-logos):", error);
      throw new Error(`Error subiendo logo: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error: any) {
    throw new Error(error.message || "Error desconocido al subir logo");
  }
};

// --- Solicitudes de Modificación y Nueva PPS ---

export const uploadSolicitudFile = async (
  file: File,
  studentId: string,
  type: "modificacion" | "nueva_pps",
  category: string
): Promise<string> => {
  if (!studentId) throw new Error("No student ID");
  const fileExt = file.name.split(".").pop();
  const fileName = `${type}/${studentId}/${category}_${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage
    .from("solicitudes_pps")
    .upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("solicitudes_pps").getPublicUrl(fileName);
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

// --- Funciones para Admin ---

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

  // Actualizar estado de la solicitud
  const { error: updateError } = await supabase
    .from("solicitudes_modificacion_pps")
    .update({ estado: "aprobada", notas_admin: notasAdmin })
    .eq("id", solicitudId);

  if (updateError) throw updateError;

  // Si es cambio de horas, actualizar la práctica
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
    .select("*")
    .eq("id", solicitudId)
    .single();

  if (fetchError) throw fetchError;
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "pendiente") throw new Error("La solicitud ya fue procesada");

  // Crear la práctica
  const practicaRecord: Database["public"]["Tables"]["practicas"]["Insert"] = {
    estudiante_id: solicitud.estudiante_id,
    especialidad: solicitud.orientacion,
    fecha_inicio: solicitud.fecha_inicio,
    fecha_finalizacion: solicitud.fecha_finalizacion,
    horas_realizadas: solicitud.horas_estimadas,
    estado: "Finalizada",
    nota: null,
    lanzamiento_id: null,
    nombre_institucion: solicitud.nombre_institucion_manual || null,
  };

  const { data: practica, error: practicaError } = await supabase
    .from("practicas")
    .insert(practicaRecord)
    .select()
    .single();

  if (practicaError) throw practicaError;

  // Actualizar estado de la solicitud
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

export const deletePractica = async (practicaId: string) => {
  const { error } = await supabase.from("practicas").delete().eq("id", practicaId);

  if (error) throw error;
};
