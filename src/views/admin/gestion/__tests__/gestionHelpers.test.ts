import { describe, expect, it } from "@jest/globals";
import { orientSlug, flagsFor, buildItems } from "../gestionHelpers";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
} from "../../../../constants";
import type { LanzamientoPPS } from "../../../../types";
import type { InstitutionInfo } from "../../../../hooks/useGestionConvocatorias";

// Helper para fabricar un lanzamiento mínimo con los campos derivados del hook.
const makeLaunch = (id: string, nombre: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    [FIELD_NOMBRE_PPS_LANZAMIENTOS]: nombre,
    [FIELD_FECHA_INICIO_LANZAMIENTOS]: "2026-03-01",
    ...extra,
  }) as unknown as LanzamientoPPS;

describe("gestionHelpers", () => {
  describe("orientSlug", () => {
    it("normaliza acentos y toma la primera palabra en minúsculas", () => {
      expect(orientSlug("Clínica")).toBe("clinica");
      expect(orientSlug("Educacional, Laboral")).toBe("educacional");
      expect(orientSlug("Salud Mental")).toBe("salud");
    });
    it("devuelve string vacío para null/undefined", () => {
      expect(orientSlug(null)).toBe("");
      expect(orientSlug(undefined)).toBe("");
    });
  });

  describe("flagsFor", () => {
    it("marca los datos faltantes (tel/referente/convenio)", () => {
      const flags = flagsFor({ phone: null, referente: null, convenio: null });
      expect(flags.map((f) => f.k).sort()).toEqual(["conv", "ref", "tel"]);
    });
    it("no marca nada cuando están todos los datos", () => {
      const flags = flagsFor({ phone: "299", referente: "Ana", convenio: "2026" });
      expect(flags).toHaveLength(0);
    });
  });

  describe("buildItems", () => {
    const instMap = new Map<string, InstitutionInfo>();

    it("clasifica un lanzamiento sin gestión como 'porContactar' y marca 'sin tel'", () => {
      const fd = { porContactar: [makeLaunch("l1", "Hospital Centro", { daysSinceEnd: 10 })] };
      const items = buildItems(fd, instMap);

      expect(items).toHaveLength(1);
      expect(items[0].state).toBe("porContactar");
      expect(items[0].titulo).toContain("Hospital Centro");
      expect(items[0].flags.some((f) => f.k === "tel")).toBe(true);
      expect(items[0].razon).toContain("10");
    });

    it("usa 'reinsistir' cuando supera el umbral de días esperando", () => {
      const fd = {
        contactadasEsperandoRespuesta: [makeLaunch("l2", "Clínica Sur", { daysWaiting: 30 })],
      };
      const items = buildItems(fd, instMap);
      expect(items[0].state).toBe("reinsistir");
    });

    it("usa 'esperandoRespuesta' cuando el contacto es reciente", () => {
      const fd = {
        contactadasEsperandoRespuesta: [makeLaunch("l3", "Clínica Sur", { daysWaiting: 1 })],
      };
      const items = buildItems(fd, instMap);
      expect(items[0].state).toBe("esperandoRespuesta");
    });

    it("marca 'sin fechas' para lanzamientos indefinidos", () => {
      const fd = { activasIndefinidas: [makeLaunch("l4", "ONG Norte")] };
      const items = buildItems(fd, instMap);
      expect(items[0].state).toBe("indefinida");
      expect(items[0].flags.some((f) => f.k === "fechas")).toBe(true);
    });
  });
});
