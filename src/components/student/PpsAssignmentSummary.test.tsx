import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_DNI_ESTUDIANTES,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORARIO_ASIGNADO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
} from "../../constants";
import type { Convocatoria, EstudianteFields, LanzamientoPPS, Practica } from "../../types";
import {
  buildPpsAssignmentSummary,
  canShowPpsAssignmentSummary,
  PrintablePpsAssignmentSummary,
} from "./PpsAssignmentSummary";

jest.mock("./home/atlas/atlasHome.css", () => ({}));

const student = {
  id: "student-1",
  [FIELD_NOMBRE_ESTUDIANTES]: "Ana Pérez",
  [FIELD_DNI_ESTUDIANTES]: 40111222,
  [FIELD_LEGAJO_ESTUDIANTES]: "35123",
} as EstudianteFields;

const practice = {
  id: "practice-1",
  [FIELD_ESTADO_PRACTICA]: "En curso",
  [FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]: "launch-1",
  [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Hospital Escuela",
  [FIELD_ESPECIALIDAD_PRACTICAS]: "Clínica",
  [FIELD_FECHA_INICIO_PRACTICAS]: "2099-08-01",
  [FIELD_FECHA_FIN_PRACTICAS]: "2099-11-30",
} as Practica;

const enrollment = {
  id: "enrollment-1",
  [FIELD_HORARIO_ASIGNADO_CONVOCATORIAS]: "Martes y jueves de 9 a 13 h",
} as Convocatoria;

const launch = {
  id: "launch-1",
  [FIELD_NOMBRE_PPS_LANZAMIENTOS]: "Dispositivo de admisiones",
  [FIELD_DIRECCION_LANZAMIENTOS]: "Av. Rivadavia 1234, CABA",
} as LanzamientoPPS;

describe("resumen informativo de asignación a PPS", () => {
  it("se habilita únicamente para una práctica vigente y usa el horario asignado", () => {
    const data = buildPpsAssignmentSummary({ practice, student, enrollment, launch });

    expect(canShowPpsAssignmentSummary(practice)).toBe(true);
    expect(data).toMatchObject({
      studentName: "Ana Pérez",
      dni: "40111222",
      legajo: "35123",
      ppsName: "Dispositivo de admisiones",
      institutionName: "Hospital Escuela",
      orientation: "Clínica",
      assignedSchedule: "Martes y jueves de 9 a 13 h",
      modality: "Presencial",
      address: "Av. Rivadavia 1234, CABA",
    });
  });

  it("no genera el documento para una práctica finalizada", () => {
    const finishedPractice = {
      ...practice,
      [FIELD_ESTADO_PRACTICA]: "Finalizada",
    } as Practica;

    expect(canShowPpsAssignmentSummary(finishedPractice)).toBe(false);
    expect(
      buildPpsAssignmentSummary({
        practice: finishedPractice,
        student,
        enrollment,
        launch,
      })
    ).toBeNull();
  });

  it("explicita en la versión imprimible que no acredita asistencia", () => {
    const data = buildPpsAssignmentSummary({ practice, student, enrollment, launch });
    expect(data).not.toBeNull();

    render(<PrintablePpsAssignmentSummary data={data!} />);

    expect(screen.getByText("No acredita asistencia")).toBeInTheDocument();
    expect(
      screen.getByText(/No constituye un certificado académico ni una constancia oficial/i)
    ).toBeInTheDocument();
  });
});
