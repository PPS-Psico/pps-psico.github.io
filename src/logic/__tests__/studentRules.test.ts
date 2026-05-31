import { describe, it, expect } from "@jest/globals";
import type { Practica } from "../../types";
import {
  ACADEMIC_CONFIG,
  isPracticeActive,
  isPracticeFinished,
  isPracticeOverdue,
  calculateTotalHours,
  calculateSpecialtyHours,
  getUniqueOrientations,
  hasBlockingActivePractices,
  checkGraduationStatus,
} from "../studentRules";

/**
 * Helper para construir una Practica de prueba sin tener que completar
 * todas las columnas de la fila de Supabase. Solo importan los campos
 * que la lógica de negocio realmente lee.
 */
const makePractica = (overrides: Partial<Practica> = {}): Practica =>
  ({
    id: "p-1",
    estudiante_id: "est-1",
    horas_realizadas: 0,
    estado: "En curso",
    especialidad: "Clínica",
    fecha_finalizacion: null,
    ...overrides,
  }) as Practica;

describe("studentRules", () => {
  describe("isPracticeActive", () => {
    it("reconoce los estados activos canónicos sin distinguir acentos ni mayúsculas", () => {
      expect(isPracticeActive("En curso")).toBe(true);
      expect(isPracticeActive("EN CURSO")).toBe(true);
      expect(isPracticeActive("  Pendiente  ")).toBe(true);
      expect(isPracticeActive("En proceso")).toBe(true);
    });

    it("devuelve false para estados terminales o desconocidos", () => {
      expect(isPracticeActive("Finalizada")).toBe(false);
      expect(isPracticeActive("Cancelada")).toBe(false);
      expect(isPracticeActive("")).toBe(false);
      expect(isPracticeActive(null)).toBe(false);
      expect(isPracticeActive(undefined)).toBe(false);
    });
  });

  describe("isPracticeFinished", () => {
    it("reconoce los estados de finalización válidos", () => {
      expect(isPracticeFinished("Finalizada")).toBe(true);
      expect(isPracticeFinished("PPS Realizada")).toBe(true);
      expect(isPracticeFinished("Convenio Realizado")).toBe(true);
      expect(isPracticeFinished("Aprobada")).toBe(true);
    });

    it("devuelve false para estados activos o desconocidos", () => {
      expect(isPracticeFinished("En curso")).toBe(false);
      expect(isPracticeFinished(null)).toBe(false);
    });
  });

  describe("isPracticeOverdue", () => {
    it("marca como vencida una práctica activa cuya fecha fin ya pasó", () => {
      const p = makePractica({ estado: "En curso", fecha_finalizacion: "2020-01-01" });
      expect(isPracticeOverdue(p)).toBe(true);
    });

    it("no marca como vencida una práctica activa con fecha futura", () => {
      const p = makePractica({ estado: "En curso", fecha_finalizacion: "2999-01-01" });
      expect(isPracticeOverdue(p)).toBe(false);
    });

    it("nunca marca como vencida una práctica no activa, aunque la fecha haya pasado", () => {
      const p = makePractica({ estado: "Finalizada", fecha_finalizacion: "2020-01-01" });
      expect(isPracticeOverdue(p)).toBe(false);
    });

    it("no marca como vencida si no hay fecha de fin", () => {
      const p = makePractica({ estado: "En curso", fecha_finalizacion: null });
      expect(isPracticeOverdue(p)).toBe(false);
    });
  });

  describe("calculateTotalHours", () => {
    it("suma las horas de todas las prácticas", () => {
      const practicas = [
        makePractica({ horas_realizadas: 100 }),
        makePractica({ horas_realizadas: 50 }),
        makePractica({ horas_realizadas: 30 }),
      ];
      expect(calculateTotalHours(practicas)).toBe(180);
    });

    it("trata las horas nulas o faltantes como 0", () => {
      const practicas = [
        makePractica({ horas_realizadas: 100 }),
        makePractica({ horas_realizadas: null as any }),
        makePractica({ horas_realizadas: undefined as any }),
      ];
      expect(calculateTotalHours(practicas)).toBe(100);
    });

    it("devuelve 0 para una lista vacía", () => {
      expect(calculateTotalHours([])).toBe(0);
    });
  });

  describe("calculateSpecialtyHours", () => {
    it("suma solo las horas de la orientación objetivo (ignorando acentos/mayúsculas)", () => {
      const practicas = [
        makePractica({ especialidad: "Clínica", horas_realizadas: 70 }),
        makePractica({ especialidad: "clinica", horas_realizadas: 30 }),
        makePractica({ especialidad: "Educacional", horas_realizadas: 100 }),
      ];
      expect(calculateSpecialtyHours(practicas, "Clínica")).toBe(100);
    });

    it("devuelve 0 si la orientación objetivo está vacía", () => {
      const practicas = [makePractica({ especialidad: "Clínica", horas_realizadas: 70 })];
      expect(calculateSpecialtyHours(practicas, "")).toBe(0);
    });

    it("devuelve 0 si no hay prácticas de esa orientación", () => {
      const practicas = [makePractica({ especialidad: "Laboral", horas_realizadas: 70 })];
      expect(calculateSpecialtyHours(practicas, "Comunitaria")).toBe(0);
    });
  });

  describe("getUniqueOrientations", () => {
    it("colapsa duplicados por normalización y prefiere 'Clínica' con acento", () => {
      const practicas = [
        makePractica({ especialidad: "clinica" }),
        makePractica({ especialidad: "Clínica" }),
        makePractica({ especialidad: "Educacional" }),
      ];
      const result = getUniqueOrientations(practicas);
      expect(result).toHaveLength(2);
      expect(result).toContain("Clínica");
      expect(result).toContain("Educacional");
    });

    it("ignora especialidades vacías", () => {
      const practicas = [
        makePractica({ especialidad: "" }),
        makePractica({ especialidad: null as any }),
        makePractica({ especialidad: "Laboral" }),
      ];
      expect(getUniqueOrientations(practicas)).toEqual(["Laboral"]);
    });
  });

  describe("hasBlockingActivePractices", () => {
    it("devuelve true si al menos una práctica está activa", () => {
      const practicas = [
        makePractica({ estado: "Finalizada" }),
        makePractica({ estado: "En curso" }),
      ];
      expect(hasBlockingActivePractices(practicas)).toBe(true);
    });

    it("devuelve false si todas las prácticas están finalizadas", () => {
      const practicas = [
        makePractica({ estado: "Finalizada" }),
        makePractica({ estado: "Cancelada" }),
      ];
      expect(hasBlockingActivePractices(practicas)).toBe(false);
    });
  });

  describe("checkGraduationStatus", () => {
    it("habilita la acreditación cuando se cumplen todos los criterios", () => {
      // 3 orientaciones, 250+ horas totales, 70+ en la orientación elegida, sin prácticas activas
      const practicas = [
        makePractica({ especialidad: "Clínica", horas_realizadas: 100, estado: "Finalizada" }),
        makePractica({ especialidad: "Educacional", horas_realizadas: 80, estado: "Finalizada" }),
        makePractica({ especialidad: "Laboral", horas_realizadas: 80, estado: "Finalizada" }),
      ];
      const status = checkGraduationStatus(practicas, "Clínica");
      expect(status.canGraduate).toBe(true);
      expect(status.requirements).toEqual({
        totalHours: true,
        specialtyHours: true,
        rotation: true,
        noActivePractices: true,
      });
    });

    it("bloquea la acreditación si hay una práctica activa, aunque cumpla horas y rotación", () => {
      const practicas = [
        makePractica({ especialidad: "Clínica", horas_realizadas: 100, estado: "Finalizada" }),
        makePractica({ especialidad: "Educacional", horas_realizadas: 80, estado: "Finalizada" }),
        makePractica({ especialidad: "Laboral", horas_realizadas: 80, estado: "En curso" }),
      ];
      const status = checkGraduationStatus(practicas, "Clínica");
      expect(status.requirements.noActivePractices).toBe(false);
      expect(status.canGraduate).toBe(false);
    });

    it("bloquea si no alcanza las horas totales requeridas", () => {
      const practicas = [
        makePractica({ especialidad: "Clínica", horas_realizadas: 50, estado: "Finalizada" }),
        makePractica({ especialidad: "Educacional", horas_realizadas: 50, estado: "Finalizada" }),
        makePractica({ especialidad: "Laboral", horas_realizadas: 50, estado: "Finalizada" }),
      ];
      const status = checkGraduationStatus(practicas, "Clínica");
      expect(status.requirements.totalHours).toBe(false);
      expect(status.canGraduate).toBe(false);
    });

    it("bloquea si no cumple la rotación mínima de áreas (menos de 3)", () => {
      const practicas = [
        makePractica({ especialidad: "Clínica", horas_realizadas: 150, estado: "Finalizada" }),
        makePractica({ especialidad: "Clínica", horas_realizadas: 150, estado: "Finalizada" }),
      ];
      const status = checkGraduationStatus(practicas, "Clínica");
      expect(status.requirements.rotation).toBe(false);
      expect(status.canGraduate).toBe(false);
    });

    it("bloquea si no alcanza las horas de la orientación elegida", () => {
      // Total OK y rotación OK, pero la orientación elegida (Comunitaria) tiene pocas horas
      const practicas = [
        makePractica({ especialidad: "Clínica", horas_realizadas: 120, estado: "Finalizada" }),
        makePractica({ especialidad: "Educacional", horas_realizadas: 120, estado: "Finalizada" }),
        makePractica({ especialidad: "Comunitaria", horas_realizadas: 40, estado: "Finalizada" }),
      ];
      const status = checkGraduationStatus(practicas, "Comunitaria");
      expect(status.requirements.specialtyHours).toBe(false);
      expect(status.canGraduate).toBe(false);
    });

    it("respeta los umbrales de ACADEMIC_CONFIG", () => {
      expect(ACADEMIC_CONFIG.HOURS_TOTAL_REQUIRED).toBe(250);
      expect(ACADEMIC_CONFIG.HOURS_SPECIALTY_REQUIRED).toBe(70);
      expect(ACADEMIC_CONFIG.ROTATION_AREAS_REQUIRED).toBe(3);
    });
  });
});
