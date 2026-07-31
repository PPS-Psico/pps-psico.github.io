import { getEnrollmentNotice } from "../enrollmentCopy";

describe("getEnrollmentNotice", () => {
  it("explica que la inscripción asegura el lugar cuando no hay límite", () => {
    expect(
      getEnrollmentNotice({
        isSelected: false,
        isEnrolled: false,
        hasFiniteCapacity: false,
      })
    ).toBe("Sin límite de cupos: toda persona que se inscriba queda seleccionada.");
  });

  it("confirma el lugar de quien ya se inscribió sin límite de cupos", () => {
    expect(
      getEnrollmentNotice({
        isSelected: false,
        isEnrolled: true,
        hasFiniteCapacity: false,
      })
    ).toBe("Esta convocatoria no tiene límite de cupos: tu inscripción asegura el lugar.");
  });

  it("mantiene el aviso de selección cuando el cupo es limitado", () => {
    expect(
      getEnrollmentNotice({
        isSelected: false,
        isEnrolled: false,
        hasFiniteCapacity: true,
      })
    ).toBe("Te avisamos por correo si quedás seleccionado/a.");
  });
});
