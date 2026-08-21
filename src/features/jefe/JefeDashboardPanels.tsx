import React, { useMemo, useState } from "react";
import type { JefeDashboardData, JefeReport } from "./types";

const GRADE_OPTIONS = ["Sin calificar", "Desaprobado", "4", "5", "6", "7", "8", "9", "10"];
const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const formatDate = (value: string | null): string => {
  if (!value) return "Sin fecha";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "");
};

const formatSubmissionDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  })
    .format(date)
    .replace(".", "");
};

const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

const URGENCY_ORDER: Record<JefeReport["urgency"], number> = {
  critical: 0,
  soon: 1,
  on_time: 2,
  undated: 3,
  stale: 4,
  waiting: 5,
  corrected: 6,
};

const compareReportPriority = (left: JefeReport, right: JefeReport): number => {
  const urgency = URGENCY_ORDER[left.urgency] - URGENCY_ORDER[right.urgency];
  if (urgency !== 0) return urgency;
  const leftDays = left.days_remaining ?? Number.POSITIVE_INFINITY;
  const rightDays = right.days_remaining ?? Number.POSITIVE_INFINITY;
  if (leftDays !== rightDays) return leftDays - rightDays;
  return (left.submitted_at ?? "").localeCompare(right.submitted_at ?? "");
};

const normalizedGrade = (grade: string | null): string => {
  if (!grade) return "Sin calificar";
  if (grade.toLocaleLowerCase("es").includes("desaprob")) return "Desaprobado";
  const numeric = Number(String(grade).replace(",", "."));
  if (Number.isFinite(numeric) && numeric >= 4 && numeric <= 10) return String(Math.round(numeric));
  return "Sin calificar";
};

const urgencyCopy = (report: JefeReport): string => {
  if (report.urgency === "stale") return "Más de 90 días fuera del plazo";
  if (report.urgency === "critical") {
    const late = Math.abs(report.days_remaining ?? 0);
    return `${late} ${plural(late, "día")} fuera del seguimiento`;
  }
  if (report.urgency === "soon") {
    if (report.days_remaining === 0) return "Vence hoy";
    return `${report.days_remaining} ${plural(report.days_remaining ?? 0, "día")} restantes`;
  }
  if (report.urgency === "undated") return "Entrega sin fecha sincronizada";
  if (report.days_remaining != null) {
    return `${report.days_remaining} ${plural(report.days_remaining, "día")} restantes`;
  }
  return report.report_status === "corrected" ? "Corregido" : "Aún no entregado";
};

const UrgencyBadge: React.FC<{ report: JefeReport }> = ({ report }) => (
  <span className={`jefe-urgency jefe-urgency--${report.urgency}`}>{urgencyCopy(report)}</span>
);

