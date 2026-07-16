import React, { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../components/student/ds";
import { useAuth } from "../../contexts/AuthContext";
import { MOODLE_ASSIGN, useAulaEntregas } from "../../hooks/useAulaEntregas";

type AulaSectionId = "guia" | "descargas" | "preguntas" | "entregas";

const SECTION_IDS: AulaSectionId[] = ["guia", "descargas", "preguntas", "entregas"];
const SECTION_STORAGE_KEY = "pps_aula_sec";
const PANEL_LOCKED_SECTIONS = [
  { label: "Inicio", path: "/student" },
  { label: "Entregas", path: "/student/entregas" },
  { label: "Prácticas", path: "/student/practicas" },
  { label: "Solicitudes", path: "/student/solicitudes" },
  { label: "Perfil", path: "/student/perfil" },
];
const COORDINATOR_MAIL = "blas.rivera@uflouniversidad.edu.ar";

/* Sección inicial: 1) ?sec= de la URL (deep-link desde el campus o un mail),
   2) última sección visitada en esta pestaña, 3) guía. */
function resolveInitialSection(fromUrl: string | null): AulaSectionId {
  if (fromUrl && SECTION_IDS.includes(fromUrl as AulaSectionId)) return fromUrl as AulaSectionId;
  try {
    const stored = sessionStorage.getItem(SECTION_STORAGE_KEY);
    if (stored && SECTION_IDS.includes(stored as AulaSectionId)) return stored as AulaSectionId;
  } catch {
    /* sessionStorage puede no estar disponible (iframe con cookies bloqueadas) */
  }
  return "guia";
}

interface AulaSection {
  id: AulaSectionId;
  num: string;
  label: string;
  hint: string;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  icon: IconName;
  /* Encabezado de página cuando la sección vive como pestaña propia del panel
     (misma articulación que .ah-pagehead de Prácticas/Solicitudes/Perfil). */
  pageEyebrow: string;
  pageTitle: React.ReactNode;
  pageLead: string;
}

interface DownloadGroup {
  title: string;
  kicker: string;
  items: { name: string; detail: string; ext: string; href: string; featured?: boolean }[];
}

interface FaqGroup {
  id: string;
  label: string;
  subtitle: string;
  items: { q: string; a: React.ReactNode }[];
}

/* Bloques de la guía: mismo recorrido en siete etapas que la versión editorial
   del campus (guia.html), traducido al lenguaje visual del panel. */
interface GuideBlock {
  num: string;
  kicker: string;
  title: string;
  summary: string;
  bullets?: string[];
  stat?: { value: string; unit: string; text: React.ReactNode };
  note?: { tag: string; key?: boolean; text: React.ReactNode };
  timeline?: { lead: string; title: string; detail: string }[];
  team?: boolean;
}

const sections: AulaSection[] = [
  {
    id: "guia",
    num: "01",
    label: "Guía 2026",
    hint: "El recorrido completo",
    eyebrow: "Cursada",
    title: (
      <>
        La guía completa, <em>dentro del panel.</em>
      </>
    ),
    description:
      "Requisitos, rotaciones, horas, fechas y criterios de finalización reunidos en un recorrido único.",
    icon: "book",
    pageEyebrow: "Campus PPS · Guía de cursada",
    pageTitle: (
      <>
        Tu PPS, de principio a <em>fin.</em>
      </>
    ),
    pageLead:
      "El recorrido completo de la práctica en siete pasos: equipo, acceso, inscripción, cursada, entregas y acreditación final.",
  },
  {
    id: "descargas",
    num: "02",
    label: "Descargas",
    hint: "Plantillas y documentos",
    eyebrow: "Materiales",
    title: (
      <>
        Documentos oficiales, <em>siempre a mano.</em>
      </>
    ),
    description:
      "Planillas, modelos y archivos que se usan durante la cursada, junto a tu recorrido.",
    icon: "download",
    pageEyebrow: "Campus PPS · Materiales",
    pageTitle: (
      <>
        Descargas para <em>tener a mano.</em>
      </>
    ),
    pageLead:
      "Guías, plantillas y documentos oficiales de la práctica. Los mantenemos actualizados durante toda la cursada.",
  },
  {
    id: "preguntas",
    num: "03",
    label: "Preguntas",
    hint: "Antes de escribirnos",
    eyebrow: "Ayuda",
    title: (
      <>
        Respuestas rápidas <em>para destrabar dudas.</em>
      </>
    ),
    description:
      "Inscripción, horarios, solicitudes, consentimiento, entregas y cierre de práctica en lenguaje claro.",
    icon: "help",
    pageEyebrow: "Campus PPS · Centro de ayuda",
    pageTitle: (
      <>
        Preguntas <em>frecuentes.</em>
      </>
    ),
    pageLead:
      "Las consultas más habituales sobre las Prácticas Profesionales Supervisadas, resueltas y agrupadas por etapa. El recorrido paso a paso está en la Guía 2026.",
  },
  {
    id: "entregas",
    num: "04",
    label: "Entregas",
    hint: "Informes a Moodle",
    eyebrow: "Moodle",
    title: (
      <>
        El único salto <em>al campus.</em>
      </>
    ),
    description:
      "Elegís tu área e institución desde acá; la carga del informe se abre directamente en Moodle.",
    icon: "upload",
    pageEyebrow: "Campus PPS · Moodle",
    pageTitle: (
      <>
        Entregas de <em>informes.</em>
      </>
    ),
    pageLead:
      "Elegí tu orientación y abrí la tarea de la institución donde cursaste. Ahí subís la planilla firmada y el informe final.",
  },
];

const guideBlocks: GuideBlock[] = [
  {
    num: "01",
    kicker: "Equipo",
    title: "Quiénes te acompañan",
    summary:
      "Antes de empezar el recorrido, ubicá al equipo de gestión PPS y el canal de consulta.",
    team: true,
  },
  {
    num: "02",
    kicker: "Acceso",
    title: "Tu cuenta abre el recorrido",
    summary:
      "Mi Panel te identifica como estudiante: completás los datos restantes y creás tu cuenta.",
    bullets: [
      "Revisá especialmente tu correo y tu teléfono: son los canales que usan coordinación y las instituciones para contactarte.",
      "Un dato incorrecto puede impedir que recibas el resultado de una selección o el contacto para iniciar la práctica.",
      "Instalá la aplicación en el celular para acceder mejor a avisos, estados y documentación.",
    ],
  },
  {
    num: "03",
    kicker: "Convocatorias",
    title: "Elegí con criterio",
    summary: "Inscribite en las convocatorias y declarale al sistema toda tu disponibilidad real.",
    bullets: [
      "Podés seleccionar todos los horarios disponibles que realmente puedas realizar.",
      "Los cupos de turno tarde son menos frecuentes y se priorizan para estudiantes que trabajan.",
      "Si quedás seleccionado/a, recibís un aviso por correo y el resultado se actualiza en Mi Panel.",
    ],
    note: {
      tag: "Antes de comenzar",
      key: true,
      text: (
        <>
          Si quedaste seleccionado/a, realizá el <strong>consentimiento digital</strong> antes de
          empezar la PPS. Sin ese paso no podés iniciar la práctica.
        </>
      ),
    },
  },
  {
    num: "04",
    kicker: "Compromiso",
    title: "Asistencia y responsabilidad profesional",
    summary: "Estar, comunicarte y sostener una actitud ética son condiciones de aprobación.",
    stat: {
      value: "80",
      unit: "%",
      text: (
        <>
          <strong>Asistencia mínima</strong> para aprobar la práctica. Por debajo de ese umbral, la
          PPS no se acredita.
        </>
      ),
    },
    note: {
      tag: "Atención",
      key: true,
      text: (
        <>
          <strong>Una sola inasistencia sin aviso previo a la institución</strong> es motivo
          suficiente para suspender o desaprobar la PPS. La responsabilidad, la confidencialidad y
          una actitud proactiva se evalúan durante todo el recorrido.
        </>
      ),
    },
  },
  {
    num: "05",
    kicker: "Seguimiento",
    title: "Los documentos que sostienen tu recorrido",
    summary:
      "Mi Panel acompaña la gestión; la evidencia oficial de la práctica se conserva aparte.",
    bullets: [
      "Mi Panel es un seguimiento referencial, no oficial: puede editarse y podés pedir correcciones desde Mis Prácticas.",
      "En PPS presenciales, la planilla de asistencia firmada es el único documento válido que certifica la práctica.",
      "En PPS online, la certificación válida es el informe final aprobado.",
    ],
    note: {
      tag: "Documento válido",
      text: (
        <>
          Si perdés la <strong>planilla de asistencia firmada</strong>, perdés el respaldo de la
          PPS. Guardala y subila junto con el informe: además de verificar la práctica, queda como
          copia de emergencia para la acreditación final.
        </>
      ),
    },
  },
  {
    num: "06",
    kicker: "Cierre",
    title: "Entregas y plazos",
    summary: "Los plazos que corren cuando termina la práctica.",
    timeline: [
      {
        lead: "30 días",
        title: "Entregá el informe",
        detail: "Corridos desde que finaliza la PPS, para subirlo desde la sección Entregas.",
      },
      {
        lead: "30 días",
        title: "Corrección docente",
        detail: "Hábiles del docente para devolver tu informe corregido.",
      },
    ],
    note: {
      tag: "Prórroga",
      text: (
        <>
          Si no llegás con la entrega, escribí a coordinación <strong>antes del vencimiento</strong>{" "}
          para pedir una prórroga.
        </>
      ),
    },
  },
  {
    num: "07",
    kicker: "Acreditación",
    title: "Finalización",
    summary: "Cuando completás los requisitos, pedís la acreditación desde Mis Solicitudes.",
    bullets: [
      "Todos los informes de PPS corregidos y aprobados por el docente.",
      "El pedido de acreditación se hace desde Mis Solicitudes, con un clic.",
    ],
    note: {
      tag: "Último paso",
      key: true,
      text: (
        <>
          Con <strong>todos los requisitos</strong> cumplidos, pedí la{" "}
          <strong>acreditación de tus PPS</strong> desde Mis Solicitudes para cerrar tu recorrido.
          El trámite puede demorar hasta <strong>14 días hábiles</strong>.
        </>
      ),
    },
  },
];

const editorialPrinciples: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "shield",
    title: "Ética profesional",
    text: "Respetá a las personas, los equipos y el encuadre de cada espacio.",
  },
  {
    icon: "lock",
    title: "Confidencialidad",
    text: "Protegé toda información clínica o institucional que conozcas.",
  },
  {
    icon: "education",
    title: "Representación UFLO",
    text: "Tu conducta también representa a la Universidad ante la institución.",
  },
  {
    icon: "bell",
    title: "Comunicación",
    text: "Informá a la institución cualquier ausencia o dificultad de manera inmediata.",
  },
  {
    icon: "user",
    title: "Responsabilidad",
    text: "Cumplí horarios, tareas, acuerdos y condiciones de la convocatoria.",
  },
  {
    icon: "plus",
    title: "Actitud proactiva",
    text: "Participá, preguntá y buscá aprender en cada instancia de la PPS.",
  },
];

