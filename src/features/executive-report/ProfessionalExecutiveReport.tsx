import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/source-serif-4/latin-600.css";
import "@fontsource/source-serif-4/latin-700.css";
import "./professionalExecutiveReport.css";
import type {
  ExecutiveReportModel,
  ManagementAgreement,
  ManagementNetworkInstitution,
  ReportDelta,
  ReportMetric,
} from "./executiveReport.types";
import {
  buildManagementAccessPresentation,
  managementCapacityValue,
  visibleManagementAgreements,
} from "./managementReport.presentation";

const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const formatISODate = (value: string | null): string => {
  if (!value) return "—";
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
};

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

const orientationClassName = (orientation: string): string =>
  `is-${orientation.toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "")}`;

const comparisonPeriod = (year: number, cutoffISO: string): string => {
  if (cutoffISO.endsWith("-12-31")) return `Cierre ${year}`;
  const [, month, day] = cutoffISO.split("-");
  return `${year} · al ${day}/${month}`;
};

const formatValue = (metric: ReportMetric): string => {
  if (metric.value == null) return "No disponible";
  const value = Number.isInteger(metric.value)
    ? integerFormatter.format(metric.value)
    : decimalFormatter.format(metric.value);
  return metric.unit === "%" ? `${value}%` : metric.unit ? `${value} ${metric.unit}` : value;
};

const DeltaLabel = ({ delta, unit }: { delta?: ReportDelta; unit?: string }) => {
  if (!delta) return null;
  if (!delta.comparable) return null;
  const sign = delta.absolute > 0 ? "+" : "";
  return (
    <span className={`per-delta${delta.absolute < 0 ? " is-negative" : ""}`}>
      <strong>
        {sign}
        {integerFormatter.format(delta.absolute)} {unit || ""}
      </strong>
      {delta.percent != null && (
        <b>
          {sign}
          {decimalFormatter.format(delta.percent)}%
        </b>
      )}
    </span>
  );
};

const ComparisonBasis = ({ model }: { model: ExecutiveReportModel }) => {
  if (!model.previous) return null;
  const hasComparableDelta = [...model.primaryMetrics, ...model.demandMetrics].some(
    (metric) => metric.delta?.comparable
  );
  if (!hasComparableDelta) return null;

  return (
    <aside className="per-comparison-basis">
      <div className="per-comparison-periods">
        <span>Base de comparación</span>
        <strong>{comparisonPeriod(model.current.year, model.current.cutoffISO)}</strong>
        <i>contra</i>
        <strong>{comparisonPeriod(model.previous.year, model.previous.cutoffISO)}</strong>
      </div>
      <p>
        <strong>Cómo leer los valores verdes</strong>
        Muestran cuánto cambió cada indicador frente al ciclo anterior al mismo corte: primero la
        diferencia absoluta y luego la variación porcentual.
        {model.comparisonContext && <small>{model.comparisonContext}</small>}
      </p>
    </aside>
  );
};

const EvidenceMetric = ({ metric }: { metric: ReportMetric }) => (
  <div className="per-metric">
    <div className="per-metric-heading">
      <span>{metric.label}</span>
      <DeltaLabel delta={metric.delta} unit={metric.deltaUnit} />
    </div>
    <strong>{formatValue(metric)}</strong>
    <p>{metric.detail}</p>
  </div>
);

const Wordmark = ({ inverse = false }: { inverse?: boolean }) => (
  <div className={`per-wordmark${inverse ? " is-inverse" : ""}`} aria-label="UFLO Universidad">
    <b>UFLO</b>
    <span>Universidad</span>
  </div>
);

const PageHeader = ({
  title,
  label,
  showWordmark = true,
}: {
  title: string;
  label: string;
  showWordmark?: boolean;
}) => (
  <header className="per-page-header">
    <div>
      <span>{label}</span>
      <h2>{title}</h2>
    </div>
    {showWordmark && <Wordmark />}
  </header>
);

const SourceFooter = ({ model, page }: { model: ExecutiveReportModel; page: string }) => (
  <footer className="per-page-footer">
    <span>
      {model.kind === "management"
        ? `Fuente: Mi Panel Académico · corte ${formatISODate(model.asOfISO)}`
        : `Fuente: Mi Panel Académico · ${model.current.metricVersion}`}
    </span>
    <span>{page}</span>
  </footer>
);

