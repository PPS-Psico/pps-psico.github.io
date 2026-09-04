/**
 * Property-based tests — flujo-aseguramiento-pps
 *
 * Cubre las Correctness Properties del design sobre la lógica pura:
 *   deriveBucket / isSeguroGestionado / buildClipboardText / buildHeader.
 *
 * Cada propiedad corre con fast-check (>= 100 runs). Las acciones con efectos
 * (persistencia, descargas, mailto) se prueban aparte en el test unit.
 *
 * Pipeline (5 pasos): Borrador → Selección → Confirmación → Seguro → Activa.
 * Al cerrar la mesa se entra a la SALA DE FIRMAS; el seguro y el listado se
 * arman después, cuando Coordinación decide, con la nómina ya decantada.
 *
 * La marca de aseguramiento ya NO clasifica como "activa" — para eso el admin
 * debe transicionar explícitamente `estado_convocatoria = 'Activa'`. La marca
 * clasifica como "asegurar" (paso 4 resuelto, falta activar).
 */
import { describe, it, expect } from "@jest/globals";
import fc from "fast-check";
import {
  deriveBucket,
  isSeguroGestionado,
  buildClipboardText,
  buildHeader,
  buildSeguroPeriod,
  normalizeSeguroText,
  type UIState,
  type BucketInput,
  type ClipboardStudent,
  type SidebarBucket,
  type LaunchTimeline,
} from "../aseguramientoService";

// ── Generadores ────────────────────────────────────────────────────────────

const ALL_STATES: UIState[] = [
  "borrador",
  "seleccion",
  "seguro",
  "confirmacion",
  "activa",
  "archivada",
];

const ALL_BUCKETS: SidebarBucket[] = [
  "borrador",
  "abierta",
  "seleccionar",
  "asegurar",
  "confirmacion",
  "activa",
  "finalizada",
  "oculta",
];

const ALL_TIMELINES: LaunchTimeline[] = ["pendiente", "en_curso", "finalizada", "desconocida"];

const arbDbState = fc.constantFrom(...ALL_STATES);

/**
 * Timelines donde el calendario NO decide y manda el paso del pipeline.
 * Las propiedades 1-3 y 5 describen la clasificación por etapa, que solo aplica
 * mientras la PPS no arrancó (o no tenemos fechas para saberlo).
 */
const arbPrePipelineTimeline = fc.constantFrom<LaunchTimeline>("pendiente", "desconocida");

/** Estados previos al seguro: mesa abierta o recién cerrada (sala de firmas). */
const arbPreSeguroState = fc.constantFrom<UIState>("seleccion", "confirmacion");

/** Estados donde marca de seguro aplica: pre-activa (con o sin seguro ya). */
const arbMarkClassifiableState = fc.constantFrom<UIState>("seleccion", "seguro", "confirmacion");

const arbIsoDate = fc
  .date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2030-12-31T23:59:59Z") })
  .map((d) => d.toISOString());

/** seguro_gestionado_at: mezcla de null y fechas ISO válidas. */
const arbSeguroAt = fc.option(arbIsoDate, { nil: null });

const arbCount = fc.integer({ min: 0, max: 50 });

const arbBucketInput: fc.Arbitrary<BucketInput> = fc.record({
  dbState: arbDbState,
  seguroGestionadoAt: arbSeguroAt,
  totalSel: arbCount,
  totalInsc: arbCount,
  vencida: fc.boolean(),
  timeline: fc.constantFrom(...ALL_TIMELINES),
});

/** Campos de estudiante sin tabs/saltos para que la fila TSV sea íntegra. */
const arbField = fc.string().map((s) => s.replace(/[\t\n\r]/g, ""));
const arbStudent: fc.Arbitrary<ClipboardStudent> = fc.record({
  apellido: arbField,
  nombre: arbField,
  dni: arbField,
  legajo: arbField,
  cargo: arbField,
  lugarCompleto: arbField,
  duracionCompleta: arbField,
});

const arbNonBlank = fc
  .string({ minLength: 1 })
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// ── Tests ────────────────────────────────────────────────────────────────────

