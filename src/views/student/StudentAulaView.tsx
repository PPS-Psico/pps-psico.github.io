import React, { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../components/student/ds";
import { useAuth } from "../../contexts/AuthContext";
import { MOODLE_ASSIGN, useAulaEntregas } from "../../hooks/useAulaEntregas";

type AulaSectionId = "guia" | "descargas" | "preguntas" | "entregas";

const SECTION_IDS: AulaSectionId[] = ["guia", "descargas", "preguntas", "entregas"];
const SECTION_STORAGE_KEY = "pps_aula_sec";
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

/* Bloques de la guía: mismo recorrido en seis etapas que la versión editorial
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
      "El recorrido completo de la práctica en seis etapas: desde el primer acceso hasta la acreditación final, con los plazos y documentos que importan.",
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
    kicker: "Acceso",
    title: "Dónde empezar",
    summary:
      "Tu cuenta de Mi Panel es la llave para inscribirte, seguir tus estados y pedir la acreditación final.",
    bullets: [
      "Generá o usá tu usuario con número de legajo.",
      "Ubicate primero: revisá esta guía y las preguntas frecuentes; casi todas las dudas se resuelven ahí.",
      "Sumate al grupo de difusión para recibir cada convocatoria al instante.",
    ],
  },
  {
    num: "02",
    kicker: "Convocatorias",
    title: "Inscribite",
    summary: "Las convocatorias se publican durante todo el ciclo y se gestionan desde el panel.",
    bullets: [
      "Postulate desde convocatorias abiertas a las que te interesen.",
      "Si quedás seleccionado/a, recibís un aviso por correo y tu estado se actualiza en el panel.",
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
    num: "03",
    kicker: "Compromiso",
    title: "Asistencia",
    summary: "El umbral que define si la práctica se acredita.",
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
          Es obligatorio{" "}
          <strong>justificar la ausencia y avisar a la institución con antelación</strong>. La falta
          de aviso es el motivo más frecuente de suspensión de una PPS.
        </>
      ),
    },
  },
  {
    num: "04",
    kicker: "Seguimiento",
    title: "Documentación",
    summary: "Con qué llevás el registro de tu práctica y qué documento vale.",
    bullets: [
      "Mi Panel concentra inscripción, solicitudes y avance de horas: tu referencia de gestión.",
      "La planilla de seguimiento de horas (en Descargas) es tu control exacto, clase a clase.",
    ],
    note: {
      tag: "Documento válido",
      text: (
        <>
          La <strong>planilla de asistencia firmada</strong> —o el{" "}
          <strong>informe final aprobado</strong> en prácticas online y eventos especiales— son los
          documentos que acreditan la realización de la PPS.
        </>
      ),
    },
  },
  {
    num: "05",
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
    num: "06",
    kicker: "Acreditación",
    title: "Finalización",
    summary: "Cuando completás los requisitos, pedís la acreditación desde Mi Panel.",
    bullets: [
      "Todos los informes de PPS corregidos y aprobados por el docente.",
      "El pedido de acreditación se hace desde Mis Prácticas, con un clic.",
    ],
    note: {
      tag: "Último paso",
      key: true,
      text: (
        <>
          Con <strong>todos los requisitos</strong> cumplidos, pedí la{" "}
          <strong>acreditación de tus PPS</strong> desde Mi Panel para cerrar tu recorrido.
        </>
      ),
    },
  },
];

const accreditationStats = [
  { value: "250", unit: "horas", label: "de práctica aprobada en total" },
  { value: "70", unit: "horas", label: "mínimas en tu orientación de especialidad" },
  { value: "3", unit: "de 4", label: "orientaciones recorridas, con informes aprobados" },
];

const deliveryAreaIcons: Partial<Record<string, IconName>> = {
  clinica: "help",
  laboral: "user",
  educacional: "book",
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
        q: "¿Cuándo firmo el consentimiento digital?",
        a: "Cuando quedás seleccionado/a y la PPS entra en etapa de confirmación, Mi Panel muestra el botón para realizar el consentimiento. Sin ese paso no podés iniciar la práctica.",
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
            Es obligatorio <strong>justificar la ausencia</strong> y avisar al referente de la
            institución con anticipación. Ausentarse sin aviso es una{" "}
            <strong>falta grave de compromiso</strong> y puede ser determinante en la desaprobación
            de la práctica.
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
        a: "En la sección Entregas, elegís tu orientación e institución: el botón abre la tarea de Moodle correspondiente. Si la PPS fue presencial, subí la planilla de asistencia firmada junto al informe.",
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
        q: "¿Qué es Mi Panel?",
        a: (
          <>
            Es la herramienta de gestión PPS para inscripción, solicitudes, seguimiento de horas,
            consentimiento y acreditación. La <strong>planilla de asistencia</strong> sigue siendo
            tu respaldo oficial.
          </>
        ),
      },
      {
        q: "¿Cómo se instala Mi Panel en el celular?",
        a: (
          <>
            Desde el navegador, con <strong>"Añadir a pantalla de inicio"</strong> (Chrome, Safari)
            o desde el ícono de instalación cuando esté disponible.
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
        q: "¿Cómo presento una propuesta de PPS con institución propia?",
        a: (
          <>
            Completás el formulario de Mi Panel con los datos de la institución. Requisitos:
            <ol>
              <li>La institución no debe tener un convenio activo.</li>
              <li>
                Debe contar con un <strong>profesional de la psicología</strong> que supervise
                (excluyente).
              </li>
              <li>Se prioriza a quienes ofrecen varios cupos.</li>
              <li>No es necesario un convenio previo con la universidad.</li>
            </ol>
            El estado de la propuesta se sigue desde Mis Solicitudes.
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
    [deliveryAreas, activeArea]
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
            <Link className="ah-aula-publicbar__cta" to={authenticatedUser ? "/student" : "/login"}>
              {authenticatedUser ? "Ir a Mi Panel" : "Entrar / crear cuenta"}
            </Link>
          </nav>
        </header>
      )}
      <main className="ah-main ah-aula__main">
        {section ? (
          /* Pestaña propia del panel: encabezado de página con la misma
             articulación que las vistas nativas (.ah-pagehead). */
          <section className="ah-pagehead ah-aula__hero ah-aula__hero--solo">
            <div className="ah-aula__hero-copy">
              <span className="eyebrow">{selectedSection.pageEyebrow}</span>
              <h1 className="ah-aula__title">{selectedSection.pageTitle}</h1>
              <p className="ah-aula__lead">{selectedSection.pageLead}</p>
            </div>
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
          /* Guía como pestaña del panel: layout editorial abierto (índice de
             etapas + capítulos con número grande), el mismo lenguaje que la
             guía del campus pero con los tokens del panel. */
          <>
            <nav className="ah-aula__gindex" aria-label="Etapas de la guía">
              {guideBlocks.map((block) => (
                <a key={block.num} href={`#aula-paso-${block.num}`}>
                  <span className="ah-aula__gindex-num">{block.num}</span>
                  <strong>{block.title}</strong>
                  <small>{block.kicker}</small>
                </a>
              ))}
            </nav>
            <div className="ah-aula__gsteps">
              {guideBlocks.map((block) => (
                <article key={block.num} className="ah-aula__gstep" id={`aula-paso-${block.num}`}>
                  <div className="ah-aula__gstep-side">
                    <span className="ah-aula__gstep-num" aria-hidden>
                      {block.num}
                    </span>
                    <span className="ah-aula__gstep-kick">{block.kicker}</span>
                    <p className="ah-aula__gstep-sum">{block.summary}</p>
                  </div>
                  <div className="ah-aula__gstep-main">
                    <h3>{block.title}</h3>
                    {block.bullets && (
                      <div className="ah-aula__gcards">
                        {block.bullets.map((bullet) => (
                          <p key={bullet} className="ah-aula__gcard">
                            <i aria-hidden />
                            {bullet}
                          </p>
                        ))}
                      </div>
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
            <footer
              className="ah-aula__accredit ah-aula__accredit--page"
              aria-label="Requisitos de acreditación"
            >
              <span className="ah-aula__accredit-kicker">Para acreditar</span>
              <div className="ah-aula__accredit-stats">
                {accreditationStats.map((stat) => (
                  <div key={stat.label} className="ah-aula__accredit-stat">
                    <strong>
                      {stat.value} <span>{stat.unit}</span>
                    </strong>
                    <small>{stat.label}</small>
                  </div>
                ))}
              </div>
            </footer>
          </>
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
                        <h3>{block.title}</h3>
                        <p>{block.summary}</p>
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
                <footer className="ah-aula__accredit" aria-label="Requisitos de acreditación">
                  <span className="ah-aula__accredit-kicker">Para acreditar</span>
                  <div className="ah-aula__accredit-stats">
                    {accreditationStats.map((stat) => (
                      <div key={stat.label} className="ah-aula__accredit-stat">
                        <strong>
                          {stat.value} <span>{stat.unit}</span>
                        </strong>
                        <small>{stat.label}</small>
                      </div>
                    ))}
                  </div>
                </footer>
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
                        onClick={() => setActiveFaq(group.id)}
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
                    {selectedFaq.items.map((item, idx) => (
                      <details key={item.q} className="ah-aula__faq-row" open={idx === 0}>
                        <summary>
                          <span>{String(idx + 1).padStart(2, "0")}</span>
                          {item.q}
                          <i className="ah-aula__faq-chev" aria-hidden>
                            <Icon name="chev" size={16} />
                          </i>
                        </summary>
                        <div>{item.a}</div>
                      </details>
                    ))}
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
                  {deliveryAreas.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      className={
                        "ah-aula__area" + (area.id === selectedArea.id ? " is-active" : "")
                      }
                      style={{ ["--area" as string]: area.color }}
                      onClick={() => setActiveArea(area.id)}
                    >
                      <span className="ah-aula__area-ic" aria-hidden>
                        <Icon name={deliveryAreaIcons[area.id] ?? "upload"} size={18} />
                      </span>
                      <span className="ah-aula__area-copy">
                        <strong>{area.name}</strong>
                        <small>
                          {area.institutions.length}{" "}
                          {area.institutions.length === 1 ? "institución" : "instituciones"}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="ah-aula__delivery-grid" key={selectedArea.id}>
                  {selectedArea.institutions.map((institution) => (
                    <a
                      key={institution.name}
                      className="ah-aula__delivery"
                      href={`${MOODLE_ASSIGN}${institution.moodleId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ["--area" as string]: selectedArea.color }}
                    >
                      <span className="ah-aula__folder" aria-hidden>
                        <Icon name="upload" size={17} />
                      </span>
                      <strong>{institution.name}</strong>
                      <span className="ah-aula__delivery-meta">Tarea de Moodle</span>
                      <span className="ah-aula__delivery-foot">
                        <span className="ah-aula__open">
                          Abrir entrega <Icon name="arrow" size={14} />
                        </span>
                        <span className="ah-aula__module">Moodle</span>
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
