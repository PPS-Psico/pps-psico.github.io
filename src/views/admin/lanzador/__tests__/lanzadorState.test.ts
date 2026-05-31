import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  mapDbToUiState,
  inscripcionVencida,
  STATE_META,
  BUCKET_META,
  BUCKET_ORDER,
  PIPELINE_STEPS,
} from "../lanzadorState";

describe("lanzadorState", () => {
  describe("mapDbToUiState", () => {
    it("mapea 'Oculto' a borrador", () => {
      expect(mapDbToUiState("Oculto")).toBe("borrador");
    });

    it("mapea variantes de abierta (mayúsculas, género)", () => {
      expect(mapDbToUiState("Abierta")).toBe("abierta");
      expect(mapDbToUiState("ABIERTO")).toBe("abierta");
      expect(mapDbToUiState("abierto")).toBe("abierta");
    });

    it("mapea 'Cerrado' y 'Cerrada' a cerrada (case/acento-insensible)", () => {
      // Este fue el origen del bug del Lanzador: la DB guardaba "Cerrado"
      // con mayúscula y la comparación cruda no lo reconocía.
      expect(mapDbToUiState("Cerrado")).toBe("cerrada");
      expect(mapDbToUiState("cerrada")).toBe("cerrada");
      expect(mapDbToUiState("CERRADO")).toBe("cerrada");
    });

    it("mapea variantes de activa", () => {
      expect(mapDbToUiState("Activa")).toBe("activa");
      expect(mapDbToUiState("activo")).toBe("activa");
    });

    it("mapea variantes de archivada", () => {
      expect(mapDbToUiState("Archivado")).toBe("archivada");
      expect(mapDbToUiState("archivada")).toBe("archivada");
    });

    it("cae a borrador para estados desconocidos o vacíos", () => {
      expect(mapDbToUiState("")).toBe("borrador");
      expect(mapDbToUiState("cualquier cosa")).toBe("borrador");
    });
  });

  describe("inscripcionVencida", () => {
    let fixedNow: number;
    beforeAll(() => {
      // Congelar "hoy" en 2025-06-15 para tests deterministas.
      fixedNow = Date.parse("2025-06-15T12:00:00Z");
      jest.useFakeTimers();
      jest.setSystemTime(fixedNow);
    });
    afterAll(() => {
      jest.useRealTimers();
    });

    it("devuelve false si no hay fecha", () => {
      expect(inscripcionVencida(null)).toBe(false);
    });

    it("devuelve false para fechas inválidas", () => {
      expect(inscripcionVencida("no-es-fecha")).toBe(false);
    });

    it("devuelve true si la fecha fin de inscripción ya pasó", () => {
      expect(inscripcionVencida("2025-06-01")).toBe(true);
    });

    it("devuelve false si la fecha fin es futura", () => {
      expect(inscripcionVencida("2025-12-31")).toBe(false);
    });
  });

  describe("metadata de consistencia", () => {
    it("STATE_META tiene los 6 estados con steps únicos crecientes", () => {
      const steps = Object.values(STATE_META).map((m) => m.step);
      expect(steps).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("el pipeline tiene 5 pasos visibles", () => {
      expect(PIPELINE_STEPS).toHaveLength(5);
    });

    it("BUCKET_ORDER referencia solo buckets definidos en BUCKET_META", () => {
      const known = Object.keys(BUCKET_META);
      BUCKET_ORDER.forEach((b) => expect(known).toContain(b));
    });

    it("BUCKET_ORDER prioriza acciones pendientes (seleccionar/asegurar primero)", () => {
      expect(BUCKET_ORDER[0]).toBe("seleccionar");
      expect(BUCKET_ORDER[1]).toBe("asegurar");
      // Las archivadas siempre al final.
      expect(BUCKET_ORDER[BUCKET_ORDER.length - 1]).toBe("archivada");
    });
  });
});
