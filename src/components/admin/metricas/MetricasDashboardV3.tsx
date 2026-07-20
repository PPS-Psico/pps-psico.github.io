// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · Dashboard (Paper & Ink · vista ejecutiva)
//
// Orquesta resultados de analytics-v2, seguimiento de director-report-v1 y lecturas extra de
// Supabase (embudo, top instituciones, serie de finalizados, actividad de
// Hermes). Hermes NO narra: aparece solo como FUENTE de una métrica dura.
// ──────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState, useCallback } from "react";
import type { MetricsKPIs } from "../../../hooks/useMetricsData";
import {
  useMetricsDinamica,
  useMetricsTopInstituciones,
  useHermesActivity,
  useMetricsHeredados,
} from "../../../hooks/useMetricsExtras";
import type { TopInstitucion } from "../../../hooks/useMetricsExtras";
import { useQuery } from "@tanstack/react-query";
import { fetchMetricList, fetchOrientationList } from "../../../services/metricsLists";
import { fetchConveniosKpis } from "../../../services/conveniosService";
import { buildExecutiveReportModel } from "../../../features/executive-report/executiveReport.model";
import { HeroMetric, KpiCard, Band, fmt } from "./MetricasPrimitives";
import {
  DinamicaCicloBand,
  BarChart,
  TrendLine,
  Distribution,
  TopInstituciones,
} from "./MetricasCharts";
import { DrillModal } from "./DrillModal";
import type { DrillState, DrillRow } from "./DrillModal";

const seriesToSpark = (series: { year: string | number; value: number }[], years: number[]) =>
  years.map((y) => {
    const hit = series.find((s) => Number(s.year) === y);
    return hit ? hit.value : 0;
  });

interface Props {
  year: number;
  metrics: MetricsKPIs;
  onStudentSelect?: (s: { legajo: string; nombre: string }) => void;
  isTestingMode?: boolean;
  onModalChange?: (open: boolean) => void;
}

