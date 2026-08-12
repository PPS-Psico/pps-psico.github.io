/**
 * aseguramientoService — Lógica del flujo de aseguramiento de PPS.
 *
 * Spec: .kiro/specs/flujo-aseguramiento-pps
 *
 * Contiene:
 *  - Tipos compartidos del Lanzador (UIState, SidebarBucket, STATE_META, etc.).
 *  - `deriveBucket`: función PURA que clasifica un lanzamiento en una categoría
 *    operativa del Lanzador a partir de su estado, marca de aseguramiento y
 *    conteos. Es la única fuente de verdad de la regla de buckets.
 *  - `marcarAseguramiento` / `revertirAseguramiento`: persisten / borran la
 *    marca `seguro_gestionado_at` en `lanzamientos_pps`. Además transicionan
 *    `estado_convocatoria` ↔ 'Confirmacion'/'Cerrado' para que el nuevo
 *    pipeline (5 pasos: Borrador → Selección → Seguro → Confirmación → Activa)
 *    refleje la sala de consentimientos.
 *  - Helpers de formato (`buildClipboardText`, `buildHeader`) usados por el
 *    Generador de seguros.
 *
 * "Activa" y "Finalizada" las decide el CALENDARIO, no un click: una PPS está
 * en curso entre su `fecha_inicio` y su `fecha_finalizacion`, y sale de la vista
 * operativa cuando esa última pasa. El botón "Activar PPS" de la sala de
 * Confirmación sigue existiendo como confirmación explícita, pero ya no es
 * requisito para que la PPS aparezca como activa.
 */
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS,
} from "../constants";
import { db } from "../lib/db";
import { parseToUTCDate } from "../utils/formatters";

// ── Tipos compartidos ─────────────────────────────────────────────────────────

/** Estado del lanzamiento en el pipeline de 5 pasos visibles (+ archivada). */
export type UIState = "borrador" | "seleccion" | "seguro" | "confirmacion" | "activa" | "archivada";

/**
 * Categoría operativa del sidebar del Lanzador.
 *
 * Las seis primeras son el recorrido visible, incluido el borrador que todavía
 * no fue publicado. Las dos últimas NO se muestran como grupo: son la forma de
 * salir de la vista operativa (`finalizada` cuando la PPS terminó, `oculta`
 * cuando una convocatoria cerrada no prosperó o quedó archivada). Siguen siendo
 * alcanzables por el buscador del sidebar.
 */
export type SidebarBucket =
  | "borrador"
  | "abierta"
  | "seleccionar"
  | "asegurar"
  | "confirmacion"
  | "activa"
  | "finalizada"
  | "oculta";

/** Metadata del pipeline (label + step). Los steps van de 1 a 6. */
export const STATE_META: Record<UIState, { label: string; step: number }> = {
  borrador: { label: "Borrador", step: 1 },
  seleccion: { label: "Selección", step: 2 },
  seguro: { label: "Seguro", step: 3 },
  confirmacion: { label: "Confirmación", step: 4 },
  activa: { label: "Activa", step: 5 },
  archivada: { label: "Archivada", step: 6 },
};

/** Pasos visibles en el pipeline (no incluye archivada). */
export const PIPELINE_STEPS = ["Borrador", "Selección", "Seguro", "Confirmación", "Activa"];

/** Metadata de las categorías del sidebar. */
export const BUCKET_META: Record<
  SidebarBucket,
  { label: string; tone: UIState; collapsedByDefault: boolean }
> = {
  borrador: { label: "Borradores", tone: "borrador", collapsedByDefault: false },
  abierta: { label: "Abiertas", tone: "seleccion", collapsedByDefault: false },
  seleccionar: { label: "A seleccionar", tone: "seleccion", collapsedByDefault: false },
  asegurar: { label: "A asegurar", tone: "seguro", collapsedByDefault: false },
  confirmacion: { label: "En confirmación", tone: "confirmacion", collapsedByDefault: false },
  activa: { label: "Activas", tone: "activa", collapsedByDefault: false },
  // Estos dos solo se listan cuando hay una búsqueda activa, así que arrancan
  // expandidos: si el admin los buscó, los quiere ver.
  finalizada: { label: "Finalizadas", tone: "archivada", collapsedByDefault: false },
  oculta: { label: "Fuera del pipeline", tone: "borrador", collapsedByDefault: false },
};

