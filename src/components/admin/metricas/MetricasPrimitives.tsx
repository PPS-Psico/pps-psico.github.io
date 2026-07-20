// ──────────────────────────────────────────────────────────────────────────
// MÉTRICAS v3 · primitivas visuales (Paper & Ink · vista ejecutiva)
// Componentes "tontos": reciben datos y disparan callbacks. Sin fetching.
// ──────────────────────────────────────────────────────────────────────────
import React from "react";

export const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-AR").format(Number(n || 0));

export type Tone = "accent" | "warn" | "ok" | "ai" | "ink";
export type OrientKey = "clinica" | "educacional" | "laboral" | "comunitaria" | "sindefinir";

const TONE: Record<Tone, { c: string; s: string }> = {
  accent: { c: "var(--accent)", s: "var(--accent-soft)" },
  warn: { c: "var(--warn)", s: "var(--warn-soft)" },
  ok: { c: "var(--ok)", s: "var(--ok-soft)" },
  ai: { c: "var(--ai)", s: "var(--ai-soft)" },
  ink: { c: "var(--ink)", s: "var(--paper-2)" },
};

export const ORIENT_VAR: Record<OrientKey, string> = {
  clinica: "var(--orient-clinica)",
  educacional: "var(--orient-educacional)",
  laboral: "var(--orient-laboral)",
  comunitaria: "var(--orient-comunitaria)",
  sindefinir: "var(--ink-4)",
};

export const ORIENT_KEY: Record<string, OrientKey> = {
  Clínica: "clinica",
  Educacional: "educacional",
  Laboral: "laboral",
  Comunitaria: "comunitaria",
  "Sin definir": "sindefinir",
};

// ── Sparkline · mini tendencia plurianual ────────────────────────────────
export function Sparkline({
  data,
  activeYear,
  years,
  color = "var(--ink)",
  w = 96,
  h = 30,
}: {
  data: number[];
  activeYear: number;
  years: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const x = (i: number) => 2 + i * ((w - 4) / (data.length - 1));
  const y = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const yi = years.indexOf(activeYear);
  const li = yi >= 0 ? yi : data.length - 1;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx={x(li)} cy={y(data[li])} r="2.6" fill={color} />
    </svg>
  );
}

// ── Variación vs año anterior ─────────────────────────────────────────────
export function Trend({ pct }: { pct?: number | null }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const c = up ? "var(--ok)" : "var(--warn)";
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 12,
        fontWeight: 600,
        color: c,
      }}
    >
      <span className="material-icons" style={{ fontSize: 14 }}>
        {up ? "trending_up" : "trending_down"}
      </span>
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

// ── HERO metric ───────────────────────────────────────────────────────────
export function HeroMetric({
  value,
  label,
  context,
  tone,
  trend,
  prevYear,
  comparisonLabel,
  spark,
  activeYear,
  years,
  onClick,
}: {
  value: number;
  label: string;
  context: string;
  tone: Tone;
  trend?: number | null;
  prevYear?: number | null;
  comparisonLabel?: string | null;
  spark?: number[];
  activeYear: number;
  years: number[];
  onClick: () => void;
}) {
  const T = TONE[tone] || TONE.ink;
  const empty = value === 0;
  return (
    <button onClick={onClick} className="hero press" type="button">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span className="eyebrow">{label}</span>
        {spark && spark.length > 1 && (
          <Sparkline
            data={spark}
            activeYear={activeYear}
            years={years}
            color={tone === "ink" ? "var(--ink-3)" : T.c}
          />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span
          className="mono num"
          style={{ color: empty ? "var(--ink-4)" : tone === "ink" ? "var(--ink)" : T.c }}
        >
          {fmt(value)}
        </span>
        {trend != null && <Trend pct={trend} />}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span className="meta" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
          {context}
        </span>
        {trend != null && prevYear != null && (
          <span
            className="meta mono"
            style={{ fontSize: 11, color: "var(--ink-4)", whiteSpace: "nowrap" }}
          >
            Base {fmt(prevYear)} · {comparisonLabel?.replace("vs. ", "") || activeYear - 1}
          </span>
        )}
      </div>
    </button>
  );
}

// ── KPI compacta ──────────────────────────────────────────────────────────
export function KpiCard({
  value,
  label,
  context,
  tone = "ink",
  loading = false,
  onClick,
}: {
  value: number;
  label: string;
  context: string;
  tone?: Tone;
  loading?: boolean;
  onClick: () => void;
}) {
  const T = TONE[tone] || TONE.ink;
  const empty = !loading && value === 0;
  return (
    <button onClick={onClick} className="kpi press" type="button" aria-busy={loading || undefined}>
      <span className="eyebrow">{label}</span>
      <span
        className="mono num"
        style={{ color: empty ? "var(--ink-4)" : tone === "ink" ? "var(--ink)" : T.c }}
      >
        {loading ? "…" : fmt(value)}
      </span>
      <span className="ctx">{context}</span>
    </button>
  );
}

// ── Banda genérica ──────────────────────────────────────────────────────────
export function Band({
  title,
  cols,
  top,
  children,
}: {
  title?: string;
  cols: 3 | 4;
  top?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`band${top ? " top" : ""}`}>
      {title && <h2 className="label band-title">{title}</h2>}
      <div className={`grid grid-${cols}`}>{children}</div>
    </section>
  );
}

export function SectionLead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 18,
      }}
    >
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2
          className="display"
          style={{ margin: "4px 0 0", fontSize: 30, lineHeight: 1, letterSpacing: "-0.01em" }}
        >
          {title}
        </h2>
      </div>
      {right && (
        <span className="meta" style={{ fontSize: 12.5 }}>
          {right}
        </span>
      )}
    </div>
  );
}

export { TONE };
