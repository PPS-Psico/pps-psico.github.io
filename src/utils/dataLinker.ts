import type { Convocatoria, LanzamientoPPS, Practica, InformeTask } from "../types";
import { normalizeStringForComparison, parseToUTCDate } from "./formatters";
import {
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_INFORME_SUBIDO_CONVOCATORIAS,
  FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS,
  FIELD_INFORME_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_ESTADO_PRACTICA,
  FIELD_NOTA_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
} from "../constants";

interface LinkDataParams {
  myEnrollments: Convocatoria[];
  allLanzamientos: LanzamientoPPS[];
  practicas: Practica[];
}

export function processAndLinkStudentData({
  myEnrollments,
  allLanzamientos,
  practicas,
}: LinkDataParams) {
  const lanzamientosMap = new Map(allLanzamientos.map((l) => [l.id, l]));

  // Step 1: Prioritize Enrollments
  const enrollmentsByPpsId = new Map<string, Convocatoria[]>();

  myEnrollments.forEach((enrollment) => {
    const linkedId = enrollment[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] as string;

    if (linkedId) {
      if (!enrollmentsByPpsId.has(linkedId)) {
        enrollmentsByPpsId.set(linkedId, []);
      }
      enrollmentsByPpsId.get(linkedId)!.push(enrollment);
    }
  });

  // Step 2: For each group, find the one with the highest priority status.
  const enrollmentMap = new Map<string, Convocatoria>();
  const statusPriority: { [key: string]: number } = {
    seleccionado: 3,
    inscripto: 2,
    "no seleccionado": 1,
  };

  enrollmentsByPpsId.forEach((enrollmentGroup, ppsId) => {
    const bestEnrollment = enrollmentGroup.reduce((best, current) => {
      const bestStatus = normalizeStringForComparison(best[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]);
      const currentStatus = normalizeStringForComparison(
        current[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]
      );
      const bestPriority = statusPriority[bestStatus] || 0;
      const currentPriority = statusPriority[currentStatus] || 0;
      return currentPriority > bestPriority ? current : best;
    });
    enrollmentMap.set(ppsId, bestEnrollment);
  });

  // Step 3: Identify completed practices
  const completedLanzamientoIds = new Set<string>();
  const completedOrientationsByInstitution = new Map<string, Set<string>>();
  const finalizadaStatuses = ["finalizada", "pps realizada", "convenio realizado", "aprobada"];

  practicas.forEach((practica) => {
    const estadoPractica = normalizeStringForComparison(practica[FIELD_ESTADO_PRACTICA]);
    if (finalizadaStatuses.includes(estadoPractica)) {
      // Block by ID
      const linkedId = practica[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] as string;
      if (linkedId) {
        completedLanzamientoIds.add(linkedId);
      }

      // Block by Name (Legacy & Duplicate Prevention)
      const pNameRaw = practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
      const pName = String(pNameRaw || "");
      if (pName.trim()) {
        const normalizedName = normalizeStringForComparison(pName);
        completedLanzamientoIds.add(normalizedName);
      }

      // Track completed orientations per institution (for multi-orientation support)
      const especialidad = String(practica[FIELD_ESPECIALIDAD_PRACTICAS] || "").trim();
      if (pName.trim() && especialidad) {
        const normalizedName = normalizeStringForComparison(pName);
        const normalizedEsp = normalizeStringForComparison(especialidad);
        if (!completedOrientationsByInstitution.has(normalizedName)) {
          completedOrientationsByInstitution.set(normalizedName, new Set());
        }
        completedOrientationsByInstitution.get(normalizedName)!.add(normalizedEsp);
      }
    }
  });

  // Step 4: Generate informe tasks
  const informeTasks: InformeTask[] = [];
  const processedForInforme = new Set<string>();

  // 4a. From Enrollments (Selections)
  for (const [ppsId, enrollment] of enrollmentMap.entries()) {
    if (
      normalizeStringForComparison(enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) ===
      "seleccionado"
    ) {
      const pps = lanzamientosMap.get(ppsId);
      if (pps && pps[FIELD_INFORME_LANZAMIENTOS]) {
        const practica = practicas.find((p) => p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] === pps.id);

        informeTasks.push({
          convocatoriaId: enrollment.id,
          practicaId: practica?.id,
          ppsName: pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Práctica",
          informeLink: pps[FIELD_INFORME_LANZAMIENTOS],
          fechaFinalizacion: pps[FIELD_FECHA_FIN_LANZAMIENTOS] || new Date().toISOString(),
          informeSubido: !!enrollment[FIELD_INFORME_SUBIDO_CONVOCATORIAS],
          nota: practica?.[FIELD_NOTA_PRACTICAS],
          fechaEntregaInforme: enrollment[FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS],
        });
        processedForInforme.add(ppsId);
      }
    }
  }

  // 4b. From Finished Practices
  for (const practica of practicas) {
    const linkedId = practica[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] as string;

    if (linkedId && !processedForInforme.has(linkedId)) {
      const pps = lanzamientosMap.get(linkedId);
      const estado = normalizeStringForComparison(practica[FIELD_ESTADO_PRACTICA]);

      if (pps && pps[FIELD_INFORME_LANZAMIENTOS] && finalizadaStatuses.includes(estado)) {
        informeTasks.push({
          convocatoriaId: `practica-${practica.id}`,
          practicaId: practica.id,
          ppsName: pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Práctica",
          informeLink: pps[FIELD_INFORME_LANZAMIENTOS],
          fechaFinalizacion:
            pps[FIELD_FECHA_FIN_LANZAMIENTOS] ||
            practica[FIELD_FECHA_FIN_PRACTICAS] ||
            new Date().toISOString(),
          informeSubido: !!practica[FIELD_NOTA_PRACTICAS],
          nota: practica[FIELD_NOTA_PRACTICAS],
        });
        processedForInforme.add(linkedId);
      }
    }
  }

  informeTasks.sort((a, b) => {
    const aIsPending = !a.informeSubido;
    const bIsPending = !b.informeSubido;
    if (aIsPending && !bIsPending) return -1;
    if (!aIsPending && bIsPending) return 1;

    const dateA = parseToUTCDate(a.fechaFinalizacion)?.getTime() || 0;
    const dateB = parseToUTCDate(b.fechaFinalizacion)?.getTime() || 0;
    return dateA - dateB;
  });

  return {
    enrollmentMap,
    completedLanzamientoIds,
    completedOrientationsByInstitution,
    informeTasks,
  };
}
