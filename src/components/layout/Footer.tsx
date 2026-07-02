import React from "react";
import "../student/home/atlas/atlasHome.css";
import type { TabId } from "../../types";

interface FooterProps {
  activeTab: TabId;
}

interface NoticeConfig {
  /** Texto breve y editorial — el descargo/expectativa condensado a una línea. */
  text: string;
  mailToSubject: string;
  mailToBody: string;
  buttonText: string;
}

// Nota al pie por sección: una línea de contexto + un contacto pre-armado.
// 'inicio' va sin nota (el Home editorial es autocontenido) y en mobile no se
// muestra ninguna (lo decide StudentView).
const noticeConfig: Partial<Record<TabId, NoticeConfig>> = {
  solicitudes: {
    text: "El estado se actualiza con cada gestión. Te avisamos por mail cuando haya novedades.",
    mailToSubject: "Consulta sobre Estado de Solicitud de PPS - Mi Panel Académico",
    mailToBody:
      "Hola,\n\nTengo una consulta sobre el estado de mi solicitud de PPS.\n\n- Nombre Completo: [Escribe tu nombre]\n- Legajo: [Escribe tu legajo]\n- Institución Solicitada: [Escribe el nombre de la institución]\n\nGracias.",
    buttonText: "Consultar una solicitud",
  },
  practicas: {
    text: "Seguimiento interno: no es un registro académico oficial y puede contener diferencias. La validación final depende de las planillas de asistencia y los informes realizados.",
    mailToSubject: "Solicitud de Corrección de Datos - Mi Panel Académico",
    mailToBody:
      "Hola,\n\nSolicito una corrección en mis datos. Adjunto la documentación respaldatoria (ej. planilla de asistencia).\n\n- Nombre Completo: [Escribe tu nombre]\n- Legajo: [Escribe tu legajo]\n\nGracias.",
    buttonText: "Solicitar corrección",
  },
  profile: {
    text: "Mantené tu teléfono y correo al día para que las instituciones puedan contactarte; podés editarlos desde acá.",
    mailToSubject: "Solicitud de Actualización de Datos - Mi Panel Académico",
    mailToBody:
      "Hola,\n\nTengo una consulta o solicitud sobre mis datos personales.\n\n- Nombre Completo: [Escribe tu nombre]\n- Legajo: [Escribe tu legajo]\n- Mi consulta es: [Describe tu duda]\n\nGracias.",
    buttonText: "Consultar mis datos",
  },
};

const Footer: React.FC<FooterProps> = ({ activeTab }) => {
  const currentNotice = noticeConfig[activeTab];

  if (!currentNotice) {
    return null;
  }

  const mailToLink = `mailto:blas.rivera@uflouniversidad.edu.ar?subject=${encodeURIComponent(currentNotice.mailToSubject)}&body=${encodeURIComponent(currentNotice.mailToBody)}`;

  return (
    <div className="ah-root">
      <div className="ah-main">
        <footer className="ah-footnote animate-fade-in-up">
          <p className="ah-footnote__txt">{currentNotice.text}</p>
          <a
            href={mailToLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ah-footnote__link"
          >
            <span className="material-icons" aria-hidden="true">
              email
            </span>
            {currentNotice.buttonText}
          </a>
        </footer>
      </div>
    </div>
  );
};

export default Footer;
