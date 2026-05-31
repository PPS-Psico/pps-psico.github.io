import {
  FIELD_TERMINO_CURSAR_CONVOCATORIAS,
  FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS,
} from "../constants";
import type { AirtableRecord, ConvocatoriaFields } from "../types";

/**
 * Pesos del puntaje de selección de candidatos.
 *
 * El puntaje busca priorizar a quienes están más avanzados en la carrera
 * (terminaron de cursar > cursando electivas > aún adeudan finales), suma
 * por horas acumuladas y por situación laboral, y descuenta penalizaciones.
 */
export const SCORE_WEIGHTS = {
  TERMINO_CURSAR: 100,
  CURSANDO_ELECTIVAS: 50,
  BASE_FINALES: 30,
  PER_HOUR: 0.5,
  TRABAJA: 20,
} as const;

/**
 * Calcula el puntaje total de un candidato a partir de su inscripción,
 * horas acumuladas, penalizaciones y situación laboral.
 *
 * Es una función pura: mismas entradas -> misma salida, sin efectos.
 */
export const calculateScore = (
  enrollment: AirtableRecord<ConvocatoriaFields>,
  hours: number,
  penalties: number,
  works: boolean
): number => {
  let academicScore = 0;
  const termino = enrollment[FIELD_TERMINO_CURSAR_CONVOCATORIAS] === "Sí";
  const electivas = enrollment[FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS] === "Sí";

  if (termino) {
    academicScore = SCORE_WEIGHTS.TERMINO_CURSAR;
  } else if (electivas) {
    academicScore = SCORE_WEIGHTS.CURSANDO_ELECTIVAS;
  } else {
    academicScore = SCORE_WEIGHTS.BASE_FINALES;
  }

  const hoursScore = hours * SCORE_WEIGHTS.PER_HOUR;
  const workScore = works ? SCORE_WEIGHTS.TRABAJA : 0;
  const penaltyScore = penalties;

  return Math.round(academicScore + hoursScore + workScore - penaltyScore);
};