describe("aseguramientoService — property-based", () => {
  it("Property 1: con marca y estado no terminal clasifica en 'asegurar' (nunca 'activa')", () => {
    // Feature: flujo-aseguramiento-pps, Property 1: La marca de aseguramiento
    // clasifica en el paso Seguro, que es el último antes de activar. Nunca en
    // "activa": esa transición sigue siendo un acto explícito del admin.
    fc.assert(
      fc.property(
        arbMarkClassifiableState,
        arbIsoDate,
        arbCount,
        arbCount,
        fc.boolean(),
        arbPrePipelineTimeline,
        (dbState, seguroGestionadoAt, totalSel, totalInsc, vencida, timeline) => {
          const bucket = deriveBucket({
            dbState,
            seguroGestionadoAt,
            totalSel,
            totalInsc,
            vencida,
            timeline,
          });
          expect(bucket).toBe("asegurar");
          expect(bucket).not.toBe("activa");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 2: sin marca y con seleccionados, la sala de firmas es el paso pendiente", () => {
    // Feature: flujo-aseguramiento-pps, Property 2: Sin marca y con gente
    // elegida, el trabajo pendiente son los consentimientos — no el seguro.
    fc.assert(
      fc.property(
        arbPreSeguroState,
        fc.integer({ min: 1, max: 50 }),
        arbCount,
        fc.boolean(),
        arbPrePipelineTimeline,
        (dbState, totalSel, totalInsc, vencida, timeline) => {
          const bucket = deriveBucket({
            dbState,
            seguroGestionadoAt: null,
            totalSel,
            totalInsc,
            vencida,
            timeline,
          });
          expect(bucket).toBe("confirmacion");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 3: round-trip 'pasar al seguro / volver a las firmas' es reversible", () => {
    // Feature: flujo-aseguramiento-pps, Property 3: el pipeline se recorre en
    // los dos sentidos sin dejar residuo. Ir al seguro es 'Cerrado' →
    // 'Confirmacion'; volver es 'Confirmacion' → 'Cerrado' con la marca en null
    // (lo que persisten `handleChangeEstado` y `revertirAseguramiento`).
    fc.assert(
      fc.property(
        arbIsoDate,
        fc.integer({ min: 1, max: 50 }),
        arbCount,
        fc.boolean(),
        arbPrePipelineTimeline,
        (marca, totalSel, totalInsc, vencida, timeline) => {
          const base = { totalSel, totalInsc, vencida, timeline };

          // 1) Mesa cerrada, sin marca: sala de firmas.
          expect(deriveBucket({ ...base, dbState: "confirmacion", seguroGestionadoAt: null })).toBe(
            "confirmacion"
          );

          // 2) Coordinación pasa al seguro; con o sin la planilla ya generada
          //    el lanzamiento vive en el paso 4.
          expect(deriveBucket({ ...base, dbState: "seguro", seguroGestionadoAt: null })).toBe(
            "asegurar"
          );
          expect(deriveBucket({ ...base, dbState: "seguro", seguroGestionadoAt: marca })).toBe(
            "asegurar"
          );

          // 3) Volver a las firmas devuelve al paso 3 sin residuo.
          expect(deriveBucket({ ...base, dbState: "confirmacion", seguroGestionadoAt: null })).toBe(
            "confirmacion"
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 4: deriveBucket siempre devuelve exactamente un bucket válido", () => {
    // Feature: flujo-aseguramiento-pps, Property 4: Totalidad y exclusividad del bucket.
    fc.assert(
      fc.property(arbBucketInput, (input) => {
        const bucket = deriveBucket(input);
        expect(ALL_BUCKETS).toContain(bucket);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 5: el estado 'archivada' sale del pipeline y tiene precedencia sobre la marca", () => {
    // Feature: flujo-aseguramiento-pps, Property 5: El estado Archivada tiene
    // precedencia sobre la marca. Con el modelo nuevo eso significa "oculta":
    // no está en el recorrido, pero tampoco es una PPS finalizada.
    fc.assert(
      fc.property(
        arbSeguroAt,
        arbCount,
        arbCount,
        fc.boolean(),
        arbPrePipelineTimeline,
        (seguroGestionadoAt, totalSel, totalInsc, vencida, timeline) => {
          const bucket = deriveBucket({
            dbState: "archivada",
            seguroGestionadoAt,
            totalSel,
            totalInsc,
            vencida,
            timeline,
          });
          expect(bucket).toBe("oculta");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 6: el flag isSeguroGestionado refleja la marca y bucket != finalizada", () => {
    // Feature: flujo-aseguramiento-pps, Property 6: El indicador "seguro gestionado"
    // refleja la marca mientras la PPS siga en el recorrido.
    fc.assert(
      fc.property(arbBucketInput, (input) => {
        const flag = isSeguroGestionado(input);
        const expected = input.seguroGestionadoAt != null && deriveBucket(input) !== "finalizada";
        expect(flag).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 6b: una PPS finalizada sale de la vista sin importar el paso del pipeline", () => {
    // El calendario tiene precedencia absoluta: si la fecha de fin pasó, no hay
    // estado ni conteo que la mantenga en el recorrido operativo.
    fc.assert(
      fc.property(arbDbState, arbSeguroAt, arbCount, arbCount, fc.boolean(), (...args) => {
        const [dbState, seguroGestionadoAt, totalSel, totalInsc, vencida] = args;
        const bucket = deriveBucket({
          dbState,
          seguroGestionadoAt,
          totalSel,
          totalInsc,
          vencida,
          timeline: "finalizada",
        });
        expect(bucket).toBe("finalizada");
      }),
      { numRuns: 100 }
    );
  });

  it("Property 6c: una PPS en curso es 'activa' aunque nadie haya apretado Activar", () => {
    // Este es el bug que motivó el rediseño: la transición a 'Activa' era un
    // click manual, así que las PPS que arrancaban sin ese click quedaban
    // trabadas en pasos previos y terminaban archivadas.
    fc.assert(
      fc.property(arbDbState, arbSeguroAt, arbCount, arbCount, fc.boolean(), (...args) => {
        const [dbState, seguroGestionadoAt, totalSel, totalInsc, vencida] = args;
        const bucket = deriveBucket({
          dbState,
          seguroGestionadoAt,
          totalSel,
          totalInsc,
          vencida,
          timeline: "en_curso",
        });
        expect(bucket).toBe("activa");
      }),
      { numRuns: 100 }
    );
  });

  it("Property 7: el texto a copiar preserva una fila por estudiante con 7 campos", () => {
    // Feature: flujo-aseguramiento-pps, Property 7: El texto a copiar preserva una fila
    // por estudiante con los 7 campos en orden.
    fc.assert(
      fc.property(fc.array(arbStudent, { minLength: 1, maxLength: 30 }), (students) => {
        const text = buildClipboardText(students);
        const lines = text.split("\n");
        expect(lines).toHaveLength(students.length);
        lines.forEach((line, i) => {
          const fields = line.split("\t");
          expect(fields).toHaveLength(7);
          const s = students[i];
          expect(fields).toEqual([
            normalizeSeguroText(s.apellido),
            normalizeSeguroText(s.nombre),
            normalizeSeguroText(s.dni),
            normalizeSeguroText(s.legajo),
            normalizeSeguroText(s.cargo),
            normalizeSeguroText(s.lugarCompleto),
            normalizeSeguroText(s.duracionCompleta),
          ]);
        });
      }),
      { numRuns: 100 }
    );
  });

  it("corrige el separador mojibake antes de copiar al Excel", () => {
    const text = buildClipboardText([
      {
        apellido: "P\u00e9rez",
        nombre: "Ana",
        dni: "123",
        legajo: "456",
        cargo: "Estudiante",
        lugarCompleto: "Ministerio",
        duracionCompleta: "Horario: KIMUN \u00c2\u00b7 2 veces por semana",
      },
    ]);

    expect(text).toContain("KIMUN \u00b7 2 veces por semana");
    expect(text).not.toContain("\u00c2\u00b7");
  });

  it("describe las PPS que finalizan al completar horas sin mostrar N/A", () => {
    expect(
      buildSeguroPeriod({
        fechaInicio: "2026-08-25",
        fechaFin: null,
        finalizacionPorHoras: true,
        horasAcreditadas: 70,
      })
    ).toBe("Del 25/08/2026 hasta completar 70 horas");
  });

  it("Property 8: el encabezado contiene institución, fecha y cantidad de seleccionados", () => {
    // Feature: flujo-aseguramiento-pps, Property 8: El encabezado contiene institución,
    // fecha y cantidad de seleccionados.
    fc.assert(
      fc.property(
        fc.option(arbNonBlank, { nil: null }),
        fc.option(arbNonBlank, { nil: null }),
        fc.integer({ min: 0, max: 50 }),
        (institucion, fecha, seleccionados) => {
          const header = buildHeader({ institucion, fecha, seleccionados });
          expect(header.seleccionados).toBe(seleccionados);
          expect(header.institucion).toBe(institucion ? institucion.trim() : "Sin institución");
          expect(header.fecha).toBe(fecha ? fecha.trim() : "Sin fecha");
        }
      ),
      { numRuns: 100 }
    );
  });
});