const editorialClosingSteps = [
  {
    num: "01",
    lead: "30 días corridos",
    title: "Entregá el informe",
    text: "Contados desde la finalización de la PPS. En prácticas presenciales, adjuntá también la planilla firmada.",
  },
  {
    num: "02",
    lead: "30 días hábiles",
    title: "Revisión académica",
    text: "Es el plazo del equipo docente para corregir y devolver el informe.",
  },
  {
    num: "03",
    lead: "Último paso",
    title: "Pedí la acreditación",
    text: "Cuando todos los requisitos estén aprobados, iniciá el pedido desde Mis Solicitudes.",
  },
];

const campusTeam = [
  { initials: "BR", name: "Blas Rivera", role: "Coord. general", tag: "Coordinación" },
  { initials: "SE", name: "Selva Estrella", role: "Jefa de área Clínica", tag: "Área clínica" },
  {
    initials: "FP",
    name: "Franco Pedraza",
    role: "Jefe de área Educacional",
    tag: "Área educacional",
  },
  {
    initials: "CR",
    name: "Cynthia Rossi",
    role: "Jefa de área Laboral y Comunitaria",
    tag: "Área laboral y comunitaria",
  },
];

const deliveryAreaIcons: Partial<Record<string, IconName>> = {
  clinica: "clinical",
  laboral: "community",
  educacional: "education",
};

/* Archivos reales servidos desde public/descargas/ — nombres canónicos
   documentados en public/descargas/README.md. */
