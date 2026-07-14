// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · vista contenedora (Paper & Ink · vista ejecutiva)
//
// Rediseño de la sección Métricas del panel admin, alineado con Inicio /
// Lanzador / Gestión / Solicitudes. Masthead serif "El estado del programa",
// selector de año que recalcula todo, y tres sub-vistas:
//   · Dashboard          → KPIs + embudo + gráficos + instituciones + Hermes
//   · Línea de tiempo    → hitos del ciclo derivados de datos reales
//   · Reporte ejecutivo  → one-pager imprimible
//
// Datos: RPC get_admin_metrics_kpis (KPIs duras) + lecturas Supabase extra.
// Hermes en shadow mode: solo fuente de una métrica, jamás narrador.
// ──────────────────────────────────────────────────────────────────────────
import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useMetricsData, useMetricsYears } from "../../hooks/useMetricsData";
import { useMetricsDinamica } from "../../hooks/useMetricsExtras";
import { useAdminPreferences } from "../../contexts/AdminPreferencesContext";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { METRICAS_V3_CSS } from "./metricasV3Styles";
import { MetricasDashboardV3 } from "../../components/admin/metricas/MetricasDashboardV3";
import { TimelineView, ExecutiveReport } from "../../components/admin/metricas/MetricasTimeline";
import ErrorBoundary from "../../components/ErrorBoundary";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";

// Generadores de export (Excel/PDF) reubicados como subpestaña opcional.
const GestionRelanzamientoReport = lazy(
  () => import("../../components/admin/GestionRelanzamientoReport")
);
const ActiveInstitutionsReport = lazy(
  () => import("../../components/admin/ActiveInstitutionsReport")
);
const ExecutiveReportGenerator = lazy(
  () => import("../../components/admin/ExecutiveReportGenerator")
);
const GestionReportPanel = lazy(() => import("../../components/admin/GestionReportPanel"));
const HermesIntelligenceDashboard = lazy(() =>
  import("../../components/admin/metricas/HermesIntelligenceDashboard").then((m) => ({
    default: m.HermesIntelligenceDashboard,
  }))
);

injectScopedStyles("metricas-v3-styles", METRICAS_V3_CSS);

type TabId = "dashboard" | "timeline" | "reporte" | "hermes" | "descargas";

interface MetricasV3ViewProps {
  onStudentSelect: (student: { legajo: string; nombre: string }) => void;
  isTestingMode?: boolean;
  onModalOpen?: (isOpen: boolean) => void;
}

// ── Skeleton del dashboard ───────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div style={{ paddingTop: 28 }}>
      <div className="grid grid-3" style={{ marginBottom: 28 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk" style={{ height: 140 }} />
        ))}
      </div>
      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sk" style={{ height: 96 }} />
        ))}
      </div>
      <div className="sk" style={{ height: 220, marginBottom: 18 }} />
      <div className="charts-2col">
        <div className="sk" style={{ height: 260 }} />
        <div className="sk" style={{ height: 260 }} />
      </div>
    </div>
  );
}

