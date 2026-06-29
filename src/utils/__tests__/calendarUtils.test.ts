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

  // ⚠️ Bug latente documentado: parseDaysOfWeek compara contra claves SIN
  // acento ("miercoles", "sabado"), pero toLowerCase() conserva el acento del
  // texto real ("Miércoles", "Sábado"). Resultado: esos dos días NO se detectan.
  // Este test fija la conducta ACTUAL (no la deseada) hasta que el owner decida
  // corregirlo (cambiaría links de calendario ya en producción).
  it("NO detecta días acentuados (miércoles) — conducta actual, bug conocido", () => {
    const result = generateRecurringCalendarLinks(
      baseEvent({ schedule: "Lunes y Miércoles 9 a 13hs" }),
      new Date("2026-03-02")
    );
    const decoded = decodeURIComponent(result!.google);
    // Solo el lunes queda en la RRULE; el miércoles se pierde por el acento:
    expect(decoded).toContain("BYDAY=MO;UNTIL");
    expect(decoded).not.toContain("BYDAY=MO,WE");
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
