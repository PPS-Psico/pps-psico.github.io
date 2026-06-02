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

    it("mapea variantes de abierta a seleccion (case/acento-insensible)", () => {
      expect(mapDbToUiState("Abierta")).toBe("seleccion");
      expect(mapDbToUiState("ABIERTO")).toBe("seleccion");
      expect(mapDbToUiState("abierto")).toBe("seleccion");
    });

    it("mapea 'Cerrado' a 'seguro' por defecto (sin marca de seguro)", () => {
      expect(mapDbToUiState("Cerrado")).toBe("seguro");
      expect(mapDbToUiState("cerrada")).toBe("seguro");
      expect(mapDbToUiState("CERRADO")).toBe("seguro");
    });

    it("mapea 'Cerrado' a 'confirmacion' si seguro_gestionado_at está seteado", () => {
      expect(mapDbToUiState("Cerrado", "2025-06-15T12:00:00Z")).toBe("confirmacion");
      expect(mapDbToUiState("Cerrado", null)).toBe("seguro");
    });

    it("mapea 'Confirmacion' (nuevo) a confirmacion", () => {
      expect(mapDbToUiState("Confirmacion")).toBe("confirmacion");
      expect(mapDbToUiState("confirmacion")).toBe("confirmacion");
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

    it("STATE_META incluye seleccion, seguro y confirmacion", () => {
      expect(STATE_META.seleccion.step).toBe(2);
      expect(STATE_META.seguro.step).toBe(3);
      expect(STATE_META.confirmacion.step).toBe(4);
    });

    it("el pipeline tiene 5 pasos visibles en el orden correcto", () => {
      expect(PIPELINE_STEPS).toHaveLength(5);
      expect(PIPELINE_STEPS).toEqual(["Borrador", "Selección", "Seguro", "Confirmación", "Activa"]);
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
