import { describe, it, expect } from "@jest/globals";
import {
  formatDate,
  normalizeStringForComparison,
  getEspecialidadClasses,
  getStatusVisuals,
  parseToUTCDate,
  safeGetId,
  toTitleCase,
  simpleNameSplit,
  formatPhoneNumber,
  addBusinessDays,
  getBusinessDaysDiff,
} from "../formatters";

describe("formatters", () => {
  describe("formatDate", () => {
    it("should format an ISO date string correctly", () => {
      expect(formatDate("2023-10-27T10:00:00.000Z")).toBe("27/10/2023");
    });

    it("should handle undefined or null input gracefully", () => {
      expect(formatDate(undefined)).toBe("N/A");
    });

    it('should return "Fecha inválida" for invalid date strings', () => {
      expect(formatDate("not a date")).toBe("Fecha inválida");
      expect(formatDate("2023-20-20")).toBe("Fecha inválida"); // invalid month
    });
  });

  describe("normalizeStringForComparison", () => {
    it("should convert to lowercase, trim, and remove accents", () => {
      expect(normalizeStringForComparison("  Educación  ")).toBe("educacion");
      expect(normalizeStringForComparison("Clínica")).toBe("clinica");
      expect(normalizeStringForComparison("COMUNITARIA")).toBe("comunitaria");
    });

    it("should handle empty or undefined strings", () => {
      expect(normalizeStringForComparison("")).toBe("");
      expect(normalizeStringForComparison(undefined)).toBe("");
    });
  });

  describe("getEspecialidadClasses", () => {
    it("should return correct classes for a known especialidad", () => {
      const result = getEspecialidadClasses("Clinica");
      expect(result.tag).toContain("bg-emerald-100");
    });

    it("should return default classes for an unknown especialidad", () => {
      const result = getEspecialidadClasses("Psicoanalisis");
      expect(result.tag).toContain("bg-slate-100");
    });
  });

  describe("getStatusVisuals", () => {
    it('should return correct visuals for "En curso"', () => {
      const result = getStatusVisuals("En curso");
      expect(result.icon).toBe("sync");
      expect(result.labelClass).toContain("bg-amber-100");
    });

    it('should return correct visuals for "Convenio Realizado"', () => {
      const result = getStatusVisuals("Convenio Realizado");
      expect(result.icon).toBe("verified");
      expect(result.labelClass).toContain("bg-emerald-100");
    });

    it("should return default visuals for an unknown status", () => {
      const result = getStatusVisuals("Estado Raro");
      expect(result.icon).toBe("help_outline");
      expect(result.labelClass).toContain("bg-slate-100");
    });
  });

  describe("parseToUTCDate", () => {
    it("should parse YYYY-MM-DD format correctly", () => {
      const date = parseToUTCDate("2023-04-15");
      expect(date).not.toBeNull();
      expect(date?.getUTCFullYear()).toBe(2023);
      expect(date?.getUTCMonth()).toBe(3); // 0-indexed
      expect(date?.getUTCDate()).toBe(15);
    });

    it("should parse DD/MM/YYYY format correctly", () => {
      const date = parseToUTCDate("15/04/2023");
      expect(date).not.toBeNull();
      expect(date?.getUTCFullYear()).toBe(2023);
      expect(date?.getUTCMonth()).toBe(3);
      expect(date?.getUTCDate()).toBe(15);
    });

    it("should ignore time part and parse only date", () => {
      const date = parseToUTCDate("2023-04-15T10:20:30Z");
      expect(date).not.toBeNull();
      expect(date?.getUTCDate()).toBe(15);
      expect(date?.getUTCHours()).toBe(0);
    });

    it("should return null for invalid date strings", () => {
      expect(parseToUTCDate("invalid-date")).toBeNull();
      expect(parseToUTCDate("2023-13-40")).toBeNull();
    });

    it("should return null for null or undefined input", () => {
      expect(parseToUTCDate(null as any)).toBeNull();
      expect(parseToUTCDate(undefined)).toBeNull();
    });
  });

  describe("safeGetId", () => {
    it("should return trimmed string for valid input", () => {
      expect(safeGetId("  123  ")).toBe("123");
    });

    it("should return null for null or undefined", () => {
      expect(safeGetId(null)).toBeNull();
      expect(safeGetId(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(safeGetId("  ")).toBeNull();
    });
  });

  describe("toTitleCase", () => {
    it("should convert string to title case", () => {
      expect(toTitleCase("hola mundo")).toBe("Hola Mundo");
      expect(toTitleCase("JUAN PEREZ")).toBe("Juan Perez");
    });

    it("should return empty string for empty input", () => {
      expect(toTitleCase("")).toBe("");
    });

    it("should handle single word", () => {
      expect(toTitleCase("hola")).toBe("Hola");
    });
  });

  describe("simpleNameSplit", () => {
    it("should split name and last name correctly", () => {
      const result = simpleNameSplit("Juan Pérez");
      expect(result.nombre).toBe("Juan");
      expect(result.apellido).toBe("Pérez");
    });

    it("should handle multiple middle names", () => {
      const result = simpleNameSplit("Juan Carlos María Pérez");
      expect(result.nombre).toBe("Juan Carlos María");
      expect(result.apellido).toBe("Pérez");
    });

    it("should handle single name", () => {
      const result = simpleNameSplit("Juan");
      expect(result.nombre).toBe("Juan");
      expect(result.apellido).toBe("");
    });
  });

  describe("formatPhoneNumber", () => {
    it("should remove non-numeric characters", () => {
      // Note: formatPhoneNumber removes ALL non-numeric characters including +
      expect(formatPhoneNumber("+54 11 1234-5678")).toBe("541112345678");
    });

    it("should return 'N/A' for null or empty", () => {
      expect(formatPhoneNumber(null)).toBe("N/A");
      expect(formatPhoneNumber("")).toBe("N/A");
    });

    it("should handle already clean phone number", () => {
      expect(formatPhoneNumber("541112345678")).toBe("541112345678");
    });
  });

  describe("addBusinessDays", () => {
    it("should add business days correctly", () => {
      const result = addBusinessDays("2023-04-14", 3); // Friday
      // Result should be 3 days forward, skipping weekend
      // Friday + 1 = Saturday (skipped) -> Monday
      // Monday + 1 = Tuesday
      // Tuesday + 1 = Wednesday (day 3)
      expect(result.getUTCDay()).toBe(3); // Should be Wednesday
    });

    it("should skip weekends", () => {
      const result = addBusinessDays("2023-04-14", 1); // Friday
      const dayOfWeek = result.getUTCDay();
      expect(dayOfWeek).not.toBe(0); // Not Sunday
      expect(dayOfWeek).not.toBe(6); // Not Saturday
      // Should be Monday (day 1)
      expect(dayOfWeek).toBe(1);
    });
  });

  describe("getBusinessDaysDiff", () => {
    it("should calculate business days correctly", () => {
      const diff = getBusinessDaysDiff("2023-04-10", "2023-04-14");
      // Monday (1) to Friday (5) = 4 business days
      expect(diff).toBe(4);
    });

    it("should skip weekends in calculation", () => {
      const diff = getBusinessDaysDiff("2023-04-10", "2023-04-17");
      // Monday to next Monday = 5 business days
      expect(diff).toBe(5);
    });

    it("should handle negative diff", () => {
      const diff = getBusinessDaysDiff("2023-04-14", "2023-04-10");
      // Friday to Monday = -4 business days (includes the Friday)
      expect(diff).toBe(-4);
    });
  });
});
