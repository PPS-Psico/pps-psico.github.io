import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../components/student/ds";
import { useAuth } from "../../contexts/AuthContext";

type AulaSectionId = "guia" | "descargas" | "preguntas" | "entregas";

interface AulaSection {
  id: AulaSectionId;
  label: string;
  eyebrow: string;
  title: string;
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

interface DeliveryArea {
  id: string;
  name: string;
  color: string;
  institutions: { name: string; moodleId: string }[];
}

const MOODLE_ASSIGN = "https://campus.uflo.edu.ar/mod/assign/view.php?id=";

const sections: AulaSection[] = [
  {
    id: "guia",
    label: "Guia 2026",
    eyebrow: "Cursada",
    title: "La guia completa de PPS, dentro del panel.",
    description:
      "Requisitos, rotaciones, horas, fechas y criterios de finalizacion reunidos en un recorrido unico.",
    icon: "book",
  },
  {
    id: "descargas",
    label: "Descargas",
    eyebrow: "Materiales",
    title: "Plantillas y documentos oficiales.",
    description:
      "Planillas, modelos y archivos que se usan durante la cursada, siempre a mano junto a tu recorrido.",
    icon: "download",
  },
  {
    id: "preguntas",
    label: "Preguntas",
    eyebrow: "Ayuda",
    title: "Respuestas rapidas para destrabar dudas.",
    description:
      "Inscripcion, horarios, solicitudes, consentimiento, entregas y cierre de practica en lenguaje claro.",
    icon: "help",
  },
  {
    id: "entregas",
    label: "Entregas",
    eyebrow: "Moodle",
    title: "El unico salto necesario al campus.",
    description:
      "Elegis tu area e institucion desde Mi Panel; la carga del informe se abre directamente en Moodle.",
    icon: "upload",
  },
];

const guideBlocks = [
  {
    num: "01",
    title: "Donde empezar",
    summary:
      "Tu cuenta de Mi Panel es la llave para inscribirte, seguir tus estados y pedir la acreditacion final.",
    bullets: [
      "Genera o usa tu usuario con numero de legajo.",
      "Revisa esta guia y preguntas antes de escribir a coordinacion.",
      "Mantenete atento al grupo de difusion para novedades de convocatorias.",
    ],
  },
  {
    num: "02",
    title: "Inscripcion y seleccion",
    summary: "Las convocatorias se publican durante el ciclo y se gestionan desde Inicio.",
    bullets: [
      "Postulate desde convocatorias abiertas.",
      "Si quedas seleccionado/a, se actualiza tu estado y recibis aviso por correo.",
      "Antes de comenzar, completa el consentimiento digital si el panel lo solicita.",
    ],
  },
  {
    num: "03",
    title: "Asistencia y documentacion",
    summary: "La acreditacion se sostiene con asistencia, planilla firmada e informes aprobados.",
    bullets: [
      "Justifica ausencias y avisa a la institucion con anticipacion.",
      "La planilla firmada es el documento valido para practicas presenciales.",
      "En practicas online o eventos especiales, el informe final aprobado acredita la realizacion.",
    ],
  },
  {
    num: "04",
    title: "Entregas y plazos",
    summary: "Los informes se cargan en Moodle, pero el acceso vive en el Aula integrada.",
    bullets: [
      "Entrega el informe dentro de los 30 dias corridos desde que finaliza la PPS.",
      "El docente tiene 30 dias habiles para corregir.",
      "Si necesitas prorroga, escribi antes del vencimiento.",
    ],
  },
  {
    num: "05",
    title: "Finalizacion",
    summary: "Cuando completas los requisitos, pedis la acreditacion desde Mi Panel.",
    bullets: [
      "250 horas totales de practica aprobada.",
      "Minimo 70 horas en tu orientacion de especialidad.",
      "Rotacion por al menos 3 de las 4 orientaciones e informes aprobados.",
    ],
  },
];

const downloads: DownloadGroup[] = [
  {
    title: "Planillas",
    kicker: "uso frecuente",
    items: [
      {
        name: "Planilla de seguimiento de horas",
        detail: "Tu control exacto de horas, clase a clase. Planilla oficial.",
        ext: "XLSX",
        href: "/descargas.html",
        featured: true,
      },
      {
        name: "Planilla de asistencia",
        detail: "Registro presencial para la firma de tu referente en sede.",
        ext: "DOC",
        href: "/descargas.html",
      },
    ],
  },
  {
    title: "Informes y normativa",
    kicker: "consulta",
    items: [
      {
        name: "Guia para la elaboracion del informe",
        detail: "Pautas de elaboracion academica del informe de PPS.",
        ext: "PDF",
        href: "/descargas.html",
      },
      {
        name: "Reglamento de PPS",
        detail: "Marco oficial y resoluciones de referencia.",
        ext: "PDF",
        href: "/descargas.html",
      },
    ],
  },
];

const faqGroups: FaqGroup[] = [
  {
    id: "inscripcion",
    label: "Inscripcion",
    subtitle: "Postulacion, seleccion y consentimiento.",
    items: [
      {
        q: "Cual es la frecuencia de lanzamiento de convocatorias?",
        a: "Se lanzan de forma periodica a lo largo del ano. Conviene revisar Mi Panel, el aula virtual y el grupo de WhatsApp de novedades.",
      },
      {
        q: "Cuales son los criterios para la seleccion de estudiantes?",
        a: "Cuando los inscriptos superan el cupo, se priorizan criterios academicos y de recorrido definidos por la coordinacion.",
      },
      {
        q: "Como se si quede seleccionado en una convocatoria?",
        a: "Recibis una notificacion por correo y tu estado se actualiza en Inicio, dentro de convocatorias cerradas y tus resultados.",
      },
      {
        q: "Cuando firmo el consentimiento digital?",
        a: "Cuando quedas seleccionado/a y la PPS entra en etapa de confirmacion, Mi Panel muestra el boton para realizar el consentimiento.",
      },
    ],
  },
  {
    id: "desarrollo",
    label: "Desarrollo",
    subtitle: "Cursada, ausencias y cambios.",
    items: [
      {
        q: "Cuantas horas acredita mi PPS?",
        a: "La mayoria de las convocatorias indica la cantidad exacta. Si dice segun recorrido, depende de extension y frecuencia, con maximo de 80 horas.",
      },
      {
        q: "Puedo cambiar de orientacion durante las PPS?",
        a: "No. Hay que completar las horas en la orientacion asignada.",
      },
      {
        q: "Que sucede si me ausento de la institucion?",
        a: "Es obligatorio justificar la ausencia y avisar con anticipacion. Ausentarse sin aviso puede ser determinante en la desaprobacion.",
      },
      {
        q: "Que pasa si no completo las horas exactas por feriados o paros?",
        a: "Pueden recuperarse extendiendo el periodo si la institucion lo autoriza. Si no, se acreditan las horas tipificadas en la convocatoria.",
      },
      {
        q: "Puedo repetir una PPS?",
        a: "No se puede repetir en la misma institucion y con la misma orientacion. Cada practica debe ser una experiencia nueva.",
      },
    ],
  },
  {
    id: "informes",
    label: "Informes",
    subtitle: "Entrega, correccion y prorroga.",
    items: [
      {
        q: "Hay alguna guia para elaborar informes?",
        a: "Si. La guia para la elaboracion del informe esta en Descargas, dentro de esta misma seccion Aula.",
      },
      {
        q: "Como entrego un informe?",
        a: "En Aula > Entregas, elegis tu orientacion e institucion. El boton abre la tarea de Moodle correspondiente.",
      },
      {
        q: "Que hago si no encuentro un espacio de entrega?",
        a: "Notifica a coordinacion para que habilite el espacio manualmente en la seccion que corresponda.",
      },
      {
        q: "Debo firmar planilla en practicas online o eventos especiales?",
        a: "No. En esos casos, el informe final es el elemento oficial que acredita la realizacion de la PPS.",
      },
      {
        q: "Cuales son las fechas de entrega de informe?",
        a: "Tenes 30 dias corridos desde que finaliza la PPS. El control de esa fecha queda de tu lado.",
      },
      {
        q: "Cuanto tiempo tiene el docente para corregir?",
        a: "30 dias habiles desde la entrega. Cargar la nota en Mi Panel es opcional.",
      },
    ],
  },
  {
    id: "panel",
    label: "Mi Panel",
    subtitle: "Acreditacion final y uso de la herramienta.",
    items: [
      {
        q: "Cuales son los requisitos obligatorios para acreditar?",
        a: "250 horas totales, minimo 70 en tu especialidad, rotacion por al menos 3 orientaciones e informes corregidos y aprobados.",
      },
      {
        q: "Que es Mi Panel?",
        a: "Es la herramienta de gestion PPS para inscripcion, solicitudes, seguimiento de horas, consentimiento y acreditacion. La planilla sigue siendo tu respaldo oficial de asistencia.",
      },
      {
        q: "Como se instala Mi Panel en el celular?",
        a: "Desde el navegador, con Anadir a pantalla de inicio o desde el icono de instalacion cuando este disponible.",
      },
      {
        q: "Como solicito una correccion en Mi Panel?",
        a: "Desde Mis Practicas. Tambien podes editar fechas y solicitar modificaciones segun corresponda.",
      },
    ],
  },
  {
    id: "tramites",
    label: "Tramites",
    subtitle: "Propuestas propias y comunicacion.",
    items: [
      {
        q: "Como presento una propuesta de PPS con institucion propia?",
        a: "Completas el formulario de Mi Panel con datos de institucion, referente, tutor, convenio y descripcion de actividades.",
      },
      {
        q: "Que sucede si envie un correo y no tuve respuesta?",
        a: "El tiempo estimado es de 48 horas habiles. Pasado ese plazo, reenvia con URGENTE en el asunto para priorizar el caso.",
      },
    ],
  },
];

const deliveryAreas: DeliveryArea[] = [
  {
    id: "clinica",
    name: "Area clinica",
    color: "var(--area-clinica)",
    institutions: [
      { name: "Cita Salud", moodleId: "946366" },
      { name: "Fundacion Tiempo", moodleId: "1085731" },
      { name: "Dige", moodleId: "1014110" },
      { name: "Ateneos Ulloa", moodleId: "926287" },
      { name: "Entrevistas Ulloa", moodleId: "920727" },
      { name: "Kano", moodleId: "914852" },
      { name: "Relevamiento Prof.", moodleId: "906164" },
      { name: "Barriletes en Bandada", moodleId: "805657" },
      { name: "Programa Aser", moodleId: "805658" },
    ],
  },
  {
    id: "laboral",
    name: "Laboral y comunitaria",
    color: "#c73e3e",
    institutions: [
      { name: "Randstad", moodleId: "1085736" },
      { name: "Human", moodleId: "1074975" },
      { name: "Prevencion en Colonias", moodleId: "1009867" },
      { name: "Camioneros", moodleId: "906141" },
    ],
  },
  {
    id: "educacional",
    name: "Area educacional",
    color: "var(--area-educacional)",
    institutions: [{ name: "Relevamiento Prof.", moodleId: "906167" }],
  },
];

interface StudentAulaViewProps {
  mode?: "panel" | "public";
}

const StudentAulaView: React.FC<StudentAulaViewProps> = ({ mode = "panel" }) => {
  const { authenticatedUser } = useAuth();
  const [activeSection, setActiveSection] = useState<AulaSectionId>("guia");
  const [activeArea, setActiveArea] = useState(deliveryAreas[0].id);
  const [activeFaq, setActiveFaq] = useState(faqGroups[0].id);
  const isPublic = mode === "public";

  const selectedSection = sections.find((s) => s.id === activeSection) ?? sections[0];
  const selectedArea = useMemo(
    () => deliveryAreas.find((area) => area.id === activeArea) ?? deliveryAreas[0],
    [activeArea]
  );
  const selectedFaq = useMemo(
    () => faqGroups.find((group) => group.id === activeFaq) ?? faqGroups[0],
    [activeFaq]
  );

  return (
    <div className={"ah-root ah-aula" + (isPublic ? " ah-aula--public" : "")}>
      {isPublic && (
        <header className="ah-aula-publicbar">
          <Link className="ah-aula-publicbar__brand" to="/aula">
            <span className="ah-aula-publicbar__mark">UFLO</span>
            <span className="ah-aula-publicbar__sep" />
            <span>PPS 2026</span>
          </Link>
          <nav className="ah-aula-publicbar__nav" aria-label="Accesos principales">
            <button type="button" onClick={() => setActiveSection("guia")}>
              Guia
            </button>
            <button type="button" onClick={() => setActiveSection("descargas")}>
              Descargas
            </button>
            <button type="button" onClick={() => setActiveSection("preguntas")}>
              Preguntas
            </button>
            <button type="button" onClick={() => setActiveSection("entregas")}>
              Entregas
            </button>
            <Link className="ah-aula-publicbar__cta" to={authenticatedUser ? "/student" : "/login"}>
              {authenticatedUser ? "Ir a Mi Panel" : "Entrar / crear cuenta"}
            </Link>
          </nav>
        </header>
      )}
      <main className="ah-main ah-aula__main">
        <section className="ah-pagehead ah-aula__hero">
          <div>
            <span className="eyebrow">Campus PPS</span>
            <h1 className="ah-aula__title">
              {isPublic ? (
                "Aula PPS 2026."
              ) : (
                <>
                  Aula <em>PPS.</em>
                </>
              )}
            </h1>
            <p className="ah-aula__lead">
              {isPublic
                ? "Guia, preguntas, descargas y entregas para empezar la cursada aunque todavia no tengas cuenta en Mi Panel."
                : "Guia, descargas, preguntas y entregas ordenadas en el mismo lugar donde seguis tus convocatorias, practicas y consentimiento."}
            </p>
          </div>
          {isPublic && (
            <aside className="ah-aula__note" aria-label="Acceso al aula">
              <span>Acceso publico</span>
              <strong>Orientate antes de entrar.</strong>
              <small>Despues creas tu cuenta o ingresas a Mi Panel.</small>
            </aside>
          )}
        </section>

        <nav className="ah-aula__switcher" aria-label="Secciones del aula">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={"ah-aula__switch" + (section.id === activeSection ? " is-active" : "")}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="ah-aula__switch-ic" aria-hidden>
                <Icon name={section.icon} size={18} />
              </span>
              <span>{section.label}</span>
            </button>
          ))}
        </nav>

        <section className="ah-aula__panel">
          <div className="ah-aula__panel-head">
            <span className="eyebrow">{selectedSection.eyebrow}</span>
            <h2>{selectedSection.title}</h2>
            <p>{selectedSection.description}</p>
          </div>

          {activeSection === "guia" && (
            <div className="ah-aula__guide">
              {guideBlocks.map((block) => (
                <article key={block.num} className="ah-aula__guide-block">
                  <span className="ah-aula__guide-num">{block.num}</span>
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
                        <span className="ah-aula__ext">{item.ext}</span>
                        <span className="ah-aula__download-main">
                          <strong>{item.name}</strong>
                          <small>{item.detail}</small>
                        </span>
                        <Icon name="download" size={18} />
                      </a>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {activeSection === "preguntas" && (
            <div className="ah-aula__faq-shell">
              <div className="ah-aula__faq-tabs" aria-label="Categorias de preguntas">
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
              <div className="ah-aula__faq-list">
                <div className="ah-aula__faq-title">
                  <h3>{selectedFaq.label}</h3>
                  <p>{selectedFaq.subtitle}</p>
                </div>
                {selectedFaq.items.map((item, idx) => (
                  <details key={item.q} className="ah-aula__faq-row" open={idx === 0}>
                    <summary>
                      <span>{String(idx + 1).padStart(2, "0")}.</span>
                      {item.q}
                    </summary>
                    <div>{item.a}</div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {activeSection === "entregas" && (
            <div className="ah-aula__deliveries">
              <div className="ah-aula__areas" role="tablist" aria-label="Areas de entrega">
                {deliveryAreas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    className={"ah-aula__area" + (area.id === activeArea ? " is-active" : "")}
                    style={{ ["--area" as string]: area.color }}
                    onClick={() => setActiveArea(area.id)}
                  >
                    <span>{area.name}</span>
                    <small>{area.institutions.length} instituciones</small>
                  </button>
                ))}
              </div>
              <div className="ah-aula__delivery-grid">
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
                      <Icon name="upload" size={18} />
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
