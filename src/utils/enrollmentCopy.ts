interface EnrollmentNoticeOptions {
  isSelected: boolean;
  isEnrolled: boolean;
  hasFiniteCapacity: boolean;
}

/** Mantiene consistente el mensaje posterior a la acción de inscripción. */
export function getEnrollmentNotice({
  isSelected,
  isEnrolled,
  hasFiniteCapacity,
}: EnrollmentNoticeOptions): string {
  if (isSelected) {
    return "Tu lugar fue confirmado. Revisá el próximo paso para completar el consentimiento.";
  }

  if (!hasFiniteCapacity) {
    return isEnrolled
      ? "Esta convocatoria no tiene límite de cupos: tu inscripción asegura el lugar."
      : "Sin límite de cupos: toda persona que se inscriba queda seleccionada.";
  }

  return isEnrolled
    ? "Tu postulación ya figura en el sistema."
    : "Te avisamos por correo si quedás seleccionado/a.";
}
