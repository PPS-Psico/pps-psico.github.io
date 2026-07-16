import { describe, it, expect } from "@jest/globals";
import {
  isBusinessDay,
  addBusinessDays,
  getAcademicRecess,
  getBusinessDaysCount,
} from "../businessDays";

// NOTA: estas funciones usan getters de hora local (getDay/getMonth/getDate)
// combinados con toISOString (UTC) para feriados. Los entornos objetivo
// (CI en UTC, desarrollo en Argentina UTC-3) preservan el día calendario,
// por eso construimos las fechas con `new Date(año, mesIndex, día, 12)`
// (mediodía local) para que el chequeo de feriados sea estable.
const localDate = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d, 12, 0, 0);

describe("businessDays", () => {
  describe("isBusinessDay", () => {
    it("considera un lunes normal como día hábil", () => {
      // 2025-03-10 es lunes, en marzo, sin feriado
      expect(isBusinessDay(localDate(2025, 3, 10))).toBe(true);
    });

    it("rechaza sábados y domingos", () => {
      expect(isBusinessDay(localDate(2025, 3, 15))).toBe(false); // sábado
      expect(isBusinessDay(localDate(2025, 3, 16))).toBe(false); // domingo
    });

    it("rechaza el receso universitario de verano", () => {
      expect(getAcademicRecess(localDate(2026, 1, 5))).toBe("summer");
      expect(isBusinessDay(localDate(2026, 1, 15))).toBe(false);
      expect(isBusinessDay(localDate(2026, 2, 2))).toBe(true);
    });

    it("rechaza el receso invernal 2026 de Río Negro (13 al 24 de julio)", () => {
      expect(getAcademicRecess(localDate(2026, 7, 13))).toBe("winter");
      expect(isBusinessDay(localDate(2026, 7, 13))).toBe(false);
      expect(isBusinessDay(localDate(2026, 7, 24))).toBe(false);
    });

    it("vuelve a contar como hábil después del receso invernal", () => {
      expect(isBusinessDay(localDate(2026, 7, 27))).toBe(true);
    });

    it("rechaza feriados nacionales conocidos", () => {
      expect(isBusinessDay(localDate(2025, 5, 1))).toBe(false); // Día del Trabajador
      expect(isBusinessDay(localDate(2025, 12, 25))).toBe(false); // Navidad
    });

    it("rechaza el feriado y el día turístico del 9 y 10 de julio de 2026", () => {
      expect(isBusinessDay(localDate(2026, 7, 9))).toBe(false);
      expect(isBusinessDay(localDate(2026, 7, 10))).toBe(false);
    });
  });

  describe("addBusinessDays", () => {
    it("suma un día hábil a un lunes y cae martes", () => {
      const result = addBusinessDays(localDate(2025, 3, 10), 1);
      expect(result.getDate()).toBe(11);
      expect(isBusinessDay(result)).toBe(true);
    });

    it("salta el fin de semana al sumar desde un viernes", () => {
      // 2025-03-14 es viernes; +1 hábil debe caer en lunes 17
      const result = addBusinessDays(localDate(2025, 3, 14), 1);
      expect(result.getDate()).toBe(17);
      expect(result.getDay()).toBe(1); // lunes
    });

    it("el resultado siempre es un día hábil", () => {
      const result = addBusinessDays(localDate(2025, 3, 10), 5);
      expect(isBusinessDay(result)).toBe(true);
    });

    it("calcula correctamente 14 días hábiles atravesando feriados y receso 2026", () => {
      const result = addBusinessDays(localDate(2026, 6, 22), 14);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(6);
      expect(result.getDate()).toBe(28);
    });
  });

  describe("getBusinessDaysCount", () => {
    it("cuenta los días hábiles entre lunes y viernes de la misma semana", () => {
      // de lunes 10 a viernes 14 = 4 días hábiles
      expect(getBusinessDaysCount(localDate(2025, 3, 10), localDate(2025, 3, 14))).toBe(4);
    });

    it("devuelve negativo cuando el rango está invertido", () => {
      expect(getBusinessDaysCount(localDate(2025, 3, 14), localDate(2025, 3, 10))).toBe(-4);
    });

    it("no cuenta el fin de semana intermedio", () => {
      // de viernes 14 a lunes 17 = 1 día hábil (lunes)
      expect(getBusinessDaysCount(localDate(2025, 3, 14), localDate(2025, 3, 17))).toBe(1);
    });

    it("devuelve 0 para el mismo día", () => {
      expect(getBusinessDaysCount(localDate(2025, 3, 10), localDate(2025, 3, 10))).toBe(0);
    });
  });
});
