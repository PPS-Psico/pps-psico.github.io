/**
 * Tests de la lógica pura del núcleo del Lanzador (`lanzador/shared.tsx`).
 *
 * Cubren las funciones que el refactor de `LanzadorView.tsx` relocalizó y que
 * concentran reglas de negocio reales:
 *  - `deriveTimeline`: dónde está parada una convocatoria en el calendario.
 *    Es la regla que decide "Activas" y "Finalizadas", y reemplazó a la vieja
 *    `isEffectivelyArchived` (que archivaba por `estado_gestion` + fecha de
 *    inicio vencida, enterrando PPS que estaban corriendo).
 *  - `buildWhatsappFromLaunch` / `buildFranjasLibresMessage`: armado de los
 *    mensajes de difusión por WhatsApp.
 */
import { describe, it, expect } from "@jest/globals";
import { deriveTimeline, buildWhatsappFromLaunch, buildFranjasLibresMessage } from "../shared";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
} from "../../../../constants";
import type { LanzamientoPPS } from "../../../../types";

const PAST = "2020-01-01";
const FUTURE = "2099-12-31";
const HOY = new Date("2026-07-24T12:00:00Z");

describe("deriveTimeline", () => {
  it("marca finalizada cuando la fecha de fin ya pasó", () => {
    expect(deriveTimeline(PAST, "2026-07-23", HOY)).toBe("finalizada");
  });

  it("marca en curso entre inicio y fin", () => {
    expect(deriveTimeline("2026-06-01", "2026-09-01", HOY)).toBe("en_curso");
  });

  it("marca pendiente cuando todavía no arrancó", () => {
    expect(deriveTimeline("2026-07-28", "2026-11-26", HOY)).toBe("pendiente");
  });

  it("incluye los bordes: el día de inicio ya es en curso y el de fin todavía no finalizó", () => {
    expect(deriveTimeline("2026-07-24", "2026-09-01", HOY)).toBe("en_curso");
    expect(deriveTimeline("2026-06-01", "2026-07-24", HOY)).toBe("en_curso");
  });

  it("compara por día calendario, sin correrse por zona horaria", () => {
    // `new Date("2026-07-23")` es medianoche UTC = 22/07 21:00 en Argentina.
    // La regla anterior normalizaba con setHours() local y adelantaba un día,
    // archivando convocatorias 24h antes de tiempo.
    expect(deriveTimeline("2026-07-23", "2026-10-23", HOY)).toBe("en_curso");
    expect(deriveTimeline("2026-01-01", "2026-07-24", HOY)).not.toBe("finalizada");
  });

  it("no asume que siga viva si falta la fecha de fin", () => {
    // Registros legacy sin fecha_finalizacion: sin ese dato no hay forma de
    // saber si terminó, así que no entran a "Activas".
    expect(deriveTimeline(PAST, null, HOY)).toBe("desconocida");
    expect(deriveTimeline(null, null, HOY)).toBe("desconocida");
    expect(deriveTimeline(undefined, undefined, HOY)).toBe("desconocida");
  });

  it("una fecha de fin futura sin inicio queda como desconocida", () => {
    expect(deriveTimeline(null, FUTURE, HOY)).toBe("desconocida");
  });
});

const makeLaunch = (overrides: Record<string, unknown> = {}): LanzamientoPPS =>
  ({
    id: "lanz-test",
    [FIELD_NOMBRE_PPS_LANZAMIENTOS]: "Hospital Garrahan",
    [FIELD_ORIENTACION_LANZAMIENTOS]: "Clínica",
    [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 5,
    [FIELD_FECHA_INICIO_LANZAMIENTOS]: "2026-08-01",
    [FIELD_FECHA_FIN_LANZAMIENTOS]: "2026-12-01",
    [FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]: "2026-07-15",
    [FIELD_DESCRIPCION_LANZAMIENTOS]: "Prácticas en sala de psicología infantil.",
    [FIELD_DIRECCION_LANZAMIENTOS]: "Combate de los Pozos 1881",
    [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: "Lunes 9 a 13",
    ...overrides,
  }) as unknown as LanzamientoPPS;

describe("buildWhatsappFromLaunch", () => {
  it("incluye los datos clave de la convocatoria y el link de inscripción", () => {
    const msg = buildWhatsappFromLaunch(makeLaunch());
    expect(msg).toContain("Nueva Convocatoria PPS");
    expect(msg).toContain("Hospital Garrahan");
    expect(msg).toContain("Clínica");
    expect(msg).toContain("Combate de los Pozos 1881");
    expect(msg).toContain("Lunes 9 a 13");
    expect(msg).toContain("pps.psico.uflo.edu.ar");
  });

  it("omite las secciones cuyos campos están vacíos", () => {
    const msg = buildWhatsappFromLaunch(
      makeLaunch({
        [FIELD_ORIENTACION_LANZAMIENTOS]: null,
        [FIELD_DESCRIPCION_LANZAMIENTOS]: null,
        [FIELD_DIRECCION_LANZAMIENTOS]: null,
      })
    );
    expect(msg).not.toContain("Orientación:");
    expect(msg).not.toContain("Sobre la práctica:");
    expect(msg).not.toContain("Lugar:");
    // Pero sigue mostrando lo que sí tiene.
    expect(msg).toContain("Hospital Garrahan");
  });
});

describe("buildFranjasLibresMessage", () => {
  it("usa singular cuando hay una sola franja libre", () => {
    const msg = buildFranjasLibresMessage(makeLaunch(), [{ label: "Lunes", libres: 1 }]);
    expect(msg).toContain("queda lugar sin cubrir en esta franja");
    expect(msg).toContain("• *Lunes* — 1 lugar libre");
  });

  it("usa plural y lista todas las franjas cuando hay varias", () => {
    const msg = buildFranjasLibresMessage(makeLaunch(), [
      { label: "Lunes", libres: 2 },
      { label: "Martes", libres: 3 },
    ]);
    expect(msg).toContain("quedan cupos sin cubrir en estas franjas");
    expect(msg).toContain("• *Lunes* — 2 lugares libres");
    expect(msg).toContain("• *Martes* — 3 lugares libres");
  });

  it("trata libres null como 0 lugares", () => {
    const msg = buildFranjasLibresMessage(makeLaunch(), [{ label: "Miércoles", libres: null }]);
    expect(msg).toContain("• *Miércoles* — 0 lugares libres");
  });
});
