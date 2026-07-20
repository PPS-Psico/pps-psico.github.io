import type { ReportLaunch } from "../../hooks/useMetricsExtras";
import type {
  AnalyticsSnapshot,
  ExecutiveReportModel,
  ExecutiveReportModelInput,
  OrientationSummary,
  ReportDelta,
  ReportMetric,
} from "./executiveReport.types";

const AUTHOR = {
  name: "Blas Rivera",
  role: "Coordinador General",
  unit: "Psicología · Sede Comahue",
  email: "blas.rivera@uflouniversidad.edu.ar",
} as const;

const ORIENTATION_LABELS: Record<string, string> = {
  clinica: "Clínica",
  educacional: "Educacional",
  laboral: "Laboral",
  juridica: "Jurídica",
  comunitaria: "Comunitaria",
  investigacion: "Investigación",
  sindefinir: "Sin clasificar",
};

const roundOne = (value: number): number => Math.round(value * 10) / 10;

export const buildDelta = (
  current: number,
  previous: number,
  comparable: boolean,
  reason?: string
): ReportDelta => ({
  current,
  previous,
  absolute: current - previous,
  percent: comparable && previous !== 0 ? roundOne(((current - previous) / previous) * 100) : null,
  comparable,
  reason,
});

const isFullYear = (snapshot: AnalyticsSnapshot): boolean => snapshot.cutoffISO.endsWith("-12-31");

const periodLabel = (snapshot: AnalyticsSnapshot): string => {
  if (isFullYear(snapshot)) return `Ciclo completo ${snapshot.year}`;
  const date = new Date(`${snapshot.cutoffISO}T12:00:00Z`);
  return `Acumulado al ${new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)}`;
};