const MetricasV3View: React.FC<MetricasV3ViewProps> = ({
  onStudentSelect,
  isTestingMode = false,
  onModalOpen,
}) => {
  const { preferences } = useAdminPreferences();
  const subtabs = useMemo<{ id: TabId; label: string; icon: string }[]>(() => {
    const base: { id: TabId; label: string; icon: string }[] = [
      { id: "dashboard", label: "Dashboard", icon: "bar_chart" },
      { id: "timeline", label: "Línea de tiempo", icon: "timeline" },
      { id: "reporte", label: "Reporte ejecutivo", icon: "summarize" },
      { id: "hermes", label: "Hermes", icon: "smart_toy" },
    ];
    if (preferences.showReports)
      base.push({ id: "descargas", label: "Descargas", icon: "download" });
    return base;
  }, [preferences.showReports]);

  const { data: years } = useMetricsYears(isTestingMode);
  const yearOptions = useMemo(
    () => (years && years.length ? years : [new Date().getFullYear()]),
    [years]
  );

  const [year, setYear] = useState<number>(new Date().getFullYear());
  // Modo comparativo del Reporte ejecutivo: compara `year` contra `compareYear`.
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareYear, setCompareYear] = useState<number>(new Date().getFullYear() - 1);
  const [tab, setTab] = useState<TabId>(() => {
    try {
      return (localStorage.getItem("metricas-v3-tab") as TabId) || "dashboard";
    } catch {
      return "dashboard";
    }
  });

  // Alinear año seleccionado al set disponible una vez que carga.
  useEffect(() => {
    if (yearOptions.length && !yearOptions.includes(year)) setYear(yearOptions[0]);
  }, [yearOptions, year]);

  useEffect(() => {
    try {
      localStorage.setItem("metricas-v3-tab", tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  // Si "Descargas" deja de estar disponible, volver al dashboard.
  useEffect(() => {
    if (tab === "descargas" && !preferences.showReports) setTab("dashboard");
  }, [tab, preferences.showReports]);

  const { data: metrics, isLoading, error } = useMetricsData({ targetYear: year, isTestingMode });
  const { data: prevMetrics } = useMetricsData({ targetYear: year - 1, isTestingMode });

  // Dinámica del ciclo se pide a nivel vista para alimentar el reporte.
  const { data: dinamica } = useMetricsDinamica({
    year,
    isTestingMode,
  });

  // Datos del año a comparar (solo se piden si el comparativo está activo).
  const compareActive = compareEnabled && compareYear !== year;
  const { data: metricsB } = useMetricsData({
    targetYear: compareYear,
    isTestingMode: isTestingMode || !compareActive,
  });
  const { data: dinamicaB } = useMetricsDinamica({
    year: compareYear,
    isTestingMode: isTestingMode || !compareActive,
  });

  const asOf = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="metricas-v3">
      <div className="wrap">
        {/* — Masthead — */}
        <div className="masthead">
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span className="mast-rule" aria-hidden="true" />
              <span className="eyebrow">Métricas · coordinación PPS · ciclo {year}</span>
              <h1 className="display">
                El estado del <em>programa</em>
              </h1>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}
            >
              <div role="radiogroup" aria-label="Año" className="year-seg">
                {yearOptions.map((y) => (
                  <button
                    key={y}
                    role="radio"
                    aria-checked={y === year}
                    onClick={() => setYear(y)}
                    className="press"
                    type="button"
                  >
                    {y}
                  </button>
                ))}
              </div>
              <span className="meta mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
                al {asOf}
              </span>
            </div>
          </div>
        </div>

        {/* — Subtabs — */}
        <div className="subtabs" role="tablist">
          {subtabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              className={`press${t.id === tab ? " active" : ""}`}
              onClick={() => setTab(t.id)}
              type="button"
            >
              <span className="material-icons" style={{ fontSize: 17 }}>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>

        {/* — Nota de año de transición (2024) — */}
        {year === 2024 && (
          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid color-mix(in oklab, var(--warn) 30%, var(--rule-2))",
              background: "color-mix(in oklab, var(--warn) 8%, var(--paper))",
            }}
          >
            <span className="material-icons" style={{ fontSize: 18, color: "var(--warn)" }}>
              info
            </span>
            <p className="meta" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
              <strong style={{ color: "var(--ink)" }}>2024 es un año de transición.</strong> En ese
              ciclo se migró y regularizó la matrícula heredada (sistema Airtable), por lo que los
              conteos de “ingresantes” y arrastre histórico están inflados y no son comparables de
              forma directa con años posteriores. Tomá 2025 en adelante como datos limpios.
            </p>
          </div>
        )}

        {/* — Contenido — */}
        {error && (
          <div style={{ paddingTop: 28 }}>
            <EmptyState
              icon="error"
              title="No pudimos cargar las métricas"
              message={(error as Error)?.message || "Error desconocido"}
            />
          </div>
        )}

        {!error && isLoading && !metrics && <DashboardSkeleton />}

        {!error && metrics && (
          <>
            {tab === "dashboard" && (
              <MetricasDashboardV3
                year={year}
                metrics={metrics}
                prevMetrics={prevMetrics}
                onStudentSelect={onStudentSelect}
                isTestingMode={isTestingMode}
                onModalChange={onModalOpen}
              />
            )}
            {tab === "timeline" && <TimelineView year={year} isTestingMode={isTestingMode} />}
            {tab === "reporte" && (
              <>
                <Suspense fallback={null}>
                  <ErrorBoundary>
                    <GestionReportPanel isTestingMode={isTestingMode} />
                  </ErrorBoundary>
                </Suspense>
                <ExecutiveReport
                  year={year}
                  metrics={metrics}
                  prevMetrics={prevMetrics}
                  dinamica={dinamica}
                  isTestingMode={isTestingMode}
                  compareEnabled={compareEnabled}
                  compareYear={compareYear}
                  yearOptions={yearOptions}
                  metricsB={compareActive ? metricsB : null}
                  dinamicaB={compareActive ? dinamicaB : null}
                  onToggleCompare={setCompareEnabled}
                  onCompareYearChange={setCompareYear}
                />
              </>
            )}
            {tab === "hermes" && (
              <Suspense
                fallback={
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                    <Loader />
                  </div>
                }
              >
                <ErrorBoundary>
                  <HermesIntelligenceDashboard isTestingMode={isTestingMode} />
                </ErrorBoundary>
              </Suspense>
            )}
            {tab === "descargas" && preferences.showReports && (
              <section style={{ padding: "32px 0 0" }}>
                <div style={{ marginBottom: 8 }}>
                  <span className="eyebrow">Exportables · Excel y PDF</span>
                  <h2
                    className="display"
                    style={{
                      margin: "6px 0 0",
                      fontSize: 30,
                      letterSpacing: "-0.01em",
                      lineHeight: 1,
                    }}
                  >
                    Descargas y planillas
                  </h2>
                </div>
                <Suspense
                  fallback={
                    <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                      <Loader />
                    </div>
                  }
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 22 }}>
                    <ErrorBoundary>
                      <GestionRelanzamientoReport isTestingMode={isTestingMode} />
                    </ErrorBoundary>
                    <ErrorBoundary>
                      <ActiveInstitutionsReport isTestingMode={isTestingMode} />
                    </ErrorBoundary>
                    <ErrorBoundary>
                      <ExecutiveReportGenerator isTestingMode={isTestingMode} />
                    </ErrorBoundary>
                  </div>
                </Suspense>
              </section>
            )}

            {/* — Footer — */}
            <footer
              className="mv3-footer"
              style={{
                marginTop: 40,
                paddingTop: 24,
                borderTop: "1px solid var(--rule-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div className="meta">Mi Panel Académico · PPS · UFLO Psicología</div>
              <div
                className="meta mono"
                style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11 }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    className="dot dot-live"
                    style={{ color: "var(--ok)", background: "var(--ok)" }}
                  />{" "}
                  Hermes online
                </span>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
};

export default MetricasV3View;
