/**
 * aseguramientoService — Lógica del flujo de aseguramiento de PPS.
 *
 * Spec: .kiro/specs/flujo-aseguramiento-pps
 *
 * Contiene:
 *  - `deriveBucket`: función PURA que clasifica un lanzamiento en una categoría
 *    operativa del Lanzador a partir de su estado, marca de aseguramiento y
 *    conteos. Es la única fuente de verdad de la regla de buckets.
 *  - `marcarAseguramiento` / `revertirAseguramiento`: persisten / borran la
 *    marca `seguro_gestionado_at` en `lanzamientos_pps`.
 *  - Helpers de formato (`buildClipboardText`, `buildHeader`) usados por el
 *    Generador de seguros.
 *
 * La transición a "Activas" se DERIVA de `seguro_gestionado_at` (no se toca
 * `estado_convocatoria`), para no acoplar con el auto-archivado ni con otras
 * automatizaciones que dependen de `estado_convocatoria`.
 */
import {
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS,
} from "../constants";
import { db } from "../lib/db";

// ── Tipos compartidos ─────────────────────────────────────────────────────────

/** Estado del lanzamiento mapeado desde `estado_convocatoria`. */
export type UIState = "borrador" | "abierta" | "cerrada" | "seleccionada" | "activa" | "archivada";

/** Categoría operativa del sidebar del Lanzador. */
export type SidebarBucket =
  | "borrador"
  | "abierta"
  | "seleccionar"
  | "asegurar"
  | "activa"
  | "archivada";

export interface BucketInput {
  /** Estado mapeado desde `estado_convocatoria`. */
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
 *  3. marca presente      → activa   (Req 6.1/6.3/3.2)
 *  4. estado activa       → activa
 *  5. hay seleccionados   → asegurar (Req 3.3/4.1)
 *  6. cerrada/vencida con inscriptos → seleccionar
 *  7. cerrada/vencida sin inscriptos → archivada (no prosperó)
 *  8. resto               → abierta
 */
export function deriveBucket(input: BucketInput): SidebarBucket {
  const { dbState, seguroGestionadoAt, totalSel, totalInsc, vencida } = input;

  if (dbState === "borrador") return "borrador";
  if (dbState === "archivada") return "archivada";

  // El seguro ya se gestionó → la PPS está operativamente "Activa".
  if (seguroGestionadoAt != null) return "activa";

  if (dbState === "activa") return "activa";

  if (totalSel > 0) return "asegurar";

  const cerradaOVencida = dbState === "cerrada" || (dbState === "abierta" && vencida);
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
 * Cierra el flujo de aseguramiento de un lanzamiento (paso 4: descargar lista).
 * Propaga el error si la persistencia falla (el caller decide cómo mostrarlo y
 * NO debe marcar el flujo como completado si esto rechaza — Req 1.5).
 */
export async function marcarAseguramiento(
  lanzamientoId: string,
  coordinadorId: string | null
): Promise<void> {
  await db.lanzamientos.update(lanzamientoId, {
    [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: new Date().toISOString(),
    [FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS]: coordinadorId,
  } as Record<string, unknown>);
}

/**
 * Revierte el aseguramiento de un lanzamiento: borra `seguro_gestionado_at`
 * (vuelve a "A asegurar") y registra el coordinador que hizo la reversión.
 */
export async function revertirAseguramiento(
  lanzamientoId: string,
  coordinadorId: string | null
): Promise<void> {
  await db.lanzamientos.update(lanzamientoId, {
    [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: null,
    [FIELD_SEGURO_GESTIONADO_POR_LANZAMIENTOS]: coordinadorId,
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
