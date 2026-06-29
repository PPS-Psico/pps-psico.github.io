import { generateRecurringCalendarLinks } from "../calendarUtils";
import type { CalendarEvent } from "../../types";

const baseEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "ev1",
  name: "PPS Hospital",
  schedule: "Lunes y Miércoles 9 a 13hs",
  orientation: "Clínica",
  location: "Av. Siempreviva 123",
  colorClasses: { tag: "", dot: "" },
  startDate: "2026-03-02",
  endDate: "2026-06-30",
  ...overrides,
});

describe("generateRecurringCalendarLinks", () => {
  it("genera links de Google y iCal con la info completa", () => {
    const result = generateRecurringCalendarLinks(baseEvent(), new Date("2026-03-02"));
    expect(result).not.toBeNull();
    expect(result!.google).toContain("https://www.google.com/calendar/render?");
    expect(result!.ical).toContain("data:text/calendar");
  });

  it("une múltiples días sin acento en la RRULE (Lunes y Viernes)", () => {
    const result = generateRecurringCalendarLinks(
      baseEvent({ schedule: "Lunes y Viernes 9 a 13hs" }),
      new Date("2026-03-02")
    );
    // El link de Google url-encodea el recur param: BYDAY=MO,FR
    expect(decodeURIComponent(result!.google)).toContain("BYDAY=MO,FR");
    expect(decodeURIComponent(result!.google)).toContain("FREQ=WEEKLY");
  });

  // ✅ Corregido (sesión 9): parseDaysOfWeek ahora normaliza diacríticos
  // (NFD + strip), así que "Miércoles"/"Sábado" se detectan correctamente.
  it("detecta días acentuados (Miércoles → WE)", () => {
    const result = generateRecurringCalendarLinks(
      baseEvent({ schedule: "Lunes y Miércoles 9 a 13hs" }),
      new Date("2026-03-02")
    );
    const decoded = decodeURIComponent(result!.google);
    expect(decoded).toContain("BYDAY=MO,WE");
  });

  it("detecta sábado acentuado (Sábado → SA)", () => {
    const result = generateRecurringCalendarLinks(
      baseEvent({ schedule: "Sábado 10 a 14" }),
      new Date("2026-03-07")
    );
    expect(decodeURIComponent(result!.google)).toContain("BYDAY=SA");
  });

  it("respeta la exclusión 'no <día>'", () => {
    const result = generateRecurringCalendarLinks(
      baseEvent({ schedule: "Martes 14 a 18, no jueves" }),
      new Date("2026-03-03")
    );
    const decoded = decodeURIComponent(result!.google);
    expect(decoded).toContain("BYDAY=TU");
    expect(decoded).not.toContain("TH");
  });

  it("devuelve null si falta el horario parseable", () => {
    expect(
      generateRecurringCalendarLinks(baseEvent({ schedule: "a convenir" }), new Date())
    ).toBeNull();
  });

  it("devuelve null si no hay día de la semana reconocible", () => {
    expect(
      generateRecurringCalendarLinks(baseEvent({ schedule: "9 a 13hs" }), new Date())
    ).toBeNull();
  });

  it("devuelve null si faltan fechas de inicio o fin", () => {
    expect(generateRecurringCalendarLinks(baseEvent({ startDate: null }), new Date())).toBeNull();
    expect(generateRecurringCalendarLinks(baseEvent({ endDate: null }), new Date())).toBeNull();
  });

  it("parsea distintos separadores de horario (guion)", () => {
    const result = generateRecurringCalendarLinks(
      baseEvent({ schedule: "Viernes 10-14" }),
      new Date("2026-03-06")
    );
    expect(result).not.toBeNull();
    expect(decodeURIComponent(result!.google)).toContain("BYDAY=FR");
  });
});
