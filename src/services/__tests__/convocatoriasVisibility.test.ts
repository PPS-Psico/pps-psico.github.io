import { isLaunchVisibleToStudent } from "../convocatoriasService";
import * as C from "../../constants";
import type { LanzamientoPPS } from "../../types";

// Fecha de referencia fija para los tests (martes 2026-06-16).
const NOW = new Date("2026-06-16T12:00:00Z");
const future = "2026-09-01";
const past = "2026-01-10";
const tomorrow = "2026-06-17";
const yesterday = "2026-06-15";

const makeLaunch = (fields: Partial<Record<string, unknown>>): LanzamientoPPS =>
  ({ id: "l1", createdTime: "", ...fields }) as unknown as LanzamientoPPS;

describe("isLaunchVisibleToStudent", () => {
  it("muestra una convocatoria Abierta no archivada", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta",
      [C.FIELD_FECHA_PUBLICACION_LANZAMIENTOS]: past,
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: future,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(true);
  });

  it("oculta una convocatoria con estado 'oculto'", () => {
    const l = makeLaunch({ [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto" });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(false);
  });

  it("oculta estados no listados (p. ej. Finalizada)", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Finalizada",
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: future,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(false);
  });

  it("muestra una Cerrada cuyo inicio aún no llegó", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrada",
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: tomorrow,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(true);
  });

  it("oculta una Cerrada cuyo inicio ya pasó", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrada",
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: yesterday,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(false);
  });

  it("muestra una Cerrada/archivada cuyo inicio aún no llegó (regla del cutover)", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrada",
      [C.FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Archivado",
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: tomorrow,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(true);
  });

  it("oculta una archivada cuyo inicio ya pasó", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta",
      [C.FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Archivado",
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: yesterday,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(false);
  });

  it("oculta una Abierta programada a futuro (fecha de publicación posterior a hoy)", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta",
      [C.FIELD_FECHA_PUBLICACION_LANZAMIENTOS]: future,
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: future,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(false);
  });

  it("muestra una Abierta ya publicada (fecha de publicación pasada)", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta",
      [C.FIELD_FECHA_PUBLICACION_LANZAMIENTOS]: past,
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: future,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(true);
  });

  it("normaliza el estado (acepta variantes con mayúsculas/acentos)", () => {
    const l = makeLaunch({
      [C.FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Confirmación",
      [C.FIELD_FECHA_INICIO_LANZAMIENTOS]: tomorrow,
    });
    expect(isLaunchVisibleToStudent(l, NOW)).toBe(true);
  });
});