const AnnualCover = ({ model }: { model: ExecutiveReportModel }) => (
  <section className="per-page per-cover">
    <div className="per-cover-top">
      <Wordmark />
      <span className="per-document-type">Documento para autoridades</span>
    </div>
    <div className="per-cover-body">
      <p className="per-kicker">Psicología · Sede Comahue</p>
      <h1>{model.title}</h1>
      <p className="per-subtitle">{model.subtitle}</p>
      <div className="per-cover-rule" />
      <p className="per-headline">{model.headline}</p>
    </div>
    <div className="per-cover-metrics">
      {model.primaryMetrics.slice(0, 4).map((metric) => (
        <div key={metric.id}>
          <strong>{formatValue(metric)}</strong>
          <span>{metric.label}</span>
        </div>
      ))}
    </div>
    <div className="per-signature">
      <div>
        <strong>{model.author.name}</strong>
        <span>{model.author.role}</span>
        <span>{model.author.unit}</span>
      </div>
      <div>
        <span>{model.periodLabel}</span>
        <span>{model.author.email}</span>
      </div>
    </div>
  </section>
);

const ManagementCover = ({ model }: { model: ExecutiveReportModel }) => (
  <section className="per-page per-cover per-management-cover">
    <div className="per-cover-top">
      <Wordmark inverse />
      <span className="per-document-type">Rendición institucional</span>
    </div>
    <div className="per-management-title">
      <p>Coordinación General de PPS</p>
      <h1>Informe de gestión</h1>
      <strong>2024—{model.year}</strong>
      <span>Psicología · Sede Comahue</span>
    </div>
    <div className="per-arrival-mark">
      <span />
      <div>
        <small>Inicio de gestión</small>
        <strong>1 de septiembre de 2024</strong>
      </div>
    </div>
    <p className="per-management-intro">{model.headline}</p>
    <div className="per-management-signature">
      <span>
        {model.author.name} · {model.author.role}
      </span>
      <span>{model.author.email}</span>
    </div>
  </section>
);

const ExecutiveReading = ({ model }: { model: ExecutiveReportModel }) => (
  <section className="per-page">
    <PageHeader
      title="Lectura ejecutiva"
      label="Síntesis del período"
      showWordmark={model.kind !== "management"}
    />
    <div className="per-reading-grid">
      <div className="per-reading-lead">
        <p>{model.headline}</p>
        <span>{model.periodLabel}</span>
      </div>
      <ol className="per-findings">
        {model.executiveSummary.map((finding) => (
          <li key={finding}>{finding}</li>
        ))}
      </ol>
    </div>
    <div className="per-metric-band">
      {model.primaryMetrics.map((metric) => (
        <EvidenceMetric key={metric.id} metric={metric} />
      ))}
    </div>
    <ComparisonBasis model={model} />
    <SourceFooter model={model} page="02" />
  </section>
);

