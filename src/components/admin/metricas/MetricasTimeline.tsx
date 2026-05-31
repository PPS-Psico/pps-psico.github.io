// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · Línea de tiempo + Reporte ejecutivo (Paper & Ink)
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import { useMetricsTimeline } from "../../../hooks/useMetricsExtras";
import type { TimelineEvent, DinamicaCiclo } from "../../../hooks/useMetricsExtras";
import type { MetricsKPIs } from "../../../hooks/useMetricsData";
import { fmt } from "./MetricasPrimitives";

const TONE_VAR: Record<string, string> = {
  accent: "var(--accent)",
  warn: "var(--warn)",
  ok: "var(--ok)",
  ai: "var(--ai)",
  ink: "var(--ink)",
};
const ICON: Record<TimelineEvent["tipo"], string> = {
  lanzamiento: "rocket_launch",
  inscripcion: "how_to_reg",
  seleccion: "task_alt",
  inicio: "play_circle",
  cierre: "verified",
  convenio: "handshake",
};

// ── LÍNEA DE TIEMPO ─────────────────────────────────────────────────────────
export function TimelineView({ year, isTestingMode }: { year: number; isTestingMode?: boolean }) {
  const { data: events = [], isLoading } = useMetricsTimeline({ year, isTestingMode });

  return (
    <section style={{ padding: "32px 0 0" }}>
      <div style={{ marginBottom: 8 }}>
        <span className="eyebrow">Cómo se movió el ciclo {year}</span>
        <h2
          className="display"
          style={{ margin: "6px 0 0", fontSize: 30, letterSpacing: "-0.01em", lineHeight: 1 }}
        >
          Línea de tiempo del programa
        </h2>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 28 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="sk" style={{ height: 56 }} />
          ))}
        </div>
      )}

      {!isLoading && events.length === 0 && (
        <p className="meta" style={{ marginTop: 28, padding: "40px 0", textAlign: "center" }}>
          Sin hitos registrados para el ciclo {year}.
        </p>
      )}

      {!isLoading && events.length > 0 && (
        <div style={{ position: "relative", marginTop: 28, paddingLeft: 4 }}>
          <div
            style={{
              position: "absolute",
              left: 19,
              top: 6,
              bottom: 6,
              width: 1,
              background: "var(--rule-2)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {events.map((e, i) => {
              const c = TONE_VAR[e.tone] || "var(--ink)";
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr",
                    gap: 18,
                    alignItems: "flex-start",
                    padding: "12px 0",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      justifyContent: "center",
                      paddingTop: 2,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: `color-mix(in oklab, ${c} 13%, var(--paper))`,
                        color: c,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--paper)",
                        zIndex: 1,
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 18 }}>
                        {ICON[e.tipo] || "circle"}
                      </span>
                    </span>
                  </div>
                  <div style={{ minWidth: 0, paddingBottom: 4 }}>
                    <div
                      style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}
                    >
                      <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: c }}>
                        {e.fecha}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                        {e.titulo}
                      </span>
                    </div>
                    <div className="meta" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.45 }}>
                      {e.detalle}
                    </div>
                    {e.items && e.items.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 10,
                        }}
                      >
                        {e.items.map((it, j) => (
                          <span
                            key={j}
                            className="tl-chip"
                            style={{
                              ["--chip" as string]: c,
                            }}
                          >
                            {it}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── REPORTE EJECUTIVO · one-pager imprimible ──────────────────────────────

// Tabla comparativa entre dos años (A = más antiguo, B = más reciente).
function ComparativeTable({
  rows,
  yearA,
  yearB,
}: {
  rows: { label: string; a: number; b: number }[];
  yearA: number;
  yearB: number;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr 1fr 1.1fr",
          borderTop: "1px solid var(--rule-2)",
        }}
      >
        {/* Header */}
        <div className="label" style={{ padding: "10px 8px" }}>
          Indicador
        </div>
        <div className="label mono" style={{ padding: "10px 8px", textAlign: "right" }}>
          {yearA}
        </div>
        <div className="label mono" style={{ padding: "10px 8px", textAlign: "right" }}>
          {yearB}
        </div>
        <div className="label" style={{ padding: "10px 8px", textAlign: "right" }}>
          Variación
        </div>

        {rows.map((r) => {
          const diff = r.b - r.a;
          const pct = r.a > 0 ? Math.round((diff / r.a) * 100) : null;
          const color = diff > 0 ? "var(--ok)" : diff < 0 ? "var(--warn)" : "var(--ink-3)";
          const sign = diff > 0 ? "+" : "";
          return (
            <React.Fragment key={r.label}>
              <div
                style={{
                  padding: "12px 8px",
                  borderTop: "1px solid var(--rule-2)",
                  fontSize: 13.5,
                  color: "var(--ink)",
                }}
              >
                {r.label}
              </div>
              <div
                className="mono"
                style={{
                  padding: "12px 8px",
                  borderTop: "1px solid var(--rule-2)",
                  textAlign: "right",
                  fontSize: 15,
                  color: "var(--ink-2)",
                }}
              >
                {fmt(r.a)}
              </div>
              <div
                className="mono"
                style={{
                  padding: "12px 8px",
                  borderTop: "1px solid var(--rule-2)",
                  textAlign: "right",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                {fmt(r.b)}
              </div>
              <div
                className="mono"
                style={{
                  padding: "12px 8px",
                  borderTop: "1px solid var(--rule-2)",
                  textAlign: "right",
                  fontSize: 13,
                  color,
                }}
              >
                {diff === 0 ? "—" : `${sign}${fmt(diff)}${pct !== null ? ` (${sign}${pct}%)` : ""}`}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function ReportBlock({
  title,
  rows,
  big,
}: {
  title: string;
  rows: { label: string; v: number; ctx?: string }[];
  big?: boolean;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <div className="label" style={{ marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 20 }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div
              className="mono"
              style={{
                fontSize: big ? 38 : 28,
                fontWeight: 300,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "var(--ink)",
              }}
            >
              {fmt(r.v)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginTop: 8 }}>
              {r.label}
            </div>
            {r.ctx && (
              <div className="meta" style={{ fontSize: 11.5, marginTop: 2 }}>
                {r.ctx}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExecutiveReport({
  year,
  metrics,
  dinamica,
  hermesTotal,
  compareEnabled = false,
  compareYear,
  yearOptions = [],
  metricsB = null,
  dinamicaB = null,
  onToggleCompare,
  onCompareYearChange,
}: {
  year: number;
  metrics: MetricsKPIs;
  dinamica?: DinamicaCiclo | null;
  hermesTotal: number;
  compareEnabled?: boolean;
  compareYear?: number;
  yearOptions?: number[];
  metricsB?: MetricsKPIs | null;
  dinamicaB?: DinamicaCiclo | null;
  onToggleCompare?: (v: boolean) => void;
  onCompareYearChange?: (y: number) => void;
}) {
  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  // Comparativo activo: hay segundo año elegido, distinto, y datos cargados.
  const comparing =
    compareEnabled && !!metricsB && compareYear !== undefined && compareYear !== year;
  // En el comparativo ordenamos cronológicamente: A = más antiguo, B = más reciente.
  const yA = comparing ? Math.min(year, compareYear as number) : year;
  const yB = comparing ? Math.max(year, compareYear as number) : year;
  const mA = comparing ? (year < (compareYear as number) ? metrics : metricsB!) : metrics;
  const mB = comparing ? (year < (compareYear as number) ? metricsB! : metrics) : metrics;
  const dA = comparing ? (year < (compareYear as number) ? dinamica : dinamicaB) : dinamica;
  const dB = comparing ? (year < (compareYear as number) ? dinamicaB : dinamica) : dinamica;

  const heroRows = [
    {
      label: "Estudiantes en PPS",
      v: metrics.estudiantes_en_pps,
      ctx: "Con práctica este año",
    },
    { label: "Finalizados", v: metrics.alumnos_finalizados, ctx: "Acreditaciones cerradas" },
    { label: "Matrícula activa", v: metrics.matricula_activa, ctx: "Alumnos en el sistema" },
  ];
  const segRows = [
    { label: "Sin ninguna PPS", v: metrics.sin_pps },
    { label: "Próximos a finalizar", v: metrics.proximos_finalizar },
    { label: "Haciendo PPS", v: metrics.haciendo_pps },
  ];
  const instRows = [
    { label: "PPS lanzadas", v: metrics.pps_lanzadas },
    { label: "Instituciones activas", v: metrics.instituciones_activas },
    { label: "Nuevos convenios", v: metrics.nuevos_convenios },
  ];

  // Filas para la tabla comparativa (todas las métricas duras comparables).
  const compareRows: { label: string; a: number; b: number }[] = comparing
    ? [
        { label: "Estudiantes en PPS", a: mA.estudiantes_en_pps, b: mB.estudiantes_en_pps },
        { label: "Ingresantes (cohorte)", a: mA.matricula_generada, b: mB.matricula_generada },
        { label: "Finalizados", a: mA.alumnos_finalizados, b: mB.alumnos_finalizados },
        { label: "Matrícula activa", a: mA.matricula_activa, b: mB.matricula_activa },
        { label: "Haciendo PPS", a: mA.haciendo_pps, b: mB.haciendo_pps },
        { label: "PPS lanzadas", a: mA.pps_lanzadas, b: mB.pps_lanzadas },
        {
          label: "Instituciones activas",
          a: mA.instituciones_activas,
          b: mB.instituciones_activas,
        },
        { label: "Nuevos convenios", a: mA.nuevos_convenios, b: mB.nuevos_convenios },
        ...(dA && dB
          ? [
              { label: "Alumnos que se postularon", a: dA.postulados, b: dB.postulados },
              { label: "Postulaciones totales", a: dA.postulaciones, b: dB.postulaciones },
            ]
          : []),
      ]
    : [];

  return (
    <section className="exec-report" style={{ padding: "32px 0 0" }}>
      {/* — Control de comparación (no se imprime) — */}
      {onToggleCompare && (
        <div
          className="no-print"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "12px 16px",
            marginBottom: 18,
            border: "1px solid var(--rule-2)",
            borderRadius: 12,
            background: "var(--paper-2)",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => onToggleCompare(e.target.checked)}
            />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
              Comparar dos años
            </span>
          </label>
          {compareEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="meta" style={{ fontSize: 12.5 }}>
                {year} vs.
              </span>
              <select
                value={compareYear}
                onChange={(e) => onCompareYearChange?.(Number(e.target.value))}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--rule-2)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              >
                {yearOptions
                  .filter((y) => y !== year)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div>
          <span className="eyebrow">Para imprimir o llevar a reunión</span>
          <h2
            className="display"
            style={{ margin: "6px 0 0", fontSize: 30, letterSpacing: "-0.01em", lineHeight: 1 }}
          >
            {comparing ? `Reporte comparativo · ${yA} vs ${yB}` : `Reporte ejecutivo · ${year}`}
          </h2>
        </div>
        <button
          className="btn btn-primary press no-print"
          onClick={() => window.print()}
          type="button"
        >
          <span className="material-icons" style={{ fontSize: 17 }}>
            print
          </span>
          Imprimir / PDF
        </button>
      </div>

      <div
        className="exec-sheet"
        style={{
          marginTop: 22,
          border: "1px solid var(--rule-2)",
          borderRadius: 16,
          background: "var(--paper)",
          padding: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderBottom: "2px solid var(--ink)",
            paddingBottom: 16,
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div className="display" style={{ fontSize: 26, letterSpacing: "-0.01em" }}>
              Estado del programa de PPS
            </div>
            <div className="meta" style={{ fontSize: 13, marginTop: 4 }}>
              {comparing
                ? `Comparación de ciclos ${yA} y ${yB} · UFLO Psicología`
                : `Ciclo lectivo ${year} · UFLO Psicología`}
            </div>
          </div>
          <div
            className="meta mono"
            style={{ fontSize: 11.5, textAlign: "right", lineHeight: 1.6 }}
          >
            <div>Emitido {today}</div>
            <div style={{ color: "var(--ink-4)" }}>Coordinación PPS</div>
          </div>
        </div>

        {comparing ? (
          <ComparativeTable rows={compareRows} yearA={yA} yearB={yB} />
        ) : (
          <>
            <ReportBlock title="Matrícula" rows={heroRows} big />
            <ReportBlock title="Seguimiento de estudiantes" rows={segRows} />
            <ReportBlock title="Red de instituciones" rows={instRows} />
          </>
        )}

        {!comparing && dinamica && dinamica.postulados > 0 && (
          <div style={{ marginTop: 26 }}>
            <div className="label" style={{ marginBottom: 12 }}>
              Dinámica del ciclo
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 0,
                border: "1px solid var(--rule-2)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {[
                {
                  v: `${dinamica.postulacionesPorAlumno}`,
                  label: `Postulaciones por alumno (${fmt(dinamica.postulaciones)} / ${fmt(dinamica.postulados)})`,
                },
                { v: fmt(dinamica.sinLugar), label: "Postulados sin lugar todavía" },
                {
                  v: dinamica.concrecionPct == null ? "—" : `${dinamica.concrecionPct}%`,
                  label: `Concreción (${fmt(dinamica.conLugar)} de ${fmt(dinamica.postulados)} con lugar)`,
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 12px",
                    borderRight: i < 2 ? "1px solid var(--rule-2)" : "none",
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 24,
                      fontWeight: 300,
                      letterSpacing: "-0.03em",
                      color: "var(--ink)",
                    }}
                  >
                    {s.v}
                  </div>
                  <div className="meta" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.3 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div className="label">Asistencia de Hermes</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="dot" style={{ background: "var(--ai)", width: 7, height: 7 }} />
            <span
              className="mono"
              style={{
                fontSize: 24,
                fontWeight: 300,
                letterSpacing: "-0.03em",
                color: hermesTotal ? "var(--ink)" : "var(--ink-4)",
              }}
            >
              {fmt(hermesTotal)}
            </span>
            <span className="meta" style={{ fontSize: 12 }}>
              conversaciones analizadas
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            paddingTop: 14,
            borderTop: "1px solid var(--rule-2)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span className="material-icons" style={{ fontSize: 14, color: "var(--ink-3)" }}>
            shield
          </span>
          <span className="meta" style={{ fontSize: 11.5 }}>
            Datos del sistema de gestión de PPS. Hermes solo detecta y propone; nunca envía ni
            cambia estados.
          </span>
        </div>
      </div>
    </section>
  );
}
