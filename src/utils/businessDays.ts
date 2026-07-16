/**
 * Calendario de días hábiles administrativos para la sede Comahue.
 *
 * Excluye fines de semana, feriados y días no laborables nacionales, además
 * de los recesos universitarios oficiales de la región de Río Negro/Comahue.
 * Las fechas se guardan explícitamente por año porque los feriados trasladables,
 * los días turísticos y los recesos cambian en cada ciclo.
 */

export type AcademicRecessType = "summer" | "winter";

interface AcademicRecess {
  type: AcademicRecessType;
  start: string;
  end: string;
}

// Fuentes oficiales:
// 2024: Argentina.gob.ar, Decreto 106/2023.
// 2025: Argentina.gob.ar, Decreto 1027/2024 y Resolución 139/2025.
// 2026: Argentina.gob.ar, Resolución 164/2025.
const NATIONAL_NON_WORKING_DAYS = [
  // 2024
  "2024-01-01",
  "2024-02-12",
  "2024-02-13",
  "2024-03-24",
  "2024-03-28",
  "2024-03-29",
  "2024-04-01",
  "2024-04-02",
  "2024-05-01",
  "2024-05-25",
  "2024-06-17",
  "2024-06-20",
  "2024-06-21",
  "2024-07-09",
  "2024-08-17",
  "2024-10-11",
  "2024-10-12",
  "2024-11-18",
  "2024-12-08",
  "2024-12-25",
  // 2025
  "2025-01-01",
  "2025-03-03",
  "2025-03-04",
  "2025-03-24",
  "2025-04-02",
  "2025-04-17",
  "2025-04-18",
  "2025-05-01",
  "2025-05-02",
  "2025-05-25",
  "2025-06-16",
  "2025-06-20",
  "2025-07-09",
  "2025-08-15",
  "2025-08-17",
  "2025-10-10",
  "2025-11-21",
  "2025-11-24",
  "2025-12-08",
  "2025-12-25",
  // 2026
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-03-23",
  "2026-03-24",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-25",
  "2026-06-15",
  "2026-06-20",
  "2026-07-09",
  "2026-07-10",
  "2026-08-17",
  "2026-10-12",
  "2026-11-23",
  "2026-12-07",
  "2026-12-08",
  "2026-12-25",
];

// Fuentes regionales oficiales:
// 2024 y 2025: calendarios y rectificaciones de la Universidad Nacional del Comahue.
// 2026: Calendario Académico del IPAP Río Negro y Ordenanza UNCo 1091/2025.
const ACADEMIC_RECESSES: AcademicRecess[] = [
  { type: "summer", start: "2024-01-02", end: "2024-01-31" },
  { type: "winter", start: "2024-07-08", end: "2024-07-26" },
  { type: "summer", start: "2025-01-06", end: "2025-01-31" },
  { type: "winter", start: "2025-07-07", end: "2025-07-18" },
  { type: "summer", start: "2026-01-05", end: "2026-01-31" },
  { type: "winter", start: "2026-07-13", end: "2026-07-24" },
];

const nonWorkingDaySet = new Set(NATIONAL_NON_WORKING_DAYS);

/** Crea una clave YYYY-MM-DD usando el día calendario local, sin conversiones UTC. */
function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Devuelve el tipo de receso que contiene la fecha, o null fuera de receso. */
export function getAcademicRecess(date: Date): AcademicRecessType | null {
  const dateKey = toLocalDateKey(date);
  return (
    ACADEMIC_RECESSES.find(({ start, end }) => dateKey >= start && dateKey <= end)?.type ?? null
  );
}

/** Indica si la fecha computa como día hábil administrativo. */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();

  if (day === 0 || day === 6) return false;
  if (nonWorkingDaySet.has(toLocalDateKey(date))) return false;
  if (getAcademicRecess(date)) return false;

  return true;
}

/** Suma una cantidad de días hábiles sin contar el día de inicio. */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let count = 0;
  let safety = 0;

  while (count < days && safety < 365 * 2) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) count++;
    safety++;
  }

  return result;
}

/** Cuenta los días hábiles entre dos fechas, excluyendo la fecha inicial. */
export function getBusinessDaysCount(from: Date, to: Date): number {
  if (from > to) return -getBusinessDaysCount(to, from);

  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const target = new Date(to);
  target.setHours(0, 0, 0, 0);

  let count = 0;
  let safety = 0;

  while (current < target && safety < 365 * 2) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current)) count++;
    safety++;
  }

  return count;
}
