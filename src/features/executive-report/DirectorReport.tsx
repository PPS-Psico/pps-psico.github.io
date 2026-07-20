import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/source-serif-4/latin-600.css";
import "@fontsource/source-serif-4/latin-700.css";
import "./professionalExecutiveReport.css";
import type {
  DirectorNearReasonCode,
  DirectorReportModel,
  DirectorStudentIdentity,
  NearCompletionStudent,
  PressureLevel,
  WithoutPpsStudent,
} from "./directorReport.types";
import type { ReportMetric } from "./executiveReport.types";

const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

const dateLabel = (iso: string): string =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${iso}T12:00:00`)
  );

const orientationClassName = (orientation?: string | null): string =>
  `is-${(orientation || "sin-definir")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]/g, "")}`;

const formatMetric = (metric: ReportMetric): string => {
  if (metric.value == null) return "—";
  const value = Number.isInteger(metric.value)
    ? integerFormatter.format(metric.value)
    : decimalFormatter.format(metric.value);
  return metric.unit === "%" ? `${value}%` : metric.unit ? `${value} ${metric.unit}` : value;
};

const chunk = <T,>(rows: T[], size: number): T[][] => {
  if (!rows.length) return [[]];
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size)
  );
};

const Wordmark = () => (
  <div className="per-wordmark" aria-label="UFLO Universidad">
    <b>UFLO</b>
    <span>Universidad</span>
  </div>
);

const PrivacyPill = () => (
  <span className="per-director-privacy-pill">Circulación interna · datos personales</span>
);

const PageHeader = ({ title, label }: { title: string; label: string }) => (
  <header className="per-page-header per-director-page-header">
    <div>
      <span>{label}</span>
      <h2>{title}</h2>
    </div>
  </header>
);

const PageFooter = ({ model, page }: { model: DirectorReportModel; page: string }) => (
  <footer className="per-page-footer per-director-footer">
    <span>
      {model.privacyLabel} · Fuente: Mi Panel Académico · {model.snapshot.metricVersion}
    </span>
    <span>{page}</span>
  </footer>
);

const StudentMeta = ({ student }: { student: DirectorStudentIdentity }) => (
  <div className="per-director-student-meta">
    <span>Legajo {student.legajo || "sin dato"}</span>
    <span>Cohorte {student.cohort || "—"}</span>
    <span className={orientationClassName(student.selectedOrientation)}>
      {student.selectedOrientation || "Orientación sin definir"}
    </span>
  </div>
);

const REASON_LABELS: Record<DirectorNearReasonCode, string> = {
  total_hours_230_249: "A 20 h o menos del total",
  missing_one_orientation: "Falta una orientación",
  specialty_gap_20_or_less: "A 20 h o menos de especialidad",
};

const PRESSURE_LABELS: Record<PressureLevel, string> = {
  low: "Baja",
  moderate: "Media",
  high: "Alta",
  saturated: "Saturada",
};

const DirectorCover = ({ model }: { model: DirectorReportModel }) => {
  const { annual, snapshot, recipient } = model;
  return (
    <section className="per-page per-director-cover">
      <div className="per-cover-top">
        <Wordmark />
        <PrivacyPill />
      </div>
      <div className="per-director-cover-main">
        <p className="per-kicker">Licenciatura en Psicología · Sede Comahue</p>
        <h1>Informe para Dirección de Carrera</h1>
        <p>Ciclo {annual.year} · panorama institucional y seguimiento nominal de estudiantes</p>
        <div className="per-cover-rule" />
        <blockquote>
          Una lectura ejecutiva del año y una foto operativa para anticipar acompañamientos, cupos y
          trayectorias próximas a completar las PPS.
        </blockquote>
      </div>
      <div className="per-director-cover-metrics">
        <div>
          <span>Estudiantes activos</span>
          <strong>{integerFormatter.format(snapshot.studentSummary.activeStudents)}</strong>
        </div>
        <div>
          <span>Sin PPS · con postulaciones</span>
          <strong>{integerFormatter.format(snapshot.studentSummary.withoutPps)}</strong>
        </div>
        <div>
          <span>Próximos a finalizar</span>
          <strong>{integerFormatter.format(snapshot.studentSummary.nearCompletion)}</strong>
        </div>
        <div>
          <span>Presión actual</span>
          <strong>
            {snapshot.pressure.pendingPerRemainingPlace == null
              ? "Saturada"
              : `${decimalFormatter.format(snapshot.pressure.pendingPerRemainingPlace)}×`}
          </strong>
        </div>
      </div>
      <div className="per-director-recipient">
        <div>
          <span>Preparado para</span>
          <strong>{recipient.name}</strong>
          <p>{recipient.role}</p>
        </div>
        <div>
          <span>Coordinación General</span>
          <strong>{annual.author.name}</strong>
          <p>{annual.author.email}</p>
        </div>
        <div>
          <span>Foto operativa</span>
          <strong>{dateLabel(snapshot.snapshotDateISO)}</strong>
          <p>Los flujos anuales corresponden al período seleccionado.</p>
        </div>
      </div>
    </section>
  );
};

const AnnualAndStudentOverview = ({ model }: { model: DirectorReportModel }) => {
  const { annual, snapshot } = model;
  return (
    <section className="per-page">
      <PageHeader
        title={`El año ${annual.year} y la situación actual`}
        label="Panorama ejecutivo"
      />
      <div className="per-director-section-label">
        <span>Resultados del ciclo</span>
        <p>{annual.periodLabel}</p>
      </div>
      <div className="per-director-annual-metrics">
        {annual.primaryMetrics.map((metric) => (
          <article key={metric.id}>
            <span>{metric.label}</span>
            <strong>{formatMetric(metric)}</strong>
            {metric.delta?.comparable && (
              <b className={metric.delta.absolute < 0 ? "is-negative" : ""}>
                {metric.delta.absolute > 0 ? "+" : ""}
                {integerFormatter.format(metric.delta.absolute)} ·{" "}
                {metric.delta.percent == null
                  ? "sin porcentaje"
                  : `${metric.delta.percent > 0 ? "+" : ""}${decimalFormatter.format(metric.delta.percent)}%`}
              </b>
            )}
            <p>{metric.detail}</p>
          </article>
        ))}
      </div>
      <div className="per-director-cutoff-note">
        <strong>Comparación anual</strong>
        <p>
          Las variaciones verdes comparan el ciclo con el año anterior al mismo corte. La foto de
          estudiantes que sigue es actual y no se interpreta como un flujo histórico.
        </p>
      </div>
      <div className="per-director-section-label is-current">
        <span>Foto actual de trayectorias</span>
        <p>Al {dateLabel(snapshot.snapshotDateISO)}</p>
      </div>
      <div className="per-director-status-grid">
        <article className="is-alert">
          <span>Sin PPS y buscando</span>
          <strong>{snapshot.studentSummary.withoutPps}</strong>
          <p>Sin prácticas cargadas y con postulaciones en {annual.year}.</p>
        </article>
        <article className="is-near">
          <span>Próximos a finalizar</span>
          <strong>{snapshot.studentSummary.nearCompletion}</strong>
          <p>Casos que cumplen alguno de los tres criterios acordados.</p>
        </article>
        <article className="is-ready">
          <span>Listos para solicitar</span>
          <strong>{snapshot.studentSummary.readyToRequest}</strong>
          <p>Cumplen requisitos y no tienen una práctica activa.</p>
        </article>
        <article>
          <span>En acreditación</span>
          <strong>{snapshot.studentSummary.inAccreditation}</strong>
          <p>Ya registran una solicitud de finalización.</p>
        </article>
      </div>
      <div className="per-director-criteria">
        <h3>Qué significa “próximo a finalizar”</h3>
        <div>
          <article>
            <b>01</b>
            <strong>230–249 horas totales</strong>
            <span>{snapshot.studentSummary.nearByReason.total_hours_230_249} casos actuales</span>
          </article>
          <article>
            <b>02</b>
            <strong>250 h o más y sólo 2 orientaciones</strong>
            <span>
              {snapshot.studentSummary.nearByReason.missing_one_orientation} casos actuales
            </span>
          </article>
          <article>
            <b>03</b>
            <strong>250 h, 3 orientaciones y 50–69 h de especialidad</strong>
            <span>
              {snapshot.studentSummary.nearByReason.specialty_gap_20_or_less} casos actuales
            </span>
          </article>
        </div>
      </div>
      <PageFooter model={model} page="02" />
    </section>
  );
};

const PressureAndActions = ({ model }: { model: DirectorReportModel }) => {
  const { snapshot } = model;
  return (
    <section className="per-page">
      <PageHeader title="Presión de convocatorias y prioridades" label="Capacidad actual" />
      <div className="per-director-pressure-hero">
        <div>
          <span>Postulaciones pendientes</span>
          <strong>{snapshot.pressure.pendingApplications}</strong>
        </div>
        <div>
          <span>Lugares aún disponibles</span>
          <strong>{snapshot.pressure.remainingPlaces}</strong>
        </div>
        <div className="is-emphasis">
          <span>Postulaciones por lugar</span>
          <strong>
            {snapshot.pressure.pendingPerRemainingPlace == null
              ? "Saturada"
              : decimalFormatter.format(snapshot.pressure.pendingPerRemainingPlace)}
          </strong>
        </div>
        <p>
          El indicador divide postulaciones pendientes por lugares todavía disponibles. Expresa
          tensión operativa, no probabilidad individual de selección.
        </p>
      </div>
      <div className="per-director-offer-list">
        {snapshot.pressure.offers.map((offer) => (
          <article key={offer.offerId} className={`is-${offer.pressureLevel}`}>
            <div className="per-director-offer-main">
              <span className={orientationClassName(offer.orientation)}>
                {offer.orientation || "Sin orientación"}
              </span>
              <strong>{offer.offerName}</strong>
            </div>
            <div>
              <strong>{offer.pendingApplications}</strong>
              <span>pendientes</span>
            </div>
            <div>
              <strong>{offer.remainingPlaces}</strong>
              <span>lugares</span>
            </div>
            <div className="per-director-pressure-level">
              <span>Presión {PRESSURE_LABELS[offer.pressureLevel]}</span>
              <strong>
                {offer.pressureLevel === "saturated"
                  ? "Sin lugar libre"
                  : `${decimalFormatter.format(offer.pendingPerRemainingPlace || 0)} por lugar`}
              </strong>
            </div>
          </article>
        ))}
      </div>
      <div className="per-director-action-strip">
        <article>
          <span>Acción inmediata</span>
          <strong>{snapshot.pressure.highPressureOffers} convocatorias exigidas</strong>
          <p>Revisar alternativas para las ofertas saturadas o con 2 postulaciones por lugar.</p>
        </article>
        <article>
          <span>Seguimiento académico</span>
          <strong>{snapshot.studentSummary.criteriaCompleteActive} trayectorias completas</strong>
          <p>Cumplen horas, especialidad y rotaciones, pero conservan alguna práctica activa.</p>
        </article>
        <article>
          <span>Trámite posible</span>
          <strong>{snapshot.studentSummary.readyToRequest} solicitudes a promover</strong>
          <p>Cumplen los requisitos y no registran solicitud ni práctica activa.</p>
        </article>
      </div>
      <PageFooter model={model} page="03" />
    </section>
  );
};

const WithoutPpsCard = ({ student }: { student: WithoutPpsStudent }) => (
  <article className="per-director-student-card">
    <div>
      <strong>{student.fullName}</strong>
      <StudentMeta student={student} />
    </div>
    <div className="per-director-student-facts">
      <span>
        <b>{student.applicationCount}</b> postulaciones del ciclo
      </span>
      <span className={student.pendingApplications > 0 ? "is-active" : ""}>
        <b>{student.pendingApplications}</b> pendientes ahora
      </span>
    </div>
  </article>
);

const WithoutPpsPages = ({ model }: { model: DirectorReportModel }) =>
  chunk(model.snapshot.withoutPpsStudents, 18).map((rows, index, pages) => (
    <section className="per-page" key={`without-${index}`}>
      <PageHeader
        title="Sin PPS · demanda activa"
        label={`Seguimiento nominal · ${index + 1} de ${pages.length}`}
      />
      <div className="per-director-list-intro">
        <p>
          Estudiantes activos sin prácticas cargadas que se postularon al menos una vez a una PPS
          durante {model.annual.year}. Se excluyen quienes no muestran actividad de búsqueda en el
          ciclo.
        </p>
        <strong>{model.snapshot.studentSummary.withoutPps} estudiantes</strong>
      </div>
      <div className="per-director-student-grid">
        {rows.map((student) => (
          <WithoutPpsCard key={student.studentId} student={student} />
        ))}
      </div>
      <PageFooter model={model} page={String(4 + index).padStart(2, "0")} />
    </section>
  ));

const NearCompletionCard = ({ student }: { student: NearCompletionStudent }) => (
  <article className={`per-director-student-card is-near is-${student.reasonCode}`}>
    <div>
      <span className="per-director-reason">{REASON_LABELS[student.reasonCode]}</span>
      <strong>{student.fullName}</strong>
      <StudentMeta student={student} />
    </div>
    <div className="per-director-progress-facts">
      <span>
        <b>{integerFormatter.format(student.totalHours)}</b> h totales
      </span>
      <span>
        <b>{integerFormatter.format(student.specialtyHours)}</b> h especialidad
      </span>
      <span>
        <b>{student.rotations}</b> orientaciones
      </span>
      {student.activePractices > 0 && <em>{student.activePractices} PPS activa</em>}
    </div>
  </article>
);

const NearCompletionPages = ({
  model,
  startPage,
}: {
  model: DirectorReportModel;
  startPage: number;
}) =>
  chunk(model.snapshot.nearCompletionStudents, 18).map((rows, index, pages) => (
    <section className="per-page" key={`near-${index}`}>
      <PageHeader
        title="Próximos a finalizar"
        label={`Seguimiento nominal · ${index + 1} de ${pages.length}`}
      />
      <div className="per-director-list-intro">
        <p>
          Listado deduplicado. Cada estudiante aparece bajo un único motivo, con prioridad al tramo
          de horas totales, luego a la rotación faltante y finalmente a la especialidad. Se excluye
          a quienes ya realizaron Relevamiento Profesional o Entrevista a Profesionales.
        </p>
        <strong>{model.snapshot.studentSummary.nearCompletion} estudiantes</strong>
      </div>
      <div className="per-director-student-grid is-near-grid">
        {rows.map((student) => (
          <NearCompletionCard key={student.studentId} student={student} />
        ))}
      </div>
      <PageFooter model={model} page={String(startPage + index).padStart(2, "0")} />
    </section>
  ));

const ReadyAndAccreditation = ({ model, page }: { model: DirectorReportModel; page: number }) => (
  <section className="per-page">
    <PageHeader title="Solicitudes y acreditaciones" label="Próximos pasos" />
    <div className="per-director-dual-list">
      <section>
        <div className="per-director-subhead">
          <span>Acción sugerida</span>
          <h3>En condiciones de solicitar</h3>
          <strong>{model.snapshot.readyToRequestStudents.length}</strong>
        </div>
        <p className="per-director-subcopy">
          Alcanzaron 250 horas, 70 de especialidad y tres orientaciones; no tienen práctica activa
          ni solicitud registrada.
        </p>
        <div className="per-director-compact-list">
          {model.snapshot.readyToRequestStudents.map((student) => (
            <article key={student.studentId}>
              <div>
                <strong>{student.fullName}</strong>
                <StudentMeta student={student} />
              </div>
              <span>
                {student.totalHours} h · {student.specialtyHours} h especialidad ·{" "}
                {student.rotations} orientaciones
              </span>
            </article>
          ))}
        </div>
      </section>
      <section>
        <div className="per-director-subhead">
          <span>Trámite en curso</span>
          <h3>Con solicitud de acreditación</h3>
          <strong>{model.snapshot.accreditationStudents.length}</strong>
        </div>
        <p className="per-director-subcopy">
          Estudiantes activos que ya poseen una solicitud de finalización registrada en el sistema.
        </p>
        <div className="per-director-compact-list">
          {model.snapshot.accreditationStudents.map((student) => (
            <article key={student.studentId}>
              <div>
                <strong>{student.fullName}</strong>
                <StudentMeta student={student} />
              </div>
              <span>{student.status || "Estado sin especificar"}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
    <div className="per-director-closing-note">
      <strong>Uso previsto</strong>
      <p>
        Este anexo nominal sirve para priorizar acompañamientos. No reemplaza la revisión individual
        del legajo ni debe circular fuera de las autoridades y equipos autorizados.
      </p>
    </div>
    <PageFooter model={model} page={String(page).padStart(2, "0")} />
  </section>
);

export const DirectorReport = ({ model }: { model: DirectorReportModel }) => {
  const withoutPageCount = Math.max(1, Math.ceil(model.snapshot.withoutPpsStudents.length / 18));
  const nearPageCount = Math.max(1, Math.ceil(model.snapshot.nearCompletionStudents.length / 18));
  const nearStartPage = 4 + withoutPageCount;
  const closingPage = nearStartPage + nearPageCount;

  return (
    <article className="per-report per-director-report">
      <DirectorCover model={model} />
      <AnnualAndStudentOverview model={model} />
      <PressureAndActions model={model} />
      <WithoutPpsPages model={model} />
      <NearCompletionPages model={model} startPage={nearStartPage} />
      <ReadyAndAccreditation model={model} page={closingPage} />
    </article>
  );
};
