import React from "react";
import type { CriteriosCalculados } from "../../../types";

interface StudentSummaryCardProps {
  criterios: CriteriosCalculados;
  activePpsName: string;
  hasActiveEnrollment: boolean;
  totalTarget: number;
  progressPct: number;
  hoursAcc: number;
  educacionHs: number;
  practicasTotal: number;
}

/**
 * Hero de resumen — dirección editorial (Gamma · ScreenInicio).
 * Tarjeta limpia y aireada: un solo indicador de progreso (la barra),
 * para no duplicar el dato y dejar respirar el resto del home.
 * Consume las clases `.home-hero` (ver index.css, scope `.ed`).
 */
export const StudentSummaryCard: React.FC<StudentSummaryCardProps> = ({
  totalTarget,
  progressPct,
  hoursAcc,
}) => {
  return (
    <div className="home-hero">
      <div className="home-hero__grad" aria-hidden />
      <div className="home-hero__row">
        <div className="min-w-0">
          <div className="mono home-hero__lbl">Tu recorrido hasta ahora</div>
          <div className="home-hero__val display">
            {hoursAcc}
            <span className="home-hero__u">
              /{totalTarget} hs · {progressPct}%
            </span>
          </div>
        </div>
      </div>
      <div className="home-hero__bar">
        <span style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
};

export default StudentSummaryCard;