const downloads: DownloadGroup[] = [
  {
    title: "Planillas",
    kicker: "uso frecuente",
    items: [
      {
        name: "Planilla de seguimiento de horas",
        detail: "Tu control exacto de horas, clase a clase. Planilla oficial.",
        ext: "XLSX",
        href: "/descargas/planilla-seguimiento-horas.xlsx",
        featured: true,
      },
      {
        name: "Planilla de asistencia",
        detail: "Registro presencial para la firma de tu referente en sede.",
        ext: "DOC",
        href: "/descargas/planilla-asistencia.doc",
      },
    ],
  },
  {
    title: "Informes y normativa",
    kicker: "consulta",
    items: [
      {
        name: "Guía para la elaboración del informe",
        detail: "Pautas de elaboración académica del informe de PPS.",
        ext: "PDF",
        href: "/descargas/guia-elaboracion-informe.pdf",
      },
      {
        name: "Reglamento de PPS",
        detail: "Marco oficial y resoluciones de referencia.",
        ext: "PDF",
        href: "/descargas/reglamento-pps.pdf",
      },
    ],
  },
];

/* Mismo cuerpo de respuestas que el centro de ayuda editorial del campus
   (preguntas.html): 26 respuestas completas, agrupadas por etapa. */
const faqGroups: FaqGroup[] = [
  {
    id: "inscripcion",
    label: "Inscripción",
    subtitle: "Postulación, cupos y consentimiento.",
    items: [
      {
        q: "¿Cuál es la frecuencia de lanzamiento de convocatorias?",
        a: "Se lanzan de forma periódica a lo largo del año. Conviene revisar Mi Panel, el aula virtual y el grupo de WhatsApp de novedades.",
      },
      {
        q: "¿Cuáles son los criterios para la selección de estudiantes?",
        a: (
          <>
            Cuando los inscriptos superan el cupo, los criterios se aplican en este orden de
            importancia:
            <ol>
              <li>
                <strong>Cantidad de horas realizadas:</strong> es el criterio principal.
              </li>
              <li>
                <strong>Situación académica:</strong> avance en la carrera.
              </li>
              <li>
                <strong>Otros factores:</strong> orientación, disponibilidad, movilidad.
              </li>
              <li>
                <strong>Criterios internos de la facultad,</strong> que pueden variar según
                objetivos.
              </li>
            </ol>
          </>
        ),
      },
      {
        q: "¿Cómo sé si quedé seleccionado en una convocatoria?",
        a: "Recibís una notificación por correo y tu estado se actualiza en la sección de convocatorias, dentro de convocatorias cerradas y tus resultados.",
      },
      {
        q: "¿Qué reviso antes de confirmar una inscripción?",
        a: "El formulario muestra las horas acreditables, el área y los horarios elegidos. Podés seleccionar todos los horarios disponibles que realmente puedas realizar. Los cupos del turno tarde son menos frecuentes y se priorizan para estudiantes que trabajan.",
      },
      {
        q: "¿Cuándo firmo el consentimiento digital?",
        a: "Cuando quedás seleccionado/a y la PPS entra en etapa de confirmación, Mi Panel muestra el botón y el plazo disponible. Leé cada paso, revisá tus datos y marcá las dos declaraciones finales. Sin ese consentimiento no podés iniciar la práctica.",
      },
    ],
  },
  {
    id: "desarrollo",
    label: "Desarrollo",
    subtitle: "Cursada, ausencias y cambios.",
    items: [
      {
        q: "¿Cuántas horas acredita mi PPS?",
        a: (
          <>
            La mayoría de las convocatorias indica la cantidad exacta. Si dice{" "}
            <em>"según recorrido"</em>, depende de la extensión y la frecuencia, con un{" "}
            <strong>máximo de 80 horas</strong>. Las horas no se acreditan oficialmente hasta
            completar las <strong>250</strong>; mientras tanto hay un registro interno en Mi Panel y
            tu seguimiento con la planilla.
          </>
        ),
      },
      {
        q: "¿Puedo cambiar de orientación durante las PPS?",
        a: "No. Hay que completar las horas en la orientación asignada.",
      },
      {
        q: "¿Qué sucede si me ausento de la institución?",
        a: (
          <>
            Es obligatorio <strong>avisar previamente a la institución</strong> y justificar la
            ausencia. <strong>Una sola inasistencia sin aviso</strong> es motivo suficiente para
            suspender o desaprobar la PPS, independientemente de la justificación posterior. La
            comunicación responsable forma parte de la evaluación profesional.
          </>
        ),
      },
      {
        q: "¿Qué pasa si no completo las horas exactas por feriados o paros?",
        a: "Pueden recuperarse extendiendo el período de la PPS si la institución lo autoriza. Si no se recuperan y la práctica termina en fecha, se acreditan las horas tipificadas en la convocatoria, sin importar si las reales fueron menores o mayores.",
      },
      {
        q: "¿Qué sucede si decido continuar más tiempo en mi PPS?",
        a: (
          <>
            Hay que avisar a coordinación para actualizar el seguro. Tené en cuenta que{" "}
            <strong>no se acreditan horas adicionales</strong> a las establecidas en la convocatoria
            original.
          </>
        ),
      },
      {
        q: "¿Puedo repetir una PPS?",
        a: "No se puede repetir en la misma institución y con la misma orientación. Cada práctica debe ser una experiencia nueva para explorar distintos campos y adquirir diversas habilidades.",
      },
      {
        q: "¿Qué sucede si necesito dar de baja una PPS antes de finalizarla?",
        a: "Comunicalo de inmediato a la institución y a coordinación. Se evalúa el caso en conjunto, pero en general la PPS se suspende y se pierden las horas realizadas.",
      },
    ],
  },
  {
    id: "informes",
    label: "Informes",
    subtitle: "Entrega, corrección y prórroga.",
    items: [
      {
        q: "¿Hay alguna guía para elaborar informes?",
        a: "Sí. La guía para la elaboración del informe está en Descargas, junto al reglamento de PPS.",
      },
      {
        q: "¿Cómo entrego un informe?",
        a: "En la sección Entregas, elegís tu orientación e institución: el botón abre la tarea de Moodle correspondiente. Si la PPS fue presencial, subí siempre la planilla de asistencia firmada junto al informe. Esa copia sirve para verificar la práctica y como respaldo de emergencia.",
      },
      {
        q: "¿Qué pasa si pierdo la planilla de asistencia?",
        a: (
          <>
            En una PPS presencial, la <strong>planilla firmada es el único documento válido</strong>{" "}
            que certifica la realización de la práctica y se exige para la acreditación final. Si la
            perdés y no conservaste una copia, perdés el respaldo de esa PPS. Guardala en un lugar
            seguro y subila junto con el informe.
          </>
        ),
      },
      {
        q: "¿Qué hago si no encuentro un espacio de entrega?",
        a: "Notificá a coordinación para que habilite el espacio manualmente en la sección que corresponda a tu orientación.",
      },
      {
        q: "¿Debo firmar planilla en prácticas online o eventos especiales?",
        a: (
          <>
            No. En esos casos, el <strong>informe final</strong> es el elemento oficial que acredita
            la realización de la PPS.
          </>
        ),
      },
      {
        q: "¿Cuáles son las fechas de entrega de informe?",
        a: (
          <>
            <strong>30 días corridos</strong> desde que finaliza la PPS. Registrá esa fecha: las
            tareas del campus no traen vencimiento configurado, así que el control queda de tu lado.
          </>
        ),
      },
      {
        q: "¿Cuánto tiempo tiene el docente para corregir?",
        a: (
          <>
            <strong>30 días hábiles</strong> desde la entrega. Cargar la nota en Mi Panel es
            opcional.
          </>
        ),
      },
      {
        q: "¿Qué hago si mi informe no fue corregido en el plazo?",
        a: "Si lo cargaste en plazo y pasaron los 30 días hábiles, enviá un correo a coordinación para que notifique al jefe de área.",
      },
      {
        q: "¿Qué hago si no llego a entregar el informe en el plazo?",
        a: (
          <>
            Comunicate con coordinación <strong>antes del vencimiento</strong> para pedir una
            prórroga. Si se aprueba, el docente corrige según disponibilidad (el plazo de 30 días no
            aplica a entregas fuera de término).
          </>
        ),
      },
    ],
  },
  {
    id: "panel",
    label: "Mi Panel",
    subtitle: "Acreditación final y uso de la herramienta.",
    items: [
      {
        q: "¿Cuáles son los requisitos obligatorios para acreditar?",
        a: (
          <>
            <ol>
              <li>
                <strong>250 horas totales</strong> de práctica aprobada.
              </li>
              <li>
                <strong>Mínimo 70 horas</strong> en tu orientación de especialidad.
              </li>
              <li>
                <strong>Rotación</strong> por al menos 3 de las 4 orientaciones.
              </li>
              <li>
                <strong>Todos los informes</strong> corregidos y aprobados.
              </li>
            </ol>
            Usá la planilla de seguimiento para el control exacto de horas: Mi Panel es referencial.
          </>
        ),
      },
      {
        q: "¿Cuánto demora la acreditación final?",
        a: (
          <>
            Una vez enviada la solicitud desde <strong>Mis Solicitudes</strong>, el trámite puede
            demorar hasta <strong>14 días hábiles</strong>. Vas a recibir la confirmación cuando la
            acreditación quede registrada.
          </>
        ),
      },
      {
        q: "¿Qué es Mi Panel?",
        a: (
          <>
            Es la herramienta de gestión PPS para inscripción, solicitudes, seguimiento de horas,
            consentimiento y acreditación. Su información es <strong>referencial y editable</strong>
            : no constituye un registro oficial y podés solicitar correcciones desde Mis Prácticas.
            En una PPS presencial, la <strong>planilla de asistencia firmada</strong> es tu respaldo
            oficial; en una PPS online, lo es el <strong>informe final aprobado</strong>.
          </>
        ),
      },
      {
        q: "¿Qué datos debo revisar cuando creo mi cuenta?",
        a: (
          <>
            Mi Panel te identifica automáticamente como estudiante y te pide completar los datos
            restantes. Revisá con especial atención <strong>correo y teléfono</strong>: coordinación
            y las instituciones usan esos canales para comunicar selecciones y organizar el inicio
            de las prácticas. Un dato incorrecto puede dejarte sin esas notificaciones.
          </>
        ),
      },
      {
        q: "¿Dónde encuentro la Guía, Descargas, Preguntas y mi perfil?",
        a: (
          <>
            En computadora, abrí <strong>Recursos</strong> en la barra superior para entrar a Guía
            2026, Descargas y Preguntas. Tu perfil está dentro del menú de tu cuenta. En celular,
            tocá <strong>Más</strong> en la barra inferior: ahí vas a encontrar esos recursos y Mi
            perfil.
          </>
        ),
      },
      {
        q: "¿Cómo se instala Mi Panel en el celular o computadora?",
        a: (
          <>
            Al ingresar a{" "}
            <a
              href="https://pps-psico.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline text-emerald-600 dark:text-emerald-400"
            >
              pps-psico.github.io
            </a>{" "}
            desde tu navegador móvil o de PC:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Android (Chrome):</strong> Toca los tres puntos arriba a la derecha y
                selecciona <em>"Instalar aplicación"</em> o{" "}
                <em>"Agregar a la pantalla principal"</em>.
              </li>
              <li>
                <strong>iOS (Safari):</strong> Toca el botón <em>"Compartir"</em> (flecha hacia
                arriba) en Safari y selecciona <em>"Agregar a Inicio"</em>.
              </li>
              <li>
                <strong>Computadora (Chrome/Edge):</strong> Haz clic en el ícono de{" "}
                <em>instalación</em> en la barra de direcciones superior de la URL.
              </li>
            </ul>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              <strong>Nota importante:</strong> Si estás navegando dentro de <strong>Moodle</strong>
              , la instalación automática está bloqueada. Abre la dirección directa en el navegador
              de tu celular para poder realizarla.
            </p>
          </>
        ),
      },
      {
        q: "¿Qué pasa si no puedo acceder a Mi Panel?",
        a: "Comunicate con coordinación. Si es tu primera inscripción, puede que el legajo todavía no esté cargado en el sistema.",
      },
      {
        q: "¿Cómo solicito una corrección en Mi Panel?",
        a: (
          <>
            Desde la sección <strong>Mis Prácticas</strong>. También podés editar fechas y solicitar
            modificaciones según corresponda.
          </>
        ),
      },
    ],
  },
  {
    id: "tramites",
    label: "Trámites",
    subtitle: "Propuestas propias y comunicación.",
    items: [
      {
        q: "¿Cómo propongo una institución nueva para realizar una PPS?",
        a: (
          <>
            Desde <strong>Solicitudes → Nueva solicitud de PPS</strong>, completás el formulario con
            los datos de una institución nueva. En línea con la
            <strong> filosofía integral y cooperativa de las PPS</strong>, las propuestas
            individuales deben aportar al conjunto de la comunidad académica. Requisitos:
            <ol>
              <li>
                <strong>Aporte al conjunto:</strong> La institución propuesta debe ofrecer al menos
                <strong> 3 cupos (vacantes) o más</strong> para que también puedan postularse otros
                estudiantes de la universidad.
              </li>
              <li>
                Debe contar con un <strong>profesional de la psicología supervisando</strong> en la
                institución (excluyente).
              </li>
              <li>La institución no debe tener ya un convenio activo con la universidad.</li>
              <li>
                No es necesario un convenio previo; el trámite de firma de convenio se inicia tras
                la aprobación académica de la propuesta.
              </li>
            </ol>
            El estado de la propuesta se sigue desde la sección <strong>Mis Solicitudes</strong>.
          </>
        ),
      },
      {
        q: "¿Qué sucede si envié un correo y no tuve respuesta?",
        a: (
          <>
            El tiempo estimado de respuesta es de <strong>48 horas hábiles</strong>. Pasado ese
            plazo, reenviá el correo con <strong>"URGENTE"</strong> en el asunto para priorizar el
            caso.
          </>
        ),
      },
    ],
  },
];