export function MetricasDashboardV3({
  year,
  metrics,
  onStudentSelect,
  isTestingMode = false,
  onModalChange,
}: Props) {
  const [drill, setDrill] = useState<DrillState | null>(null);

  const { data: dinamica } = useMetricsDinamica({
    year,
    isTestingMode,
  });
  const { data: topInst = [], isFetched: topInstFetched } = useMetricsTopInstituciones({
    year,
    isTestingMode,
  });
  const { data: hermes } = useHermesActivity({ year, isTestingMode });
  const { data: heredados = 0 } = useMetricsHeredados({ year, isTestingMode });
  const { data: conveniosKpis } = useQuery({
    queryKey: ["conveniosKpis", year, isTestingMode],
    queryFn: () => fetchConveniosKpis(year),
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 2,
  });
  const renovaciones = conveniosKpis?.renovaciones ?? 0;
  const conveniosPorVencer = conveniosKpis?.convenios_por_vencer ?? 0;
  const annualModel = useMemo(
    () =>
      metrics.analytics_snapshot
        ? buildExecutiveReportModel({
            kind: "annual",
            selected: metrics.analytics_snapshot,
            previous: metrics.comparison_snapshot,
          })
        : null,
    [metrics.analytics_snapshot, metrics.comparison_snapshot]
  );
  const operational = metrics.operational_snapshot;
  const directorLoading = false;
  const directorError = operational ? null : new Error("Sin foto operativa disponible");
  const annualMetrics = useMemo(
    () => new Map((annualModel?.primaryMetrics || []).map((metric) => [metric.id, metric])),
    [annualModel]
  );

  const sparkYears = useMemo(() => {
    const ys = new Set<number>();
    metrics.enrollment_evolution?.forEach((e) => ys.add(Number(e.year)));
    metrics.finalization_evolution?.forEach((e) => ys.add(Number(e.year)));
    ys.add(year);
    return Array.from(ys)
      .filter((y) => !Number.isNaN(y))
      .sort((a, b) => a - b);
  }, [metrics, year]);

  const sparks = useMemo(
    () => ({
      // enrollment_evolution usa analytics-v2: inicios de PPS al mismo corte.
      enPps: seriesToSpark(metrics.enrollment_evolution || [], sparkYears),
      finalizados: seriesToSpark(metrics.finalization_evolution || [], sparkYears),
    }),
    [metrics, sparkYears]
  );

  const openDrill = useCallback(
    (next: DrillState | null) => {
      setDrill(next);
      onModalChange?.(!!next);
    },
    [onModalChange]
  );

  const closeDrill = useCallback(() => openDrill(null), [openDrill]);

  const onRowClick = useCallback(
    (row: DrillRow) => {
      if (row.legajo && onStudentSelect) {
        onStudentSelect({ legajo: String(row.legajo), nombre: row.nombre });
        closeDrill();
      }
    },
    [onStudentSelect, closeDrill]
  );

  // Drill por KPI: usa fetchMetricList (RPCs de listas reales).
  const drillKpi = useCallback(
    async (key: string, title: string, subtitle: string, kind: "student" | "inst" = "student") => {
      openDrill({ title, subtitle, rows: [], kind, loading: true, onRowClick });
      try {
        const res = await fetchMetricList(key, year);
        const rows: DrillRow[] = res.students.map((s) => {
          const horas =
            (s as Record<string, unknown>).horas ?? (s as Record<string, unknown>).correo;
          return {
            ...s,
            horas:
              typeof horas === "string" && horas.includes("hs")
                ? horas
                : ((s as Record<string, unknown>).horas as number),
          };
        });
        openDrill({
          title,
          subtitle,
          rows,
          kind,
          loading: false,
          onRowClick: kind === "student" ? onRowClick : undefined,
        });
      } catch {
        openDrill({ title, subtitle, rows: [], kind, loading: false });
      }
    },
    [year, openDrill, onRowClick]
  );

  const drillArea = useCallback(
    async (area: string) => {
      const total = metrics.orientation_distribution[area] || 0;
      const title = `Orientación · ${area}`;
      const subtitle = `${total} alumnos en ${year}`;
      openDrill({ title, subtitle, rows: [], kind: "student", loading: true, onRowClick });
      try {
        const res = await fetchOrientationList(year, area);
        openDrill({
          title,
          subtitle,
          rows: res.students as DrillRow[],
          kind: "student",
          loading: false,
          onRowClick,
        });
      } catch {
        openDrill({ title, subtitle, rows: [], kind: "student", loading: false });
      }
    },
    [metrics, year, openDrill, onRowClick]
  );

  const drillInst = useCallback(
    (r: TopInstitucion) => {
      const historicalCapacity = metrics.capacity_source === "historical_documented_offers";
      openDrill({
        title: r.nombre,
        subtitle: historicalCapacity
          ? `${r.ofrecidos} vacantes finitas documentadas en ${year}`
          : `${r.ocupados} estudiantes en PPS en ${year}`,
        rows: r.list as DrillRow[],
        kind: "student",
        loading: false,
        onRowClick,
      });
    },
    [metrics.capacity_source, year, openDrill, onRowClick]
  );

  // — Evolución de inicios reales de PPS al mismo corte temporal —
  const enrollmentData = useMemo(
    () =>
      (metrics.enrollment_evolution || []).map((e) => ({
        ...e,
        isProjection: false,
      })),
    [metrics]
  );

  const hermesTotal = hermes?.total ?? 0;
  const usesHistoricalOfferSource = metrics.capacity_source === "historical_documented_offers";
  const capacityCoverage = metrics.capacity_finite_offer_coverage_pct;
  const capacityContext = usesHistoricalOfferSource
    ? `${metrics.capacity_documented_finite_offers ?? 0}/${metrics.pps_lanzadas} ofertas con cupo finito${capacityCoverage == null ? "" : ` (${capacityCoverage}%)`}; ${metrics.capacity_unknown_or_realized_offers} sin total finito`
    : "Cupos fijos + participación realizada";
  const primaryMetric = (id: string) => annualMetrics.get(id);
  const metricTrend = (id: string) => {
    const delta = primaryMetric(id)?.delta;
    return delta?.comparable ? delta.percent : null;
  };
  const metricPrevious = (id: string) => {
    const delta = primaryMetric(id)?.delta;
    return delta?.comparable ? delta.previous : null;
  };
  const comparisonLabel =
    annualModel?.primaryMetrics.find((metric) => metric.delta?.comparable)?.delta?.referenceLabel ??
    null;

  const openOperationalList = (title: string, subtitle: string, rows: DrillRow[]) =>
    openDrill({ title, subtitle, rows, kind: "student", loading: false, onRowClick });

  return (
    <>
      {/* Los cuatro resultados coinciden uno a uno con el informe profesional. */}
      <Band cols={4}>
        <HeroMetric
          value={primaryMetric("offers")?.value ?? metrics.pps_lanzadas}
          label={primaryMetric("offers")?.label ?? "Ofertas de PPS"}
          context={primaryMetric("offers")?.detail ?? "Ofertas registradas en el período"}
          tone="ink"
          trend={metricTrend("offers")}
          prevYear={metricPrevious("offers")}
          comparisonLabel={comparisonLabel}
          activeYear={year}
          years={sparkYears}
          onClick={() =>
            drillKpi(
              "pps_lanzadas",
              primaryMetric("offers")?.label ?? "Ofertas de PPS",
              `${metrics.pps_lanzadas} ofertas registradas en ${year}`,
              "inst"
            )
          }
        />
        <HeroMetric
          value={primaryMetric("capacity")?.value ?? metrics.cupos_ofrecidos}
          label={primaryMetric("capacity")?.label ?? "Capacidad registrada"}
          context={primaryMetric("capacity")?.detail ?? capacityContext}
          tone="accent"
          trend={metricTrend("capacity")}
          prevYear={metricPrevious("capacity")}
          comparisonLabel={comparisonLabel}
          activeYear={year}
          years={sparkYears}
          onClick={() =>
            drillKpi(
              "cupos_ofrecidos",
              primaryMetric("capacity")?.label ?? "Capacidad registrada",
              `${metrics.cupos_ofrecidos} lugares registrados en ${year}`,
              "inst"
            )
          }
        />
        <HeroMetric
          value={primaryMetric("started")?.value ?? metrics.estudiantes_en_pps}
          label={primaryMetric("started")?.label ?? "Estudiantes que iniciaron"}
          context={primaryMetric("started")?.detail ?? "Personas con una PPS iniciada"}
          tone="ok"
          trend={metricTrend("started")}
          prevYear={metricPrevious("started")}
          comparisonLabel={comparisonLabel}
          spark={sparks.enPps}
          activeYear={year}
          years={sparkYears}
          onClick={() =>
            drillKpi(
              "estudiantes_en_pps",
              "Estudiantes que iniciaron PPS",
              `${metrics.estudiantes_en_pps} con inicio efectivo de PPS en ${year}`
            )
          }
        />
        <HeroMetric
          value={primaryMetric("finalized")?.value ?? metrics.alumnos_finalizados}
          label={primaryMetric("finalized")?.label ?? "Finalizaciones registradas"}
          context={primaryMetric("finalized")?.detail ?? "Finalizaciones efectivas del período"}
          tone="ok"
          trend={metricTrend("finalized")}
          prevYear={metricPrevious("finalized")}
          comparisonLabel={comparisonLabel}
          spark={sparks.finalizados}
          activeYear={year}
          years={sparkYears}
          onClick={() =>
            drillKpi(
              "alumnos_finalizados",
              "Alumnos finalizados",
              `${metrics.alumnos_finalizados} acreditados en ${year}`
            )
          }
        />
      </Band>

      {comparisonLabel && (
        <div className="metric-comparison-note">
          <span className="material-icons" aria-hidden="true">
            compare_arrows
          </span>
          Las variaciones comparan el mismo período: {comparisonLabel.replace("vs. ", "")}.
        </div>
      )}

      {/* Foto operativa: misma cohorte nominal que recibe Agostina. */}
      <Band title="Seguimiento operativo actual" cols={4} top>
        <KpiCard
          value={operational?.studentSummary.withoutPps ?? 0}
          label="Sin PPS · demanda activa"
          context={`Sin prácticas y con postulaciones en ${year}`}
          tone="warn"
          loading={directorLoading}
          onClick={() =>
            openOperationalList(
              "Sin PPS · demanda activa",
              "Estudiantes actuales sin prácticas que se postularon durante el ciclo seleccionado",
              (operational?.withoutPpsStudents || []).map((student) => ({
                nombre: student.fullName,
                legajo: student.legajo || "—",
                horas: `${student.applicationCount} postulaciones`,
                detalle: `${student.pendingApplications} postulaciones pendientes`,
              }))
            )
          }
        />
        <KpiCard
          value={operational?.studentSummary.nearCompletion ?? 0}
          label="Próximos a finalizar"
          context={
            directorError
              ? "No se pudo calcular la cohorte actual"
              : `${operational?.studentSummary.nearByReason.total_hours_230_249 ?? 0} por horas · ${operational?.studentSummary.nearByReason.missing_one_orientation ?? 0} por orientación · ${operational?.studentSummary.nearByReason.specialty_gap_20_or_less ?? 0} por especialidad`
          }
          tone="accent"
          loading={directorLoading}
          onClick={() =>
            openOperationalList(
              "Próximos a finalizar · PPS de entrevistas",
              "Cumplen uno de los tres criterios y no realizaron Relevamiento ni Entrevista a Profesionales",
              (operational?.nearCompletionStudents || []).map((student) => ({
                nombre: student.fullName,
                legajo: student.legajo || "—",
                horas: `${student.totalHours} h`,
                detalle: student.reasonLabel,
              }))
            )
          }
        />
        <KpiCard
          value={operational?.studentSummary.readyToRequest ?? 0}
          label="Listos para solicitar"
          context="Completaron horas, especialidad y tres orientaciones"
          tone="ok"
          loading={directorLoading}
          onClick={() =>
            openOperationalList(
              "Listos para solicitar acreditación",
              "Cumplen los tres requisitos y todavía no iniciaron el trámite",
              (operational?.readyToRequestStudents || []).map((student) => ({
                nombre: student.fullName,
                legajo: student.legajo || "—",
                horas: `${student.totalHours} h`,
                detalle: `${student.specialtyHours} h de especialidad · ${student.rotations} orientaciones`,
              }))
            )
          }
        />
        <KpiCard
          value={operational?.studentSummary.inAccreditation ?? 0}
          label="En acreditación"
          context="Solicitud de finalización actualmente en trámite"
          tone="ok"
          loading={directorLoading}
          onClick={() =>
            openOperationalList(
              "Estudiantes en acreditación",
              "Solicitudes de finalización actualmente en trámite",
              (operational?.accreditationStudents || []).map((student) => ({
                nombre: student.fullName,
                legajo: student.legajo || "—",
                detalle: student.status || "En proceso",
              }))
            )
          }
        />
      </Band>

      {/* — Composición del ciclo: heredados + ingresantes nuevos — */}
      <Band title="Composición del ciclo" cols={3} top>
        <KpiCard
          value={heredados}
          label="Heredados"
          context="Venían de 2024-2025 sin finalizar — con los que arrancaste"
          tone="ink"
          onClick={() =>
            drillKpi(
              "heredados",
              "Estudiantes heredados",
              `${heredados} venían de ciclos anteriores al iniciar ${year}`
            )
          }
        />
        <KpiCard
          value={metrics.matricula_generada}
          label="Ingresantes nuevos"
          context="Iniciaron su primera PPS este año"
          tone="ok"
          onClick={() =>
            drillKpi(
              "matricula_generada",
              "Ingresantes del año",
              `${metrics.matricula_generada} ingresaron al sistema de PPS en ${year}`
            )
          }
        />
        <KpiCard
          value={heredados + metrics.matricula_generada}
          label="Población del ciclo"
          context="Heredados + ingresantes nuevos"
          tone="accent"
          onClick={() =>
            drillKpi(
              "matricula_activa",
              "Población del ciclo",
              `${heredados} heredados + ${metrics.matricula_generada} nuevos en ${year}`
            )
          }
        />
      </Band>

      {/* — Dinámica del ciclo (reemplaza al embudo) — */}
      {metrics.demanda_disponible && dinamica && <DinamicaCicloBand d={dinamica} year={year} />}

      {/* — Dos columnas de gráficos — */}
      <section className="band top">
        <div className="charts-2col">
          <div className="charts-col">
            <BarChart data={enrollmentData} year={year} />
            <Distribution dist={metrics.orientation_distribution || {}} onArea={drillArea} />
          </div>
          <div className="charts-col">
            <TrendLine
              data={metrics.finalization_evolution || []}
              year={year}
              title="Evolución de finalizaciones"
            />
            <TopInstituciones rows={topInst} onInst={drillInst} />
          </div>
        </div>
      </section>

      {/* La oferta y la capacidad ya aparecen arriba con el mismo contrato del informe. */}
      <Band title="Red institucional" cols={4} top>
        <KpiCard
          value={topInstFetched ? topInst.length : metrics.instituciones_activas}
          label="Instituciones activas"
          context="Instituciones con ofertas de PPS en el período"
          tone="ink"
          onClick={() =>
            drillKpi(
              "instituciones_activas",
              "Instituciones activas",
              `${metrics.instituciones_activas} con PPS en ${year}`,
              "inst"
            )
          }
        />
        <KpiCard
          value={metrics.nuevos_convenios}
          label="Nuevos convenios"
          context="Instituciones sin vínculo previo, firmadas este año"
          tone="ok"
          onClick={() =>
            drillKpi(
              "nuevos_convenios",
              "Nuevos convenios",
              `${metrics.nuevos_convenios} instituciones nuevas en ${year}`,
              "inst"
            )
          }
        />
        <KpiCard
          value={renovaciones}
          label="Renovaciones"
          context="Re-firmas de convenios existentes este año"
          tone="ink"
          onClick={() =>
            drillKpi(
              "renovaciones",
              "Renovaciones del año",
              `${renovaciones} convenios renovados en ${year}`,
              "inst"
            )
          }
        />
        <KpiCard
          value={conveniosPorVencer}
          label="Próximos a vencer"
          context="Vencen en los próximos 90 días sin renovar"
          tone={conveniosPorVencer > 0 ? "warn" : "ink"}
          onClick={() =>
            drillKpi(
              "convenios_por_vencer",
              "Convenios próximos a vencer",
              `${conveniosPorVencer} vencen dentro de 90 días`,
              "inst"
            )
          }
        />
      </Band>

      {/* — Hermes como FUENTE (no como voz) — */}
      <section className="band top">
        <div className="hermes-row">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="dot"
              style={{ background: "var(--ai)", width: 7, height: 7 }}
              title="Fuente: Hermes"
            />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                Conversaciones analizadas por Hermes
              </div>
              <div className="meta" style={{ fontSize: 11.5, marginTop: 2 }}>
                WhatsApp y mail de la lista «Instituciones»
                {hermes && hermesTotal > 0
                  ? ` · ${fmt(hermes.whatsapp)} chats · ${fmt(hermes.gmail)} hilos`
                  : ""}{" "}
                · en {year}
              </div>
            </div>
          </div>
          <span
            className="mono"
            style={{
              fontSize: 30,
              fontWeight: 300,
              letterSpacing: "-0.03em",
              color: hermesTotal ? "var(--ink)" : "var(--ink-4)",
            }}
          >
            {fmt(hermesTotal)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
            fontSize: 11.5,
            color: "var(--ink-3)",
          }}
        >
          <span className="material-icons" style={{ fontSize: 14 }}>
            shield
          </span>
          Hermes lee los chats de tu lista «Instituciones» y la casilla de mail. Solo detecta y
          propone; nunca envía ni cambia estados.
        </div>
      </section>

      <DrillModal state={drill} onClose={closeDrill} />
    </>
  );
}
