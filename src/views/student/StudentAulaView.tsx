import React, { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../components/student/ds";
import { useAuth } from "../../contexts/AuthContext";
import { MOODLE_ASSIGN, useAulaEntregas } from "../../hooks/useAulaEntregas";

type AulaSectionId = "guia" | "descargas" | "preguntas" | "entregas";

const SECTION_IDS: AulaSectionId[] = ["guia", "descargas", "preguntas", "entregas"];
const SECTION_STORAGE_KEY = "pps_aula_sec";

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
  },
];

const heroFacts = [
  { value: "250 h", label: "totales para acreditar" },
  { value: "70 h", label: "mínimas en tu especialidad" },
  { value: "3 de 4", label: "orientaciones recorridas" },
  { value: "30 días", label: "para entregar el informe" },
];

const guideBlocks = [
  {
    num: "01",
    title: "Dónde empezar",
    summary:
      "Tu cuenta de Mi Panel es la llave para inscribirte, seguir tus estados y pedir la acreditación final.",
    bullets: [
      "Generá o usá tu usuario con número de legajo.",
      "Revisá esta guía y las preguntas antes de escribir a coordinación.",
      "Mantenete atento al grupo de difusión para novedades de convocatorias.",
    ],
  },
  {
    num: "02",
    title: "Inscripción y selección",
    summary: "Las convocatorias se publican durante el ciclo y se gestionan desde Inicio.",
    bullets: [
      "Postulate desde convocatorias abiertas.",
      "Si quedás seleccionado/a, se actualiza tu estado y recibís aviso por correo.",
      "Antes de comenzar, completá el consentimiento digital si el panel lo solicita.",
    ],
  },
  {
    num: "03",
    title: "Asistencia y documentación",
    summary: "La acreditación se sostiene con asistencia, planilla firmada e informes aprobados.",
    bullets: [
      "Justificá ausencias y avisá a la institución con anticipación.",
      "La planilla firmada es el documento válido para prácticas presenciales.",
      "En prácticas online o eventos especiales, el informe final aprobado acredita la realización.",
    ],
  },
  {
    num: "04",
    title: "Entregas y plazos",
    summary: "Los informes se cargan en Moodle, pero el acceso vive en el Aula integrada.",
    bullets: [
      "Entregá el informe dentro de los 30 días corridos desde que finaliza la PPS.",
      "El docente tiene 30 días hábiles para corregir.",
      "Si necesitás prórroga, escribí antes del vencimiento.",
    ],
  },
  {
    num: "05",
    title: "Finalización",
    summary: "Cuando completás los requisitos, pedís la acreditación desde Mi Panel.",
    bullets: [
      "250 horas totales de práctica aprobada.",
      "Mínimo 70 horas en tu orientación de especialidad.",
      "Rotación por al menos 3 de las 4 orientaciones e informes aprobados.",
    ],
  },
];

const accreditationStats = [
  { value: "250", unit: "horas", label: "de práctica aprobada en total" },
  { value: "70", unit: "horas", label: "mínimas en tu orientación de especialidad" },
  { value: "3", unit: "de 4", label: "orientaciones recorridas, con informes aprobados" },
];

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

