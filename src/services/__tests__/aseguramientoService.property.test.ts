/**
 * Property-based tests — flujo-aseguramiento-pps
 *
 * Cubre las Correctness Properties del design sobre la lógica pura:
 *   deriveBucket / isSeguroGestionado / buildClipboardText / buildHeader.
 *
 * Cada propiedad corre con fast-check (>= 100 runs). Las acciones con efectos
 * (persistencia, descargas, mailto) se prueban aparte en el test unit.
 *
 * Pipeline nuevo (5 pasos): Borrador → Selección → Seguro → Confirmación → Activa.
 * La marca de aseguramiento ya NO clasifica como "activa" — para eso el admin
 * debe transicionar explícitamente `estado_convocatoria = 'Activa'`. La marca
 * clasifica como "confirmacion" (sala de consentimientos).
 */
import { describe, it, expect } from "@jest/globals";
import fc from "fast-check";
import {
  deriveBucket,
  isSeguroGestionado,
  buildClipboardText,
  buildHeader,
  type UIState,
  type BucketInput,
  type ClipboardStudent,
  type SidebarBucket,
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
  "archivada",
];

const arbDbState = fc.constantFrom(...ALL_STATES);

/** Estados donde tiene sentido "A asegurar": no terminal, no borrador/archivada. */
const arbNonTerminalState = fc.constantFrom<UIState>("seleccion", "seguro");

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
  it("Property 1: con marca y estado no terminal clasifica en 'confirmacion' (nunca 'asegurar' ni 'activa')", () => {
    // Feature: flujo-aseguramiento-pps, Property 1: La marca de aseguramiento clasifica en
    // la sala de Confirmación (nuevo pipeline). Antes la marca clasificaba en
    // "activa" — eso se saltaba la sala de consentimientos (bug histórico).
    fc.assert(
      fc.property(
        arbMarkClassifiableState,
        arbIsoDate,
        arbCount,
        arbCount,
        fc.boolean(),
        (dbState, seguroGestionadoAt, totalSel, totalInsc, vencida) => {
          const bucket = deriveBucket({
            dbState,
            seguroGestionadoAt,
            totalSel,
            totalInsc,
            vencida,
          });
          expect(bucket).toBe("confirmacion");
          expect(bucket).not.toBe("asegurar");
          expect(bucket).not.toBe("activa");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 2: sin marca, con seleccionados y estado no terminal clasifica en 'asegurar'", () => {
    // Feature: flujo-aseguramiento-pps, Property 2: Sin marca, con seleccionados y
    // estado no terminal, clasifica en A_Asegurar.
    fc.assert(
      fc.property(
        arbNonTerminalState,
        fc.integer({ min: 1, max: 50 }),
        arbCount,
        fc.boolean(),
        (dbState, totalSel, totalInsc, vencida) => {
          const bucket = deriveBucket({
            dbState,
            seguroGestionadoAt: null,
            totalSel,
            totalInsc,
            vencida,
          });
          expect(bucket).toBe("asegurar");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 3: round-trip 'marcar/revertir' vuelve al estado original (asegurar)", () => {
    // Feature: flujo-aseguramiento-pps, Property 3: La reversión es el inverso de la
    // marca. En el nuevo flujo, revertir implica DOS cosas: borrar la marca Y
    // regresar `estado_convocatoria` a 'Cerrado' (lo que `revertirAseguramiento`
    // persiste). El test simula esa transición completa.
    fc.assert(
      fc.property(
        arbNonTerminalState,
        arbIsoDate,
        fc.integer({ min: 1, max: 50 }),
        arbCount,
        fc.boolean(),
        (dbStateOriginal, marca, totalSel, totalInsc, vencida) => {
          // 1) Marcar: dbState pasa a "confirmacion" + marca set.
          const conMarca = deriveBucket({
            dbState: "confirmacion",
            seguroGestionadoAt: marca,
            totalSel,
            totalInsc,
            vencida,
          });
          expect(conMarca).toBe("confirmacion");

          // 2) Revertir: dbState vuelve a "seguro" (lo que era "Cerrado") + marca null.
          const revertido = deriveBucket({
            dbState: "seguro",
            seguroGestionadoAt: null,
            totalSel,
            totalInsc,
            vencida,
          });
          expect(revertido).toBe("asegurar");
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

  it("Property 5: el estado 'archivada' tiene precedencia sobre la marca", () => {
    // Feature: flujo-aseguramiento-pps, Property 5: El estado Archivada tiene
    // precedencia sobre la marca.
    fc.assert(
      fc.property(
        arbSeguroAt,
        arbCount,
        arbCount,
        fc.boolean(),
        (seguroGestionadoAt, totalSel, totalInsc, vencida) => {
          const bucket = deriveBucket({
            dbState: "archivada",
            seguroGestionadoAt,
            totalSel,
            totalInsc,
            vencida,
          });
          expect(bucket).toBe("archivada");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 6: el flag isSeguroGestionado refleja la marca y bucket != archivada", () => {
    // Feature: flujo-aseguramiento-pps, Property 6: El indicador "seguro gestionado"
    // refleja la marca (cualquier estado salvo archivada).
    fc.assert(
      fc.property(arbBucketInput, (input) => {
        const flag = isSeguroGestionado(input);
        const expected = input.seguroGestionadoAt != null && deriveBucket(input) !== "archivada";
        expect(flag).toBe(expected);
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
            s.apellido,
            s.nombre,
            s.dni,
            s.legajo,
            s.cargo,
            s.lugarCompleto,
            s.duracionCompleta,
          ]);
        });
      }),
      { numRuns: 100 }
    );
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
