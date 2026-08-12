/**
 * Tests de `buildSidebarEntries` — la clasificación del sidebar del Lanzador.
 *
 * Esta función (extraída del orquestador `LanzadorView`) integra
 * `mapDbToUiState` + `deriveTimeline` + `deriveBucket` y deriva la `metaLine` y
 * el flag `needsAction` de cada convocatoria. El test la cubre de punta a punta
 * sin montar el componente (que en testing mode no trae datos).
 *
 * Varios casos están tomados de datos reales de producción, donde el modelo
 * anterior mandaba a "Archivadas" PPS que estaban corriendo.
 */
import { describe, it, expect } from "@jest/globals";
import { buildSidebarEntries } from "../lanzadorState";
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FINALIZACION_POR_HORAS_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
} from "../../../../constants";
import type { LanzamientoPPS } from "../../../../types";

/** Fechas relativas a hoy, para que los tests no caduquen con el calendario. */
const diasDesdeHoy = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const AYER = diasDesdeHoy(-1);
const HACE_UN_MES = diasDesdeHoy(-30);
const EN_UN_MES = diasDesdeHoy(30);
const EN_TRES_MESES = diasDesdeHoy(90);

let seq = 0;
const launch = (overrides: Record<string, unknown> = {}): LanzamientoPPS =>
  ({
    id: `lanz-${++seq}`,
    [FIELD_NOMBRE_PPS_LANZAMIENTOS]: "Hospital X",
    [FIELD_ORIENTACION_LANZAMIENTOS]: "Clínica",
    [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 4,
    [FIELD_FECHA_INICIO_LANZAMIENTOS]: EN_UN_MES,
    [FIELD_FECHA_FIN_LANZAMIENTOS]: EN_TRES_MESES,
    [FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]: diasDesdeHoy(15),
    [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: null,
    [FIELD_ESTADO_GESTION_LANZAMIENTOS]: null,
    ...overrides,
  }) as unknown as LanzamientoPPS;

const NO_COUNTS = {};
const NO_CONSENT = {};

describe("buildSidebarEntries", () => {
  describe("el calendario manda sobre el paso del pipeline", () => {
    it("una PPS que arrancó es 'activa' aunque nadie haya apretado Activar", () => {
      // Caso real: Centro SENSUS quedó en 'Confirmacion' con el seguro
      // gestionado y su inicio ya pasado. El modelo anterior la archivaba.
      const l = launch({
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Confirmacion",
        [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: "2026-06-01T00:00:00Z",
        [FIELD_FECHA_INICIO_LANZAMIENTOS]: HACE_UN_MES,
        [FIELD_FECHA_FIN_LANZAMIENTOS]: EN_UN_MES,
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Relanzada",
      });
      const [e] = buildSidebarEntries([l], NO_COUNTS, NO_CONSENT);
      expect(e.bucket).toBe("activa");
      expect(e.metaLine).toContain("En curso");
    });

    it("una PPS cuya fecha de fin pasó queda 'finalizada' aunque siga en Confirmación", () => {
      const l = launch({
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Confirmacion",
        [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: "2026-06-01T00:00:00Z",
        [FIELD_FECHA_INICIO_LANZAMIENTOS]: HACE_UN_MES,
        [FIELD_FECHA_FIN_LANZAMIENTOS]: AYER,
      });
      const [e] = buildSidebarEntries([l], NO_COUNTS, NO_CONSENT);
      expect(e.bucket).toBe("finalizada");
      expect(e.uiState).toBe("archivada");
      expect(e.metaLine).toContain("Finalizó");
      // En una finalizada no se sigue publicitando la marca de seguro.
      expect(e.seguroGestionado).toBe(false);
    });

    it("una convocatoria Oculto que está corriendo aparece en 'activa'", () => {
      // Caso real: Ministerio de Trabajo, 28 seleccionados, en curso y oculto.
      // 'Oculto' significa "no visible para estudiantes", no "no existe".
      const l = launch({
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto",
        [FIELD_FECHA_INICIO_LANZAMIENTOS]: HACE_UN_MES,
        [FIELD_FECHA_FIN_LANZAMIENTOS]: EN_UN_MES,
        [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: "2026-04-20T00:00:00Z",
      });
      const [e] = buildSidebarEntries([l], { [l.id]: { inscriptos: 40, seleccionados: 28 } }, {});
      expect(e.bucket).toBe("activa");
    });

    it("mantiene activa una PPS sin fecha global cuando cada estudiante completa sus horas", () => {
      const l = launch({
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Activa",
        [FIELD_FECHA_INICIO_LANZAMIENTOS]: HACE_UN_MES,
        [FIELD_FECHA_FIN_LANZAMIENTOS]: null,
        [FIELD_FINALIZACION_POR_HORAS_LANZAMIENTOS]: true,
        [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: 70,
        [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: "2026-07-01T00:00:00Z",
      });
      const [e] = buildSidebarEntries([l], NO_COUNTS, NO_CONSENT);
      expect(e.bucket).toBe("activa");
      expect(e.metaLine).toBe("En curso · hasta completar 70 h");
    });
  });

  describe("estado_gestion ya no oculta nada", () => {
    it("'Archivado' no saca del recorrido a una PPS en curso", () => {
      // Es lo que hacía el cron de auto-archivado: escribía 'Archivado' 2 días
      // después del inicio y enterraba PPS con alumnos adentro.
      const l = launch({
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta",
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Archivado",
        [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: "2026-07-01T00:00:00Z",
        [FIELD_FECHA_INICIO_LANZAMIENTOS]: HACE_UN_MES,
        [FIELD_FECHA_FIN_LANZAMIENTOS]: EN_UN_MES,
      });
      const [e] = buildSidebarEntries([l], { [l.id]: { inscriptos: 12, seleccionados: 8 } }, {});
      expect(e.bucket).toBe("activa");
    });

    it("'No se Relanza' tampoco altera la clasificación", () => {
      const l = launch({
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta",
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "No se Relanza",
      });
      const [e] = buildSidebarEntries([l], { [l.id]: { inscriptos: 3, seleccionados: 0 } }, {});
      expect(e.bucket).toBe("abierta");
    });
  });

  describe("pasos previos al inicio", () => {
    it("clasifica una convocatoria Abierta y muestra el conteo de inscriptos", () => {
      const l = launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta" });
      const [e] = buildSidebarEntries(
        [l],
        { [l.id]: { inscriptos: 3, seleccionados: 0 } },
        NO_CONSENT
      );
      expect(e.bucket).toBe("abierta");
      expect(e.metaLine).toContain("3 inscriptos");
      expect(e.metaLine).toContain("4 cupos");
    });

    it("clasifica en 'asegurar' cuando hay seleccionados y falta el seguro", () => {
      const l = launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrado" });
      const [e] = buildSidebarEntries([l], { [l.id]: { inscriptos: 9, seleccionados: 4 } }, {});
      expect(e.bucket).toBe("asegurar");
      expect(e.needsAction).toBe(true);
    });

    it("marca needsAction y metaLine de consentimientos en confirmación", () => {
      const l = launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Confirmacion" });
      const [e] = buildSidebarEntries(
        [l],
        { [l.id]: { inscriptos: 5, seleccionados: 4 } },
        { [l.id]: { aceptados: 2, total: 4, pendientes: 2, bajas: 0 } }
      );
      expect(e.bucket).toBe("confirmacion");
      expect(e.needsAction).toBe(true);
      expect(e.metaLine).toBe("2 firmaron · 2 pendientes");
    });

    it("no vuelve a mostrar 25/25 cuando el roster real tiene 37 seleccionados", () => {
      const l = launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Confirmacion" });
      const [e] = buildSidebarEntries(
        [l],
        { [l.id]: { inscriptos: 37, seleccionados: 37 } },
        {
          [l.id]: {
            aceptados: 25,
            total: 37,
            pendientes: 12,
            bajas: 0,
            seleccionados_vigentes: 37,
          },
        }
      );

      expect(e.metaLine).toBe("25 firmaron · 12 pendientes");
      expect(e.metaLine).not.toContain("25/25");
    });

    it("un borrador que todavía no arrancó queda visible en Borradores", () => {
      const [e] = buildSidebarEntries(
        [launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto" })],
        NO_COUNTS,
        NO_CONSENT
      );
      expect(e.bucket).toBe("borrador");
      expect(e.metaLine).toBe("Borrador · no visible para estudiantes");
      expect(e.needsAction).toBe(false);
    });
  });

  describe("PPS en curso sin seguro", () => {
    it("la señala como pendiente y pide acción", () => {
      // Caso real: Refugio Gabriel Brochero corriendo desde mayo sin seguro.
      const l = launch({
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Cerrado",
        [FIELD_FECHA_INICIO_LANZAMIENTOS]: HACE_UN_MES,
        [FIELD_FECHA_FIN_LANZAMIENTOS]: EN_UN_MES,
        [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: null,
      });
      const [e] = buildSidebarEntries([l], { [l.id]: { inscriptos: 8, seleccionados: 6 } }, {});
      expect(e.bucket).toBe("activa");
      expect(e.metaLine).toBe("Seguro pendiente");
      expect(e.needsAction).toBe(true);
      // El canvas sigue el estado de la DB, así que abre el generador de seguros.
      expect(e.uiState).toBe("seguro");
    });
  });

  it("registros legacy sin fecha de finalización no se cuelan en 'activa'", () => {
    const l = launch({
      [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto",
      [FIELD_FECHA_INICIO_LANZAMIENTOS]: "2024-09-06",
      [FIELD_FECHA_FIN_LANZAMIENTOS]: null,
    });
    const [e] = buildSidebarEntries([l], NO_COUNTS, NO_CONSENT);
    expect(e.bucket).toBe("borrador");
  });

  it("procesa varias convocatorias preservando el orden de entrada", () => {
    const entries = buildSidebarEntries(
      [
        launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto" }),
        launch({
          [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Activa",
          [FIELD_FECHA_INICIO_LANZAMIENTOS]: HACE_UN_MES,
          [FIELD_FECHA_FIN_LANZAMIENTOS]: EN_UN_MES,
        }),
      ],
      NO_COUNTS,
      NO_CONSENT
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].bucket).toBe("borrador");
    expect(entries[1].bucket).toBe("activa");
  });
});
