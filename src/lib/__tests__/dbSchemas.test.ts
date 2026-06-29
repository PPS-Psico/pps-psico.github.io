import {
  estudianteSchema,
  practicaSchema,
  convocatoriaSchema,
  lanzamientoSchema,
  institucionSchema,
  penalizacionSchema,
  solicitudSchema,
  finalizacionSchema,
  compromisoSchema,
  convenioSchema,
  validateDbRow,
} from "../dbSchemas";

describe("dbSchemas", () => {
  describe("rows válidos pasan el schema", () => {
    it("estudiante mínimo válido", () => {
      const row = { id: "est_1", legajo: "12345", nombre: "Ana", correo: null };
      expect(estudianteSchema.safeParse(row).success).toBe(true);
    });

    it("estudiante con columnas extra (passthrough)", () => {
      const row = { id: "est_2", nombre: "Luis", columna_nueva_no_esperada: "x" };
      expect(estudianteSchema.safeParse(row).success).toBe(true);
    });

    it("convocatoria con legajo numérico (union string|number)", () => {
      const rowNum = { id: "c1", legajo: 999, nombre_pps: "PPS A" };
      const rowStr = { id: "c2", legajo: "999", nombre_pps: "PPS A" };
      expect(convocatoriaSchema.safeParse(rowNum).success).toBe(true);
      expect(convocatoriaSchema.safeParse(rowStr).success).toBe(true);
    });

    it("practica válida", () => {
      const row = { id: "p1", estado: "En curso", horas_realizadas: 40, es_online: false };
      expect(practicaSchema.safeParse(row).success).toBe(true);
    });

    it("lanzamiento con array de actividades", () => {
      const row = { id: "l1", nombre_pps: "PPS", actividades_lista: ["a", "b"] };
      expect(lanzamientoSchema.safeParse(row).success).toBe(true);
    });

    it("institucion válida", () => {
      const row = { id: "i1", nombre: "Hospital", convenio_nuevo: 1 };
      expect(institucionSchema.safeParse(row).success).toBe(true);
    });

    it("penalizacion válida", () => {
      const row = { id: "pen1", puntaje_penalizacion: 2, tipo_incumplimiento: "Ausencia" };
      expect(penalizacionSchema.safeParse(row).success).toBe(true);
    });

    it("solicitud válida", () => {
      const row = { id: "s1", nombre_alumno: "Ana", estado_seguimiento: "Pendiente" };
      expect(solicitudSchema.safeParse(row).success).toBe(true);
    });

    it("finalizacion con campos Json (unknown)", () => {
      const row = {
        id: "f1",
        estado: "Pendiente",
        certificado_url: [{ url: "x" }],
        detalle_practicas: { foo: 1 },
      };
      expect(finalizacionSchema.safeParse(row).success).toBe(true);
    });

    it("compromiso válido", () => {
      const row = {
        id: "cm1",
        convocatoria_id: "c1",
        estudiante_id: "e1",
        lanzamiento_id: "l1",
        firma_texto: "Ana",
        legajo: "123",
        nombre_completo: "Ana Gomez",
        texto_acta: "...",
        version: "1.0",
        acepta_compromiso: true,
      };
      expect(compromisoSchema.safeParse(row).success).toBe(true);
    });

    it("convenio válido", () => {
      const row = { id: "cv1", institucion_id: "i1", fecha_firma: "2025-01-01", tipo: "Marco" };
      expect(convenioSchema.safeParse(row).success).toBe(true);
    });
  });

  describe("rows malformados fallan el safeParse", () => {
    it("estudiante con tipo de campo incorrecto (cohorte string en vez de number)", () => {
      const row = { id: "est_1", cohorte: "no-es-numero" };
      expect(estudianteSchema.safeParse(row).success).toBe(false);
    });

    it("practica con horas_realizadas no numérico", () => {
      const row = { id: "p1", horas_realizadas: "muchas" };
      expect(practicaSchema.safeParse(row).success).toBe(false);
    });

    it("lanzamiento con actividades_lista que no es array de strings", () => {
      const row = { id: "l1", actividades_lista: "no-es-array" };
      expect(lanzamientoSchema.safeParse(row).success).toBe(false);
    });
  });

  describe("validateDbRow", () => {
    it("no lanza con un row válido", () => {
      expect(() =>
        validateDbRow(estudianteSchema, { id: "e1", nombre: "Ana" }, "estudiantes")
      ).not.toThrow();
    });

    it("no lanza con un row malformado (solo advierte en dev)", () => {
      expect(() =>
        validateDbRow(estudianteSchema, { id: "e1", cohorte: "x" }, "estudiantes")
      ).not.toThrow();
    });

    it("no lanza con entrada no objeto", () => {
      expect(() => validateDbRow(estudianteSchema, null, "estudiantes")).not.toThrow();
      expect(() => validateDbRow(estudianteSchema, undefined, "estudiantes")).not.toThrow();
    });
  });
});