const comparisonReference = (current: AnalyticsSnapshot, previous: AnalyticsSnapshot): string => {
  if (isFullYear(current) && isFullYear(previous)) return `vs. cierre ${previous.year}`;
  const cutoff = new Date(`${previous.cutoffISO}T12:00:00Z`);
  const date = `${String(cutoff.getUTCDate()).padStart(2, "0")}/${String(
    cutoff.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  return `vs. ${previous.year} al ${date}`;
};

const contextualizeDelta = (
  delta: ReportDelta,
  current: AnalyticsSnapshot,
  previous: AnalyticsSnapshot
): ReportDelta => ({
  ...delta,
  referenceLabel: comparisonReference(current, previous),
});

const isReviewedHistoricalSnapshot = (snapshot: AnalyticsSnapshot): boolean =>
  snapshot.year === 2024 &&
  snapshot.capacity.source === "historical_documented_offers" &&
  snapshot.quality.historicalReconstructionReviewed === true &&
  snapshot.quality.historicalReconstructionMappedPct === 100;

const usesVerifiedHistoricalBridge = (
  current: AnalyticsSnapshot,
  previous: AnalyticsSnapshot
): boolean =>
  current.year === previous.year + 1 &&
  current.capacity.source === "operational_launches" &&
  isReviewedHistoricalSnapshot(previous);

const hasAlignedPeriod = (current: AnalyticsSnapshot, previous: AnalyticsSnapshot): boolean =>
  isFullYear(current) === isFullYear(previous);

const comparisonContext = (
  current: AnalyticsSnapshot,
  previous: AnalyticsSnapshot | null
): string | null => {
  if (!previous || !usesVerifiedHistoricalBridge(current, previous)) return null;
  return `Para capacidad, la base ${previous.year} son ${previous.capacity.operational} vacantes finitas documentadas; sus ${previous.capacity.unknownOrRealizedOffers} ofertas sin cupo prefijado no tienen un total numérico y se informan aparte.`;
};

const capacityComparison = (
  current: AnalyticsSnapshot,
  previous: AnalyticsSnapshot | null
): ReportDelta | undefined => {
  if (!previous) return undefined;
  const homogeneousDefinition =
    current.capacity.comparable &&
    previous.capacity.comparable &&
    current.capacity.source === previous.capacity.source &&
    current.capacity.dateBasis === previous.capacity.dateBasis;
  const comparable =
    hasAlignedPeriod(current, previous) &&
    (homogeneousDefinition || usesVerifiedHistoricalBridge(current, previous));
  return contextualizeDelta(
    buildDelta(
      current.capacity.operational,
      previous.capacity.operational,
      comparable,
      comparable
        ? undefined
        : "No se publica variación: la definición o la fuente de capacidad no es homogénea."
    ),
    current,
    previous
  );
};

const offerComparison = (
  current: AnalyticsSnapshot,
  previous: AnalyticsSnapshot | null
): ReportDelta | undefined => {
  if (!previous) return undefined;
  const homogeneousDefinition =
    current.capacity.comparable &&
    previous.capacity.comparable &&
    current.capacity.source === previous.capacity.source &&
    current.capacity.dateBasis === previous.capacity.dateBasis;
  const comparable =
    hasAlignedPeriod(current, previous) &&
    (homogeneousDefinition || usesVerifiedHistoricalBridge(current, previous));
  return contextualizeDelta(
    buildDelta(
      current.capacity.launches,
      previous.capacity.launches,
      comparable,
      comparable
        ? undefined
        : "No se publica variación: la fuente o la base temporal de las ofertas no es homogénea."
    ),
    current,
    previous
  );
};

const flowDelta = (
  current: number,
  previous: number | undefined,
  sameCutoff: boolean,
  currentSnapshot: AnalyticsSnapshot,
  previousSnapshot: AnalyticsSnapshot
): ReportDelta | undefined => {
  if (previous == null) return undefined;
  return contextualizeDelta(
    buildDelta(
      current,
      previous,
      sameCutoff,
      sameCutoff
        ? undefined
        : "Los períodos no comparten un corte y una base histórica comparables."
    ),
    currentSnapshot,
    previousSnapshot
  );
};

const summarizeOrientations = (launches: ReportLaunch[]): OrientationSummary[] => {
  const totals = new Map<string, { launches: number; capacity: number }>();
  launches.forEach((launch) => {
    const key = launch.orient || "sindefinir";
    const current = totals.get(key) || { launches: 0, capacity: 0 };
    current.launches += 1;
    current.capacity += launch.capacidadOperativa;
    totals.set(key, current);
  });
  const totalCapacity = Array.from(totals.values()).reduce((sum, item) => sum + item.capacity, 0);
  return Array.from(totals.entries())
    .map(([key, value]) => ({
      key,
      label: ORIENTATION_LABELS[key] || key,
      launches: value.launches,
      capacity: value.capacity,
      sharePct: totalCapacity ? roundOne((value.capacity / totalCapacity) * 100) : null,
    }))
    .sort((a, b) => b.capacity - a.capacity || b.launches - a.launches);
};

const realizedCapacityContext = (launches: ReportLaunch[]): string | null => {
  const providers = Array.from(
    new Set(
      launches
        .filter((launch) => launch.modalidadCupo === "realizado")
        .map((launch) => {
          const normalized = launch.nombre.toLocaleLowerCase("es");
          if (normalized.includes("tiempo")) return "Fundación Tiempo";
          if (normalized.includes("ulloa")) return "Institución Fernando Ulloa";
          return launch.nombre.trim();
        })
        .filter(Boolean)
    )
  );
  if (!providers.length) return null;

  const providerList = new Intl.ListFormat("es-AR", {
    style: "long",
    type: "conjunction",
  }).format(providers);
  const coordinatedProviders = new Set(["Fundación Tiempo", "Institución Fernando Ulloa"]);
  const coordinatedByThisUnit =
    providers.length === 2 && providers.every((provider) => coordinatedProviders.has(provider));

  return `Los participantes de ofertas sin límite prefijado corresponden a ${providerList}.${
    coordinatedByThisUnit ? " Ambos convenios fueron gestionados por esta Coordinación." : ""
  }`;
};

const annualHeadline = (snapshot: AnalyticsSnapshot): string => {
  if (
    snapshot.year === 2024 &&
    snapshot.capacity.launches === 42 &&
    snapshot.capacity.documentedFiniteOffers === 36 &&
    snapshot.capacity.operational === 270
  ) {
    return "El ciclo 2024 cerró con 42 ofertas: 36 de cupo finito que totalizan 270 vacantes documentadas y 6 ofertas sin cupo finito.";
  }
  return `${snapshot.capacity.launches} ofertas reunieron ${snapshot.capacity.operational} lugares registrados y ${snapshot.flows.ppsStarted} estudiantes iniciaron una PPS.`;
};

const primaryMetrics = (
  current: AnalyticsSnapshot,
  previous: AnalyticsSnapshot | null
): ReportMetric[] => {
  const sameCutoff = previous ? isFullYear(current) === isFullYear(previous) : false;
  const flowsComparable = Boolean(previous && sameCutoff && previous.year >= 2024);
  return [
    {
      id: "offers",
      label: "Ofertas de PPS",
      value: current.capacity.launches,
      deltaUnit: "ofertas",
      detail:
        current.capacity.source === "historical_documented_offers"
          ? "Ofertas reconstruidas y verificadas en evidencia documental."
          : "Lanzamientos con fecha de inicio dentro del período.",
      delta: offerComparison(current, previous),
      status: current.capacity.complete ? "verified" : "partial",
    },
    {
      id: "capacity",
      label: current.year === 2024 ? "Vacantes documentadas" : "Capacidad registrada",
      value: current.capacity.operational,
      deltaUnit: "lugares",
      detail:
        current.year === 2024
          ? `${current.capacity.documentedFiniteOffers ?? 0} ofertas finitas; ${current.capacity.unknownOrRealizedOffers} sin cupo finito.`
          : `${current.capacity.fixedOffered} cupos publicados + ${current.capacity.realized} participantes incorporados en ofertas sin límite prefijado.`,
      delta: capacityComparison(current, previous),
      status: current.capacity.complete ? "verified" : "partial",
    },
    {
      id: "started",
      label: "Estudiantes que iniciaron",
      value: current.flows.ppsStarted,
      deltaUnit: "estudiantes",
      detail: "Personas distintas con al menos una PPS iniciada en el período.",
      delta: previous
        ? flowDelta(
            current.flows.ppsStarted,
            previous.flows.ppsStarted,
            flowsComparable,
            current,
            previous
          )
        : undefined,
      status: "verified",
    },
    {
      id: "finalized",
      label: "Finalizaciones registradas",
      value: current.flows.finalized,
      deltaUnit: "finalizaciones",
      detail: "Estudiantes con finalización efectiva registrada dentro del período.",
      delta: previous
        ? flowDelta(
            current.flows.finalized,
            previous.flows.finalized,
            flowsComparable,
            current,
            previous
          )
        : undefined,
      status: "verified",
    },
  ];
};

const demandMetrics = (
  current: AnalyticsSnapshot,
  previous: AnalyticsSnapshot | null
): ReportMetric[] => {
  const demandComparable = Boolean(
    previous &&
    current.flows.demandAvailable &&
    previous.flows.demandAvailable &&
    isFullYear(current) === isFullYear(previous)
  );
  return [
    {
      id: "applications",
      label: "Postulaciones",
      value: current.flows.applications,
      deltaUnit: "postulaciones",
      detail: current.flows.demandAvailable
        ? "Inscripciones registradas a convocatorias del período."
        : "La migración histórica no conserva demanda completa.",
      delta:
        previous && current.flows.applications != null && previous.flows.applications != null
          ? contextualizeDelta(
              buildDelta(
                current.flows.applications,
                previous.flows.applications,
                demandComparable,
                demandComparable ? undefined : "Demanda no comparable entre ambos ciclos."
              ),
              current,
              previous
            )
          : undefined,
      status: current.flows.demandAvailable ? "verified" : "not-available",
    },
    {
      id: "applicants",
      label: "Estudiantes postulados",
      value: current.flows.applicants,
      deltaUnit: "estudiantes",
      detail: current.flows.demandAvailable
        ? "Personas distintas que realizaron al menos una postulación."
        : "Indicador no reconstruible con evidencia suficiente.",
      delta:
        previous && current.flows.applicants != null && previous.flows.applicants != null
          ? contextualizeDelta(
              buildDelta(
                current.flows.applicants,
                previous.flows.applicants,
                demandComparable,
                demandComparable ? undefined : "Demanda no comparable entre ambos ciclos."
              ),
              current,
              previous
            )
          : undefined,
      status: current.flows.demandAvailable ? "verified" : "not-available",
    },
  ];
};

const qualityMetrics = (snapshot: AnalyticsSnapshot): ReportMetric[] => [
  {
    id: "practice-link",
    label: "Prácticas vinculadas a lanzamiento",
    value: snapshot.quality.practiceLaunchLinkCoveragePct,
    unit: "%",
    detail: "Cobertura del vínculo que permite atribuir cada práctica a su oferta.",
    status:
      snapshot.quality.practiceLaunchLinkCoveragePct == null
        ? "not-available"
        : snapshot.quality.practiceLaunchLinkCoveragePct >= 95
          ? "verified"
          : "partial",
  },
  {
    id: "institution-link",
    label: "Ofertas vinculadas a institución",
    value: snapshot.quality.launchInstitutionLinkCoveragePct,
    unit: "%",
    detail: "Cobertura del vínculo necesario para análisis institucional.",
    status:
      snapshot.quality.launchInstitutionLinkCoveragePct == null
        ? "not-available"
        : snapshot.quality.launchInstitutionLinkCoveragePct >= 95
          ? "verified"
          : "partial",
  },
  {
    id: "selected-at",
    label: "Selecciones con fecha trazable",
    value: snapshot.quality.selectedAtCoveragePct,
    unit: "%",
    detail: `${snapshot.quality.selectedAtN} de ${snapshot.quality.selectedTotalN} selecciones conservan una marca temporal trazable.`,
    status: snapshot.quality.selectedAtCoveragePct == null ? "not-available" : "experimental",
  },
];

export const buildExecutiveReportModel = (
  input: ExecutiveReportModelInput
): ExecutiveReportModel => {
  const generatedAt = input.generatedAt || new Date();
  const { selected, previous } = input;
  const managementSeries = [...(input.managementSeries || [])].sort((a, b) => a.year - b.year);
  const kind = input.kind;
  const annual = kind === "annual";
  const headline = annual
    ? annualHeadline(selected)
    : "Desde el inicio de la gestión se consolidó una medición versionada, trazable y apta para rendición institucional.";

  const executiveSummary = annual
    ? [
        annualHeadline(selected),
        selected.flows.demandAvailable
          ? `La demanda registrada alcanzó ${selected.flows.applications} postulaciones de ${selected.flows.applicants} estudiantes.`
          : "La demanda no se publica para este ciclo porque la migración histórica no conserva un registro completo.",
        selected.year === 2024
          ? "El cierre 2024 se presenta como resultado oficial documentado; la migración no conserva una demanda completa para reconstruir comparaciones anteriores."
          : input.selectionEffort?.primerIntentoPct != null
            ? `${input.selectionEffort.primerIntentoPct}% de quienes tuvieron su primera selección en el ciclo accedió en su primera postulación.`
            : "La oferta y sus resultados se presentan con el mismo corte temporal que el ciclo anterior.",
      ]
    : [
        "La serie integra el cierre documentado de 2024 y los registros operativos posteriores bajo el contrato analytics-v2.",
        "El 1 de septiembre de 2024 se utiliza como hito de inicio de gestión y el 31 de agosto como línea de base temporal.",
        "Las variaciones se presentan como evidencia de evolución del programa; no se atribuyen causalmente a una única intervención.",
      ];

  const outcomeMetrics: ReportMetric[] = [
    {
      id: "trajectory",
      label: "Mediana hasta finalizar",
      value: input.trajectory?.medianaMeses ?? null,
      unit: "meses",
      detail: input.trajectory?.n
        ? `Calculada sobre ${input.trajectory.n} de ${input.trajectory.totalFinalizados} finalizaciones.`
        : "Sin base suficiente para calcular la trayectoria del ciclo.",
      status: input.trajectory?.medianaMeses == null ? "not-available" : "verified",
    },
    ...(input.selectionEffort?.primerIntentoPct != null
      ? [
          {
            id: "first-selection-effort",
            label: "Acceso en primera postulación",
            value: input.selectionEffort.primerIntentoPct,
            unit: "%",
            detail: `${input.selectionEffort.primerIntentoN} de ${input.selectionEffort.cohorteN} estudiantes. Mediana: ${input.selectionEffort.medianaPostulaciones} postulación${input.selectionEffort.medianaPostulaciones === 1 ? "" : "es"}; 75% accedió en hasta ${input.selectionEffort.p75Postulaciones}.`,
            status: "verified" as const,
          },
        ]
      : []),
    {
      id: "new-agreements",
      label: "Convenios nuevos",
      value: input.agreements?.length ?? 0,
      detail: "Instituciones con alta de convenio registrada en el año.",
      status: "verified",
    },
  ];

  const limitations = [
    "Los stocks actuales de estudiantes no se reconstruyen hacia atrás sin snapshots históricos; por eso no se comparan como si fueran flujos anuales.",
    "Las variaciones porcentuales de capacidad sólo se muestran si fuente, base temporal y definición son homogéneas.",
    selected.flows.demandAvailable
      ? "La demanda corresponde a registros de convocatorias vinculadas al período."
      : "La demanda histórica del ciclo no está disponible con cobertura suficiente y se identifica expresamente como no disponible.",
    "El reporte no incluye nombres, legajos ni otros datos personales de estudiantes.",
  ];

  return {
    kind,
    generatedAtISO: generatedAt.toISOString(),
    asOfISO: selected.cutoffISO,
    year: selected.year,
    previousYear: previous?.year ?? null,
    title: annual ? `Informe anual de PPS · ${selected.year}` : "Informe de gestión de PPS",
    subtitle: annual
      ? "Estado de situación, acceso y resultados"
      : `Período 2024–${selected.year} · inicio de gestión 1 de septiembre de 2024`,
    periodLabel: periodLabel(selected),
    headline,
    executiveSummary,
    author: AUTHOR,
    primaryMetrics: primaryMetrics(selected, previous),
    demandMetrics: demandMetrics(selected, previous),
    outcomeMetrics,
    qualityMetrics: qualityMetrics(selected),
    orientations: summarizeOrientations(input.launches || []),
    realizedCapacityContext: realizedCapacityContext(input.launches || []),
    launches: input.launches || [],
    agreements: input.agreements || [],
    trajectory: input.trajectory || null,
    selectionEffort: input.selectionEffort || null,
    current: selected,
    previous,
    comparisonContext: comparisonContext(selected, previous),
    management: annual
      ? null
      : {
          startISO: "2024-09-01",
          baseline: input.managementBaseline || null,
          series: managementSeries,
          caveat:
            "El corte de llegada permite ordenar la evidencia en el tiempo, pero no demuestra por sí solo causalidad.",
        },
    methodology: [
      `Contrato de datos: ${selected.metricVersion}.`,
      `Corte del informe: ${selected.cutoffISO}.`,
      selected.capacity.dateBasis === "announcement_at"
        ? "La oferta histórica se asigna por fecha documentada de anuncio."
        : "La oferta operativa se asigna por fecha de inicio del lanzamiento.",
      "Capacidad registrada = cupos publicados en ofertas con límite prefijado + participantes incorporados en ofertas sin límite prefijado.",
      "Los conteos de estudiantes se deduplican por persona dentro de cada indicador.",
    ],
    limitations,
  };
};

export const containsPersonalStudentData = (model: ExecutiveReportModel): boolean => {
  const serialized = JSON.stringify(model).toLocaleLowerCase("es");
  return ["legajo", "estudiante_id", "documento", "dni"].some((token) =>
    serialized.includes(`\"${token}\"`)
  );
};
