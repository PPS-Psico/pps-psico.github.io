// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · Dashboard (Paper & Ink · vista ejecutiva)
//
// Orquesta KPIs reales (RPC get_admin_metrics_kpis) + lecturas extra de
// Supabase (embudo, top instituciones, serie de finalizados, actividad de
// Hermes). Hermes NO narra: aparece solo como FUENTE de una métrica dura.
// ──────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState, useCallback } from "react";
import type { MetricsKPIs } from "../../../hooks/useMetricsData";
import {
  useMetricsDinamica,
  useMetricsTopInstituciones,
  useFinalizadosSeries,
  useHermesActivity,
  useMetricsHeredados,
} from "../../../hooks/useMetricsExtras";
import type { TopInstitucion } from "../../../hooks/useMetricsExtras";
import { useQuery } from "@tanstack/react-query";
import { fetchMetricList, fetchOrientationList } from "../../../services/metricsLists";
import { fetchConveniosKpis } from "../../../services/conveniosService";
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
  prevMetrics?: MetricsKPIs;
  onStudentSelect?: (s: { legajo: string; nombre: string }) => void;
  isTestingMode?: boolean;
  onModalChange?: (open: boolean) => void;
}

export function MetricasDashboardV3({
  year,
  metrics,
  prevMetrics,
  onStudentSelect,
  isTestingMode = false,
  onModalChange,
}: Props) {
  const [drill, setDrill] = useState<DrillState | null>(null);

  const { data: dinamica } = useMetricsDinamica({
    year,
    isTestingMode,
  });
  const { data: topInst = [] } = useMetricsTopInstituciones({ year, isTestingMode });
  const { data: finalizadosSeries = [] } = useFinalizadosSeries(isTestingMode);
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

  const sparkYears = useMemo(() => {
    const ys = new Set<number>();
    metrics.enrollment_evolution?.forEach((e) => ys.add(Number(e.year)));
    metrics.trend_data?.forEach((e) => ys.add(Number(e.year)));
    finalizadosSeries.forEach((e) => ys.add(e.year));
    ys.add(year);
    return Array.from(ys)
      .filter((y) => !Number.isNaN(y))
      .sort((a, b) => a - b);
  }, [metrics, finalizadosSeries, year]);

  const sparks = useMemo(
    () => ({
      // enrollment_evolution ahora es la serie de "estudiantes en PPS" por año.
      enPps: seriesToSpark(metrics.enrollment_evolution || [], sparkYears),
      activa: seriesToSpark(metrics.trend_data || [], sparkYears),
      finalizados: seriesToSpark(finalizadosSeries, sparkYears),
    }),
    [metrics, finalizadosSeries, sparkYears]
  );

  // — prev-year valores para "X en {year-1}" —
  const prevVals = useMemo(() => {
    const fromSeries = (s?: { year: string; value: number }[]) =>
      s?.find((e) => Number(e.year) === year - 1)?.value;
    return {
      enPps: metrics.estudiantes_en_pps_prev,
      activa: prevMetrics?.matricula_activa ?? fromSeries(metrics.trend_data),
      finalizados:
        prevMetrics?.alumnos_finalizados ??
        finalizadosSeries.find((e) => e.year === year - 1)?.value,
    };
  }, [prevMetrics, metrics, finalizadosSeries, year]);

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
      openDrill({
        title: r.nombre,
        subtitle: `${r.ocupados} estudiantes en PPS en ${year}`,
        rows: r.list as DrillRow[],
        kind: "student",
        loading: false,
        onRowClick,
      });
    },
    [year, openDrill, onRowClick]
  );

  // — Evolución de inscriptos: enrollment_evolution; marca proyección si target es año actual —
  const enrollmentData = useMemo(
    () =>
      (metrics.enrollment_evolution || []).map((e) => ({
        ...e,
        isProjection: Number(e.year) === new Date().getFullYear() && Number(e.year) === year,
      })),
    [metrics, year]
  );

  const hermesTotal = hermes?.total ?? 0;

  // El año anterior 2024 es de transición (regularización de la migración de
  // Airtable): comparar contra él da % engañosos. Ocultamos el trend interanual
  // cuando el año previo es 2024.
  const hideTrend = year - 1 === 2024;
  const trendOf = (v: number | undefined) => (hideTrend ? undefined : v);

  return (
    <>
      {/* — Banda matrícula (3 hero con sparkline) — */}
      <Band cols={3}>
        <HeroMetric
          value={metrics.estudiantes_en_pps}
          label="Estudiantes en PPS"
          context="Hicieron al menos una práctica este año"
          tone="ok"
          trend={trendOf(metrics.trends?.estudiantes_en_pps)}
          prevYear={prevVals.enPps}
          spark={sparks.enPps}
          activeYear={year}
          years={sparkYears}
          onClick={() =>
            drillKpi(
              "estudiantes_en_pps",
              "Estudiantes en PPS",
              `${metrics.estudiantes_en_pps} con actividad de PPS en ${year}`
            )
          }
        />
        <HeroMetric
          value={metrics.alumnos_finalizados}
          label="Finalizados"
          context="Acreditaciones cerradas en el ciclo"
          tone="ok"
          trend={trendOf(metrics.trends?.acreditados)}
          prevYear={prevVals.finalizados}
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
        <HeroMetric
          value={metrics.matricula_activa}
          label="Matrícula activa"
          context="Alumnos vigentes en el sistema"
          tone="accent"
          trend={trendOf(metrics.trends?.activos)}
          prevYear={prevVals.activa}
          spark={sparks.activa}
          activeYear={year}
          years={sparkYears}
          onClick={() =>
            drillKpi(
              "matricula_activa",
              "Matrícula activa",
              `${metrics.matricula_activa} alumnos activos en ${year}`
            )
          }
        />
      </Band>

      {/* — Banda seguimiento (3) — */}
      <Band title="Seguimiento de estudiantes" cols={3} top>
        <KpiCard
          value={metrics.sin_pps}
          label="Sin ninguna PPS"
          context="Activos sin práctica · al día de hoy"
          tone="warn"
          onClick={() =>
            drillKpi(
              "sin_pps",
              "Alumnos sin ninguna PPS",
              `${metrics.sin_pps} activos sin práctica`
            )
          }
        />
        <KpiCard
          value={metrics.proximos_finalizar}
          label="Próximos a finalizar"
          context="≥ 230 hs acumuladas · al día de hoy"
          tone="accent"
          onClick={() =>
            drillKpi(
              "proximos_finalizar",
              "Próximos a finalizar",
              `${metrics.proximos_finalizar} con ≥230 hs`
            )
          }
        />
        <KpiCard
          value={metrics.haciendo_pps}
          label="Haciendo PPS"
          context="Con práctica en curso"
          tone="ok"
          onClick={() =>
            drillKpi("haciendo_pps", "Haciendo PPS", `${metrics.haciendo_pps} en curso`)
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
      {dinamica && <DinamicaCicloBand d={dinamica} year={year} />}

      {/* — Dos columnas de gráficos — */}
      <section className="band top">
        <div className="charts-2col">
          <div className="charts-col">
            <BarChart data={enrollmentData} year={year} />
            <Distribution dist={metrics.orientation_distribution || {}} onArea={drillArea} />
          </div>
          <div className="charts-col">
            <TrendLine data={metrics.trend_data || []} year={year} />
            <TopInstituciones rows={topInst} onInst={drillInst} />
          </div>
        </div>
      </section>

      {/* — Banda instituciones (3) — */}
      <Band title="Red de instituciones" cols={3} top>
        <KpiCard
          value={metrics.pps_lanzadas}
          label="PPS lanzadas"
          context="Convocatorias del año"
          tone="ink"
          onClick={() =>
            drillKpi(
              "pps_lanzadas",
              "PPS lanzadas",
              `${metrics.pps_lanzadas} convocatorias en ${year}`,
              "inst"
            )
          }
        />
        <KpiCard
          value={metrics.instituciones_activas}
          label="Instituciones activas"
          context="Con PPS este año"
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
          value={metrics.cupos_ofrecidos}
          label="Cupos ofrecidos"
          context="Sumados en el año"
          tone="ink"
          onClick={() =>
            drillKpi(
              "cupos_ofrecidos",
              "Cupos ofrecidos",
              `${metrics.cupos_ofrecidos} cupos en ${year}`,
              "inst"
            )
          }
        />
      </Band>

      {/* — Banda convenios (nuevos · renovaciones · por vencer) — */}
      <Band title="Convenios del ciclo" cols={3} top>
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
