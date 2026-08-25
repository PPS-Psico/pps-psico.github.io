import type { Practica } from "../../types";

/**
 * Para acreditar hace falta que todas las PPS esten corregidas y aprobadas.
 * Este modulo decide, PPS por PPS, si la nota habilita el envio.
 *
 * Hay dos niveles, y la diferencia importa:
 *
 *   · "block"  -> el panel SABE que la PPS no puede acreditarse (esta
 *                 desaprobada, o Campus devolvio algo que no es una nota).
 *                 Corta el envio siempre.
 *   · "warn"   -> falta la nota. Hoy no corta, porque la mayoria de las PPS
 *                 historicas nunca tuvieron nota cargada en el panel: al medirlo
 *                 sobre los alumnos que ya reunen las horas y todavia no enviaron
 *                 solicitud, exigir nota en todas dejaba afuera a 57 de 59.
 *                 Se muestra el detalle para que el alumno y coordinacion sepan
 *                 exactamente que falta.
 *
 * Cuando la cobertura de notas de Campus este completa, alcanza con poner
 * ENFORCE_MISSING_GRADE en true para que "warn" pase a cortar tambien.
 *
 * La desaprobacion NO se deduce de un umbral numerico: es un estado explicito
 * de la practica (`registrar_desaprobacion_pps`), y el formulario ya filtra por
 * estado "Finalizada". Aca solo se contempla el veredicto textual de las tareas
 * pass/fail.
 */

export const ENFORCE_MISSING_GRADE = false;

export type GradeSeverity = "ok" | "warn" | "block";
export type GradeBlockReason = "sin_correccion" | "sin_verificar" | "desaprobada" | "nota_invalida";

export interface GradeReadiness {
  severity: GradeSeverity;
  /** true cuando la nota habilita el envio sin reparos. */
  ready: boolean;
  /** true cuando, con la configuracion actual, esta PPS impide avanzar. */
  blocking: boolean;
  nota: string | null;
  reason: GradeBlockReason | null;
  label: string;
  detail: string;
}

const UNVERIFIED_SOURCES = new Set(["legacy"]);

/** Textos que Moodle o el panel usan como estado, no como calificacion. */
const NON_GRADE_TEXT = /^(sin calificar|entregado|a revisar|pendiente|en correcci)/i;

const formatNota = (value: number): string => String(Number(value));

const build = (
  severity: GradeSeverity,
  fields: { nota: string | null; reason: GradeBlockReason | null; label: string; detail: string }
): GradeReadiness => ({
  severity,
  ready: severity === "ok",
  blocking: severity === "block" || (severity === "warn" && ENFORCE_MISSING_GRADE),
  ...fields,
});

export function resolveGradeReadiness(practica: Practica): GradeReadiness {
  const fuente = practica.nota_fuente ?? null;
  const notaTexto = (practica.nota ?? "").trim();
  const notaMoodle = practica.nota_moodle ?? null;

  const fuenteVerificada = Boolean(fuente) && !UNVERIFIED_SOURCES.has(fuente as string);

  if (/^desaprobad/i.test(notaTexto)) {
    return build("block", {
      nota: notaTexto,
      reason: "desaprobada",
      label: "PPS desaprobada",
      detail: "Figura desaprobada, así que no puede incluirse en la acreditación.",
    });
  }

  // Nota verificada desde Campus o cargada por coordinación.
  if (fuenteVerificada && notaMoodle !== null) {
    return build("ok", {
      nota: formatNota(notaMoodle),
      reason: null,
      label: `Nota ${formatNota(notaMoodle)}`,
      detail: "Calificación verificada desde Campus.",
    });
  }

  if (fuenteVerificada && /^aprobad/i.test(notaTexto)) {
    return build("ok", {
      nota: notaTexto,
      reason: null,
      label: "Aprobada",
      detail: "Campus registra la PPS como aprobada.",
    });
  }

  // Con procedencia pero sin un valor utilizable: Campus devolvió algo que no
  // es una nota. Eso es un problema concreto, no una espera.
  if (fuenteVerificada) {
    return build("block", {
      nota: notaTexto || null,
      reason: "nota_invalida",
      label: "Nota a revisar",
      detail: "Campus devolvió una calificación que no se puede interpretar. Avisá a coordinación.",
    });
  }

  // Sin procedencia: puede haber una nota histórica cargada a mano.
  if (notaTexto !== "" && !NON_GRADE_TEXT.test(notaTexto)) {
    return build("ok", {
      nota: notaTexto,
      reason: null,
      label: `Nota ${notaTexto}`,
      detail: "Calificación registrada en el panel.",
    });
  }

  const entregado = NON_GRADE_TEXT.test(notaTexto) || practica.informe_estado === "entregado";
  return build("warn", {
    nota: null,
    reason: entregado ? "sin_correccion" : "sin_verificar",
    label: entregado ? "Falta la corrección" : "Sin nota",
    detail: entregado
      ? "Campus registra la entrega, pero la cátedra todavía no cargó la calificación."
      : "Todavía no hay una calificación registrada para esta PPS.",
  });
}

export interface GradeIssue {
  practica: Practica;
  readiness: GradeReadiness;
}

export function collectGradeIssues(practicas: Practica[]): {
  blocking: GradeIssue[];
  warnings: GradeIssue[];
} {
  const issues = practicas
    .map((practica) => ({ practica, readiness: resolveGradeReadiness(practica) }))
    .filter((entry) => entry.readiness.severity !== "ok");

  return {
    blocking: issues.filter((entry) => entry.readiness.blocking),
    warnings: issues.filter((entry) => !entry.readiness.blocking),
  };
}