interface StudentAulaViewProps {
  mode?: "panel" | "public";
  section?: AulaSectionId;
}

const StudentAulaView: React.FC<StudentAulaViewProps> = ({ mode = "panel", section }) => {
  const { authenticatedUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPublic = mode === "public";
  const { areas: deliveryAreas } = useAulaEntregas();

  const [activeSectionState, setActiveSectionState] = useState<AulaSectionId>(() =>
    resolveInitialSection(searchParams.get("sec"))
  );
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState(faqGroups[0].id);
  const [openFaq, setOpenFaq] = useState<string | null>(faqGroups[0].items[0]?.q ?? null);
  const [mailCopied, setMailCopied] = useState(false);

  const activeSection = section || activeSectionState;

  /* Cambio de sección: persiste en sessionStorage y, en el modo público,
     también en la URL (?sec=) para que se pueda compartir/deep-linkear. */
  const setActiveSection = useCallback(
    (id: AulaSectionId) => {
      if (section) return; // Sección fija (pestaña propia del panel): no cambia
      setActiveSectionState(id);
      try {
        sessionStorage.setItem(SECTION_STORAGE_KEY, id);
      } catch {
        /* noop */
      }
      if (isPublic) {
        setSearchParams(id === "guia" ? {} : { sec: id }, { replace: true });
      }
    },
    [isPublic, setSearchParams, section]
  );

  const handleCopyMail = useCallback(() => {
    const done = () => {
      setMailCopied(true);
      window.setTimeout(() => setMailCopied(false), 2600);
    };
    try {
      navigator.clipboard.writeText(COORDINATOR_MAIL).then(done, done);
    } catch {
      done();
    }
  }, []);

  const selectedSection = sections.find((s) => s.id === activeSection) ?? sections[0];
  const selectedArea = useMemo(
    () => deliveryAreas.find((area) => area.id === activeArea) ?? deliveryAreas[0],
    [activeArea, deliveryAreas]
  );

  const handleDeliveryAreaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % deliveryAreas.length;
      else if (event.key === "ArrowLeft")
        nextIndex = (index - 1 + deliveryAreas.length) % deliveryAreas.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = deliveryAreas.length - 1;
      else return;

      event.preventDefault();
      const nextArea = deliveryAreas[nextIndex];
      setActiveArea(nextArea.id);
      document.getElementById(`delivery-tab-${nextArea.id}`)?.focus();
    },
    [deliveryAreas]
  );
  const selectedFaq = useMemo(
    () => faqGroups.find((group) => group.id === activeFaq) ?? faqGroups[0],
    [activeFaq]
  );

  return (
    <div
      className={
        "ah-root ah-unified ah-aula" +
        (isPublic ? " ah-aula--public" : "") +
        (section ? " ah-aula--section-only" : "")
      }
    >
      {isPublic && !section && (
        <header className="ah-aula-publicbar">
          <Link className="ah-aula-publicbar__brand" to="/aula">
            <span className="ah-aula-publicbar__mark">UFLO</span>
            <span className="ah-aula-publicbar__sep" />
            <span>PPS 2026</span>
          </Link>
          <nav className="ah-aula-publicbar__nav" aria-label="Accesos principales">
            {PANEL_LOCKED_SECTIONS.map((item) =>
              authenticatedUser ? (
                <Link key={item.path} className="ah-aula-publicbar__panel" to={item.path}>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.path}
                  type="button"
                  className="ah-aula-publicbar__panel is-locked"
                  aria-disabled="true"
                  title="Disponible al ingresar a Mi Panel"
                >
                  <span>{item.label}</span>
                  <span className="material-icons" aria-hidden>
                    lock
                  </span>
                </button>
              )
            )}
            <span className="ah-aula-publicbar__navsep" aria-hidden />
            {sections.map((secItem) => (
              <button
                key={secItem.id}
                type="button"
                className={secItem.id === activeSection ? "is-on" : undefined}
                onClick={() => setActiveSection(secItem.id)}
              >
                {secItem.label}
              </button>
            ))}
          </nav>
        </header>
      )}
      <main className="ah-main ah-aula__main">
        {section ? (
          /* Pestaña propia del panel: encabezado de página con la misma
             articulación que las vistas nativas (.ah-pagehead). */
          <section
            className={
              "ah-pagehead ah-aula__hero ah-aula__hero--solo" +
              (activeSection === "guia" ? " ah-aula__hero--guide" : "")
            }
          >
            <div className="ah-aula__hero-copy">
              <span className="eyebrow">{selectedSection.pageEyebrow}</span>
              <h1 className="ah-aula__title">{selectedSection.pageTitle}</h1>
              <p className="ah-aula__lead">{selectedSection.pageLead}</p>
            </div>
            {activeSection === "guia" && (
              <figure className="ah-aula__journey-art">
                <img
                  src={`${import.meta.env.BASE_URL}campus-pps-recorrido.png`}
                  alt="Recorrido de la PPS en siete etapas: equipo, acceso, inscripción, compromiso, documentación, entregas y finalización."
                  width="1915"
                  height="821"
                  decoding="async"
                />
              </figure>
            )}
          </section>
        ) : (
          <>
            <section className="ah-pagehead ah-aula__hero ah-aula__hero--solo">
              <div className="ah-aula__hero-copy">
                <span className="eyebrow">
                  Campus PPS · Facultad de Psicología
                  {isPublic && <span className="ah-aula__hero-tag">Acceso público</span>}
                </span>
                <h1 className="ah-aula__title">
                  Aula <em>PPS 2026.</em>
                </h1>
                <p className="ah-aula__lead">
                  {isPublic
                    ? "Guía, preguntas, descargas y entregas para empezar la cursada aunque todavía no tengas cuenta en Mi Panel."
                    : "Guía, descargas, preguntas y entregas en el mismo lugar donde seguís tus convocatorias, prácticas y consentimiento."}
                </p>
              </div>
            </section>

            <nav className="ah-aula__switcher" aria-label="Secciones del aula">
              {sections.map((secItem) => (
                <button
                  key={secItem.id}
                  type="button"
                  className={"ah-aula__switch" + (secItem.id === activeSection ? " is-active" : "")}
                  aria-current={secItem.id === activeSection ? "true" : undefined}
                  onClick={() => setActiveSection(secItem.id)}
                >
                  <span className="ah-aula__switch-ic" aria-hidden>
                    <Icon name={secItem.icon} size={17} />
                  </span>
                  <span className="ah-aula__switch-txt">
                    <span className="ah-aula__switch-label">{secItem.label}</span>
                    <small>{secItem.hint}</small>
                  </span>
                  <span className="ah-aula__switch-num" aria-hidden>
                    {secItem.num}
                  </span>
                </button>
              ))}
            </nav>
          </>
        )}

        {section && activeSection === "guia" ? (
          <div className="ah-aula__editorial">
            <section className="ah-aula__editorial-team" aria-labelledby="editorial-team-title">
              <header className="ah-aula__editorial-heading ah-aula__editorial-heading--compact">
                <span className="ah-aula__editorial-num" aria-hidden>
                  01
                </span>
                <div>
                  <span className="ah-aula__editorial-eyebrow">Equipo PPS</span>
                  <h2 id="editorial-team-title">El equipo que te acompaña</h2>
                </div>
              </header>
              <div className="ah-aula__editorial-people">
                {campusTeam.map((person) => (
                  <div key={person.initials}>
                    <span aria-hidden>{person.initials}</span>
                    <p>
                      <strong>{person.name}</strong>
                      <small>{person.role}</small>
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="ah-aula__editorial-opening">
              <article className="ah-aula__editorial-chapter" aria-labelledby="editorial-account">
                <header className="ah-aula__editorial-heading">
                  <span className="ah-aula__editorial-num" aria-hidden>
                    02
                  </span>
                  <div>
                    <span className="ah-aula__editorial-eyebrow">Primer acceso</span>
                    <h2 id="editorial-account">Tu cuenta abre el recorrido</h2>
                  </div>
                </header>
                <p className="ah-aula__editorial-pull">
                  El primer paso para una experiencia ordenada y sin contratiempos.
                </p>
                <p className="ah-aula__editorial-copy">
                  Al ingresar, Mi Panel te identifica automáticamente como estudiante. Solo tenés
                  que completar los datos restantes y crear tu cuenta.
                </p>
                <ul className="ah-aula__editorial-checks">
                  <li>
                    <Icon name="check" size={17} />
                    <span>
                      <strong>Completá tus datos personales</strong> y comprobá que coincidan con tu
                      documentación y tu legajo.
                    </span>
                  </li>
                  <li>
                    <Icon name="bell" size={17} />
                    <span>
                      <strong>Revisá correo y teléfono.</strong> Coordinación y las instituciones
                      usan esos canales para comunicar una selección, coordinar entrevistas y
                      organizar el inicio.
                    </span>
                  </li>
                  <li>
                    <Icon name="alert" size={17} />
                    <span>
                      <strong>Mantenelos actualizados.</strong> Un dato incorrecto puede impedir que
                      recibas una notificación o que la institución logre contactarte.
                    </span>
                  </li>
                </ul>
                <aside className="ah-aula__editorial-app" role="note">
                  <span className="material-icons ah-aula__editorial-phone" aria-hidden>
                    smartphone
                  </span>
                  <p>
                    <strong>Mi Panel, mejor en el celular</strong>
                    <span>
                      Disponible para instalar en <strong>iOS y Android</strong>. Accedé a avisos,
                      estados y documentación con mayor comodidad.
                    </span>
                  </p>
                </aside>
              </article>

              <article className="ah-aula__editorial-chapter" aria-labelledby="editorial-enroll">
                <header className="ah-aula__editorial-heading">
                  <span className="ah-aula__editorial-num" aria-hidden>
                    03
                  </span>
                  <div>
                    <span className="ah-aula__editorial-eyebrow">Convocatorias</span>
                    <h2 id="editorial-enroll">Elegí con criterio</h2>
                  </div>
                </header>
                <p className="ah-aula__editorial-pull">
                  Cada horario que elegís puede convertirse en tu vacante.
                </p>
                <p className="ah-aula__editorial-copy">
                  Inscribite con amplitud, pero también con responsabilidad. Marcá solo opciones que
                  realmente puedas sostener durante toda la práctica.
                </p>
                <ul className="ah-aula__editorial-checks ah-aula__editorial-checks--enrollment">
                  <li>
                    <Icon name="cal" size={17} />
                    <span>
                      <strong>Seleccioná todos los horarios que puedas cumplir.</strong> Podés
                      elegir más de uno si están disponibles y realmente podés realizarlos.
                    </span>
                  </li>
                  <li>
                    <Icon name="clock" size={17} />
                    <span>
                      <strong>Los cupos de turno tarde son menos frecuentes.</strong> Se priorizan
                      para estudiantes que trabajan.
                    </span>
                  </li>
                  <li>
                    <Icon name="bell" size={17} />
                    <span>
                      <strong>Revisá tu correo y Mi Panel.</strong> Ahí se comunica el resultado de
                      cada selección y el plazo para confirmar tu vacante.
                    </span>
                  </li>
                </ul>
                <aside className="ah-aula__editorial-consent" role="note">
                  <Icon name="idcard" size={23} />
                  <p>
                    <strong>La selección todavía no habilita el inicio</strong>
                    <span>
                      Leé y firmá el consentimiento digital dentro del plazo indicado. Ahí confirmás
                      el horario y las condiciones de la convocatoria. Sin esa aceptación no podés
                      comenzar la PPS.
                    </span>
                  </p>
                </aside>
              </article>

              <article
                className="ah-aula__editorial-commitment"
                aria-labelledby="editorial-commitment"
              >
                <header className="ah-aula__editorial-heading">
                  <span className="ah-aula__editorial-num" aria-hidden>
                    04
                  </span>
                  <div>
                    <span className="ah-aula__editorial-eyebrow">Compromiso</span>
                    <h2 id="editorial-commitment">Estar es parte de aprobar</h2>
                  </div>
                </header>
                <div className="ah-aula__editorial-commitment-lead">
                  <div className="ah-aula__editorial-attendance">
                    <strong>
                      80<span>%</span>
                    </strong>
                    <p>
                      de asistencia mínima requerida. Por debajo de este umbral, la práctica no se
                      acredita.
                    </p>
                  </div>
                  <blockquote>
                    <span aria-hidden>“</span>
                    Una sola inasistencia sin aviso previo a la institución es motivo suficiente
                    para suspender o desaprobar la PPS.
                  </blockquote>
                </div>
                <div className="ah-aula__editorial-principles">
                  {editorialPrinciples.map((principle) => (
                    <div key={principle.title}>
                      <Icon name={principle.icon} size={21} />
                      <p>
                        <strong>{principle.title}</strong>
                        <span>{principle.text}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <p className="ah-aula__editorial-commitment-note">
                  La evaluación no se limita a sumar horas. La institución informa el desempeño
                  técnico y actitudinal, y coordinación audita el cumplimiento ético. La PPS puede
                  suspenderse en cualquier momento si no se respeta el encuadre.
                </p>
              </article>
            </div>

            <article className="ah-aula__editorial-documents" aria-labelledby="editorial-documents">
              <header className="ah-aula__editorial-heading">
                <span className="ah-aula__editorial-num" aria-hidden>
                  05
                </span>
                <div>
                  <span className="ah-aula__editorial-eyebrow">Seguimiento y respaldo</span>
                  <h2 id="editorial-documents">Los documentos que sostienen tu recorrido</h2>
                </div>
              </header>
              <div className="ah-aula__editorial-docgrid">
                <section className="ah-aula__editorial-docintro">
                  <p>
                    Tu recorrido deja huellas. Conocé cuál documento acompaña la gestión y cuál
                    certifica oficialmente cada práctica.
                  </p>
                </section>
                <section className="ah-aula__editorial-doc ah-aula__editorial-doc--panel">
                  <Icon name="eye" size={25} />
                  <div>
                    <span>Seguimiento editable</span>
                    <h3>Mi Panel no es un documento oficial</h3>
                    <p>
                      Organiza inscripciones, estados, solicitudes y horas. Su información es
                      referencial, puede editarse y podés pedir modificaciones desde Mis Prácticas.
                    </p>
                  </div>
                </section>
                <section className="ah-aula__editorial-doc ah-aula__editorial-doc--paper">
                  <Icon name="file" size={25} />
                  <div>
                    <span>PPS presenciales</span>
                    <h3>Planilla de asistencia firmada</h3>
                    <p>
                      Es el <strong>único documento válido</strong> que certifica la realización de
                      una práctica presencial y es obligatorio para la acreditación final. Subila
                      junto con el informe para conservar una copia de respaldo.
                    </p>
                    <strong className="ah-aula__editorial-doc-warning">
                      Si perdés la planilla, perdés el respaldo de la PPS.
                    </strong>
                  </div>
                </section>
                <section className="ah-aula__editorial-doc ah-aula__editorial-doc--online">
                  <Icon name="check" size={25} />
                  <div>
                    <span>PPS online</span>
                    <h3>Informe final aprobado</h3>
                    <p>
                      En prácticas a distancia, el informe corregido y aprobado es el documento que
                      acredita oficialmente la realización de la PPS.
                    </p>
                  </div>
                </section>
              </div>
            </article>

            <article className="ah-aula__editorial-closing" aria-labelledby="editorial-closing">
              <header className="ah-aula__editorial-heading">
                <span className="ah-aula__editorial-num" aria-hidden>
                  06
                </span>
                <div>
                  <span className="ah-aula__editorial-eyebrow">Cierre</span>
                  <h2 id="editorial-closing">Entregas y revisión</h2>
                </div>
              </header>
              <div className="ah-aula__editorial-flow">
                {editorialClosingSteps.map((step) => (
                  <section key={step.num}>
                    <span>{step.num}</span>
                    <p>
                      <small>{step.lead}</small>
                      <strong>{step.title}</strong>
                      {step.text}
                    </p>
                  </section>
                ))}
              </div>
            </article>

            <footer className="ah-aula__editorial-final" aria-labelledby="editorial-final">
              <div className="ah-aula__editorial-final-title">
                <span aria-hidden>07</span>
                <p>
                  <small>Acreditación</small>
                  <strong id="editorial-final">El último paso se pide desde Mis Solicitudes</strong>
                </p>
              </div>
              <div className="ah-aula__editorial-final-reqs">
                <span>
                  <strong>250 h</strong> totales
                </span>
                <span>
                  <strong>70 h</strong> en tu orientación
                </span>
                <span>
                  <strong>3 de 4</strong> áreas recorridas
                </span>
                <span>
                  <strong>Todos</strong> los informes aprobados
                </span>
              </div>
              <p>
                Cuando el recorrido esté completo y la documentación esté respaldada, solicitá la
                acreditación final desde <strong>Mis Solicitudes</strong>. El trámite puede demorar
                hasta <strong>14 días hábiles</strong>.
              </p>
            </footer>
          </div>
        ) : (
          <section
            className={
              "ah-aula__panel" + (activeSection === "entregas" ? " ah-aula__panel--deliveries" : "")
            }
            key={selectedSection.id}
          >
            {!section && (
              <div className="ah-aula__panel-head">
                <span className="eyebrow">{selectedSection.eyebrow}</span>
                <h2>{selectedSection.title}</h2>
                <p>{selectedSection.description}</p>
              </div>
            )}

            {activeSection === "guia" && (
              <>
                <div className="ah-aula__guide">
                  {guideBlocks.map((block) => (
                    <article key={block.num} className="ah-aula__guide-block">
                      <div className="ah-aula__guide-rail" aria-hidden>
                        <span className="ah-aula__guide-num">{block.num}</span>
                      </div>
                      <div>
                        <span className="ah-aula__guide-eyebrow">{block.kicker}</span>
                        {block.team ? (
                          <h3>
                            Quiénes te <em>acompañan.</em>
                          </h3>
                        ) : (
                          <h3>{block.title}</h3>
                        )}
                        <p>{block.summary}</p>
                        {block.team && (
                          <div
                            className="ah-aula__teamshow ah-aula__teamshow--compact"
                            aria-label="Equipo de gestión PPS"
                          >
                            {campusTeam.map((person, index) => (
                              <article key={person.initials} className="ah-aula__teamcard">
                                <span
                                  className="ah-aula__teamcard-avatar"
                                  data-person={index}
                                  aria-hidden
                                >
                                  {person.initials}
                                </span>
                                <strong>{person.name}</strong>
                                <small>{person.role}</small>
                              </article>
                            ))}
                          </div>
                        )}
                        {block.bullets && (
                          <ul>
                            {block.bullets.map((bullet) => (
                              <li key={bullet}>{bullet}</li>
                            ))}
                          </ul>
                        )}
                        {block.stat && (
                          <div className="ah-aula__stat">
                            <strong>
                              {block.stat.value}
                              <span>{block.stat.unit}</span>
                            </strong>
                            <p>{block.stat.text}</p>
                          </div>
                        )}
                        {block.timeline && (
                          <div className="ah-aula__timeline">
                            {block.timeline.map((row) => (
                              <div key={row.title} className="ah-aula__tl">
                                <span className="ah-aula__tl-lead">{row.lead}</span>
                                <div>
                                  <strong>{row.title}</strong>
                                  <small>{row.detail}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {block.note && (
                          <div
                            className={"ah-aula__keynote" + (block.note.key ? " is-key" : "")}
                            role="note"
                          >
                            <div>
                              <span className="ah-aula__keynote-tag">{block.note.tag}</span>
                              {block.note.text}
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {activeSection === "descargas" && (
              <div className="ah-aula__download-groups">
                {downloads.map((group) => (
                  <section key={group.title} className="ah-aula__download-group">
                    <div className="ah-aula__group-head">
                      <h3>{group.title}</h3>
                      <span>{group.kicker}</span>
                    </div>
                    <div className="ah-aula__downloads">
                      {group.items.map((item) => (
                        <a
                          key={item.name}
                          href={item.href}
                          className={"ah-aula__download" + (item.featured ? " is-featured" : "")}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="ah-aula__ext" data-ext={item.ext}>
                            {item.ext}
                          </span>
                          <span className="ah-aula__download-main">
                            <strong>{item.name}</strong>
                            <small>{item.detail}</small>
                          </span>
                          <span className="ah-aula__download-go" aria-hidden>
                            <Icon name="download" size={17} />
                          </span>
                        </a>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {activeSection === "preguntas" && (
              <>
                <div className="ah-aula__faq-shell">
                  <div className="ah-aula__faq-tabs" aria-label="Categorías de preguntas">
                    {faqGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className={
                          "ah-aula__faq-tab" + (group.id === activeFaq ? " is-active" : "")
                        }
                        onClick={() => {
                          setActiveFaq(group.id);
                          setOpenFaq(group.items[0]?.q ?? null);
                        }}
                      >
                        <span>{group.label}</span>
                        <small>{group.items.length} respuestas</small>
                      </button>
                    ))}
                  </div>
                  <div className="ah-aula__faq-list" key={selectedFaq.id}>
                    <div className="ah-aula__faq-title">
                      <h3>{selectedFaq.label}</h3>
                      <p>{selectedFaq.subtitle}</p>
                    </div>
                    {selectedFaq.items.map((item, idx) => {
                      const isOpen = openFaq === item.q;
                      const panelId = `faq-${selectedFaq.id}-${idx}`;

                      return (
                        <div
                          key={item.q}
                          className="ah-aula__faq-row"
                          data-open={isOpen ? "true" : "false"}
                        >
                          <button
                            type="button"
                            className="ah-aula__faq-question"
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() => setOpenFaq(isOpen ? null : item.q)}
                          >
                            <span>{String(idx + 1).padStart(2, "0")}</span>
                            {item.q}
                            <i className="ah-aula__faq-chev" aria-hidden>
                              <Icon name="chev" size={16} />
                            </i>
                          </button>
                          <div id={panelId} className="ah-aula__faq-panel">
                            <div className="ah-aula__faq-answer">{item.a}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <footer className="ah-aula__faq-cta">
                  <div>
                    <strong>¿No encontraste tu respuesta?</strong>
                    <small>
                      El canal único de consultas es el correo. Coordinación responde en hasta 48 h
                      hábiles.
                    </small>
                  </div>
                  <button type="button" className="ah-aula__mailbtn" onClick={handleCopyMail}>
                    <Icon name={mailCopied ? "check" : "arrow"} size={15} />
                    {mailCopied ? "Correo copiado" : "Escribir al coordinador"}
                  </button>
                </footer>
              </>
            )}

            {activeSection === "entregas" && (
              <div className="ah-aula__deliveries">
                <div className="ah-aula__areas" role="tablist" aria-label="Áreas de entrega">
                  {deliveryAreas.map((area, index) => (
                    <button
                      key={area.id}
                      type="button"
                      role="tab"
                      id={`delivery-tab-${area.id}`}
                      aria-selected={area.id === selectedArea.id}
                      aria-controls="delivery-panel"
                      tabIndex={area.id === selectedArea.id ? 0 : -1}
                      className={
                        "ah-aula__area" + (area.id === selectedArea.id ? " is-active" : "")
                      }
                      style={{ ["--area" as string]: area.color }}
                      onClick={() => setActiveArea(area.id)}
                      onKeyDown={(event) => handleDeliveryAreaKeyDown(event, index)}
                    >
                      <span className="ah-aula__area-ic" aria-hidden>
                        <Icon name={deliveryAreaIcons[area.id] ?? "upload"} size={18} />
                      </span>
                      <span className="ah-aula__area-copy">
                        <strong>
                          {area.id === "laboral" ? (
                            <>
                              <span className="ah-aula__area-prefix">Área </span>
                              Laboral y comunitaria
                            </>
                          ) : (
                            area.name
                          )}
                        </strong>
                        <small>
                          {area.institutions.length}{" "}
                          {area.institutions.length === 1 ? "institución" : "instituciones"}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  id="delivery-panel"
                  role="tabpanel"
                  aria-labelledby={`delivery-tab-${selectedArea.id}`}
                  className="ah-aula__delivery-grid"
                  key={selectedArea.id}
                >
                  {selectedArea.institutions.map((institution) => (
                    <a
                      key={institution.name}
                      className="ah-aula__delivery"
                      href={`${MOODLE_ASSIGN}${institution.moodleId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ["--area" as string]: selectedArea.color }}
                    >
                      <strong>{institution.name}</strong>
                      <span className="ah-aula__delivery-foot">
                        <span className="ah-aula__open">Abrir entrega</span>
                      </span>
                    </a>
                  ))}
                </div>
                <p className="ah-aula__deliveries-note">
                  Cada tarjeta abre la tarea de esa institución en Moodle, donde subís el informe
                  final y, si corresponde, la planilla firmada.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default StudentAulaView;