const GradeControl: React.FC<{
  report: JefeReport;
  saving: boolean;
  readOnly: boolean;
  onChange: (report: JefeReport, grade: string) => Promise<void>;
}> = ({ report, saving, readOnly, onChange }) => {
  const currentGrade = report.grade?.trim() || "Sin calificar";

  if (readOnly) {
    return (
      <div
        className="jefe-grade-readonly"
        title="Nota registrada en el panel o sincronizada desde Moodle"
      >
        <span aria-hidden="true">NOTA ACTUAL</span>
        <span className="sr-only">Nota actual de {report.student_name}:</span>
        <strong>{currentGrade}</strong>
      </div>
    );
  }

  const grade = normalizedGrade(report.grade);

  return (
    <label className="jefe-grade-control">
      <span className="sr-only">Calificación de {report.student_name}</span>
      <select
        value={grade}
        disabled={saving}
        onChange={(event) => void onChange(report, event.target.value)}
        aria-label={`Calificación de ${report.student_name}`}
      >
        {GRADE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="material-icons" aria-hidden="true">
        {saving ? "progress_activity" : "expand_more"}
      </span>
    </label>
  );
};

const ReportRow: React.FC<{
  report: JefeReport;
  saving: boolean;
  readOnly: boolean;
  onGrade: (report: JefeReport, grade: string) => Promise<void>;
  compact?: boolean;
}> = ({ report, saving, readOnly, onGrade, compact = false }) => (
  <article
    className={`jefe-report-row jefe-report-row--${report.urgency}${compact ? " is-compact" : ""}`}
  >
    <span className="jefe-report-row__marker" aria-hidden="true" />
    <div className="jefe-report-row__identity">
      <strong>{report.student_name}</strong>
      <span>
        {report.pps_name} · {report.orientation}
      </span>
    </div>
    <div className="jefe-report-row__date">
      <span>{report.submitted_at ? "ENTREGADO" : "FECHA DE ENTREGA"}</span>
      <strong>
        {report.submitted_at ? formatSubmissionDate(report.submitted_at) : "No sincronizada"}
      </strong>
    </div>
    <UrgencyBadge report={report} />
    <div className="jefe-report-row__actions">
      {report.campus_url && (
        <a
          href={report.campus_url}
          target="_blank"
          rel="noreferrer"
          className="jefe-icon-link"
          aria-label={`Abrir informe de ${report.student_name} en el Campus`}
          title="Abrir en el Campus"
        >
          <span className="material-icons">open_in_new</span>
          <span className="jefe-icon-link__label">Abrir informe</span>
        </a>
      )}
      <GradeControl report={report} saving={saving} readOnly={readOnly} onChange={onGrade} />
    </div>
  </article>
);

type CommonPanelProps = {
  data: JefeDashboardData;
  savingId: string | null;
  readOnly?: boolean;
  onGrade: (report: JefeReport, grade: string) => Promise<void>;
};

export const JefeHomePanel: React.FC<
  CommonPanelProps & { onNavigate: (view: "informes" | "panorama") => void }
> = ({ data, savingId, readOnly = false, onGrade, onNavigate }) => {
  const pending = data.reports
    .filter((report) => report.report_status === "pending")
    .sort(compareReportPriority)
    .slice(0, 5);
  const firstName = data.profile.name.trim().split(/\s+/)[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <>
      <section className="jefe-hero">
        <p className="jefe-context-line">
          {dateLabel} · {data.profile.areas.map((area) => area.label).join(" + ")}
        </p>
        <h1>
          {greeting}, <em>{firstName}.</em>
        </h1>
        <p className="jefe-hero__summary">
          Tenés <u>{data.queue.pending} informes pendientes</u> de corrección.
          {data.queue.critical > 0 && (
            <>
              {" "}
              <span className="is-critical">
                {data.queue.critical} {plural(data.queue.critical, "informe")}{" "}
                {data.queue.critical === 1 ? "superó" : "superaron"} el seguimiento interno de 30
                días
              </span>
              .
            </>
          )}{" "}
          {data.queue.soon > 0 && (
            <span className="is-soon">
              {data.queue.soon} {plural(data.queue.soon, "entrega")}{" "}
              {data.queue.soon === 1 ? "llega" : "llegan"} al plazo esta semana.
            </span>
          )}
          {data.queue.undated > 0 && (
            <>
              {" "}
              <span>
                {data.queue.undated} {plural(data.queue.undated, "entrega")} sin fecha verificable.
              </span>
            </>
          )}
        </p>
        <p className="jefe-hero__note">
          El orden usa 30 días corridos desde la entrega registrada. Los casos con más de 90 días de
          atraso quedan como antecedentes.
        </p>
      </section>

      <div className="jefe-home-grid">
        <section className="jefe-section jefe-priority-panel">
          <header className="jefe-section__header">
            <div>
              <p className="jefe-context-line">Orden de atención</p>
              <h2>Informes para corregir</h2>
            </div>
            <button className="jefe-text-action" onClick={() => onNavigate("informes")}>
              Ver todos <span className="material-icons">arrow_forward</span>
            </button>
          </header>
          <div className="jefe-report-list">
            {pending.length > 0 ? (
              pending.map((report) => (
                <ReportRow
                  key={report.practica_id}
                  report={report}
                  saving={savingId === report.practica_id}
                  readOnly={readOnly}
                  onGrade={onGrade}
                  compact
                />
              ))
            ) : (
              <div className="jefe-empty">
                <span className="material-icons">task_alt</span>
                <strong>No hay informes pendientes.</strong>
                <p>La cola está al día para tus orientaciones.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="jefe-status-rail" aria-label="Estado de la cola">
          <p className="jefe-context-line">Estado de la cola</p>
          <div className="jefe-status-item jefe-status-item--critical">
            <span>CRÍTICOS</span>
            <strong>{data.queue.critical}</strong>
            <p>Pasaron los 30 días corridos</p>
          </div>
          <div className="jefe-status-item jefe-status-item--soon">
            <span>ESTA SEMANA</span>
            <strong>{data.queue.soon}</strong>
            <p>Les quedan 7 días o menos</p>
          </div>
          <div className="jefe-status-item jefe-status-item--ok">
            <span>EN PLAZO</span>
            <strong>{data.queue.on_time}</strong>
            <p>Seguimiento interno normal</p>
          </div>
          <div className="jefe-status-item jefe-status-item--undated">
            <span>SIN FECHA</span>
            <strong>{data.queue.undated}</strong>
            <p>Requieren sincronizar la fecha real</p>
          </div>
        </aside>
      </div>

      <section className="jefe-panorama-peek">
        <header>
          <div>
            <p className="jefe-context-line">Panorama {data.panorama.year}</p>
            <h2>Tu orientación, en un vistazo</h2>
          </div>
          <button className="jefe-text-action" onClick={() => onNavigate("panorama")}>
            Abrir estadísticas <span className="material-icons">arrow_forward</span>
          </button>
        </header>
        <div className="jefe-data-band">
          <div>
            <strong>{data.panorama.offers}</strong>
            <span>PPS lanzadas</span>
          </div>
          <div>
            <strong>{data.panorama.capacity.total}</strong>
            <span>Cupos registrados</span>
          </div>
          <div>
            <strong>{data.panorama.institutions_count}</strong>
            <span>Instituciones</span>
          </div>
          <div>
            <strong>{data.panorama.students_started}</strong>
            <span>Estudiantes que iniciaron</span>
          </div>
        </div>
      </section>
    </>
  );
};

type ReportFilter = "all" | "critical" | "soon" | "on_time" | "undated";

export const JefeReportsPanel: React.FC<CommonPanelProps> = ({
  data,
  savingId,
  readOnly = false,
  onGrade,
}) => {
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [search, setSearch] = useState("");
  const [showStale, setShowStale] = useState(false);
  const [showWaiting, setShowWaiting] = useState(false);
  const [showCorrected, setShowCorrected] = useState(false);

  const pending = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return data.reports
      .filter((report) => {
        if (report.report_status !== "pending") return false;
        if (filter !== "all" && report.urgency !== filter) return false;
        if (!term) return true;
        return `${report.student_name} ${report.pps_name} ${report.orientation}`
          .toLocaleLowerCase("es")
          .includes(term);
      })
      .sort(compareReportPriority);
  }, [data.reports, filter, search]);

  const waiting = data.reports.filter((report) => report.report_status === "waiting");
  const stale = data.reports.filter((report) => report.report_status === "stale");
  const corrected = data.reports.filter((report) => report.report_status === "corrected");

  const filterItems: { id: ReportFilter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: data.queue.pending },
    { id: "critical", label: "Críticos", count: data.queue.critical },
    { id: "soon", label: "Esta semana", count: data.queue.soon },
    { id: "on_time", label: "En plazo", count: data.queue.on_time },
    { id: "undated", label: "Sin fecha", count: data.queue.undated },
  ];

  return (
    <section className="jefe-page-section">
      <header className="jefe-page-heading">
        <div>
          <p className="jefe-context-line">
            Informes · {data.profile.areas.map((area) => area.label).join(" + ")}
          </p>
          <h1>Cola de corrección</h1>
          <p>
            Prioridad calculada desde cada entrega. Los atrasos mayores a 90 días quedan fuera de
            esta cola.
          </p>
        </div>
        <div className="jefe-heading-number">
          <strong>{data.queue.pending}</strong>
          <span>PENDIENTES</span>
        </div>
      </header>

      <div className="jefe-report-toolbar">
        <div className="jefe-filter-tabs" role="tablist" aria-label="Filtrar informes">
          {filterItems.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={filter === item.id}
              className={filter === item.id ? "is-active" : ""}
              onClick={() => setFilter(item.id)}
            >
              {item.label} <span>{item.count}</span>
            </button>
          ))}
        </div>
        <label className="jefe-search">
          <span className="material-icons">search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar estudiante o PPS"
          />
        </label>
      </div>

      <div className="jefe-ledger-head" aria-hidden="true">
        <span>ESTUDIANTE / PPS</span>
        <span>ENTREGA</span>
        <span>SEGUIMIENTO</span>
        <span>{readOnly ? "NOTA ACTUAL" : "CALIFICACIÓN"}</span>
      </div>
      <div className="jefe-report-list jefe-report-list--ledger">
        {pending.length > 0 ? (
          pending.map((report) => (
            <ReportRow
              key={report.practica_id}
              report={report}
              saving={savingId === report.practica_id}
              readOnly={readOnly}
              onGrade={onGrade}
            />
          ))
        ) : (
          <div className="jefe-empty">
            <span className="material-icons">filter_alt_off</span>
            <strong>No hay informes con este filtro.</strong>
          </div>
        )}
      </div>

      <div className="jefe-archive-lists">
        <details open={showStale} onToggle={(event) => setShowStale(event.currentTarget.open)}>
          <summary>
            <span>
              <strong>Entregas antiguas</strong>
              <small>
                Superaron 90 días de atraso y quedan como antecedentes, fuera de los pendientes.
              </small>
            </span>
            <b>{stale.length}</b>
          </summary>
          <div className="jefe-corrected-list">
            {stale.slice(0, 100).map((report) => (
              <ReportRow
                key={report.practica_id}
                report={report}
                saving={savingId === report.practica_id}
                readOnly={readOnly}
                onGrade={onGrade}
                compact
              />
            ))}
            {stale.length > 100 && <p>Se muestran los primeros 100 de {stale.length}.</p>}
          </div>
        </details>
        <details open={showWaiting} onToggle={(event) => setShowWaiting(event.currentTarget.open)}>
          <summary>
            <span>
              <strong>Aún no entregados</strong>
              <small>Quedan guardados fuera de la cola de corrección.</small>
            </span>
            <b>{waiting.length}</b>
          </summary>
          <div className="jefe-compact-list">
            {waiting.slice(0, 100).map((report) => (
              <div key={report.practica_id}>
                <span>{report.student_name}</span>
                <small>{report.pps_name}</small>
              </div>
            ))}
            {waiting.length > 100 && <p>Se muestran los primeros 100 de {waiting.length}.</p>}
          </div>
        </details>
        <details
          open={showCorrected}
          onToggle={(event) => setShowCorrected(event.currentTarget.open)}
        >
          <summary>
            <span>
              <strong>Corregidos</strong>
              <small>Historial disponible para consulta y ajuste de nota.</small>
            </span>
            <b>{corrected.length}</b>
          </summary>
          <div className="jefe-corrected-list">
            {corrected.slice(0, 100).map((report) => (
              <ReportRow
                key={report.practica_id}
                report={report}
                saving={savingId === report.practica_id}
                readOnly={readOnly}
                onGrade={onGrade}
                compact
              />
            ))}
            {corrected.length > 100 && <p>Se muestran los primeros 100 de {corrected.length}.</p>}
          </div>
        </details>
      </div>
    </section>
  );
};

