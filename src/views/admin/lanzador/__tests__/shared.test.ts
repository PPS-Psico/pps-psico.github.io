/**
 * Tests de la lógica pura del núcleo del Lanzador (`lanzador/shared.tsx`).
 *
 * Cubren las funciones que el refactor de `LanzadorView.tsx` relocalizó y que
 * concentran reglas de negocio reales:
 *  - `isEffectivelyArchived`: cuándo una convocatoria debe tratarse como
 *    archivada aunque su estado siga en un paso del pipeline.
 *  - `buildWhatsappFromLaunch` / `buildFranjasLibresMessage`: armado de los
 *    mensajes de difusión por WhatsApp.
 *
 * Son tests "de relocalización": aseguran que mover el código no cambió su
 * comportamiento observable.
 */
import { describe, it, expect } from "@jest/globals";
import {
  isEffectivelyArchived,
  buildWhatsappFromLaunch,
  buildFranjasLibresMessage,
} from "../shared";
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

describe("isEffectivelyArchived", () => {
  it("trata como archivada si estado_gestion es 'Archivado' o 'No se Relanza'", () => {
    expect(isEffectivelyArchived("Archivado", "abierta", FUTURE)).toBe(true);
    expect(isEffectivelyArchived("No se Relanza", "seleccionar", FUTURE)).toBe(true);
  });

  it("archiva un bucket pre-inicio cuya fecha de inicio ya pasó (+gracia)", () => {
    expect(isEffectivelyArchived(null, "seleccionar", PAST)).toBe(true);
    expect(isEffectivelyArchived(null, "asegurar", PAST)).toBe(true);
    expect(isEffectivelyArchived(null, "confirmacion", PAST)).toBe(true);
  });

  it("NO archiva un bucket pre-inicio con fecha de inicio futura", () => {
    expect(isEffectivelyArchived(null, "seleccionar", FUTURE)).toBe(false);
  });

  it("NO archiva buckets que no son pre-inicio aunque la fecha haya pasado", () => {
    expect(isEffectivelyArchived(null, "activa", PAST)).toBe(false);
    expect(isEffectivelyArchived(null, "abierta", PAST)).toBe(false);
  });

  it("NO archiva si no hay fecha de inicio", () => {
    expect(isEffectivelyArchived(null, "seleccionar", null)).toBe(false);
    expect(isEffectivelyArchived(undefined, "seleccionar", undefined)).toBe(false);
  });

  it("respeta el período de gracia configurable", () => {
    // Con una gracia enorme, ni una fecha de 2020 cae fuera de gracia.
    expect(isEffectivelyArchived(null, "seleccionar", PAST, 9999)).toBe(false);
    // Con gracia 0, una fecha de inicio pasada sí archiva.
    expect(isEffectivelyArchived(null, "seleccionar", PAST, 0)).toBe(true);
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
