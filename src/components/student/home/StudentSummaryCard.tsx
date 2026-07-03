import React from "react";
import type { CriteriosCalculados } from "../../../types";

interface StudentSummaryCardProps {
  criterios: CriteriosCalculados;
  activePpsName: string;
  hasActiveEnrollment: boolean;
  totalTarget: number;
  progressPct: number;
  hoursAcc: number;
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
  const remainingHours = Math.max(totalTarget - hoursAcc, 0);

  return (
    <div className="home-hero">
      <div className="home-hero__grad" aria-hidden />
      <div className="home-hero__top">
        <div className="min-w-0">
          <div className="mono home-hero__lbl">Avance PPS</div>
          <div className="home-hero__val display">
            {hoursAcc}
            <span className="home-hero__u">/{totalTarget} hs</span>
          </div>
        </div>
        <span className="home-hero__pct">{progressPct}%</span>
      </div>
      <div className="home-hero__bar">
        <span style={{ width: `${progressPct}%` }} />
      </div>
      <p className="home-hero__hint">
        {remainingHours > 0
          ? `Te faltan ${remainingHours} hs para completar el recorrido.`
          : "Completaste las horas requeridas."}
      </p>
    </div>
  );
};

export default StudentSummaryCard;
