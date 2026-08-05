import { describe, it, expect } from "@jest/globals";
import type { Convocatoria, LanzamientoPPS, Practica } from "../../types";
import { processAndLinkStudentData } from "../../utils/dataLinker";
import { getEnrollmentEligibility } from "../enrollmentEligibility";

/**
 * Regresión del caso Fundación Tiempo (agosto 2026).
 *
 * 12 inscripciones de 10 estudiantes que ya habían cursado la PPS se colaron a
 * los relanzamientos porque (a) el bloqueo por PPS realizada se había perdido
 * en el rediseño Atlas y (b) sus prácticas seguían marcadas "En curso" en la
 * base, así que ni siquiera contaban como realizadas.
 *
 * Las filas de abajo son las de producción, con la forma exacta que tienen:
 * el relanzamiento anual es un `lanzamiento_id` distinto al de la práctica, y
 * el vínculo real es el nombre. Si alguien vuelve a tocar el matcheo por
 * nombre, este test lo caza.
 */

const LANZ_ADULTOS_2026_08 = {
  id: "1b4c8717-6460-49c7-911f-0314c8dcc5ce",
  nombre_pps: "Fundación Tiempo - PPS con Orientación Clínica Adultos",
  orientacion: "Clínica",
  estado_convocatoria: "Abierta",
} as LanzamientoPPS;

const LANZ_NINOS_2026_08 = {
  id: "44a41c31-136c-480d-ad80-8f74a9e9c942",
  nombre_pps: "Fundación Tiempo - PPS con Orientación Clínica Niños",
  orientacion: "Clínica",
  estado_convocatoria: "Abierta",
} as LanzamientoPPS;

/** Cursada en el relanzamiento de abril, otro lanzamiento_id. */
const practicaAdultosAbril = {
  id: "5f1ef341-699a-4d88-81ba-7952f1da9575",
  estudiante_id: "2ecdeb92-191e-43b5-b181-fa2d6ffa8472",
  lanzamiento_id: "8c056286-51b5-4a46-b015-815c8d8e8e76",
  nombre_institucion: "Fundación Tiempo - PPS con Orientación Clínica Adultos",
  especialidad: "Clínica",
  estado: "Finalizada",
} as Practica;

const practicaNinosAbril = {
  id: "5355b8ae-a96e-4335-8f2c-a902a0381fa8",
  estudiante_id: "2ecdeb92-191e-43b5-b181-fa2d6ffa8472",
  lanzamiento_id: "94ee67af-cc57-4cc1-971f-82ea6b11a4bf",
  nombre_institucion: "Fundación Tiempo - PPS con Orientación Clínica Niños",
  especialidad: "Clínica",
  estado: "Finalizada",
} as Practica;

const link = (practicas: Practica[]) =>
  processAndLinkStudentData({
    myEnrollments: [] as Convocatoria[],
    allLanzamientos: [LANZ_ADULTOS_2026_08, LANZ_NINOS_2026_08],
    practicas,
  });

describe("Fundación Tiempo — bloqueo de reinscripción", () => {
  it("bloquea el relanzamiento de agosto a quien cursó el de abril", () => {
    const history = link([practicaAdultosAbril, practicaNinosAbril]);

    expect(getEnrollmentEligibility(LANZ_ADULTOS_2026_08, history).isCompleted).toBe(true);
    expect(getEnrollmentEligibility(LANZ_NINOS_2026_08, history).isCompleted).toBe(true);
  });

  it("no confunde Adultos con Niños: cursar una no bloquea la otra", () => {
    const history = link([practicaAdultosAbril]);

    expect(getEnrollmentEligibility(LANZ_ADULTOS_2026_08, history).isCompleted).toBe(true);
    expect(getEnrollmentEligibility(LANZ_NINOS_2026_08, history).isCompleted).toBe(false);
  });

  it("tolera la especialidad sin acento que traen las filas viejas", () => {
    const history = link([{ ...practicaNinosAbril, especialidad: "Clinica" } as Practica]);

    expect(getEnrollmentEligibility(LANZ_NINOS_2026_08, history).isCompleted).toBe(true);
  });

  it("NO bloquea si la práctica quedó desaprobada: esa PPS hay que rehacerla", () => {
    const history = link([{ ...practicaNinosAbril, estado: "Desaprobada" } as Practica]);

    expect(getEnrollmentEligibility(LANZ_NINOS_2026_08, history).isCompleted).toBe(false);
  });

  it("NO bloquea mientras la práctica siga realmente en curso", () => {
    const history = link([{ ...practicaNinosAbril, estado: "En curso" } as Practica]);

    expect(getEnrollmentEligibility(LANZ_NINOS_2026_08, history).isCompleted).toBe(false);
  });
});
