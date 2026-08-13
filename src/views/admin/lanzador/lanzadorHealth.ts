/**
 * lanzadorHealth — Cálculo puro de la "Salud por franja horaria".
 *
 * Extraído del `useMemo` inline de SeleccionView para poder testearlo aislado.
 *
 * Las mega-convocatorias usan cupos exactos por franja. Los lanzamientos
 * anteriores conservan el cálculo estimado (total ÷ cantidad de franjas).
 */
import { parseSchedules, normalizeSchedule } from "../../../utils/scheduleUtils";
import { normalizeStringForComparison } from "../../../utils/formatters";

/** Fila mínima del roster necesaria para el cálculo (subset de RosterRow). */
export interface HealthRosterRow {
  estado_inscripcion?: string | null;
  horario_asignado?: string | null;
  horario_seleccionado?: string | null;
  opcion_horario_asignado_id?: string | null;
  convocatoria_preferencias?: Array<{ opcion_horario_id: string | null }>;
}

export interface ExactHealthSlot {
  id: string;
  label: string;
  cupos: number;
}

export interface HorarioHealthInput {
  horarioStr: string | null;
  horariosFijos: boolean;
  cupos: number | null;
  roster: HealthRosterRow[];
  optionSlots?: ExactHealthSlot[];
}

export interface HorarioHealthSlot {
  label: string;
  /** Inscriptos cuya franja coincide con este slot. */
  count: number;
  /** De esos inscriptos, cuántos están "Seleccionado". */
  seleccionados: number;
  /** Cupo exacto o estimado. `null` si no hay cupo total. */
  cuposLocal: number | null;
  isEstimated: boolean;
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
  const { horarioStr, horariosFijos, cupos, roster, optionSlots = [] } = input;
  const hasExactSlots = optionSlots.length > 0;
  if (horariosFijos && !hasExactSlots) return [];

  const slots = hasExactSlots
    ? optionSlots
    : parseSchedules(horarioStr).map((label) => ({ id: null, label, cupos: null }));
  if (slots.length === 0) return [];

  const cuposEstimados = cupos ? Math.max(1, Math.round(cupos / slots.length)) : null;

  return slots.map((slot) => {
    const cuposPorSlot = hasExactSlots ? slot.cupos : cuposEstimados;
    const norm = normalizeSchedule(slot.label);
    const matching = roster.filter((row) => {
      if (slot.id) {
        return (
          row.opcion_horario_asignado_id === slot.id ||
          row.convocatoria_preferencias?.some(
            (preference) => preference.opcion_horario_id === slot.id
          )
        );
      }
      const horario = row.horario_asignado || row.horario_seleccionado;
      return horario && normalizeSchedule(horario) === norm;
    });
    const count = matching.length;
    const seleccionados = roster.filter((row) => {
      const selected =
        normalizeStringForComparison(row.estado_inscripcion as string) === "seleccionado";
      if (!selected) return false;
      if (slot.id) return row.opcion_horario_asignado_id === slot.id;
      const horario = row.horario_asignado || row.horario_seleccionado;
      return horario && normalizeSchedule(horario) === norm;
    }).length;

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
      label: slot.label,
      count,
      seleccionados,
      cuposLocal: cuposPorSlot,
      isEstimated: !hasExactSlots,
      pct,
      status,
      libres,
      faltanSeleccion,
      selStatus,
    };
  });
}