const faqGroups: FaqGroup[] = [
  {
    id: "inscripcion",
    label: "Inscripción",
    subtitle: "Postulación, selección y consentimiento.",
    items: [
      {
        q: "¿Cuál es la frecuencia de lanzamiento de convocatorias?",
        a: "Se lanzan de forma periódica a lo largo del año. Conviene revisar Mi Panel, el aula virtual y el grupo de WhatsApp de novedades.",
      },
      {
        q: "¿Cuáles son los criterios para la selección de estudiantes?",
        a: "Cuando los inscriptos superan el cupo, se priorizan criterios académicos y de recorrido definidos por la coordinación.",
      },
      {
        q: "¿Cómo sé si quedé seleccionado en una convocatoria?",
        a: "Recibís una notificación por correo y tu estado se actualiza en Inicio, dentro de convocatorias cerradas y tus resultados.",
      },
      {
        q: "¿Cuándo firmo el consentimiento digital?",
        a: "Cuando quedás seleccionado/a y la PPS entra en etapa de confirmación, Mi Panel muestra el botón para realizar el consentimiento.",
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
        a: "La mayoría de las convocatorias indica la cantidad exacta. Si dice según recorrido, depende de extensión y frecuencia, con máximo de 80 horas.",
      },
      {
        q: "¿Puedo cambiar de orientación durante las PPS?",
        a: "No. Hay que completar las horas en la orientación asignada.",
      },
      {
        q: "¿Qué sucede si me ausento de la institución?",
        a: "Es obligatorio justificar la ausencia y avisar con anticipación. Ausentarse sin aviso puede ser determinante en la desaprobación.",
      },
      {
        q: "¿Qué pasa si no completo las horas exactas por feriados o paros?",
        a: "Pueden recuperarse extendiendo el período si la institución lo autoriza. Si no, se acreditan las horas tipificadas en la convocatoria.",
      },
      {
        q: "¿Puedo repetir una PPS?",
        a: "No se puede repetir en la misma institución y con la misma orientación. Cada práctica debe ser una experiencia nueva.",
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
        a: "Sí. La guía para la elaboración del informe está en Descargas, dentro de esta misma sección Aula.",
      },
      {
        q: "¿Cómo entrego un informe?",
        a: "En Aula > Entregas, elegís tu orientación e institución. El botón abre la tarea de Moodle correspondiente.",
      },
      {
        q: "¿Qué hago si no encuentro un espacio de entrega?",
        a: "Notificá a coordinación para que habilite el espacio manualmente en la sección que corresponda.",
      },
      {
        q: "¿Debo firmar planilla en prácticas online o eventos especiales?",
        a: "No. En esos casos, el informe final es el elemento oficial que acredita la realización de la PPS.",
      },
      {
        q: "¿Cuáles son las fechas de entrega de informe?",
        a: "Tenés 30 días corridos desde que finaliza la PPS. El control de esa fecha queda de tu lado.",
      },
      {
        q: "¿Cuánto tiempo tiene el docente para corregir?",
        a: "30 días hábiles desde la entrega. Cargar la nota en Mi Panel es opcional.",
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
        a: "250 horas totales, mínimo 70 en tu especialidad, rotación por al menos 3 orientaciones e informes corregidos y aprobados.",
      },
      {
        q: "¿Qué es Mi Panel?",
        a: "Es la herramienta de gestión PPS para inscripción, solicitudes, seguimiento de horas, consentimiento y acreditación. La planilla sigue siendo tu respaldo oficial de asistencia.",
      },
      {
        q: "¿Cómo se instala Mi Panel en el celular?",
        a: "Desde el navegador, con Añadir a pantalla de inicio o desde el ícono de instalación cuando esté disponible.",
      },
      {
        q: "¿Cómo solicito una corrección en Mi Panel?",
        a: "Desde Mis Prácticas. También podés editar fechas y solicitar modificaciones según corresponda.",
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
        a: "Completás el formulario de Mi Panel con datos de institución, referente, tutor, convenio y descripción de actividades.",
      },
      {
        q: "¿Qué sucede si envié un correo y no tuve respuesta?",
        a: "El tiempo estimado es de 48 horas hábiles. Pasado ese plazo, reenviá con URGENTE en el asunto para priorizar el caso.",
      },
    ],
  },
];

interface StudentAulaViewProps {
  mode?: "panel" | "public";
}

