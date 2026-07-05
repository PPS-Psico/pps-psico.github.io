// Helpers del trámite de acreditación por PPS (flujo guiado de finalización).
// Centraliza la forma del snapshot `detalle_practicas` y el cálculo de
// horas totales / nota promedio para reusar entre estudiante y admin.

export interface DetalleArchivo {
  url: string;
  filename: string;
}

export interface DetallePracticaItem {
  practicaId: string;
  nombre: string;
  especialidad: string | null;
  horas: number;
  fechaInicio: string | null;
  fechaFinalizacion: string | null;
  esOnline: boolean;
  /** "1".."10" | "Aprobado" | "Desaprobado" | "No entregado" */
  nota: string;
  informe: DetalleArchivo | null;
  asistencia: DetalleArchivo | null;
}

export interface DetallePracticas {
  totalHoras: number;
  /** Promedio de notas numéricas, ya redondeado (.5 → arriba). null si no hay notas numéricas. */
  notaPromedio: number | null;
  items: DetallePracticaItem[];
}

// Opciones de nota para el select del estudiante.
export const NOTA_NUMERICA_OPTIONS = ["10", "9", "8", "7", "6", "5", "4"] as const;
export const NOTA_TEXTO_OPTIONS = ["Aprobado"] as const;

/** Devuelve el valor numérico de una nota (1-10) o null si es texto / vacío. */
export const parseNotaNumeric = (nota: string | null | undefined): number | null => {
  if (nota == null) return null;
  const trimmed = String(nota).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 && n <= 10 ? n : null;
};

/** Promedio de notas numéricas redondeado (.5 hacia arriba). null si no hay ninguna numérica. */
export const computeNotaPromedio = (
  notas: ReadonlyArray<string | null | undefined>
): number | null => {
  const numericas = notas.map(parseNotaNumeric).filter((n): n is number => n != null);
  if (numericas.length === 0) return null;
  const avg = numericas.reduce((a, b) => a + b, 0) / numericas.length;
  return Math.round(avg); // Math.round redondea .5 hacia arriba para positivos
};

/** Suma de horas (tolerante a null / strings). */
export const computeTotalHoras = (
  horas: ReadonlyArray<number | string | null | undefined>
): number => horas.reduce<number>((acc, h) => acc + (Number(h) || 0), 0);
