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
 * La transición a "Activa" ahora la hace el admin explícitamente
 * (botón "Activar PPS" en la sala de Confirmación) — ya no se deriva de la
 * marca de aseguramiento. Esto desacopla "seguro listo" de "PPS corriendo"
 * y permite operar con reemplazos/consentimientos parciales.
 */
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS,
} from "../constants";
import { db } from "../lib/db";

// ── Tipos compartidos ─────────────────────────────────────────────────────────

/** Estado del lanzamiento en el pipeline de 5 pasos visibles (+ archivada). */
export type UIState = "borrador" | "seleccion" | "seguro" | "confirmacion" | "activa" | "archivada";

/** Categoría operativa del sidebar del Lanzador. */
export type SidebarBucket =
  | "borrador"
  | "abierta"
  | "seleccionar"
  | "asegurar"
  | "confirmacion"
  | "activa"
  | "archivada";

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
  borrador: { label: "Borradores", tone: "borrador", collapsedByDefault: true },
  abierta: { label: "Abiertas", tone: "seleccion", collapsedByDefault: false },
  seleccionar: { label: "A seleccionar", tone: "seleccion", collapsedByDefault: false },
  asegurar: { label: "A asegurar", tone: "seguro", collapsedByDefault: false },
  confirmacion: { label: "En confirmación", tone: "confirmacion", collapsedByDefault: false },
  activa: { label: "Activas", tone: "activa", collapsedByDefault: false },
  archivada: { label: "Archivadas", tone: "archivada", collapsedByDefault: true },
};

/** Orden del sidebar: acciones pendientes primero, archivadas al final. */
export const BUCKET_ORDER: SidebarBucket[] = [
  "seleccionar",
  "asegurar",
  "confirmacion",
  "abierta",
  "activa",
  "borrador",
  "archivada",
];

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
}

// ── Derivación de bucket (PURA) ────────────────────────────────────────────────

/**
 * Clasifica un lanzamiento en exactamente un bucket. Orden de precedencia:
 *  1. borrador
 *  2. archivada           (precede a la marca de aseguramiento)
 *  3. confirmacion        (sala de consentimientos; explícita en DB o por marca)
 *  4. activa              (admin activó la PPS explícitamente)
 *  5. hay seleccionados   → asegurar (Req 3.3/4.1)
 *  6. cerrada/vencida con inscriptos → seleccionar
 *  7. cerrada/vencida sin inscriptos → archivada (no prosperó)
 *  8. resto               → abierta
 *
 * Nótese: la marca `seguro_gestionado_at` ya NO clasifica como "activa".
 * Eso lo hace ahora `dbState === "activa"` (acción explícita del admin).
 */
export function deriveBucket(input: BucketInput): SidebarBucket {
  const { dbState, seguroGestionadoAt, totalSel, totalInsc, vencida } = input;

  if (dbState === "borrador") return "borrador";
  if (dbState === "archivada") return "archivada";
  if (dbState === "confirmacion") return "confirmacion";
  if (dbState === "activa") return "activa";

  // La marca de seguro tiene precedencia sobre los conteos y la ventana de
  // inscripción: si está seteada (aunque el DB haya quedado en 'Cerrado' por
  // datos legacy), el lanzamiento está operativamente en la sala de
  // Confirmación. Esto reemplaza el hack anterior que la trataba como 'activa'
  // y se saltaba la sala de consentimientos.
  if (seguroGestionadoAt != null) return "confirmacion";

  if (totalSel > 0) return "asegurar";

  const cerradaOVencida = dbState === "seguro" || (dbState === "seleccion" && vencida);
  if (cerradaOVencida && totalInsc > 0) return "seleccionar";
  if (cerradaOVencida) return "archivada";

  return "abierta";
}

/** True si el lanzamiento tiene marca de aseguramiento y no está archivado. */
export function isSeguroGestionado(input: BucketInput): boolean {
  return input.seguroGestionadoAt != null && deriveBucket(input) !== "archivada";
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