const AnnualEvidence = ({ model }: { model: ExecutiveReportModel }) => {
  const maxCapacity = Math.max(1, ...model.orientations.map((item) => item.capacity));
  return (
    <section className="per-page">
      <PageHeader title="Acceso, demanda y oferta" label="Evidencia del ciclo" />
      <div className="per-two-column">
        <div>
          <h3>Demanda registrada</h3>
          <div className="per-stacked-metrics">
            {model.demandMetrics.map((metric) => (
              <EvidenceMetric key={metric.id} metric={metric} />
            ))}
          </div>
        </div>
        <div>
          <h3>Cómo se construye la capacidad registrada</h3>
          <div className="per-capacity-equation">
            <div>
              <strong>{integerFormatter.format(model.current.capacity.fixedOffered)}</strong>
              <span>cupos publicados en ofertas con límite</span>
            </div>
            <b>+</b>
            <div>
              <strong>{integerFormatter.format(model.current.capacity.realized)}</strong>
              <span>participantes incorporados en ofertas sin límite prefijado</span>
            </div>
            <b>=</b>
            <div className="is-total">
              <strong>{integerFormatter.format(model.current.capacity.operational)}</strong>
              <span>lugares registrados</span>
            </div>
          </div>
          {model.year !== 2024 && (
            <div className="per-capacity-notes">
              <p className="per-capacity-explainer">
                En las ofertas con cupo se cuenta lo publicado. Cuando una oferta no fija un límite,
                se cuentan los estudiantes efectivamente incorporados.
              </p>
              {model.realizedCapacityContext && (
                <p className="per-capacity-source">
                  <strong>Procedencia de los participantes</strong>
                  {model.realizedCapacityContext}
                </p>
              )}
            </div>
          )}
          {model.year === 2024 && (
            <p className="per-verified-note">
              Resultado oficial: 42 ofertas; 36 finitas por 270 vacantes y 6 sin cupo finito.
            </p>
          )}
        </div>
      </div>
      <div className="per-orientation-block">
        <div>
          <h3>Distribución por orientación</h3>
          <p>Lugares registrados, atribuidos a la orientación de cada oferta.</p>
        </div>
        {model.orientations.length ? (
          <div className="per-bars">
            {model.orientations.map((item) => (
              <div className={`per-bar-row ${orientationClassName(item.key)}`} key={item.key}>
                <span>{item.label}</span>
                <div>
                  <i style={{ width: `${(item.capacity / maxCapacity) * 100}%` }} />
                </div>
                <strong>{integerFormatter.format(item.capacity)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="per-empty-evidence">
            La distribución detallada no está disponible para este corte. El total oficial se
            conserva en la síntesis.
          </p>
        )}
      </div>
      <SourceFooter model={model} page="03" />
    </section>
  );
};

const OutcomesAndInstitutions = ({ model }: { model: ExecutiveReportModel }) => (
  <section className="per-page">
    <PageHeader title="Resultados e instituciones" label="Trayectorias y vínculos del ciclo" />
    <div
      className="per-outcome-strip"
      style={{ gridTemplateColumns: `repeat(${model.outcomeMetrics.length}, 1fr)` }}
    >
      {model.outcomeMetrics.map((metric) => (
        <EvidenceMetric key={metric.id} metric={metric} />
      ))}
    </div>
    {model.agreements.length > 0 && (
      <div className="per-agreements">
        <div className="per-agreements-heading">
          <div>
            <span>Red institucional</span>
            <h3>Convenios incorporados en {model.year}</h3>
          </div>
          <p>
            Instituciones dadas de alta en el ciclo, con la orientación y el aporte registrado de
            cada vínculo.
          </p>
        </div>
        <div className="per-agreement-list">
          {model.agreements.map((agreement, index) => (
            <article key={agreement.institucion} className="per-agreement-row">
              <span className="per-agreement-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="per-agreement-identity">
                <strong>{agreement.institucion}</strong>
                <div className="per-orientation-tags">
                  {agreement.orientaciones.map((orientation) => (
                    <span className={orientationClassName(orientation)} key={orientation}>
                      {ORIENTATION_LABELS[orientation] || orientation}
                    </span>
                  ))}
                </div>
              </div>
              <div className="per-agreement-facts">
                <span>
                  <strong>{agreement.pps}</strong>
                  {agreement.pps === 1 ? "oferta" : "ofertas"}
                </span>
                <span>
                  <strong>{agreement.cupos}</strong>
                  lugares registrados
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    )}
    <SourceFooter model={model} page="04" />
  </section>
);

const ManagementTimeline = ({ model }: { model: ExecutiveReportModel }) => {
  const series = model.management?.series || [];
  const maxCapacity = Math.max(1, ...series.map((snapshot) => snapshot.capacity.operational));
  return (
    <section className="per-page">
      <PageHeader
        title="Evolución de la gestión"
        label="Serie 2024 hasta la actualidad"
        showWordmark={false}
      />
      <div className="per-arrival-timeline">
        <span>2024</span>
        <div>
          <i style={{ left: "66.7%" }} />
          <b style={{ left: "66.7%" }}>01.09 · inicio de gestión</b>
        </div>
        <span>{model.year}</span>
      </div>
      <p className="per-timeline-caveat">{model.management?.caveat}</p>
      <div className="per-series-table">
        <div className="per-series-head">
          <span>Año / corte</span>
          <span>Ofertas</span>
          <span>Capacidad</span>
          <span>Inicios</span>
          <span>Finalizaciones</span>
        </div>
        {series.map((snapshot) => (
          <div className="per-series-row" key={`${snapshot.year}-${snapshot.cutoffISO}`}>
            <span>
              <strong>{snapshot.year}</strong>
              <small>
                {snapshot.cutoffISO.endsWith("12-31") ? "cierre anual" : `al ${snapshot.cutoffISO}`}
              </small>
            </span>
            <strong>{snapshot.capacity.launches}</strong>
            <span className="per-series-capacity">
              <i style={{ width: `${(snapshot.capacity.operational / maxCapacity) * 100}%` }} />
              <strong>{snapshot.capacity.operational}</strong>
            </span>
            <strong>{snapshot.flows.ppsStarted}</strong>
            <strong>{snapshot.flows.finalized}</strong>
          </div>
        ))}
      </div>
      <div className="per-baseline-note">
        <strong>Línea de base temporal</strong>
        <p>
          {model.management?.baseline
            ? `Al 31 de agosto de 2024: ${model.management.baseline.capacity.launches} ofertas, ${model.management.baseline.capacity.operational} vacantes finitas, ${model.management.baseline.flows.ppsStarted} inicios y ${model.management.baseline.flows.finalized} finalizaciones. `
            : "El corte al 31 de agosto de 2024 queda registrado como línea de base. "}
          El cierre completo 2024 fue de 42 ofertas: 36 finitas por 270 vacantes y 6 sin cupo
          finito.
        </p>
      </div>
      <SourceFooter model={model} page="03" />
    </section>
  );
};

const ManagementAnnualSummary = ({ model }: { model: ExecutiveReportModel }) => {
  const data = model.management?.data;
  const series = model.management?.series || [];
  if (!data) return null;
  const cohortByYear = new Map(data.population.accountCohorts.map((row) => [row.year, row]));
  const enrollmentByYear = new Map(
    data.population.administrativeEnrollment.map((row) => [row.year, row])
  );
  const agreementsByYear = new Map<number, number>();
  data.agreements.forEach((agreement) => {
    const agreementYear = Number(agreement.signedAt.slice(0, 4));
    agreementsByYear.set(
      agreementYear,
      (agreementsByYear.get(agreementYear) || 0) + agreement.agreementCount
    );
  });
  const maxEnrollment = Math.max(
    1,
    ...data.population.administrativeEnrollment.map((row) => row.students)
  );
  const access = buildManagementAccessPresentation(data.access, series);
  const rows = [
    {
      label: "PPS lanzadas",
      value: (snapshot: (typeof series)[number]) => snapshot.capacity.launches,
    },
    {
      label: "Cupos ofrecidos",
      value: managementCapacityValue,
    },
    {
      label: "Estudiantes que iniciaron PPS",
      value: (snapshot: (typeof series)[number]) => snapshot.flows.ppsStarted,
    },
    {
      label: "Estudiantes que finalizaron",
      value: (snapshot: (typeof series)[number]) => snapshot.flows.finalized,
    },
    {
      label: "Altas de cuenta en Mi Panel",
      value: (snapshot: (typeof series)[number]) => {
        const cohort = cohortByYear.get(snapshot.year);
        return cohort?.available ? (cohort.accountsCreated ?? "ND") : "ND";
      },
    },
    {
      label: "De esas altas, actualmente activas",
      value: (snapshot: (typeof series)[number]) => {
        const cohort = cohortByYear.get(snapshot.year);
        return cohort?.available ? (cohort.currentlyActive ?? "ND") : "ND";
      },
    },
    {
      label: "Matrícula administrativa PPS",
      value: (snapshot: (typeof series)[number]) =>
        enrollmentByYear.get(snapshot.year)?.students ?? "ND",
    },
    {
      label: "Convenios nuevos",
      value: (snapshot: (typeof series)[number]) => agreementsByYear.get(snapshot.year) || 0,
    },
  ];

  return (
    <section className="per-page per-management-summary">
      <PageHeader
        title="Resumen de los años de gestión"
        label="Resultados por año y corte"
        showWordmark={false}
      />
      <p className="per-summary-intro">
        Los años cerrados se leen al 31 de diciembre. {model.year} se calcula hasta el corte
        elegido: <strong>{formatISODate(model.asOfISO)}</strong>. “Cupos ofrecidos” presenta en una
        sola cifra la capacidad total registrada por Mi Panel.
      </p>
      <div
        className="per-management-matrix"
        style={{ gridTemplateColumns: `minmax(210px, 1.7fr) repeat(${series.length}, 1fr)` }}
      >
        <div className="per-matrix-corner">Indicador</div>
        {series.map((snapshot) => (
          <div className="per-matrix-year" key={`head-${snapshot.year}`}>
            <strong>{snapshot.year}</strong>
            <span>{snapshot.cutoffISO.endsWith("12-31") ? "cierre" : "al corte"}</span>
          </div>
        ))}
        {rows.flatMap((row) => [
          <div className="per-matrix-label" key={`${row.label}-label`}>
            {row.label}
          </div>,
          ...series.map((snapshot) => (
            <div className="per-matrix-value" key={`${row.label}-${snapshot.year}`}>
              {row.value(snapshot)}
            </div>
          )),
        ])}
      </div>
      <div className="per-enrollment-series">
        <div>
          <h3>Crecimiento de la matrícula administrativa</h3>
          <p>
            Serie externa informada por la Facultad. No equivale a cuentas creadas, postulantes ni
            estudiantes que iniciaron PPS.
          </p>
        </div>
        <div className="per-enrollment-bars">
          {data.population.administrativeEnrollment.map((row) => (
            <div key={row.cycle}>
              <span>{row.cycle}</span>
              <i style={{ width: `${(row.students / maxEnrollment) * 100}%` }} />
              <strong>{row.students}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="per-current-stock-note">
        <strong>Foto operativa al momento de emisión</strong>
        <span>
          {data.population.currentStock.activeStudents} estudiantes activos en Mi Panel ·{" "}
          {data.population.currentStock.activeStudentsWithCurrentPps} con PPS actualmente en curso
        </span>
        <small>
          Este stock no se usa como serie histórica: su estado corresponde al momento de generar el
          documento. El historial verificable de cuentas de Mi Panel comienza el{" "}
          {data.population.accountHistoryStartISO
            ? formatISODate(data.population.accountHistoryStartISO)
            : "día no disponible"}
          ; por eso los años anteriores se informan como ND. Las altas de cuenta no equivalen a
          ingresantes académicos.
        </small>
      </div>
      <div className="per-access-evidence">
        <div className="per-access-metric">
          <strong>{data.access.startRatePct?.toLocaleString("es-AR") ?? "—"}%</strong>
          <span>acceso observado en {data.access.year}</span>
        </div>
        <div className="per-access-copy">
          <p className="per-access-lead">{access.overview}</p>
          <p>
            <strong>Qué pasó con quienes todavía no iniciaron</strong>
            {access.pending}
          </p>
          <p>
            <strong>Trayectoria registrada</strong>
            {access.withoutAnyPps}
          </p>
          <small>{access.scope}</small>
        </div>
      </div>
      <SourceFooter model={model} page="G3" />
    </section>
  );
};

const AgreementContributionCell = ({
  agreement,
  year,
}: {
  agreement: ManagementAgreement;
  year: number;
}) => {
  if (year < Number(agreement.signedAt.slice(0, 4))) {
    return (
      <span
        className="per-contribution-empty"
        aria-label="La institución aún no estaba incorporada"
      />
    );
  }
  const contribution = agreement.contributions.find((item) => item.year === year);
  return (
    <span className="per-contribution-cell">
      <strong>{contribution?.practiceStudents || 0}</strong>
      <small>estudiantes</small>
    </span>
  );
};

const ManagementAgreementPages = ({ model }: { model: ExecutiveReportModel }) => {
  const data = model.management?.data;
  if (!data?.agreements.length) return null;
  const years = model.management?.series.map((snapshot) => snapshot.year) || [];
  const visibleAgreements = visibleManagementAgreements(data.agreements);
  const pages = chunk(visibleAgreements, 10);
  return (
    <>
      {pages.map((agreements, pageIndex) => (
        <section className="per-page per-management-detail-page" key={`agreements-${pageIndex}`}>
          <PageHeader
            title="Nuevas instituciones incorporadas por esta gestión"
            label={`Gestión 2024—${model.year} · parte ${pageIndex + 1} de ${pages.length}`}
            showWordmark={false}
          />
          {pageIndex === 0 && (
            <p className="per-detail-intro">
              Incorporar cada institución requirió múltiples reuniones y el diseño y la tramitación
              de los convenios marco y específicos necesarios. La tabla muestra únicamente cuántos
              estudiantes realizaron una PPS en cada año. El total vuelve a contar a cada estudiante
              una sola vez entre años.
            </p>
          )}
          <div
            className="per-contribution-head"
            style={{
              gridTemplateColumns: `minmax(210px, 1.8fr) repeat(${years.length}, 0.8fr) 0.9fr`,
            }}
          >
            <span>Institución</span>
            {years.map((year) => (
              <span key={year}>{year}</span>
            ))}
            <span>Total</span>
          </div>
          <div className="per-contribution-list">
            {agreements.map((agreement) => (
              <article
                className="per-contribution-row"
                style={{
                  gridTemplateColumns: `minmax(210px, 1.8fr) repeat(${years.length}, 0.8fr) 0.9fr`,
                }}
                key={agreement.id}
              >
                <div className="per-contribution-identity">
                  <strong>{agreement.institution}</strong>
                  <span>
                    Desde{" "}
                    {agreement.datePrecision === "year"
                      ? agreement.signedAt.slice(0, 4)
                      : formatISODate(agreement.signedAt)}
                    {agreement.datePrecision === "year" ? " · fecha anual registrada" : ""}
                  </span>
                  {agreement.agreementCount > 1 && (
                    <span>{agreement.agreementCount} registros de convenio consolidados</span>
                  )}
                  <div className="per-orientation-tags">
                    {agreement.orientations.length ? (
                      agreement.orientations.map((orientation) => (
                        <span className={orientationClassName(orientation)} key={orientation}>
                          {ORIENTATION_LABELS[orientation] || orientation}
                        </span>
                      ))
                    ) : (
                      <span>Sin orientación atribuida</span>
                    )}
                  </div>
                </div>
                {years.map((year) => (
                  <AgreementContributionCell agreement={agreement} year={year} key={year} />
                ))}
                <span className="per-contribution-total">
                  <strong>{agreement.totalPracticeStudents}</strong>
                  <small>estudiantes distintos</small>
                </span>
              </article>
            ))}
          </div>
          <SourceFooter model={model} page={`C${pageIndex + 1}`} />
        </section>
      ))}
    </>
  );
};

const NetworkRow = ({
  institution,
  years,
}: {
  institution: ManagementNetworkInstitution;
  years: number[];
}) => (
  <article
    className="per-network-row"
    style={{
      gridTemplateColumns: `minmax(260px, 1.8fr) minmax(210px, 1.35fr) repeat(${years.length}, 0.45fr) 0.7fr`,
    }}
  >
    <div className="per-network-identity">
      <strong>{institution.institution}</strong>
      <span>Última actividad: {formatISODate(institution.lastActivity)}</span>
    </div>
    <div className="per-network-orientations">
      {institution.orientations.length
        ? institution.orientations.map((orientation) => (
            <span className={orientationClassName(orientation)} key={orientation}>
              {ORIENTATION_LABELS[orientation] || orientation}
            </span>
          ))
        : "Sin orientación atribuida"}
    </div>
    {years.map((year) => (
      <strong className="per-network-year" key={year}>
        {institution.launchesByYear[String(year)] || 0}
      </strong>
    ))}
    <strong className="per-network-total">{institution.totalLaunches}</strong>
  </article>
);

const ManagementNetworkPages = ({ model }: { model: ExecutiveReportModel }) => {
  const data = model.management?.data;
  if (!data?.recentNetwork.length) return null;
  const years = Array.from(
    new Set(data.recentNetwork.flatMap((row) => Object.keys(row.launchesByYear).map(Number)))
  ).sort((a, b) => a - b);
  const pages = chunk(data.recentNetwork, 12);
  return (
    <>
      {pages.map((institutions, pageIndex) => (
        <section className="per-page per-management-network-page" key={`network-${pageIndex}`}>
          <PageHeader
            title="Red institucional con actividad reciente"
            label={`${years.join("–")} · parte ${pageIndex + 1} de ${pages.length}`}
            showWordmark={false}
          />
          {pageIndex === 0 && (
            <div className="per-network-context">
              <p>
                Incluye instituciones y espacios con al menos una PPS lanzada durante los dos años
                calendario más recientes hasta el corte.
              </p>
            </div>
          )}
          <div
            className="per-network-head"
            style={{
              gridTemplateColumns: `minmax(260px, 1.8fr) minmax(210px, 1.35fr) repeat(${years.length}, 0.45fr) 0.7fr`,
            }}
          >
            <span>Institución / espacio</span>
            <span>Orientaciones</span>
            {years.map((year) => (
              <span key={year}>{year}</span>
            ))}
            <span>Total</span>
          </div>
          <div className="per-network-list">
            {institutions.map((institution) => (
              <NetworkRow institution={institution} years={years} key={institution.key} />
            ))}
          </div>
          <SourceFooter model={model} page={`R${pageIndex + 1}`} />
        </section>
      ))}
    </>
  );
};

const ManagementClosing = ({ model }: { model: ExecutiveReportModel }) => {
  const data = model.management?.data;
  if (!data) return null;
  const totalFixed = data.agreements.reduce((total, row) => total + row.totalFixedOffered, 0);
  const totalRealized = data.agreements.reduce((total, row) => total + row.totalRealized, 0);
  const totalCapacity = totalFixed + totalRealized;
  return (
    <section className="per-page per-management-closing">
      <PageHeader
        title="Estado al corte y documentación adjunta"
        label="Cierre ejecutivo"
        showWordmark={false}
      />
      <div className="per-closing-statement">
        <strong>Generado automáticamente por Mi Panel</strong>
        <h3>
          Este documento demuestra la capacidad de Mi Panel para producir información de gestión
          actualizada.
        </h3>
        <small>
          La fecha de corte, los indicadores, la serie anual y el detalle institucional se
          recalculan cada vez que se genera el informe.
        </small>
        <p>{model.headline}</p>
        <span>Corte reproducible: {formatISODate(model.asOfISO)}</span>
      </div>
      <div className="per-closing-band">
        <div>
          <strong>{data.institutionCount}</strong>
          <span>
            instituciones o espacios incorporados · {data.agreementCount} registros de convenio
          </span>
        </div>
        <div>
          <strong>{totalCapacity}</strong>
          <span>cupos ofrecidos acumulados desde esas instituciones</span>
        </div>
      </div>
      <div className="per-closing-columns">
        <div>
          <h3>Actualización al corte</h3>
          <p>
            Mi Panel consolida la actividad de las PPS, las trayectorias estudiantiles y la red
            institucional con la información disponible al momento de emisión.
          </p>
        </div>
        <div>
          <h3>Documento que acompaña este informe</h3>
          <p>
            Se adjunta por separado el <strong>Informe anual detallado de PPS {model.year}</strong>,
            generado en forma separada para el año del corte. Ese documento conserva el desarrollo
            operativo del año en curso y no forma parte de este rediseño.
          </p>
        </div>
      </div>
      <div className="per-final-signature">
        <div>
          <strong>{model.author.name}</strong>
          <span>{model.author.role}</span>
          <span>{model.author.unit}</span>
        </div>
        <a href={`mailto:${model.author.email}`}>{model.author.email}</a>
      </div>
      <SourceFooter model={model} page="Cierre" />
    </section>
  );
};

const TechnicalAnnex = ({ model }: { model: ExecutiveReportModel }) => (
  <section className="per-page">
    <PageHeader title="Trazabilidad y calidad" label="Anexo técnico · circulación interna" />
    <div className="per-quality-section per-quality-section-technical">
      <div className="per-quality-intro">
        <h3>Cobertura de medición</h3>
        <p>Controles internos que respaldan la lectura y quedan disponibles ante una consulta.</p>
      </div>
      <div className="per-quality-list">
        {model.qualityMetrics.map((metric) => (
          <div key={metric.id}>
            <span>{metric.label}</span>
            <strong>{formatValue(metric)}</strong>
            <p>{metric.detail}</p>
          </div>
        ))}
      </div>
    </div>
    <div className="per-method-grid">
      <div>
        <h3>Reglas de construcción</h3>
        <ol>
          {model.methodology.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
      <div>
        <h3>Límites que deben conservarse al leer</h3>
        <ul>
          {model.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
    <div className="per-data-contract">
      <span>Versión de métrica</span>
      <strong>{model.current.metricVersion}</strong>
      <span>Corte reproducible</span>
      <strong>{model.asOfISO}</strong>
      <span>Protección de datos</span>
      <strong>Sin información personal</strong>
    </div>
    <div className="per-final-signature">
      <div>
        <strong>{model.author.name}</strong>
        <span>{model.author.role}</span>
        <span>{model.author.unit}</span>
      </div>
      <a href={`mailto:${model.author.email}`}>{model.author.email}</a>
    </div>
    <SourceFooter model={model} page={model.kind === "annual" ? "05" : "04"} />
  </section>
);

const LaunchAnnex = ({ model }: { model: ExecutiveReportModel }) => {
  if (!model.launches.length) return null;
  const monthFormatter = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const orderedLaunches = [...model.launches].sort((a, b) => {
    const dateA = a.fechaInicio?.getTime() ?? Number.POSITIVE_INFINITY;
    const dateB = b.fechaInicio?.getTime() ?? Number.POSITIVE_INFINITY;
    return dateA - dateB || a.nombre.localeCompare(b.nombre, "es");
  });
  const grouped = orderedLaunches.reduce<
    Array<{ key: string; label: string; launches: typeof model.launches }>
  >((months, launch) => {
    const key = launch.fechaInicio
      ? `${launch.fechaInicio.getUTCFullYear()}-${String(launch.fechaInicio.getUTCMonth() + 1).padStart(2, "0")}`
      : "sin-fecha";
    const current = months.at(-1);
    if (!current || current.key !== key) {
      const rawLabel = launch.fechaInicio ? monthFormatter.format(launch.fechaInicio) : "Sin fecha";
      months.push({
        key,
        label: `${rawLabel.charAt(0).toUpperCase()}${rawLabel.slice(1)}`,
        launches: [launch],
      });
    } else {
      current.launches.push(launch);
    }
    return months;
  }, []);
  return (
    <section className="per-page per-annex">
      <PageHeader title="Anexo de ofertas" label={`Detalle documentado · ${model.year}`} />
      <p className="per-annex-intro">
        Ofertas ordenadas por mes. “Participantes registrados” identifica las propuestas sin cupo
        prefijado, donde el total corresponde a quienes efectivamente se incorporaron.
      </p>
      <div className="per-months">
        {grouped.map((month) => {
          const capacity = month.launches.reduce(
            (total, launch) => total + launch.capacidadOperativa,
            0
          );
          return (
            <section className="per-month-block" key={month.key}>
              <header>
                <span>{month.label}</span>
                <p>
                  <strong>{month.launches.length}</strong>{" "}
                  {month.launches.length === 1 ? "oferta" : "ofertas"}
                  <i />
                  <strong>{capacity}</strong> lugares registrados
                </p>
              </header>
              <div className="per-offer-list">
                {month.launches.map((launch) => (
                  <article className="per-offer-row" key={launch.id}>
                    <div className="per-offer-main">
                      <strong>{launch.nombre}</strong>
                      <span className={orientationClassName(launch.orient)}>
                        {ORIENTATION_LABELS[launch.orient] || launch.orient}
                      </span>
                    </div>
                    <time>
                      {launch.fechaInicio
                        ? new Intl.DateTimeFormat("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            timeZone: "UTC",
                          }).format(launch.fechaInicio)
                        : "—"}
                    </time>
                    <div className="per-offer-capacity">
                      <strong>
                        {launch.modalidadCupo === "desconocido"
                          ? "—"
                          : integerFormatter.format(launch.capacidadOperativa)}
                      </strong>
                      {launch.modalidadCupo === "realizado" && (
                        <span>participantes registrados · sin cupo prefijado</span>
                      )}
                      {launch.modalidadCupo === "desconocido" && (
                        <span>sin cupo prefijado documentado</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <SourceFooter model={model} page="A1" />
    </section>
  );
};

export const ProfessionalExecutiveReport = ({
  model,
  includeTechnicalAnnex = false,
}: {
  model: ExecutiveReportModel;
  includeTechnicalAnnex?: boolean;
}) => (
  <article className="per-report" aria-label={model.title}>
    {model.kind === "annual" ? <AnnualCover model={model} /> : <ManagementCover model={model} />}
    <ExecutiveReading model={model} />
    {model.kind === "annual" ? (
      <>
        <AnnualEvidence model={model} />
        <OutcomesAndInstitutions model={model} />
      </>
    ) : (
      <>
        <ManagementAnnualSummary model={model} />
        <ManagementTimeline model={model} />
        <ManagementAgreementPages model={model} />
        <ManagementNetworkPages model={model} />
        <ManagementClosing model={model} />
      </>
    )}
    {includeTechnicalAnnex && <TechnicalAnnex model={model} />}
    {model.kind === "annual" && <LaunchAnnex model={model} />}
  </article>
);

const ORIENTATION_LABELS: Record<string, string> = {
  clinica: "Clínica",
  educacional: "Educacional",
  laboral: "Laboral",
  juridica: "Jurídica",
  comunitaria: "Comunitaria",
  investigacion: "Investigación",
  sindefinir: "Sin clasificar",
};