/**
 * Orden del sidebar: el recorrido operativo, con las acciones pendientes
 * primero. Una convocatoria vive acá desde que se abre la inscripción hasta que
 * llega su fecha de finalización.
 */
export const BUCKET_ORDER: SidebarBucket[] = [
  "seleccionar",
  "asegurar",
  "confirmacion",
  "borrador",
  "abierta",
  "activa",
];

/**
 * Buckets que NO forman parte del recorrido y por lo tanto no se muestran como
 * grupo: una PPS finalizada ya no pide trabajo, y una convocatoria cerrada sin
 * postulantes queda fuera del pipeline. Los borradores (`estado = Oculto`) sí
 * tienen grupo propio para que siempre se puedan revisar y publicar.
 */
export const HIDDEN_BUCKETS: SidebarBucket[] = ["finalizada", "oculta"];

/**
 * Dónde está parado el lanzamiento en el calendario. Es el eje que manda sobre
 * el pipeline: una PPS que arrancó está en curso aunque el admin nunca haya
 * apretado "Activar", y una que llegó a su fecha de fin terminó aunque haya
 * quedado con consentimientos pendientes.
 *
 * `desconocida` = no hay fechas suficientes para ubicarla (típicamente registros
 * legacy sin `fecha_finalizacion`). Nunca se la trata como en curso: sin fecha
 * de fin no hay forma de saber si sigue viva, y suponer que sí llenaría
 * "Activas" de ruido histórico.
 */
export type LaunchTimeline = "pendiente" | "en_curso" | "finalizada" | "desconocida";

/**
 * Ubica un lanzamiento en el calendario comparando por día (no por instante).
 *
 * Las fechas vienen como `YYYY-MM-DD` y se normalizan a mediodía UTC vía
 * `parseToUTCDate`: comparar con `new Date(str)` + `setHours(0,0,0,0)` corría un
 * día hacia atrás en timezones negativos como Argentina.
 */
export function deriveTimeline(
  fechaInicio: string | null | undefined,
  fechaFinalizacion: string | null | undefined,
  now: Date = new Date()
): LaunchTimeline {
  const hoy = parseToUTCDate(now.toISOString());
  const ini = parseToUTCDate(fechaInicio);
  const fin = parseToUTCDate(fechaFinalizacion);
  if (!hoy) return "desconocida";

  if (fin && fin.getTime() < hoy.getTime()) return "finalizada";
  if (!ini) return "desconocida";
  if (ini.getTime() > hoy.getTime()) return "pendiente";
  // Ya arrancó: solo es "en curso" si sabemos que todavía no terminó.
  return fin ? "en_curso" : "desconocida";
}

export interface BucketInput {
  /** Estado mapeado desde `estado_convocatoria` (+ marca de seguro). */
  dbState: UIState;
  /** Valor de `seguro_gestionado_at` (null = no asegurado). */
  seguroGestionadoAt: string | null;
  /** Estudiantes con `estado_inscripcion = "seleccionado"`. */
  totalSel: number;
  /** Total de inscriptos a la convocatoria. */
  totalInsc: number;
  /** ¿La ventana de inscripción ya venció? */
  vencida: boolean;
  /** Posición en el calendario (ver `deriveTimeline`). */
  timeline: LaunchTimeline;
}

// ── Derivación de bucket (PURA) ────────────────────────────────────────────────

/**
 * Clasifica un lanzamiento en exactamente un bucket. Orden de precedencia:
 *  1. finalizada          (fecha de fin pasada → sale de la vista operativa)
 *  2. activa              (arrancó y no terminó, sin importar el paso del admin)
 *  3. borrador            (estado Oculto y todavía no arrancó)
 *  4. oculta              (archivada en DB y todavía no arrancó)
 *  5. activa              (marcada 'Activa' en DB aunque no haya llegado su fecha)
 *  6. confirmacion        (sala de consentimientos; explícita en DB o por marca)
 *  7. hay seleccionados   → asegurar (Req 3.3/4.1)
 *  8. cerrada/vencida con inscriptos → seleccionar
 *  9. cerrada/vencida sin inscriptos → oculta (no prosperó)
 * 10. resto               → abierta
 *
 * El calendario tiene precedencia sobre el pipeline (1 y 2). Antes "Activa"
 * dependía de un click del admin en la sala de Confirmación, así que las PPS
 * que arrancaban sin ese click quedaban trabadas en pasos previos y una regla
 * de "archivada efectiva" terminaba enterrándolas.
 */
