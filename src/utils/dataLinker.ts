import type { Convocatoria, LanzamientoPPS, Practica, InformeTask } from "../types";
import { buildCompletedHistory } from "../logic/enrollmentEligibility";
import { isPracticeFinished } from "../logic/studentRules";
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
  FIELD_INFORME_ESTADO_PRACTICAS,
  FIELD_NOTA_MOODLE_PRACTICAS,
  FIELD_NOTA_FUENTE_PRACTICAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
} from "../constants";

interface LinkDataParams {
  myEnrollments: Convocatoria[];
  allLanzamientos: LanzamientoPPS[];
  practicas: Practica[];
}

function getPracticeInformeEvidence(practica: Practica): {
  informeSubido: boolean;
  nota: string | null;
} {
  const moodleGrade = practica[FIELD_NOTA_MOODLE_PRACTICAS];
  const storedGrade =
    practica[FIELD_NOTA_FUENTE_PRACTICAS] && practica[FIELD_NOTA_FUENTE_PRACTICAS] !== "legacy"
      ? practica[FIELD_NOTA_PRACTICAS]
      : null;
  const nota = moodleGrade != null ? String(moodleGrade) : storedGrade ? String(storedGrade) : null;
  const normalizedNote = normalizeStringForComparison(nota);
  const hasDeliveryEvidence =
    Boolean(normalizedNote) &&
    normalizedNote !== "sin calificar" &&
    normalizedNote !== "no entregado";
  const informeState = normalizeStringForComparison(practica[FIELD_INFORME_ESTADO_PRACTICAS]);

  return {
    informeSubido: hasDeliveryEvidence || ["entregado", "calificado"].includes(informeState),
    nota,
  };
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
  const { completedLanzamientoIds, completedOrientationsByInstitution } =
    buildCompletedHistory(practicas);

  // Step 4: Generate informe tasks
  const informeTasks: InformeTask[] = [];
  const processedForInforme = new Set<string>();
  const processedPracticeIds = new Set<string>();

  // 4a. From Enrollments (Selections)
  for (const [ppsId, enrollment] of enrollmentMap.entries()) {
    if (
      normalizeStringForComparison(enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) ===
      "seleccionado"
    ) {
      const pps = lanzamientosMap.get(ppsId);
      if (pps && pps[FIELD_INFORME_LANZAMIENTOS]) {
        const practica = practicas.find((p) => p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] === pps.id);
        const practiceEvidence = practica ? getPracticeInformeEvidence(practica) : null;

        informeTasks.push({
          convocatoriaId: enrollment.id,
          practicaId: practica?.id,
          ppsName: pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Práctica",
          informeLink: pps[FIELD_INFORME_LANZAMIENTOS],
          fechaFinalizacion: pps[FIELD_FECHA_FIN_LANZAMIENTOS] || new Date().toISOString(),
          informeSubido:
            !!enrollment[FIELD_INFORME_SUBIDO_CONVOCATORIAS] ||
            Boolean(practiceEvidence?.informeSubido),
          nota: practiceEvidence?.nota ?? null,
          fechaEntregaInforme: enrollment[FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS],
        });
        processedForInforme.add(ppsId);
        if (practica) processedPracticeIds.add(practica.id);
      }
    }
  }

  // 4b. From Finished Practices
  for (const practica of practicas) {
    const linkedId = practica[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] as string;

    if (linkedId && !processedForInforme.has(linkedId)) {
      const pps = lanzamientosMap.get(linkedId);

      if (
        pps &&
        pps[FIELD_INFORME_LANZAMIENTOS] &&
        isPracticeFinished(practica[FIELD_ESTADO_PRACTICA])
      ) {
        const practiceEvidence = getPracticeInformeEvidence(practica);

        informeTasks.push({
          convocatoriaId: `practica-${practica.id}`,
          practicaId: practica.id,
          ppsName: pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Práctica",
          informeLink: pps[FIELD_INFORME_LANZAMIENTOS],
          fechaFinalizacion:
            pps[FIELD_FECHA_FIN_LANZAMIENTOS] ||
            practica[FIELD_FECHA_FIN_PRACTICAS] ||
            new Date().toISOString(),
          informeSubido: practiceEvidence.informeSubido,
          nota: practiceEvidence.nota,
        });
        processedForInforme.add(linkedId);
        processedPracticeIds.add(practica.id);
      }
    }
  }

  // 4c. From canonical practice evidence without a usable launch.
  // Historical special activities (for example, professional surveys) were
  // recorded directly in `practicas`. Their Moodle grade is still authoritative
  // even though they do not have a launch or an old task link.
  for (const practica of practicas) {
    if (processedPracticeIds.has(practica.id)) continue;

    const practiceEvidence = getPracticeInformeEvidence(practica);
    if (!practiceEvidence.informeSubido) continue;

    informeTasks.push({
      convocatoriaId: `practica-${practica.id}`,
      practicaId: practica.id,
      ppsName:
        String(practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] ?? "").trim() || "Práctica",
      fechaFinalizacion: practica[FIELD_FECHA_FIN_PRACTICAS] || new Date().toISOString(),
      informeSubido: true,
      nota: practiceEvidence.nota,
    });
    processedPracticeIds.add(practica.id);
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
