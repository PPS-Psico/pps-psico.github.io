import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  mapDbToUiState,
  inscripcionVencida,
  STATE_META,
  BUCKET_META,
  BUCKET_ORDER,
  HIDDEN_BUCKETS,
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

    it("mapea 'Cerrado' a la sala de firmas (sin marca de seguro)", () => {
      expect(mapDbToUiState("Cerrado")).toBe("confirmacion");
      expect(mapDbToUiState("cerrada")).toBe("confirmacion");
      expect(mapDbToUiState("CERRADO")).toBe("confirmacion");
    });

    it("'Cerrado' es la sala de firmas aunque el seguro ya se haya generado", () => {
      // Regresión: volver del paso Seguro a las firmas escribe 'Cerrado' pero
      // conserva `seguro_gestionado_at`, porque la planilla se generó de verdad.
      // Mientras la marca decidía el paso, el estado cambiaba y la pantalla no:
      // el boton "Volver a las firmas" no hacia nada visible.
      expect(mapDbToUiState("Cerrado", "2025-06-15T12:00:00Z")).toBe("confirmacion");
      expect(mapDbToUiState("Cerrado", null)).toBe("confirmacion");
    });

    it("mapea 'Seguro' al paso Seguro", () => {
      expect(mapDbToUiState("Seguro")).toBe("seguro");
      expect(mapDbToUiState("seguro")).toBe("seguro");
    });

    it("mapea el token 'Confirmacion' al paso Seguro", () => {
      // 'Confirmacion' quedó nombrado así cuando el seguro iba antes de las
      // firmas; hoy identifica el paso 4.
      expect(mapDbToUiState("Confirmacion")).toBe("seguro");
      expect(mapDbToUiState("confirmacion")).toBe("seguro");
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

    it("el consentimiento va antes que el seguro", () => {
      expect(STATE_META.seleccion.step).toBe(2);
      expect(STATE_META.confirmacion.step).toBe(3);
      expect(STATE_META.seguro.step).toBe(4);
    });

    it("el pipeline tiene 5 pasos visibles en el orden correcto", () => {
      expect(PIPELINE_STEPS).toHaveLength(5);
      expect(PIPELINE_STEPS).toEqual(["Borrador", "Selección", "Confirmación", "Seguro", "Activa"]);
    });

    it("BUCKET_ORDER referencia solo buckets definidos en BUCKET_META", () => {
      const known = Object.keys(BUCKET_META);
      BUCKET_ORDER.forEach((b) => expect(known).toContain(b));
      HIDDEN_BUCKETS.forEach((b) => expect(known).toContain(b));
    });

    it("BUCKET_ORDER prioriza acciones pendientes (seleccionar/confirmar primero)", () => {
      expect(BUCKET_ORDER[0]).toBe("seleccionar");
      expect(BUCKET_ORDER[1]).toBe("confirmacion");
      expect(BUCKET_ORDER[2]).toBe("asegurar");
      // Las que están en curso cierran el recorrido visible.
      expect(BUCKET_ORDER[BUCKET_ORDER.length - 1]).toBe("activa");
    });

    it("oculta los borradores del listado normal y los conserva para la búsqueda", () => {
      expect(BUCKET_ORDER).not.toContain("borrador");
      expect(HIDDEN_BUCKETS).toContain("borrador");
      expect(BUCKET_META.borrador.label).toBe("Borradores");
    });

    it("el recorrido visible no incluye lo que sale de la vista operativa", () => {
      // Borradores, finalizadas y fuera del pipeline existen como clasificación
      // (el buscador los alcanza) pero no se listan como grupo.
      expect(BUCKET_ORDER).not.toContain("borrador");
      expect(BUCKET_ORDER).not.toContain("finalizada");
      expect(BUCKET_ORDER).not.toContain("oculta");
      expect(HIDDEN_BUCKETS).toEqual(["borrador", "finalizada", "oculta"]);
      // Y ningún bucket puede estar en las dos listas a la vez.
      HIDDEN_BUCKETS.forEach((b) => expect(BUCKET_ORDER).not.toContain(b));
    });
  });
});
