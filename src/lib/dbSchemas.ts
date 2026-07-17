import { z } from "zod";
import { logger } from "../utils/logger";

/**
 * Validación en el borde de datos (data boundary).
 *
 * Cada tabla de Supabase tiene un schema *lenient* que describe la forma
 * esperada de una fila (`Row`). La validación corre **solo en desarrollo**
 * (`import.meta.env.DEV`) para detectar "drift" entre el esquema real de la
 * base y lo que el front asume, sin agregar overhead ni riesgo en producción.
 *
 * Principios de diseño:
 *  - **No rompe en producción**: `validateDbRow` es un no-op fuera de dev y
 *    nunca lanza; solo emite un `logger.warn` cuando detecta una discrepancia.
 *  - **Lenient**: los schemas usan `.passthrough()` (columnas extra permitidas)
 *    y campos `.nullable().optional()`. Para columnas con tipos históricamente
 *    ambiguos (p. ej. `legajo`, que puede venir como string o number según la
 *    tabla) se usa `z.union([...])` para evitar falsos positivos.
 *  - **Fiel a `src/types/supabase.ts`**: los campos reflejan los tipos `Row`
 *    generados, de modo que un cambio de esquema no anunciado se note en dev.
 */

const isDev = import.meta.env?.DEV ?? false;

// --- Helpers de campo lenient ---
const str = z.string().nullable().optional();
const num = z.number().nullable().optional();
const bool = z.boolean().nullable().optional();
const strArr = z.array(z.string()).nullable().optional();
/** `legajo`/`dni` pueden venir como string o number según la tabla/origen. */
const idLike = z.union([z.string(), z.number()]).nullable().optional();
/** Campos `Json` de Supabase: cualquier forma serializable. */
const json = z.unknown().nullable().optional();

export const estudianteSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    airtable_id: str,
    apellido_separado: str,
    certificado_trabajo: str,
    cohorte: num,
    correo: str,
    created_at: str,
    dni: num,
    estado: str,
    fecha_finalizacion: str,
    fecha_nacimiento: str,
    genero: str,
    legajo: str,
    must_change_password: bool,
    nombre: str,
    nombre_separado: str,
    notas_internas: str,
    orientacion_elegida: str,
    role: str,
    telefono: str,
    trabaja: bool,
    user_id: str,
  })
  .passthrough();

export const practicaSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    airtable_id: str,
    created_at: str,
    es_online: bool,
    especialidad: str,
    estado: str,
    estudiante_id: str,
    fecha_finalizacion: str,
    fecha_inicio: str,
    horas_realizadas: num,
    lanzamiento_id: str,
    nombre_institucion: str,
    nota: str,
  })
  .passthrough();

export const convocatoriaSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    airtable_id: str,
    baja_automatica_at: str,
    certificado_trabajo: str,
    certificado_url: str,
    correo: str,
    created_at: str,
    cursando_electivas: str,
    cv_url: str,
    direccion: str,
    dni: num,
    estado_inscripcion: str,
    estudiante_id: str,
    fecha_entrega_informe: str,
    fecha_finalizacion: str,
    fecha_inicio: str,
    fecha_nacimiento: str,
    finales_adeuda: str,
    horario_asignado: str,
    horario_seleccionado: str,
    horas_acreditadas: num,
    informe_subido: bool,
    lanzamiento_id: str,
    legajo: idLike,
    nombre_pps: str,
    orientacion: str,
    otra_situacion_academica: str,
    reminder_sent_at: str,
    selected_at: str,
    telefono: str,
    termino_cursar: str,
    trabaja: bool,
  })
  .passthrough();

