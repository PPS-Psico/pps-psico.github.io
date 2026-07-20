// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · gráficos editoriales (Paper & Ink)
// SVG/CSS a mano para respetar el registro plano; nada de librerías saturadas.
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import { fmt, TONE, ORIENT_VAR, ORIENT_KEY, SectionLead } from "./MetricasPrimitives";
import type { FunnelStage, TopInstitucion, DinamicaCiclo } from "../../../hooks/useMetricsExtras";

// ── DINÁMICA DEL CICLO (reemplaza al embudo) ──────────────────────────────────
// Tres tarjetas accionables sobre el proceso de inscripción/selección del año.
export function DinamicaCicloBand({ d, year }: { d: DinamicaCiclo; year: number }) {
  if (d.postulados === 0) {
    return (
      <section className="band top">
        <SectionLead eyebrow="El recorrido de una PPS" title="Dinámica del ciclo" />
        <p className="meta" style={{ textAlign: "center", padding: "20px 0" }}>
          Sin postulaciones registradas para {year}.
        </p>
      </section>
    );
  }

  const card = (title: string, big: string, sub: string, tone: "accent" | "ok" | "warn") => {
    const c = tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="eyebrow">{title}</span>
        <span
          className="mono"
          style={{
            fontSize: 34,
            fontWeight: 300,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: c,
          }}
        >
          {big}
        </span>
        <span className="meta" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
          {sub}
        </span>
      </div>
    );
  };

  return (
    <section className="band top">
      <SectionLead
        eyebrow="El recorrido de una PPS"
        title="Dinámica del ciclo"
        right={`${fmt(d.postulados)} alumnos se postularon en ${year}`}
      />
      <div className="grid grid-3" style={{ marginTop: 4 }}>
        {card(
          "Demanda",
          `${d.postulacionesPorAlumno}`,
          `postulaciones por alumno · ${fmt(d.postulaciones)} en total entre ${fmt(d.postulados)} alumnos`,
          "accent"
        )}
        {card(
          "Sin lugar todavía",
          fmt(d.sinLugar),
          d.sinLugar > 0
            ? "Se postularon pero aún no tienen PPS asignada — a ubicar"
            : "Todos los postulados ya tienen lugar",
          d.sinLugar > 0 ? "warn" : "ok"
        )}
        {card(
          "Concreción",
          d.concrecionPct == null ? "—" : `${d.concrecionPct}%`,
          `${fmt(d.conLugar)} de ${fmt(d.postulados)} postulados ya consiguió lugar`,
          "ok"
        )}
      </div>
    </section>
  );
}

// ── EMBUDO cónico (legacy, ya no usado por la vista) ──────────────────────────
export function Funnel({
  stages,
  onStage,
}: {
  stages: FunnelStage[];
  onStage: (s: FunnelStage) => void;
}) {
  const valid = stages.filter((s) => s.value > 0);
  const max = stages[0]?.value || 1;
  // Conversión postulados → seleccionados (por alumno), la tasa real de selección.
  const postulados = stages[0]?.value || 0;
  const seleccionados = stages.find((s) => s.key === "seleccionados")?.value || 0;
  const selPct = postulados ? Math.round((seleccionados / postulados) * 100) : 0;
  if (!valid.length) {
    return (
      <section className="band top">
        <SectionLead eyebrow="El recorrido de una PPS" title="Embudo del ciclo" />
        <p className="meta" style={{ textAlign: "center", padding: "20px 0" }}>
          Sin movimiento de convocatorias registrado para este año.
        </p>
      </section>
    );
  }
  return (
    <section className="band top">
      <SectionLead
        eyebrow="El recorrido de una PPS"
        title="Embudo del ciclo"
        right={`Por alumno · ${selPct}% de los postulados quedó seleccionado`}
      />
      <div className="funnel">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100;
          const T = TONE[s.tone] || TONE.ink;
          const prev = stages[i - 1]?.value;
          const conv = i === 0 ? 100 : prev ? Math.round((s.value / prev) * 100) : 0;
          const dropped = i === 0 || prev == null ? 0 : prev - s.value;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className="funnel-drop">
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    south
                  </span>
                  <span className="meta mono" style={{ fontSize: 10.5 }}>
                    {conv}% avanza{dropped > 0 ? ` · −${dropped} quedaron en el camino` : ""}
                  </span>
                </div>
              )}
              <button
                onClick={() => onStage(s)}
                className="funnel-step press"
                type="button"
                title={`${s.label} · ${s.value}`}
                style={{ width: `${Math.max(pct, 26)}%`, minWidth: 280 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "13px 18px",
                    borderRadius: 10,
                    background: T.s,
                    border: `1px solid color-mix(in oklab, ${T.c} 22%, transparent)`,
                    transition: "transform .12s ease",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                      {s.label}
                    </div>
                    <div className="meta" style={{ fontSize: 11, marginTop: 1 }}>
                      {s.note}
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 26,
                      fontWeight: 300,
                      letterSpacing: "-0.03em",
                      color: T.c,
                      flexShrink: 0,
                    }}
                  >
                    {fmt(s.value)}
                  </span>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

