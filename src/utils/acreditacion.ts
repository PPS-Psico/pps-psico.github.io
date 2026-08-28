// Helpers del trámite de acreditación por PPS (flujo guiado de finalización).
// Centraliza la forma del snapshot `detalle_practicas` y el cálculo de
// horas totales / nota promedio para reusar entre estudiante y admin.

export interface DetalleArchivoSubido {
  source?: "student_upload";
  url: string;
  filename: string;
}

export interface DetalleArchivoMoodle {
  source: "moodle";
  cmid: number | null;
  evidence: string;
  confidence?: number | null;
  fileCount?: number | null;
  logicalFileCount?: number | null;
}

export type DetalleArchivo = DetalleArchivoSubido | DetalleArchivoMoodle;

export const isDetalleArchivoSubido = (
  archivo: DetalleArchivo | null | undefined
): archivo is DetalleArchivoSubido =>
  Boolean(archivo && "url" in archivo && typeof archivo.url === "string" && archivo.url !== "");

export const isDetalleArchivoMoodle = (
  archivo: DetalleArchivo | null | undefined
): archivo is DetalleArchivoMoodle => archivo?.source === "moodle";

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
  documentation?: {
    report: "verified" | "required";
    attendance: "verified" | "required" | "not_required";
  };
}

export interface DetallePracticas {
  version?: string;
  source?: "manual" | "moodle_assisted" | "moodle_automatic";
  totalHoras: number;
  /** Promedio de notas numéricas, ya redondeado (.5 → arriba). null si no hay notas numéricas. */
  notaPromedio: number | null;
  items: DetallePracticaItem[];
}

// Opciones de nota para el select del estudiante.
export const NOTA_NUMERICA_OPTIONS = ["10", "9", "8", "7", "6", "5", "4"] as const;
export const NOTA_TEXTO_OPTIONS = ["Aprobado"] as const;

/**
 * La calificación textual "Aprobado" pertenece al esquema usado hasta 2024.
 * Si no podemos determinar el año, aplicamos el criterio vigente y exigimos nota numérica.
 */
export const permiteNotaAprobado = (fechaInicio: string | null | undefined): boolean => {
  const match = String(fechaInicio ?? "").match(/^(\d{4})(?:-|$)/);
  if (!match) return false;
  return Number(match[1]) <= 2024;
};

/** Devuelve el valor numérico de una nota (1-10) o null si es texto / vacío. */
export const parseNotaNumeric = (nota: string | null | undefined): number | null => {
  if (nota == null) return null;
  const trimmed = String(nota).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 && n <= 10 ? n : null;
};

