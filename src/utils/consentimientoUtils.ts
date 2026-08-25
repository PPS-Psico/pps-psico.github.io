export const CONSENTIMIENTO_TIME_ZONE = "America/Argentina/Buenos_Aires";

const HOURS_24_MS = 24 * 60 * 60 * 1000;

const buenosAiresDateKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CONSENTIMIENTO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

/**
 * El consentimiento solo se abre cuando la mesa cierra antes del día de inicio.
 * Un cierre el mismo día (o posterior) omite firma, correo y bajas automáticas.
 */
export const isConsentimientoRequiredOnClose = (
  fechaInicio: unknown,
  closedAt: Date = new Date()
): boolean => {
  const startDate = String(fechaInicio ?? "")
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!startDate || Number.isNaN(closedAt.getTime())) return true;
  return startDate > buenosAiresDateKey(closedAt);
};

/**
 * Interpreta la fecha calendario de inicio a las 00:00 de Buenos Aires.
 * Argentina usa UTC-03:00 sin horario de verano; mantener el offset explícito
 * evita que `new Date("YYYY-MM-DD")` la trate como medianoche UTC.
 */
export const parsePpsStartAtBuenosAires = (value: unknown): Date | null => {
  const datePart = String(value ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0];
  if (!datePart) return null;

  const date = new Date(`${datePart}T00:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Cierre del consentimiento: 24 h antes del inicio. Si la selección ocurrió
 * dentro de esas últimas 24 h, el estudiante conserva la ventana hasta el
 * comienzo mismo de la PPS. Si excepcionalmente fue seleccionado cuando la PPS
 * ya había comenzado, recibe 24 h completas desde la selección para que el
 * plazo nunca nazca vencido. Un último recordatorio manual reemplaza ese cierre
 * por una ventana individual de 24 h desde el envío.
 */
export const getConsentimientoDeadline = (
  fechaInicio: unknown,
  selectedAt: unknown,
  listaEntregadaAt?: unknown,
  finalReminderSentAt?: unknown
): Date | null => {
  const finalReminder = finalReminderSentAt ? new Date(String(finalReminderSentAt)) : null;
  if (finalReminder && !Number.isNaN(finalReminder.getTime())) {
    return new Date(finalReminder.getTime() + HOURS_24_MS);
  }

  const start = parsePpsStartAtBuenosAires(fechaInicio);
  const selected = new Date(String(selectedAt ?? ""));
  if (!start || Number.isNaN(selected.getTime())) return null;

  const regularDeadline = new Date(start.getTime() - HOURS_24_MS);
  const calendarDeadline =
    selected.getTime() >= start.getTime()
      ? new Date(selected.getTime() + HOURS_24_MS)
      : selected.getTime() <= regularDeadline.getTime()
        ? regularDeadline
        : start;
  const delivered = listaEntregadaAt ? new Date(String(listaEntregadaAt)) : null;

  if (delivered && !Number.isNaN(delivered.getTime())) {
    return delivered.getTime() < calendarDeadline.getTime() ? delivered : calendarDeadline;
  }

  return calendarDeadline;
};

export const formatConsentimientoDeadline = (deadline: Date): string =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: CONSENTIMIENTO_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(deadline);

export const formatConsentimientoDeadlineShort = (deadline: Date): string =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: CONSENTIMIENTO_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(deadline);
