import React from "react";

export const MesasAvisoBanner: React.FC = () => {
  return (
    <div className="ah-mesas-banner">
      <div className="ah-mesas-banner__header">
        <div className="ah-mesas-banner__icon-wrap">
          <span className="material-icons ah-mesas-banner__icon" aria-hidden>
            event_available
          </span>
        </div>
        <div className="ah-mesas-banner__titles">
          <h4 className="ah-mesas-banner__title">Reprogramación de Mesas de Examen</h4>
          <p className="ah-mesas-banner__subtitle">
            Se actualizaron las fechas y horarios de los próximos llamados.
          </p>
        </div>
      </div>

      <div className="ah-mesas-banner__grid">
        <div className="ah-mesas-banner__card">
          <span className="ah-mesas-banner__badge">1° Llamado</span>
          <div className="ah-mesas-banner__date">Próximo lunes (27/07)</div>
          <div className="ah-mesas-banner__detail">
            Mantiene el <strong>mismo horario</strong> habitual.
          </div>
        </div>

        <div className="ah-mesas-banner__card">
          <span className="ah-mesas-banner__badge ah-mesas-banner__badge--alt">2° Llamado</span>
          <div className="ah-mesas-banner__date">Lunes 03/08</div>
          <div className="ah-mesas-banner__detail">
            Reprogramado a las <strong>12:30 hs</strong>.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MesasAvisoBanner;