/** Valida la nota según el esquema de calificación correspondiente al año de la PPS. */
export const isNotaPermitidaParaPps = (
  nota: string | null | undefined,
  fechaInicio: string | null | undefined
): boolean => {
  if (parseNotaNumeric(nota) != null) return true;
  return String(nota ?? "").trim() === "Aprobado" && permiteNotaAprobado(fechaInicio);
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

/** Semanas que abarca el período de una práctica (mínimo 1). null si las fechas no sirven. */
export const computeSemanas = (
  fechaInicio: string | null | undefined,
  fechaFinalizacion: string | null | undefined
): number | null => {
  if (!fechaInicio || !fechaFinalizacion) return null;
  const inicio = new Date(fechaInicio).getTime();
  const fin = new Date(fechaFinalizacion).getTime();
  if (isNaN(inicio) || isNaN(fin) || fin < inicio) return null;
  const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;
  // Una práctica que empieza y termina el mismo día sigue siendo una semana de cursada.
  return Math.max(1, Math.round((fin - inicio) / MS_POR_SEMANA));
};

/**
 * Frecuencia semanal estimada (horas por semana) repartiendo las horas acreditadas entre las
 * semanas que duró la práctica.
 *
 * Devuelve null si faltan datos, para que quien lo muestre distinga "no lo sabemos" de "da cero".
 */
export const computeFrecuenciaSemanal = (
  horas: number | string | null | undefined,
  fechaInicio: string | null | undefined,
  fechaFinalizacion: string | null | undefined
): number | null => {
  const totalHoras = Number(horas);
  if (!Number.isFinite(totalHoras) || totalHoras <= 0) return null;
  const semanas = computeSemanas(fechaInicio, fechaFinalizacion);
  if (semanas == null) return null;
  return Math.round((totalHoras / semanas) * 10) / 10;
};

/**
 * Horas semanales que se desprenden de un horario declarado ("Lunes de 9 a 13; Jueves 14 a 18").
 *
 * Es deliberadamente conservador: si alguno de los tramos no se entiende, devuelve null en vez de
 * sumar de menos. Preferimos "no sé" antes que un número que después alguien carga al SAC.
 */
export const parseHorasSemanalesDeHorario = (horario: string | null | undefined): number | null => {
  if (!horario) return null;
  const tramos = String(horario)
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tramos.length === 0) return null;

  // Los `\s*` van dentro de los grupos opcionales a propósito: dos `\s*` seguidos alrededor de
  // un opcional hacen que el motor pueda dividir los espacios de muchas formas y backtrackee.
  const RANGO =
    /(\d{1,2})(?:[:.](\d{2}))?(?:\s*(?:hs?|horas?))?\s*(?:a|hasta|-|–|—)(?:\s*)(\d{1,2})(?:[:.](\d{2}))?/i;

  let total = 0;
  for (const tramo of tramos) {
    const m = tramo.match(RANGO);
    if (!m) return null;
    const desde = Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
    const hasta = Number(m[3]) + (m[4] ? Number(m[4]) / 60 : 0);
    if (!(hasta > desde) || hasta > 24) return null;
    total += hasta - desde;
  }

  return Math.round(total * 10) / 10;
};

/**
 * Cuánto puede desviarse el total implícito del horario declarado respecto de las horas
 * acreditadas antes de considerarlo poco creíble. Que sobre un poco es normal (inasistencias);
 * que sobre o falte mucho significa que el horario no describe lo que realmente pasó.
 */
const BANDA_COHERENCIA = { min: 0.7, max: 1.4 } as const;

export interface FrecuenciaSemanalResuelta {
  /** Horas por semana a informar. null si no alcanzan los datos. */
  valor: number | null;
  origen: "horario" | "calculo" | null;
  /** Presente solo cuando se descartó el horario declarado por incoherente. */
  advertencia?: string;
}

/**
 * Frecuencia semanal a informar al SAC.
 *
 * Manda el horario declarado en la convocatoria, porque es el dato real de cursada. Pero se
 * verifica contra las horas acreditadas: si repartido en las semanas del período da un total muy
 * distinto, el horario no describe lo que pasó y se cae al cálculo `horas ÷ semanas`.
 */
export const resolveFrecuenciaSemanal = (params: {
  horas: number | string | null | undefined;
  fechaInicio: string | null | undefined;
  fechaFinalizacion: string | null | undefined;
  horarioDeclarado?: string | null;
}): FrecuenciaSemanalResuelta => {
  const { horas, fechaInicio, fechaFinalizacion, horarioDeclarado } = params;
  const calculada = computeFrecuenciaSemanal(horas, fechaInicio, fechaFinalizacion);
  const declarada = parseHorasSemanalesDeHorario(horarioDeclarado);
  const semanas = computeSemanas(fechaInicio, fechaFinalizacion);
  const totalHoras = Number(horas);

  if (declarada == null) {
    return { valor: calculada, origen: calculada != null ? "calculo" : null };
  }

  if (semanas == null || !Number.isFinite(totalHoras) || totalHoras <= 0) {
    // Sin período ni horas no hay contra qué contrastar: el horario es lo único que tenemos.
    return { valor: declarada, origen: "horario" };
  }

  const ratio = (declarada * semanas) / totalHoras;
  if (ratio < BANDA_COHERENCIA.min || ratio > BANDA_COHERENCIA.max) {
    return {
      valor: calculada,
      origen: calculada != null ? "calculo" : null,
      advertencia: `El horario declarado (${declarada} hs/sem) da ${Math.round(
        declarada * semanas
      )} hs en ${semanas} semanas, pero se acreditaron ${totalHoras} hs.`,
    };
  }

  return { valor: declarada, origen: "horario" };
};
