import { processAndLinkStudentData } from "../dataLinker";
import * as C from "../../constants";
import type { Convocatoria, LanzamientoPPS, Practica } from "../../types";

const lanz = (id: string, over: Record<string, unknown> = {}): LanzamientoPPS =>
  ({ id, createdTime: "", ...over }) as unknown as LanzamientoPPS;

const conv = (id: string, over: Record<string, unknown> = {}): Convocatoria =>
  ({ id, createdTime: "", ...over }) as unknown as Convocatoria;

const prac = (id: string, over: Record<string, unknown> = {}): Practica =>
  ({ id, createdTime: "", ...over }) as unknown as Practica;

describe("processAndLinkStudentData", () => {
  describe("enrollmentMap (prioridad de estado)", () => {
    it("elige 'Seleccionado' sobre 'Inscripto' para el mismo lanzamiento", () => {
      const myEnrollments = [
        conv("c1", {
          [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: "lz1",
          [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto",
        }),
        conv("c2", {
          [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: "lz1",
          [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
        }),
      ];
      const { enrollmentMap } = processAndLinkStudentData({
        myEnrollments,
        allLanzamientos: [lanz("lz1")],
        practicas: [],
      });
      expect(enrollmentMap.get("lz1")?.id).toBe("c2");
    });

    it("ignora inscripciones sin lanzamiento vinculado", () => {
      const { enrollmentMap } = processAndLinkStudentData({
        myEnrollments: [conv("c1", { [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto" })],
        allLanzamientos: [],
        practicas: [],
      });
      expect(enrollmentMap.size).toBe(0);
    });
  });

  describe("completedLanzamientoIds y orientaciones", () => {
    it("marca completado por id y por nombre normalizado para prácticas finalizadas", () => {
      const practicas = [
        prac("p1", {
          [C.FIELD_ESTADO_PRACTICA]: "Finalizada",
          [C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "lz2",
          [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Hospital Álvarez",
          [C.FIELD_ESPECIALIDAD_PRACTICAS]: "Clínica",
        }),
      ];
      const { completedLanzamientoIds, completedOrientationsByInstitution } =
        processAndLinkStudentData({ myEnrollments: [], allLanzamientos: [], practicas });

      expect(completedLanzamientoIds.has("lz2")).toBe(true);
      expect(completedLanzamientoIds.has("hospital alvarez")).toBe(true);
      expect(completedOrientationsByInstitution.get("hospital alvarez")?.has("clinica")).toBe(true);
    });

    it("no marca completado para prácticas en curso", () => {
      const practicas = [
        prac("p1", {
          [C.FIELD_ESTADO_PRACTICA]: "En curso",
          [C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "lz2",
        }),
      ];
      const { completedLanzamientoIds } = processAndLinkStudentData({
        myEnrollments: [],
        allLanzamientos: [],
        practicas,
      });
      expect(completedLanzamientoIds.has("lz2")).toBe(false);
    });
  });

  describe("informeTasks", () => {
    it("genera una tarea desde una inscripción 'Seleccionado' cuyo lanzamiento pide informe", () => {
      const allLanzamientos = [
        lanz("lz1", {
          [C.FIELD_INFORME_LANZAMIENTOS]: "http://informe/plantilla",
          [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: "PPS Garrahan",
          [C.FIELD_FECHA_FIN_LANZAMIENTOS]: "2026-06-30",
        }),
      ];
      const myEnrollments = [
        conv("c1", {
          [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: "lz1",
          [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
          [C.FIELD_INFORME_SUBIDO_CONVOCATORIAS]: false,
        }),
      ];
      const { informeTasks } = processAndLinkStudentData({
        myEnrollments,
        allLanzamientos,
        practicas: [],
      });
      expect(informeTasks).toHaveLength(1);
      expect(informeTasks[0]).toMatchObject({
        convocatoriaId: "c1",
        ppsName: "PPS Garrahan",
        informeLink: "http://informe/plantilla",
        informeSubido: false,
      });
    });

    it("no genera tarea si el lanzamiento no pide informe", () => {
      const { informeTasks } = processAndLinkStudentData({
        myEnrollments: [
          conv("c1", {
            [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: "lz1",
            [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
          }),
        ],
        allLanzamientos: [lanz("lz1", { [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: "Sin informe" })],
        practicas: [],
      });
      expect(informeTasks).toHaveLength(0);
    });

    it("genera tarea desde una práctica finalizada con lanzamiento que pide informe", () => {
      const allLanzamientos = [
        lanz("lz3", {
          [C.FIELD_INFORME_LANZAMIENTOS]: "http://informe/3",
          [C.FIELD_NOMBRE_PPS_LANZAMIENTOS]: "PPS Tobar",
        }),
      ];
      const practicas = [
        prac("p3", {
          [C.FIELD_ESTADO_PRACTICA]: "Finalizada",
          [C.FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "lz3",
          [C.FIELD_NOTA_PRACTICAS]: "Aprobado",
        }),
      ];
      const { informeTasks } = processAndLinkStudentData({
        myEnrollments: [],
        allLanzamientos,
        practicas,
      });
      expect(informeTasks).toHaveLength(1);
      expect(informeTasks[0]).toMatchObject({
        practicaId: "p3",
        ppsName: "PPS Tobar",
        informeSubido: true, // tiene nota
      });
    });

    it("ordena las tareas pendientes (sin informe subido) primero", () => {
      const allLanzamientos = [
        lanz("lzA", {
          [C.FIELD_INFORME_LANZAMIENTOS]: "x",
          [C.FIELD_FECHA_FIN_LANZAMIENTOS]: "2026-01-01",
        }),
        lanz("lzB", {
          [C.FIELD_INFORME_LANZAMIENTOS]: "x",
          [C.FIELD_FECHA_FIN_LANZAMIENTOS]: "2026-02-01",
        }),
      ];
      const myEnrollments = [
        conv("cA", {
          [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: "lzA",
          [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
          [C.FIELD_INFORME_SUBIDO_CONVOCATORIAS]: true,
        }),
        conv("cB", {
          [C.FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: "lzB",
          [C.FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
          [C.FIELD_INFORME_SUBIDO_CONVOCATORIAS]: false,
        }),
      ];
      const { informeTasks } = processAndLinkStudentData({
        myEnrollments,
        allLanzamientos,
        practicas: [],
      });
      // cB (pendiente) debe ir antes que cA (ya subido) aunque su fecha sea posterior
      expect(informeTasks[0].convocatoriaId).toBe("cB");
      expect(informeTasks[1].convocatoriaId).toBe("cA");
    });
  });
});
