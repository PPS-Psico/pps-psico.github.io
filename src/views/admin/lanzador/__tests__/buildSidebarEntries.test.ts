/**
 * Tests de `buildSidebarEntries` — la clasificación del sidebar del Lanzador.
 *
 * Esta función (extraída del orquestador `LanzadorView`) integra
 * `mapDbToUiState` + `deriveBucket` + `isEffectivelyArchived` y deriva la
 * `metaLine` y el flag `needsAction` de cada convocatoria. El test la cubre de
 * punta a punta sin montar el componente (que en testing mode no trae datos).
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
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS,
} from "../../../../constants";
import type { LanzamientoPPS } from "../../../../types";

let seq = 0;
const launch = (overrides: Record<string, unknown> = {}): LanzamientoPPS =>
  ({
    id: `lanz-${++seq}`,
    [FIELD_NOMBRE_PPS_LANZAMIENTOS]: "Hospital X",
    [FIELD_ORIENTACION_LANZAMIENTOS]: "Clínica",
    [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 4,
    [FIELD_FECHA_INICIO_LANZAMIENTOS]: "2099-08-01",
    [FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]: "2099-07-15",
    [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: null,
    [FIELD_ESTADO_GESTION_LANZAMIENTOS]: null,
    ...overrides,
  }) as unknown as LanzamientoPPS;

const NO_COUNTS = {};
const NO_CONSENT = {};

describe("buildSidebarEntries", () => {
  it("clasifica un borrador (Oculto) en el bucket borrador", () => {
    const [e] = buildSidebarEntries(
      [launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto" })],
      NO_COUNTS,
      NO_CONSENT
    );
    expect(e.bucket).toBe("borrador");
    expect(e.uiState).toBe("borrador");
    expect(e.metaLine).toBe("Sin publicar");
    expect(e.needsAction).toBe(false);
  });

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

  it("fuerza bucket archivada cuando estado_gestion es Archivado (aunque el pipeline siga)", () => {
    const l = launch({
      [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Confirmacion",
      [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Archivado",
      [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: "2099-07-01T00:00:00Z",
    });
    const [e] = buildSidebarEntries([l], NO_COUNTS, NO_CONSENT);
    expect(e.bucket).toBe("archivada");
    expect(e.uiState).toBe("archivada");
    // En archivadas no se refleja la marca de seguro.
    expect(e.seguroGestionado).toBe(false);
  });

  it("marca needsAction y metaLine de consentimientos en confirmación", () => {
    const l = launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Confirmacion" });
    const [e] = buildSidebarEntries(
      [l],
      { [l.id]: { inscriptos: 5, seleccionados: 4 } },
      {
        [l.id]: { aceptados: 2, total: 4 },
      }
    );
    expect(e.bucket).toBe("confirmacion");
    expect(e.needsAction).toBe(true);
    expect(e.metaLine).toBe("2/4 consintieron");
  });

  it("clasifica una PPS Activa y refleja el seguro gestionado", () => {
    const l = launch({
      [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Activa",
      [FIELD_SEGURO_GESTIONADO_AT_LANZAMIENTOS]: "2099-07-10T00:00:00Z",
    });
    const [e] = buildSidebarEntries([l], NO_COUNTS, NO_CONSENT);
    expect(e.bucket).toBe("activa");
    expect(e.uiState).toBe("activa");
    expect(e.seguroGestionado).toBe(true);
    expect(e.metaLine).toContain("Seguro gestionado");
  });

  it("procesa varias convocatorias preservando el orden de entrada", () => {
    const entries = buildSidebarEntries(
      [
        launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto" }),
        launch({ [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Activa" }),
      ],
      NO_COUNTS,
      NO_CONSENT
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].bucket).toBe("borrador");
    expect(entries[1].bucket).toBe("activa");
  });
});