export const lanzamientoSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    actividades_label: str,
    actividades_lista: strArr,
    airtable_id: str,
    archivo_descargable_nombre: str,
    archivo_descargable_url: str,
    codigo_tarjeta_campus: str,
    created_at: str,
    cupos_disponibles: num,
    descripcion_larga: str,
    direccion: str,
    estado_convocatoria: str,
    estado_gestion: str,
    fecha_encuentro_inicial: str,
    fecha_fin_inscripcion: str,
    fecha_finalizacion: str,
    fecha_inicio: str,
    fecha_inicio_inscripcion: str,
    fecha_publicacion: str,
    fecha_relanzamiento: str,
    historial_gestion: str,
    horario_seleccionado: str,
    horarios_fijos: bool,
    horarios_obligatorios: strArr,
    horas_acreditadas: num,
    informe: str,
    institucion_id: str,
    mensaje_whatsapp: str,
    nombre_pps: str,
    notas_gestion: str,
    orientacion: str,
    permite_certificado: bool,
    plantilla_seguro_url: str,
    plazo_inscripcion_dias: num,
    proximo_seguimiento: str,
    req_certificado_trabajo: bool,
    req_cv: bool,
    requisito_obligatorio: str,
    seguro_gestionado_at: str,
    seguro_gestionado_por: str,
    updated_at: str,
  })
  .passthrough();

export const institucionSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    airtable_id: str,
    codigo_tarjeta_campus: str,
    convenio_nuevo: num,
    created_at: str,
    direccion: str,
    logo_invert_dark: bool,
    logo_url: str,
    nombre: str,
    orientaciones: str,
    telefono: str,
    tutor: str,
  })
  .passthrough();

export const penalizacionSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    airtable_id: str,
    convocatoria_afectada: str,
    created_at: str,
    estudiante_id: str,
    fecha_incidente: str,
    notas: str,
    puntaje_penalizacion: num,
    tipo_incumplimiento: str,
  })
  .passthrough();

export const solicitudSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    actualizacion: str,
    airtable_id: str,
    contacto_tutor: str,
    convenio_uflo: str,
    created_at: str,
    descripcion_institucion: str,
    direccion_completa: str,
    email: str,
    email_institucion: str,
    estado_seguimiento: str,
    estudiante_id: str,
    legajo: str,
    localidad: str,
    nombre_alumno: str,
    nombre_institucion: str,
    notas: str,
    orientacion_sugerida: str,
    referente_institucion: str,
    telefono_institucion: str,
    tipo_practica: str,
    tutor_disponible: str,
  })
  .passthrough();

export const finalizacionSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    airtable_id: str,
    certificado_url: json,
    created_at: str,
    detalle_practicas: json,
    estado: str,
    estudiante_id: str,
    fecha_solicitud: str,
    informe_final_url: json,
    planilla_asistencia_url: json,
    planilla_horas_url: json,
    sugerencias_mejoras: str,
  })
  .passthrough();

export const compromisoSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    accepted_at: str,
    acepta_compromiso: bool,
    acepta_lectura: bool,
    convocatoria_id: str,
    created_at: str,
    dni: num,
    estado: str,
    estudiante_id: str,
    firma_texto: str,
    lanzamiento_id: str,
    legajo: str,
    nombre_completo: str,
    texto_acta: str,
    updated_at: str,
    version: str,
  })
  .passthrough();

export const convenioSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    archivo_url: str,
    created_at: str,
    es_renovacion: bool,
    fecha_firma: str,
    fecha_vencimiento: str,
    institucion_id: str,
    notas: str,
    tipo: str,
  })
  .passthrough();

/**
 * Valida una fila de la base contra su schema.
 *
 * - En producción es un **no-op** (cero overhead).
 * - En desarrollo, ante una discrepancia emite `logger.warn` con el detalle
 *   del drift y **nunca lanza**: el flujo de datos continúa con el row original.
 */
export function validateDbRow(schema: z.ZodTypeAny, row: unknown, tableName: string): void {
  if (!isDev) return;
  try {
    const result = schema.safeParse(row);
    if (!result.success) {
      logger.warn(`[dbSchema] Drift detectado en la tabla "${tableName}":`, result.error.issues);
    }
  } catch (e) {
    // La validación jamás debe romper el flujo, ni siquiera en dev.
    logger.warn(`[dbSchema] Error validando "${tableName}":`, e);
  }
}
