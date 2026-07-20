import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/source-serif-4/latin-600.css";
import "@fontsource/source-serif-4/latin-700.css";
import "./professionalExecutiveReport.css";
import type { ExecutiveReportModel, ReportDelta, ReportMetric } from "./executiveReport.types";

const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

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

const PageHeader = ({ title, label }: { title: string; label: string }) => (
  <header className="per-page-header">
    <div>
      <span>{label}</span>
      <h2>{title}</h2>
    </div>
    <Wordmark />
  </header>
);

const SourceFooter = ({ model, page }: { model: ExecutiveReportModel; page: string }) => (
  <footer className="per-page-footer">
    <span>Fuente: Mi Panel Académico · {model.current.metricVersion}</span>
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
    <PageHeader title="Lectura ejecutiva" label="Síntesis del período" />
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
      <PageHeader title="Evolución de la gestión" label="Serie 2024 hasta la actualidad" />
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
      <ManagementTimeline model={model} />
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
