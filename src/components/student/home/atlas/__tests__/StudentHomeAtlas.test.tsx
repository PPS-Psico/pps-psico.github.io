import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import {
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
} from "../../../../../constants";
import type { Convocatoria, LanzamientoPPS } from "../../../../../types";
import { initialCriterios } from "../../../../../utils/criteriaCalculations";
import StudentHomeAtlas from "../StudentHomeAtlas";

jest.mock("../atlasHome.css", () => ({}));

const launch = {
  id: "launch-open",
  [FIELD_NOMBRE_PPS_LANZAMIENTOS]: "Institución de prueba - Dispositivo",
  [FIELD_ORIENTACION_LANZAMIENTOS]: "Comunitaria",
  [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: 80,
  [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 8,
  [FIELD_FECHA_INICIO_LANZAMIENTOS]: "2026-08-01",
  [FIELD_FECHA_FIN_LANZAMIENTOS]: "2026-11-30",
  [FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]: "2026-07-31",
} as LanzamientoPPS;

const enrollment = {
  id: "enrollment-open",
  [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: launch.id,
  [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto",
} as Convocatoria;

describe("StudentHomeAtlas en escritorio", () => {
  it("permite cancelar una inscripción desde la tarjeta destacada sin navegar", () => {
    const onCancelarInscripcion = jest.fn();
    const onOpenDetalle = jest.fn();

    render(
      <StudentHomeAtlas
        student={null}
        studentName="Ana"
        criterios={initialCriterios}
        openLanzamientos={[launch]}
        practicas={[]}
        solicitudes={[]}
        informeTasks={[]}
        closedLanzamientos={[]}
        enrollmentMap={new Map([[launch.id, enrollment]])}
        institutionAddressMap={new Map()}
        consent={null}
        upcomingStart={null}
        onStartConsent={jest.fn()}
        onOpenDetalle={onOpenDetalle}
        onInscribir={jest.fn()}
        onCancelarInscripcion={onCancelarInscripcion}
        onVerConvocados={jest.fn()}
        onNavigate={jest.fn()}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Inscripción confirmada");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar inscripción" }));

    expect(onCancelarInscripcion).toHaveBeenCalledWith(enrollment.id, "Institución de prueba");
    expect(onOpenDetalle).not.toHaveBeenCalled();
  });
});