const StudentAulaView: React.FC<StudentAulaViewProps> = ({ mode = "panel" }) => {
  const { authenticatedUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPublic = mode === "public";
  const { areas: deliveryAreas } = useAulaEntregas();

  const [activeSection, setActiveSectionState] = useState<AulaSectionId>(() =>
    resolveInitialSection(searchParams.get("sec"))
  );
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState(faqGroups[0].id);

  /* Cambio de sección: persiste en sessionStorage y, en el modo público,
     también en la URL (?sec=) para que se pueda compartir/deep-linkear. */
  const setActiveSection = useCallback(
    (id: AulaSectionId) => {
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
    [isPublic, setSearchParams]
  );

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
    <div className={"ah-root ah-unified ah-aula" + (isPublic ? " ah-aula--public" : "")}>
      {isPublic && (
        <header className="ah-aula-publicbar">
          <Link className="ah-aula-publicbar__brand" to="/aula">
            <span className="ah-aula-publicbar__mark">UFLO</span>
            <span className="ah-aula-publicbar__sep" />
            <span>PPS 2026</span>
          </Link>
          <nav className="ah-aula-publicbar__nav" aria-label="Accesos principales">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={section.id === activeSection ? "is-on" : undefined}
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            ))}
            <Link className="ah-aula-publicbar__cta" to={authenticatedUser ? "/student" : "/login"}>
              {authenticatedUser ? "Ir a Mi Panel" : "Entrar / crear cuenta"}
            </Link>
          </nav>
        </header>
      )}
      <main className="ah-main ah-aula__main">
        <section className="ah-pagehead ah-aula__hero">
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
          <aside className="ah-aula__note" aria-label="Datos clave de la cursada">
            <span>Reglas de la cursada</span>
            <div className="ah-aula__note-grid">
              {heroFacts.map((fact) => (
                <React.Fragment key={fact.label}>
                  <b>{fact.value}</b>
                  <small>{fact.label}</small>
                </React.Fragment>
              ))}
            </div>
          </aside>
        </section>

        <nav className="ah-aula__switcher" aria-label="Secciones del aula">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={"ah-aula__switch" + (section.id === activeSection ? " is-active" : "")}
              aria-current={section.id === activeSection ? "true" : undefined}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="ah-aula__switch-ic" aria-hidden>
                <Icon name={section.icon} size={17} />
              </span>
              <span className="ah-aula__switch-txt">
                <span className="ah-aula__switch-label">{section.label}</span>
                <small>{section.hint}</small>
              </span>
              <span className="ah-aula__switch-num" aria-hidden>
                {section.num}
              </span>
            </button>
          ))}
        </nav>

        <section className="ah-aula__panel" key={selectedSection.id}>
          <div className="ah-aula__panel-head">
            <span className="eyebrow">{selectedSection.eyebrow}</span>
            <h2>{selectedSection.title}</h2>
            <p>{selectedSection.description}</p>
          </div>

          {activeSection === "guia" && (
            <>
              <div className="ah-aula__guide">
                {guideBlocks.map((block) => (
                  <article key={block.num} className="ah-aula__guide-block">
                    <div className="ah-aula__guide-rail" aria-hidden>
                      <span className="ah-aula__guide-num">{block.num}</span>
                    </div>
                    <div>
                      <h3>{block.title}</h3>
                      <p>{block.summary}</p>
                      <ul>
                        {block.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
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
            <div className="ah-aula__faq-shell">
              <div className="ah-aula__faq-tabs" aria-label="Categorías de preguntas">
                {faqGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={"ah-aula__faq-tab" + (group.id === activeFaq ? " is-active" : "")}
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
          )}

          {activeSection === "entregas" && (
            <div className="ah-aula__deliveries">
              <p className="ah-aula__deliveries-hint">
                <Icon name="alert" size={15} />
                Cada entrega abre la tarea de Moodle en una pestaña nueva, con tu sesión del campus.
              </p>
              <div className="ah-aula__areas" role="tablist" aria-label="Áreas de entrega">
                {deliveryAreas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    className={"ah-aula__area" + (area.id === selectedArea.id ? " is-active" : "")}
                    style={{ ["--area" as string]: area.color }}
                    onClick={() => setActiveArea(area.id)}
                  >
                    <span>
                      <i className="ah-aula__area-dot" aria-hidden />
                      {area.name}
                    </span>
                    <small>
                      {area.institutions.length}{" "}
                      {area.institutions.length === 1 ? "institución" : "instituciones"}
                    </small>
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
                    <small>Tarea de Moodle</small>
                    <span className="ah-aula__open">
                      Abrir entrega <Icon name="arrow" size={14} />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default StudentAulaView;
