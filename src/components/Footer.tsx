
import React from 'react';
import { ALERT_PRACTICAS_TITLE, ALERT_PRACTICAS_TEXT, ALERT_INFORMES_TITLE } from '../constants';
import Card from './ui/Card';
import type { TabId } from '../types';

interface FooterProps {
  activeTab: TabId;
}

interface NoticeConfig {
  title: string;
  text: string;
  icon: string;
  mailToSubject: string;
  mailToBody: string;
  buttonText: string;
}

const noticeConfig: Partial<Record<TabId, NoticeConfig>> = {
  inicio: {
    title: 'Sobre las Convocatorias',
    text: 'Las convocatorias se abren y cierran según las necesidades de las instituciones. Si no ves una PPS de tu interés, ¡vuelve a consultar pronto! Las fechas y horarios son definidos por cada institución y no pueden modificarse.',
    icon: 'campaign',
    mailToSubject: 'Consulta sobre Convocatorias de PPS - Mi Panel Académico',
    mailToBody: 'Hola,\n\nTengo una consulta sobre las convocatorias de PPS.\n\n- Nombre Completo: [Escribe tu nombre]\n- Legajo: [Escribe tu legajo]\n- Mi consulta es: [Describe tu duda]\n\nGracias.',
    buttonText: 'Consultar sobre convocatorias'
  },
  solicitudes: {
    title: 'Acerca de tus Solicitudes',
    text: 'El estado de tus solicitudes de PPS se actualiza a medida que avanzan las gestiones con las instituciones, lo cual puede tomar tiempo. Te mantendremos informado de cada avance a través de notificaciones por correo electrónico. Si tienes dudas sobre un estado en particular, puedes contactarnos.',
    icon: 'list_alt',
    mailToSubject: 'Consulta sobre Estado de Solicitud de PPS - Mi Panel Académico',
    mailToBody: 'Hola,\n\nTengo una consulta sobre el estado de mi solicitud de PPS.\n\n- Nombre Completo: [Escribe tu nombre]\n- Legajo: [Escribe tu legajo]\n- Institución Solicitada: [Escribe el nombre de la institución]\n\nGracias.',
    buttonText: 'Consultar sobre una solicitud'
  },
  practicas: {
    title: ALERT_PRACTICAS_TITLE,
    text: ALERT_PRACTICAS_TEXT,
    icon: 'gavel',
    mailToSubject: 'Solicitud de Corrección de Datos - Mi Panel Académico',
    mailToBody: 'Hola,\n\nSolicito una corrección en mis datos. Adjunto la documentación respaldatoria (ej. planilla de asistencia).\n\n- Nombre Completo: [Escribe tu nombre]\n- Legajo: [Escribe tu legajo]\n\nGracias.',
    buttonText: 'Enviar correo para corrección'
  },
  profile: {
    title: 'Sobre tus Datos Personales',
    text: 'Mantener tus datos de contacto actualizados es fundamental para que las instituciones puedan contactarse contigo. Ahora tienes el control para editar tu teléfono y correo electrónico directamente desde este panel si detectas algún cambio necesario.',
    icon: 'contact_mail',
    mailToSubject: 'Solicitud de Actualización de Datos - Mi Panel Académico',
    mailToBody: 'Hola,\n\nTengo una consulta o solicitud sobre mis datos personales.\n\n- Nombre Completo: [Escribe tu nombre]\n- Legajo: [Escribe tu legajo]\n- Mi consulta es: [Describe tu duda]\n\nGracias.',
    buttonText: 'Consultar sobre mis datos'
  }
};


const Footer: React.FC<FooterProps> = ({ activeTab }) => {
  const currentNotice = noticeConfig[activeTab];

  if (!currentNotice) {
    return null;
  }

  const mailToLink = `mailto:blas.rivera@uflouniversidad.edu.ar?subject=${encodeURIComponent(currentNotice.mailToSubject)}&body=${encodeURIComponent(currentNotice.mailToBody)}`;

  return (
    <footer className="mt-16 mb-8 animate-fade-in-up">
      <Card>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="hidden sm:block flex-shrink-0">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 rounded-2xl h-14 w-14 flex items-center justify-center border border-blue-100 dark:border-blue-800 shadow-sm">
              <span className="material-icons !text-3xl" aria-hidden="true">
                {currentNotice.icon}
              </span>
            </div>
          </div>
          <div className="flex-grow pt-2 sm:pt-0">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg leading-tight mb-3">
              {currentNotice.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed max-w-prose">
              {currentNotice.text}
            </p>
            <div className="mt-6">
              <a
                href={mailToLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 dark:text-white dark:border-transparent dark:hover:from-blue-500 dark:hover:to-indigo-500 font-bold text-sm py-3 px-6 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900"
              >
                <span className="material-icons !text-lg">email</span>
                <span>{currentNotice.buttonText}</span>
              </a>
            </div>
          </div>
        </div>
      </Card>
    </footer>
  );
};

export default Footer;
