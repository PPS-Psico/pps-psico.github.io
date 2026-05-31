/**
 * Property-based tests — flujo-aseguramiento-pps
 *
 * Cubre las 8 Correctness Properties del design sobre la lógica pura:
 *   deriveBucket / isSeguroGestionado / buildClipboardText / buildHeader.
 *
 * Cada propiedad corre con fast-check (>= 100 runs). Las acciones con efectos
 * (persistencia, descargas, mailto) se prueban aparte en el test unit.
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
  "abierta",
  "cerrada",
  "seleccionada",
  "activa",
  "archivada",
];

const ALL_BUCKETS: SidebarBucket[] = [
  "borrador",
  "abierta",
  "seleccionar",
  "asegurar",
  "activa",
  "archivada",
];

const arbDbState = fc.constantFrom(...ALL_STATES);

/** Estados no terminales para "A asegurar": ni borrador, ni archivada, ni activa. */
const arbNonTerminalState = fc.constantFrom<UIState>("abierta", "cerrada", "seleccionada");

/** Estados que permiten que la marca clasifique como activa: todo menos borrador/archivada. */
const arbMarkClassifiableState = fc.constantFrom<UIState>(
  "abierta",
  "cerrada",
  "seleccionada",
  "activa"
);

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
  it("Property 1: con marca y estado no terminal clasifica en activa, nunca en asegurar", () => {
    // Feature: flujo-aseguramiento-pps, Property 1: La marca de aseguramiento clasifica en Activas y nunca en A_Asegurar
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
          expect(bucket).toBe("activa");
          expect(bucket).not.toBe("asegurar");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 2: sin marca, con seleccionados y estado no terminal clasifica en asegurar", () => {
    // Feature: flujo-aseguramiento-pps, Property 2: Sin marca, con seleccionados y estado no terminal, clasifica en A_Asegurar
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

  it("Property 3: marcar y revertir devuelve el bucket al original (round-trip)", () => {
    // Feature: flujo-aseguramiento-pps, Property 3: La reversión es el inverso de la marca (round-trip de la transición)
    fc.assert(
      fc.property(
        arbNonTerminalState,
        arbIsoDate,
        fc.integer({ min: 1, max: 50 }),
        arbCount,
        fc.boolean(),
        (dbState, marca, totalSel, totalInsc, vencida) => {
          const base = { dbState, totalSel, totalInsc, vencida };
          const conMarca = deriveBucket({ ...base, seguroGestionadoAt: marca });
          const revertido = deriveBucket({ ...base, seguroGestionadoAt: null });
          expect(conMarca).toBe("activa");
          expect(revertido).toBe("asegurar");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 4: deriveBucket siempre devuelve exactamente un bucket válido", () => {
    // Feature: flujo-aseguramiento-pps, Property 4: Totalidad y exclusividad del bucket
    fc.assert(
      fc.property(arbBucketInput, (input) => {
        const bucket = deriveBucket(input);
        expect(ALL_BUCKETS).toContain(bucket);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 5: el estado archivada tiene precedencia sobre la marca", () => {
    // Feature: flujo-aseguramiento-pps, Property 5: El estado Archivada tiene precedencia sobre la marca
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

  it("Property 6: el flag seguroGestionado refleja la marca y bucket != archivada", () => {
    // Feature: flujo-aseguramiento-pps, Property 6: El indicador "seguro gestionado" refleja la marca
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
    // Feature: flujo-aseguramiento-pps, Property 7: El texto a copiar preserva una fila por estudiante con los 7 campos en orden
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
    // Feature: flujo-aseguramiento-pps, Property 8: El encabezado contiene institución, fecha y cantidad de seleccionados
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
