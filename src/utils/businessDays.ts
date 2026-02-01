/**
 * Utility for calculating business days in Argentina,
 * accounting for national holidays and the January recess.
 */

// Argentina National Holidays 2024, 2025, and 2026
const HOLIDAYS = [
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
  "2024-11-20",
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
  "2025-05-25",
  "2025-06-16",
  "2025-06-20",
  "2025-07-09",
  "2025-08-15",
  "2025-08-17",
  "2025-10-12",
  "2025-10-13",
  "2025-11-24",
  "2025-12-08",
  "2025-12-25",
  // 2026
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-03-24",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-25",
  "2026-06-15",
  "2026-06-20",
  "2026-07-09",
  "2026-08-17",
  "2026-10-12",
  "2026-11-23",
  "2026-12-08",
  "2026-12-25",
];

const holidaySet = new Set(HOLIDAYS);

/**
 * Checks if a given date is a business day (non-weekend, non-holiday, not in January recess, and not in winter break).
 * @param date The date to check
 * @returns true if it's a business day
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const month = date.getMonth(); // 0 = January, 6 = July, 7 = August
  const dayOfMonth = date.getDate();
  const dateString = date.toISOString().split("T")[0];

  // 1. Weekend check
  if (day === 0 || day === 6) return false;

  // 2. January recess check
  if (month === 0) return false;

  // 3. Winter break check (Receso Invernal: July 21 to August 1)
  // July is month 6, August is month 7
  if ((month === 6 && dayOfMonth >= 21) || (month === 7 && dayOfMonth <= 1)) {
    return false;
  }

  // 4. Holiday check
  if (holidaySet.has(dateString)) return false;

  return true;
}

/**
 * Calculates a target date by adding a specific number of business days to a start date.
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let count = 0;
  let safety = 0;

  while (count < days && safety < 365 * 2) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      count++;
    }
    safety++;
  }

  return result;
}

/**
 * Calculates the number of business days between two dates.
 */
export function getBusinessDaysCount(from: Date, to: Date): number {
  if (from > to) {
    return -getBusinessDaysCount(to, from);
  }

  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const target = new Date(to);
  target.setHours(0, 0, 0, 0);

  let count = 0;
  let safety = 0;

  while (current < target && safety < 365 * 2) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current)) {
      count++;
    }
    safety++;
  }

  return count;
}