export const JefePanoramaPanel: React.FC<{
  data: JefeDashboardData;
  year: number;
  onYearChange: (year: number) => void;
  loading: boolean;
}> = ({ data, year, onYearChange, loading }) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, index) => currentYear - index);
  const maxMonth = Math.max(1, ...data.panorama.months.map((month) => month.offers));
  const sourceLabel =
    data.panorama.source === "historical_documented"
      ? "Fuente documental reconciliada"
      : "Datos operativos al corte";

  return (
    <section className="jefe-page-section">
      <header className="jefe-page-heading jefe-page-heading--panorama">
        <div>
          <p className="jefe-context-line">
            Panorama · {data.profile.areas.map((area) => area.label).join(" + ")}
          </p>
          <h1>Estado de la orientación</h1>
          <p>Oferta, capacidad, instituciones y estudiantes que iniciaron PPS.</p>
        </div>
        <label className="jefe-year-select">
          <span>AÑO</span>
          <select
            value={year}
            onChange={(event) => onYearChange(Number(event.target.value))}
            disabled={loading}
          >
            {years.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="jefe-scope-line">
        <div>
          {data.profile.areas.map((area) => (
            <span key={area.key}>{area.label}</span>
          ))}
        </div>
        <small>
          {sourceLabel} · corte {formatDate(data.panorama.cutoff)}
        </small>
      </div>

      <div className="jefe-data-band jefe-data-band--wide">
        <div>
          <strong>{data.panorama.offers}</strong>
          <span>PPS lanzadas</span>
        </div>
        <div>
          <strong>{data.panorama.capacity.total}</strong>
          <span>Cupos registrados</span>
        </div>
        <div>
          <strong>{data.panorama.institutions_count}</strong>
          <span>Instituciones</span>
        </div>
        <div>
          <strong>{data.panorama.students_started}</strong>
          <span>Estudiantes que iniciaron</span>
        </div>
        <div>
          <strong>
            {data.panorama.source === "historical_documented" ? "—" : data.panorama.applicants}
          </strong>
          <span>
            {data.panorama.source === "historical_documented"
              ? "Demanda no disponible"
              : "Estudiantes postulados"}
          </span>
        </div>
      </div>

      <p className="jefe-capacity-note">
        Cupos registrados: <strong>{data.panorama.capacity.fixed} fijos</strong> +{" "}
        <strong>{data.panorama.capacity.realized} realizados</strong>
        {data.panorama.capacity.unknown_offers > 0 && (
          <> · {data.panorama.capacity.unknown_offers} ofertas sin cupo finito</>
        )}
        .
      </p>

      <div className="jefe-panorama-grid">
        <section className="jefe-chart-panel">
          <header>
            <p className="jefe-context-line">Ritmo del año</p>
            <h2>PPS lanzadas por mes</h2>
          </header>
          <div className="jefe-bars" role="img" aria-label={`PPS lanzadas por mes en ${year}`}>
            {data.panorama.months.map((month) => (
              <div className="jefe-bar" key={month.month_number}>
                <span>{month.offers > 0 ? month.offers : ""}</span>
                <i style={{ height: `${Math.max(4, (month.offers / maxMonth) * 100)}%` }} />
                <small>{MONTHS[month.month_number - 1]}</small>
              </div>
            ))}
          </div>
        </section>

        <aside className="jefe-current-panel">
          <p className="jefe-context-line">Foto actual</p>
          <h2>Situación operativa</h2>
          <p className="jefe-current-panel__date">
            Al {formatDate(data.current.as_of)} · no es un resultado anual
          </p>
          <dl>
            <div>
              <dt>Prácticas activas</dt>
              <dd>{data.current.active_practices}</dd>
            </div>
            <div>
              <dt>Convocatorias abiertas</dt>
              <dd>{data.current.open_offers}</dd>
            </div>
            <div>
              <dt>Informes pendientes</dt>
              <dd>{data.current.pending_reports}</dd>
            </div>
            <div className="is-critical">
              <dt>Informes críticos</dt>
              <dd>{data.current.critical_reports}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <section className="jefe-institutions">
        <header>
          <div>
            <p className="jefe-context-line">Red de prácticas</p>
            <h2>Instituciones con ofertas de PPS en {year}</h2>
          </div>
          <span>{data.panorama.institutions.length} REGISTROS</span>
        </header>
        <div className="jefe-institution-table" role="table">
          <div className="jefe-institution-table__head" role="row">
            <span>INSTITUCIÓN / OFERTA</span>
            <span>PPS</span>
            <span>CUPOS REGISTRADOS</span>
          </div>
          {data.panorama.institutions.map((institution) => (
            <div role="row" key={institution.institution_name}>
              <strong>{institution.institution_name}</strong>
              <span>{institution.offer_count}</span>
              <span>{institution.fixed_capacity + institution.realized_capacity}</span>
            </div>
          ))}
          {data.panorama.institutions.length === 0 && (
            <p className="jefe-table-empty">No hay ofertas registradas para este corte.</p>
          )}
        </div>
      </section>
    </section>
  );
};