export function deriveBucket(input: BucketInput): SidebarBucket {
  const { dbState, seguroGestionadoAt, totalSel, totalInsc, vencida, timeline } = input;

  if (timeline === "finalizada") return "finalizada";
  if (timeline === "en_curso") return "activa";

  if (dbState === "borrador") return "borrador";
  if (dbState === "archivada") return "oculta";
  if (dbState === "activa") return "activa";
  if (dbState === "confirmacion") return "confirmacion";

  // La marca de seguro tiene precedencia sobre los conteos y la ventana de
  // inscripción: si está seteada (aunque el DB haya quedado en 'Cerrado' por
  // datos legacy), el lanzamiento está operativamente en la sala de
  // Confirmación.
  if (seguroGestionadoAt != null) return "confirmacion";

  if (totalSel > 0) return "asegurar";

  const cerradaOVencida = dbState === "seguro" || (dbState === "seleccion" && vencida);
  if (cerradaOVencida && totalInsc > 0) return "seleccionar";
  if (cerradaOVencida) return "oculta";

  return "abierta";
}

/** True si el lanzamiento tiene marca de aseguramiento y sigue en el recorrido. */
export function isSeguroGestionado(input: BucketInput): boolean {
  return input.seguroGestionadoAt != null && deriveBucket(input) !== "finalizada";
}

// ── Mutaciones de aseguramiento ─────────────────────────────────────────────────

/**
 * Cierra el flujo de aseguramiento de un lanzamiento (paso 4: sala de
 * confirmaciones). Persiste DOS cosas:
 *  - `seguro_gestionado_at` (timestamp) y `seguro_gestionado_por` (auditoría).
 *  - `estado_convocatoria = 'Confirmacion'` (transición explícita al
 *    bucket "En confirmación" del nuevo pipeline).
 *
 * Esto desacopla "seguro listo" de "PPS activa": la PPS puede arrancar
 * (transición a 'Activa' manual del admin) con reemplazos o consentimientos
 * parciales aún en curso.
 *
 * Propaga el error si la persistencia falla (el caller decide cómo mostrarlo
 * y NO debe marcar el flujo como completado si esto rechaza — Req 1.5).
 */
export async function marcarAseguramiento(
  lanzamientoId: string,
  coordinadorId: string | null
): Promise<void> {
  await db.lanzamientos.update(lanzamientoId, {
    [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: new Date().toISOString(),
    [FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS]: coordinadorId,
    [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Confirmacion",
  } as Record<string, unknown>);
}

/**
 * Revierte el aseguramiento: borra `seguro_gestionado_at` y regresa el estado
 * de la convocatoria a 'Cerrado' (= "A asegurar" en el sidebar). El admin
 * puede luego re-abrir la mesa a 'Abierta' si necesita más candidatos.
 */
export async function revertirAseguramiento(
  lanzamientoId: string,
  coordinadorId: string | null
): Promise<void> {
  await db.lanzamientos.update(lanzamientoId, {
    [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: null,
    [FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS]: coordinadorId,
    [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrado",
  } as Record<string, unknown>);
}

// ── Helpers de formato del Generador de seguros ─────────────────────────────────

export interface ClipboardStudent {
  apellido: string;
  nombre: string;
  dni: string;
  legajo: string;
  cargo: string;
  lugarCompleto: string;
  duracionCompleta: string;
}

/**
 * Arma el texto a copiar al portapapeles: una fila por estudiante, 7 campos
 * separados por tabulación en orden fijo, filas unidas por salto de línea.
 */
export function buildClipboardText(students: ClipboardStudent[]): string {
  return students
    .map((s) =>
      [s.apellido, s.nombre, s.dni, s.legajo, s.cargo, s.lugarCompleto, s.duracionCompleta].join(
        "\t"
      )
    )
    .join("\n");
}

export interface SeguroHeader {
  institucion: string;
  fecha: string;
  seleccionados: number;
}

/** Datos del encabezado del generador: institución, fecha y cantidad. */
export function buildHeader(args: {
  institucion: string | null;
  fecha: string | null;
  seleccionados: number;
}): SeguroHeader {
  return {
    institucion: args.institucion?.trim() || "Sin institución",
    fecha: args.fecha?.trim() || "Sin fecha",
    seleccionados: args.seleccionados,
  };
}
