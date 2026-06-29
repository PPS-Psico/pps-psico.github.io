/**
 * lanzadorHealth — Cálculo puro de la "Salud por franja horaria".
 *
 * Extraído del `useMemo` inline de SeleccionView para poder testearlo aislado.
 *
 * ⚠️ IMPORTANTE sobre los cupos por franja: el modelo de datos NO guarda un
 * cupo por franja. Solo existe un cupo TOTAL del lanzamiento
 * (`cupos_disponibles`) y un string de horarios (`;`-separado). Por eso
 * `cuposLocal` es una ESTIMACIÓN pareja (`total ÷ nº de franjas`), no un dato
 * real. La UI debe mostrarlo como estimación (no afirmar "Faltan X" como exacto).
 */
import { parseSchedules, normalizeSchedule } from "../../../utils/scheduleUtils";
import { normalizeStringForComparison } from "../../../utils/formatters";

/** Fila mínima del roster necesaria para el cálculo (subset de RosterRow). */
export interface HealthRosterRow {
  estado_inscripcion?: string | null;
  horario_asignado?: string | null;
  horario_seleccionado?: string | null;
}

export interface HorarioHealthInput {
  horarioStr: string | null;
  horariosFijos: boolean;
  cupos: number | null;
  roster: HealthRosterRow[];
}

export interface HorarioHealthSlot {
  label: string;
  /** Inscriptos cuya franja coincide con este slot. */
  count: number;
  /** De esos inscriptos, cuántos están "Seleccionado". */
  seleccionados: number;
  /** Cupo por franja ESTIMADO (total ÷ nº de franjas). `null` si no hay cupo total. */
  cuposLocal: number | null;
  /** Ocupación del slot respecto al cupo estimado (0..1+). */
  pct: number;
  status: "low" | "ok" | "full";
  /** Lugares libres estimados (cupoEstimado − inscriptos). */
  libres: number | null;
  /** Faltan seleccionar estimados (cupoEstimado − seleccionados). */
  faltanSeleccion: number | null;
  selStatus: "completo" | "falta" | "excedido" | "indef";
}

/**
 * Calcula la salud por franja a partir del roster de inscripciones.
 *
 * - Si el lanzamiento tiene horarios fijos (todos comparten franja) → `[]`
 *   (no hay diferenciación por franja que mostrar).
 * - El cupo por franja es estimado (división pareja del total).
 * - Un inscripto cae en una franja por su `horario_asignado` (lo pone el admin
 *   en la selección) o, si no, por su `horario_seleccionado` (lo eligió al
 *   inscribirse).
 */
export function computeHorarioHealth(input: HorarioHealthInput): HorarioHealthSlot[] {
  const { horarioStr, horariosFijos, cupos, roster } = input;
  if (horariosFijos) return [];

  const slots = parseSchedules(horarioStr);
  if (slots.length === 0) return [];

  const cuposPorSlot = cupos ? Math.max(1, Math.round(cupos / slots.length)) : null;

  return slots.map((slot) => {
    const norm = normalizeSchedule(slot);
    const matching = roster.filter((r) => {
      const h = r.horario_asignado || r.horario_seleccionado;
      return h && normalizeSchedule(h) === norm;
    });
    const count = matching.length;
    const seleccionados = matching.filter(
      (r) => normalizeStringForComparison(r.estado_inscripcion as string) === "seleccionado"
    ).length;

    const pct = cuposPorSlot ? count / cuposPorSlot : 0;
    const status: "low" | "ok" | "full" =
      cuposPorSlot && count === 0 ? "low" : pct >= 1 ? "full" : pct >= 0.5 ? "ok" : "low";

    const libres = cuposPorSlot != null ? Math.max(0, cuposPorSlot - count) : null;
    const faltanSeleccion = cuposPorSlot != null ? Math.max(0, cuposPorSlot - seleccionados) : null;
    const selStatus: "completo" | "falta" | "excedido" | "indef" =
      cuposPorSlot == null
        ? "indef"
        : seleccionados > cuposPorSlot
          ? "excedido"
          : seleccionados === cuposPorSlot
            ? "completo"
            : "falta";

    return {
      label: slot,
      count,
      seleccionados,
      cuposLocal: cuposPorSlot,
      pct,
      status,
      libres,
      faltanSeleccion,
      selStatus,
    };
  });
}