// ── Gráfico de barras (inicios reales de PPS al mismo corte) ───────────
export function BarChart({
  data,
  year,
}: {
  data: { year: string; value: number; isProjection?: boolean }[];
  year: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="card">
      <span className="eyebrow">Iniciaron PPS por año · mismo corte</span>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          height: 150,
          marginTop: 20,
          borderBottom: "1px solid var(--rule-2)",
        }}
      >
        {data.map((d) => {
          const h = Math.max(4, (d.value / max) * 128);
          const isYear = d.year === String(year);
          return (
            <div
              key={d.year}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 7,
                minWidth: 0,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isYear ? "var(--ink)" : "var(--ink-4)",
                }}
              >
                {d.value}
              </span>
              <div
                className="bar"
                title={`${d.year}: ${d.value}`}
                style={{
                  width: "100%",
                  maxWidth: 40,
                  height: h,
                  background: isYear ? "var(--accent)" : "var(--paper-3)",
                  border: d.isProjection ? "1.5px dashed var(--accent)" : "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {data.map((d) => (
          <span
            key={d.year}
            className="mono"
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 11,
              color: d.year === String(year) ? "var(--ink-2)" : "var(--ink-4)",
            }}
          >
            {d.year}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Tendencia de matrícula activa (línea SVG) ─────────────────────────────
export function TrendLine({
  data,
  year,
  title = "Tendencia de matrícula activa",
}: {
  data: { year: string; value: number }[];
  year: number;
  title?: string;
}) {
  const W = 320;
  const H = 132;
  const pad = 18;
  if (data.length < 2) {
    return (
      <div className="card">
        <span className="eyebrow">{title}</span>
        <p className="meta" style={{ marginTop: 14 }}>
          Serie insuficiente.
        </p>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value)) * 1.08;
  const min = Math.min(...data.map((d) => d.value)) * 0.82;
  const x = (i: number) => pad + i * ((W - pad * 2) / (data.length - 1));
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `${pad},${H - pad} ${pts} ${x(data.length - 1)},${H - pad}`;
  const cur = data.find((d) => d.year === String(year)) || data[data.length - 1];
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="eyebrow">{title}</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
          {cur.value}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", marginTop: 14, display: "block" }}
        preserveAspectRatio="none"
      >
        <line
          x1={pad}
          y1={H - pad}
          x2={W - pad}
          y2={H - pad}
          stroke="var(--rule-2)"
          strokeWidth="1"
        />
        <polygon points={area} fill="var(--accent-soft)" />
        <polyline
          points={pts}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => {
          const isYear = d.year === String(year);
          return (
            <circle
              key={d.year}
              cx={x(i)}
              cy={y(d.value)}
              r={isYear ? 4 : 2.5}
              fill={isYear ? "var(--accent)" : "var(--paper)"}
              stroke="var(--accent)"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {data.map((d) => (
          <span
            key={d.year}
            className="mono"
            style={{
              fontSize: 10.5,
              color: d.year === String(year) ? "var(--ink-2)" : "var(--ink-4)",
            }}
          >
            {d.year}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Distribución por orientación ──────────────────────────────────────────
export function Distribution({
  dist,
  onArea,
}: {
  dist: Record<string, number>;
  onArea: (area: string) => void;
}) {
  const entries = Object.entries(dist).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!total) {
    return (
      <div className="card">
        <span className="eyebrow">Inicios de PPS por orientación</span>
        <p className="meta" style={{ marginTop: 14 }}>
          Sin alumnos asignados este año.
        </p>
      </div>
    );
  }
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="eyebrow">Inicios efectivos por área de PPS</span>
        <span className="meta mono" style={{ fontSize: 11 }}>
          {total} menciones
        </span>
      </div>
      <div
        style={{
          display: "flex",
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          marginTop: 16,
          gap: 1.5,
        }}
      >
        {entries.map(([area, v]) => (
          <div
            key={area}
            title={`${area} · ${v}`}
            style={{
              width: `${(v / total) * 100}%`,
              background: ORIENT_VAR[ORIENT_KEY[area] || "sindefinir"],
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 14 }}>
        {entries.map(([area, v]) => {
          const pct = Math.round((v / total) * 100);
          const ok = ORIENT_KEY[area] || "sindefinir";
          return (
            <button
              key={area}
              onClick={() => onArea(area)}
              className="row-btn press"
              type="button"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "7px 6px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--ink-2)",
                  minWidth: 0,
                }}
              >
                <span
                  className="dot"
                  style={{ background: ORIENT_VAR[ok], width: 7, height: 7, flexShrink: 0 }}
                />
                <span
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {area}
                </span>
              </span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
                {pct}%
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ink)",
                  minWidth: 28,
                  textAlign: "right",
                }}
              >
                {v}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── TOP instituciones por cupos (ocupación) ───────────────────────────────
export function TopInstituciones({
  rows,
  onInst,
}: {
  rows: TopInstitucion[];
  onInst: (r: TopInstitucion) => void;
}) {
  if (!rows.length) {
    return (
      <div className="card">
        <span className="eyebrow">Top instituciones por cupos</span>
        <p className="meta" style={{ marginTop: 14 }}>
          Sin datos de instituciones este año.
        </p>
      </div>
    );
  }
  const usesDocumentedCapacity =
    rows.every((row) => row.ocupados === 0) && rows.some((row) => row.ofrecidos > 0);
  const valueOf = (row: TopInstitucion) => (usesDocumentedCapacity ? row.ofrecidos : row.ocupados);
  const max = Math.max(...rows.map(valueOf), 1);
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="eyebrow">
          {usesDocumentedCapacity
            ? "Top instituciones · capacidad"
            : "Top instituciones · estudiantes"}
        </span>
        <span className="meta" style={{ fontSize: 11 }}>
          {usesDocumentedCapacity ? "vacantes documentadas" : "alumnos en PPS"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 14 }}>
        {rows.slice(0, 6).map((r) => (
          <button
            key={r.nombre}
            onClick={() => onInst(r)}
            className="row-btn press"
            type="button"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 86px auto",
              gap: 12,
              alignItems: "center",
              padding: "9px 6px",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--ink)",
                minWidth: 0,
              }}
            >
              <span
                className="dot"
                style={{ background: ORIENT_VAR[r.orient], width: 7, height: 7, flexShrink: 0 }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.nombre}
              </span>
            </span>
            <div
              style={{
                height: 7,
                background: "var(--paper-3)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(valueOf(r) / max) * 100}%`,
                  background: ORIENT_VAR[r.orient],
                  borderRadius: 999,
                }}
              />
            </div>
            <span
              className="mono"
              style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap" }}
            >
              {valueOf(r)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
