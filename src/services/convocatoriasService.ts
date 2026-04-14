import * as C from "../constants";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import type { CompromisoPPS, Convocatoria, GroupedSeleccionados, LanzamientoPPS } from "../types";
import {
  cleanDbValue,
  cleanInstitutionName,
  normalizeStringForComparison,
  safeGetId,
} from "../utils/formatters";
import { cleanSchedule, findMatchingGroupKey } from "../utils/scheduleUtils";

function addToGrouped(
  grouped: GroupedSeleccionados,
  rawHorario: string,
  student: {
    nombre: string;
    legajo: string;
    compromisoEstado?: string | null;
    compromisoFecha?: string | null;
  }
) {
  const horario = cleanSchedule(rawHorario) || "No especificado";
  const matchKey = findMatchingGroupKey(horario, Object.keys(grouped));
  const groupKey = matchKey || horario;
  if (!grouped[groupKey]) grouped[groupKey] = [];
  grouped[groupKey].push(student);
}

function sortGrouped(grouped: GroupedSeleccionados): GroupedSeleccionados {
  for (const h in grouped) grouped[h].sort((a, b) => a.nombre.localeCompare(b.nombre));
  return grouped;
}

export const fetchConvocatoriasData = async (
  studentId: string | null
): Promise<{
  lanzamientos: LanzamientoPPS[];
  myEnrollments: Convocatoria[];
  allLanzamientos: LanzamientoPPS[];
  institutionAddressMap: Map<string, string>;
  institutionLogoMap: Map<string, { url: string; invert: boolean }>;
}> => {
  let myEnrollments: Convocatoria[] = [];
  const enrolledLaunchIds = new Set<string>();

  if (studentId) {
    const enrollments = await db.convocatorias.getAll({
      filters: { [C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentId },
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

  const enrollments = await db.convocatorias.getAll({
    filters: { [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzamientoId },
  });

  const selectedEnrollments = enrollments.filter((e) => {
    const status = String(e[C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "").toLowerCase();
    return status.includes("seleccionado") || status.includes("asignado");
  });

  if (selectedEnrollments.length === 0) return null;

  let commitmentsMap = new Map<
    string,
    Pick<CompromisoPPS, "convocatoria_id" | "estado" | "accepted_at">
  >();
  try {
    const { data: commitments } = await supabase
      .from("compromisos_pps")
      .select("convocatoria_id, estado, accepted_at")
      .eq("lanzamiento_id", lanzamientoId);

    commitmentsMap = new Map(
      ((commitments || []) as Pick<CompromisoPPS, "convocatoria_id" | "estado" | "accepted_at">[])
        .filter((row) => !!row.convocatoria_id)
        .map((row) => [row.convocatoria_id, row])
    );
  } catch (error) {
    console.warn("[fetchSeleccionados] Could not load commitments", error);
  }

  const studentIds = selectedEnrollments
    .map((e) => safeGetId(e[C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]))
    .filter(Boolean) as string[];
  const students = await db.estudiantes.getAll({ filters: { id: studentIds } });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const needsRpc = students.length === 0 && selectedEnrollments.length > 0;
  if (needsRpc) {
    try {
      const { data: rpcData } = await supabase.rpc("get_seleccionados_for_launch", {
        p_lanzamiento_id: lanzamientoId,
      });
      if (rpcData && (rpcData as any[]).length > 0) {
        const grouped: GroupedSeleccionados = {};
        (rpcData as { horario: string; nombre: string; legajo: string }[]).forEach((row) => {
          addToGrouped(grouped, row.horario, {
            nombre: row.nombre,
            legajo: row.legajo,
            compromisoEstado: null,
            compromisoFecha: null,
          });
        });
        return sortGrouped(grouped);
      }
    } catch (rpcErr) {
      console.warn("[fetchSeleccionados] RPC fallback failed:", rpcErr);
    }
  }

  const grouped: GroupedSeleccionados = {};
  selectedEnrollments.forEach((row) => {
    const horario =
      (row[C.FIELD_HORARIO_ASIGNADO_CONVOCATORIAS] as string) ||
      (row[C.FIELD_HORARIO_FORMULA_CONVOCATORIAS] as string) ||
      "";
    const sId = safeGetId(row[C.FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
    const student = sId ? studentMap.get(sId) : null;
    addToGrouped(grouped, horario, {
      nombre: student ? (student[C.FIELD_NOMBRE_ESTUDIANTES] as string) : "Estudiante",
      legajo: student ? String(student[C.FIELD_LEGAJO_ESTUDIANTES]) : "---",
      compromisoEstado: commitmentsMap.get(row.id)?.estado || null,
      compromisoFecha: commitmentsMap.get(row.id)?.accepted_at || null,
    });
  });

  return sortGrouped(grouped);
};

export const toggleStudentSelection = async (
  convocatoriaId: string,
  isSelecting: boolean,
  studentId: string,
  lanzamiento: LanzamientoPPS,
  horarioAsignado?: string
): Promise<{ success: boolean; error?: string }> => {
  const newStatus = isSelecting ? "Seleccionado" : "Inscripto";
  try {
    const updatePayload: Record<string, any> = {
      [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: newStatus,
    };
    if (isSelecting) {
      updatePayload.selected_at = new Date().toISOString();
      updatePayload.reminder_sent_at = null;
      updatePayload.baja_automatica_at = null;
    } else {
      updatePayload.selected_at = null;
      updatePayload.reminder_sent_at = null;
      updatePayload.baja_automatica_at = null;
    }
    await db.convocatorias.update(convocatoriaId, updatePayload);

    if (isSelecting) {
      let rawName = lanzamiento[C.FIELD_NOMBRE_PPS_LANZAMIENTOS];
      if (Array.isArray(rawName)) rawName = rawName[0];
      const cleanName = cleanDbValue(rawName);

      let finalOrientacion = "";
      if (horarioAsignado) {
        const match = horarioAsignado.match(/\[(.*)\]/);
        if (match) finalOrientacion = match[1].trim();
      }

      if (!finalOrientacion) {
        const rawOrient = lanzamiento[C.FIELD_ORIENTACION_LANZAMIENTOS];
        const orients =
          typeof rawOrient === "string"
            ? rawOrient.split(",").map((o) => o.trim())
            : Array.isArray(rawOrient)
              ? rawOrient
              : [];
        finalOrientacion = orients[0] || "";
      }

      const cleanOrientacion = cleanDbValue(finalOrientacion);

      if (rawName && rawName !== cleanName && cleanName.length > 2) {
        console.log(
          `[DATA SERVICE] 🚨 DETECTED DIRTY ROOT: Lanzamiento ${lanzamiento.id} has dirty name. Cleaning source...`
        );
        db.lanzamientos
          .update(lanzamiento.id, { [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: cleanName })
          .catch((err) => console.warn("Failed to clean source launch", err));
      }

      const { data: existing } = await supabase
        .from("practicas")
        .select(`id, ${C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS}`)
        .eq(C.FIELD_ESTUDIANTE_LINK_PRACTICAS, studentId)
        .eq(C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, lanzamiento.id)
        .maybeSingle();

      if (!existing) {
        console.log(`[DATA SERVICE] Creating Practica. Name="${cleanName}"`);

        let finalName = cleanName;
        if (typeof finalName === "string") {
          finalName = finalName.replace(/^\{|^\[|\]$|\}$/g, "").replace(/^"|^'|"$|'$/g, "");
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

        await db.practicas.create(payload as any);
      } else {
        console.log(`[DATA SERVICE] Practica already exists. Checking data integrity...`);
        const existingPractica = existing as any;
        const currentName = existingPractica[C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
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
