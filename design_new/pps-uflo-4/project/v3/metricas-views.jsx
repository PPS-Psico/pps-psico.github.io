/* global React, METRICS, FUNNEL, ENROLLMENT_EVOLUTION, TREND_DATA, buildOccupancy,
   HERO_SPARK, SPARK_YEARS, buildTopInst */
const { useState: useStateM, useEffect: useEffectM } = React;

// ── Helpers de color por tono ────────────────────────────────────────────
const TONE = {
  accent: { c: 'var(--accent)', s: 'var(--accent-soft)' },
  warn:   { c: 'var(--warn)',   s: 'var(--warn-soft)' },
  ok:     { c: 'var(--ok)',     s: 'var(--ok-soft)' },
  ai:     { c: 'var(--ai)',     s: 'var(--ai-soft)' },
  ink:    { c: 'var(--ink)',    s: 'var(--paper-2)' },
};
const ORIENT_VAR = {
  clinica: 'var(--orient-clinica)', educacional: 'var(--orient-educacional)',
  laboral: 'var(--orient-laboral)', comunitaria: 'var(--orient-comunitaria)',
  sindefinir: 'var(--ink-4)',
};
function fmt(n) { return new Intl.NumberFormat('es-AR').format(n); }

// ── Sparkline · mini tendencia plurianual ─────────────────────────────────
function Sparkline({ data, year, color = 'var(--ink)', w = 96, h = 30 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const x = i => 2 + i * ((w - 4) / (data.length - 1));
  const y = v => h - 3 - ((v - min) / span) * (h - 6);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const yi = SPARK_YEARS.indexOf(year);
  const li = yi >= 0 ? yi : data.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
      <circle cx={x(li)} cy={y(data[li])} r="2.6" fill={color} />
    </svg>
  );
}

// ── PAGE HEAD · masthead ejecutivo serif + selector de año ────────────────
function MetricsHead({ year, years, onYear, asOf }) {
  return (
    <div style={{ padding: '44px 0 26px', borderBottom: '1.5px solid var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">Métricas · coordinación PPS · ciclo {year}</span>
          <h1 className="display" style={{ margin: '6px 0 0', fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.015em' }}>
            El estado del programa
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div role="radiogroup" aria-label="Año" style={{ display: 'inline-flex', padding: 3, gap: 2, border: '1px solid var(--rule-2)', borderRadius: 10, background: 'var(--paper)' }}>
            {years.map(y => (
              <button key={y} role="radio" aria-checked={y === year} onClick={() => onYear(y)} className="mono press" style={{
                border: 0, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: y === year ? 'var(--ink)' : 'transparent',
                color: y === year ? 'var(--paper)' : 'var(--ink-3)', transition: 'all .12s ease',
              }}>{y}</button>
            ))}
          </div>
          <span className="meta mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>al {asOf}</span>
        </div>
      </div>
    </div>
  );
}

// ── Variación vs año anterior ─────────────────────────────────────────────
function Trend({ pct }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const c = up ? 'var(--ok)' : 'var(--warn)';
  return (
    <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600, color: c }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{up ? 'trending_up' : 'trending_down'}</span>
      {up ? '+' : ''}{pct}%
    </span>
  );
}

// ── HERO metric — número protagonista + sparkline ─────────────────────────
function HeroMetric({ kpi, label, context, tone, trend, prevYear, spark, year, onClick }) {
  const T = TONE[tone] || TONE.ink;
  const empty = kpi.value === 0;
  return (
    <button onClick={onClick} className="press" style={{
      display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 24px 22px',
      borderRadius: 16, border: '1px solid var(--rule-2)', background: 'var(--paper)',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minWidth: 0, width: '100%', transition: 'all .12s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--rule-3)'; e.currentTarget.style.background = 'var(--paper-2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rule-2)'; e.currentTarget.style.background = 'var(--paper)'; }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <span className="eyebrow">{label}</span>
        {spark && <Sparkline data={spark} year={year} color={tone === 'ink' ? 'var(--ink-3)' : T.c} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 52, fontWeight: 300, letterSpacing: '-0.045em', lineHeight: 0.9, color: empty ? 'var(--ink-4)' : (tone === 'ink' ? 'var(--ink)' : T.c) }}>{fmt(kpi.value)}</span>
        {trend != null && <Trend pct={trend} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="meta" style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.4 }}>{context}</span>
        {trend != null && prevYear != null && <span className="meta mono" style={{ fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{fmt(prevYear)} en {year - 1}</span>}
      </div>
    </button>
  );
}

// ── KPI compacta (seguimiento / instituciones) ────────────────────────────
function KpiCard({ kpi, label, context, tone = 'ink', dotAi, onClick }) {
  const T = TONE[tone] || TONE.ink;
  const empty = kpi.value === 0;
  return (
    <button onClick={onClick} className="press" style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 16px 15px',
      borderRadius: 14, border: '1px solid var(--rule-2)', background: 'var(--paper)',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minWidth: 0, width: '100%', transition: 'all .12s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--rule-3)'; e.currentTarget.style.background = 'var(--paper-2)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rule-2)'; e.currentTarget.style.background = 'var(--paper)'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {dotAi && <span className="dot" style={{ background: 'var(--ai)', width: 6, height: 6 }} title="Fuente: Hermes"></span>}
        <span className="eyebrow" style={{ color: dotAi ? 'var(--ai)' : 'var(--ink-3)' }}>{label}</span>
      </div>
      <span className="mono" style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1, color: empty ? 'var(--ink-4)' : (tone === 'ink' ? 'var(--ink)' : T.c) }}>{fmt(kpi.value)}</span>
      <span className="meta" style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>{context}</span>
    </button>
  );
}

// ── Banda genérica ────────────────────────────────────────────────────────
function Band({ title, cols, children, top }) {
  return (
    <section style={{ padding: '28px 0', borderTop: top ? '1px solid var(--rule-2)' : 'none' }}>
      {title && <h2 className="label" style={{ margin: '0 0 16px' }}>{title}</h2>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }} className={`grid-${cols}`}>{children}</div>
    </section>
  );
}

function SectionLead({ eyebrow, title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="display" style={{ margin: '4px 0 0', fontSize: 30, lineHeight: 1, letterSpacing: '-0.01em' }}>{title}</h2>
      </div>
      {right && <span className="meta" style={{ fontSize: 12.5 }}>{right}</span>}
    </div>
  );
}

// ── EMBUDO cónico real ────────────────────────────────────────────────────
function Funnel({ stages, onStage }) {
  const max = stages[0].value;
  const endPct = Math.round(stages[stages.length - 1].value / max * 100);
  return (
    <section style={{ padding: '30px 0', borderTop: '1px solid var(--rule-2)' }}>
      <SectionLead eyebrow="El recorrido de una PPS" title="Embudo del ciclo"
        right={`De solicitud a acreditación · ${endPct}% llega al cierre`} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, maxWidth: 760, margin: '0 auto' }}>
        {stages.map((s, i) => {
          const pct = s.value / max * 100;
          const T = TONE[s.tone] || TONE.ink;
          const conv = i === 0 ? 100 : Math.round(s.value / stages[i - 1].value * 100);
          const dropped = i === 0 ? 0 : stages[i - 1].value - s.value;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', color: 'var(--ink-4)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>south</span>
                  <span className="meta mono" style={{ fontSize: 10.5 }}>
                    {conv}% avanza{dropped > 0 ? ` · −${dropped} quedaron` : ''}
                  </span>
                </div>
              )}
              <button onClick={() => onStage(s)} className="press" title={`${s.label} · ${s.value}`} style={{
                width: `${Math.max(pct, 26)}%`, minWidth: 280, border: 0, cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', padding: 0,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                  padding: '13px 18px', borderRadius: 10, background: T.s,
                  border: `1px solid color-mix(in oklab, ${T.c} 22%, transparent)`,
                  transition: 'transform .12s ease', textAlign: 'left',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.label}</div>
                    <div className="meta" style={{ fontSize: 11, marginTop: 1, color: 'var(--ink-3)' }}>{s.note}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-0.03em', color: T.c, flexShrink: 0 }}>{fmt(s.value)}</span>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

// ── Gráfico de barras (evolución de inscriptos) ───────────────────────────
function BarChart({ data, year }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ padding: '20px 20px 16px', border: '1px solid var(--rule-2)', borderRadius: 14, background: 'var(--paper)' }}>
      <span className="eyebrow">Evolución de inscriptos</span>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, marginTop: 20, borderBottom: '1px solid var(--rule-2)' }}>
        {data.map(d => {
          const h = Math.max(4, d.value / max * 128);
          const isYear = d.year === String(year);
          return (
            <div key={d.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: isYear ? 'var(--ink)' : 'var(--ink-4)' }}>{d.value}</span>
              <div title={d.label} style={{
                width: '100%', maxWidth: 40, height: h, borderRadius: '5px 5px 0 0',
                background: isYear ? 'var(--accent)' : 'var(--paper-3)',
                border: d.isProjection ? '1.5px dashed var(--accent)' : 'none', boxSizing: 'border-box',
                transition: 'height .5s cubic-bezier(.3,.7,.4,1)',
              }}></div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {data.map(d => <span key={d.year} className="mono" style={{ flex: 1, textAlign: 'center', fontSize: 11, color: d.year === String(year) ? 'var(--ink-2)' : 'var(--ink-4)' }}>{d.year}</span>)}
      </div>
      <div className="meta" style={{ fontSize: 11, marginTop: 10, color: 'var(--ink-4)' }}>Barra punteada · proyección con habilitados sin cuenta</div>
    </div>
  );
}

// ── Tendencia de matrícula activa (línea SVG refinada) ────────────────────
function TrendLine({ data, year }) {
  const W = 320, H = 132, pad = 18;
  const max = Math.max(...data.map(d => d.value)) * 1.08;
  const min = Math.min(...data.map(d => d.value)) * 0.82;
  const x = i => pad + i * ((W - pad * 2) / (data.length - 1));
  const y = v => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const area = `${pad},${H - pad} ${pts} ${x(data.length - 1)},${H - pad}`;
  const cur = data.find(d => d.year === String(year)) || data[data.length - 1];
  return (
    <div style={{ padding: '20px 20px 16px', border: '1px solid var(--rule-2)', borderRadius: 14, background: 'var(--paper)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow">Tendencia de matrícula activa</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{cur.value}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 14, display: 'block' }} preserveAspectRatio="none">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--rule-2)" strokeWidth="1" />
        <polygon points={area} fill="var(--accent-soft)" />
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => {
          const isYear = d.year === String(year);
          return <circle key={d.year} cx={x(i)} cy={y(d.value)} r={isYear ? 4 : 2.5} fill={isYear ? 'var(--accent)' : 'var(--paper)'} stroke="var(--accent)" strokeWidth="1.5" />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {data.map(d => <span key={d.year} className="mono" style={{ fontSize: 10.5, color: d.year === String(year) ? 'var(--ink-2)' : 'var(--ink-4)' }}>{d.year}</span>)}
      </div>
    </div>
  );
}

// ── Distribución por orientación (share del cohorte) ──────────────────────
function Distribution({ dist, onArea }) {
  const entries = Object.entries(dist);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const keyMap = { 'Clínica': 'clinica', 'Educacional': 'educacional', 'Laboral': 'laboral', 'Comunitaria': 'comunitaria', 'Sin definir': 'sindefinir' };
  return (
    <div style={{ padding: '20px 20px 16px', border: '1px solid var(--rule-2)', borderRadius: 14, background: 'var(--paper)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow">Distribución por orientación</span>
        <span className="meta mono" style={{ fontSize: 11 }}>{total} alumnos</span>
      </div>
      {/* barra de share apilada */}
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', marginTop: 16, gap: 1.5 }}>
        {entries.map(([area, v]) => (
          <div key={area} title={`${area} · ${v}`} style={{ width: `${total ? v / total * 100 : 0}%`, background: ORIENT_VAR[keyMap[area]] }}></div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 14 }}>
        {entries.map(([area, v]) => {
          const pct = total ? Math.round(v / total * 100) : 0;
          return (
            <button key={area} onClick={() => onArea(area)} className="press" style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center',
              padding: '7px 6px', borderRadius: 8, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', minWidth: 0 }}>
                <span className="dot" style={{ background: ORIENT_VAR[keyMap[area]], width: 7, height: 7, flexShrink: 0 }}></span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{area}</span>
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{pct}%</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', minWidth: 28, textAlign: 'right' }}>{v}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── TOP instituciones por cupos (ocupación) ───────────────────────────────
function TopInstituciones({ rows, onInst }) {
  const max = Math.max(...rows.map(r => r.ofrecidos), 1);
  return (
    <div style={{ padding: '20px 20px 16px', border: '1px solid var(--rule-2)', borderRadius: 14, background: 'var(--paper)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow">Top instituciones por cupos</span>
        <span className="meta" style={{ fontSize: 11 }}>ocupados / ofrecidos</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 14 }}>
        {rows.slice(0, 6).map(r => {
          const rate = Math.round(r.ocupados / r.ofrecidos * 100);
          return (
            <button key={r.nombre} onClick={() => onInst(r)} className="press" style={{
              display: 'grid', gridTemplateColumns: '1fr 86px auto', gap: 12, alignItems: 'center',
              padding: '9px 6px', borderRadius: 8, border: 0, borderBottom: '1px solid var(--rule)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', minWidth: 0 }}>
                <span className="dot" style={{ background: ORIENT_VAR[r.orient], width: 7, height: 7, flexShrink: 0 }}></span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</span>
              </span>
              <div style={{ height: 7, background: 'var(--paper-3)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.ofrecidos / max * 100}%`, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'var(--paper-3)' }}></div>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${rate}%`, background: ORIENT_VAR[r.orient] }}></div>
                </div>
              </div>
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{r.ocupados}<span style={{ color: 'var(--ink-4)' }}>/{r.ofrecidos}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── MODAL de drill-down ───────────────────────────────────────────────────
function DrillModal({ open, title, subtitle, rows, kind, onClose }) {
  useEffectM(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  const isInst = kind === 'inst';
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'color-mix(in oklab, var(--ink) 28%, transparent)',
      backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 20px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, maxHeight: '84vh', display: 'flex', flexDirection: 'column',
        background: 'var(--paper)', border: '1px solid var(--rule-3)', borderRadius: 16,
        boxShadow: '0 24px 64px -12px color-mix(in oklab, var(--ink) 30%, transparent)', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--rule-2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 className="display" style={{ margin: 0, fontSize: 25, lineHeight: 1 }}>{title}</h3>
            <div className="meta" style={{ fontSize: 12.5, marginTop: 5 }}>{subtitle}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm press" aria-label="Cerrar" style={{ flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '6px 0' }}>
          {rows.length === 0 && <div className="meta" style={{ padding: '40px 22px', textAlign: 'center' }}>Sin registros para este año.</div>}
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '11px 22px', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</div>
                <div className="meta mono" style={{ fontSize: 11.5, marginTop: 2 }}>
                  {isInst ? r.legajo : `legajo ${r.legajo}`}{r.institucion ? ` · ${r.institucion}` : ''}{r.detalle ? ` · ${r.detalle}` : ''}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {r.horas != null ? `${r.horas} hs` : (isInst && r.cupos != null ? `${r.cupos} cupos` : '')}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="meta mono" style={{ fontSize: 11.5 }}>{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</span>
          <button onClick={onClose} className="btn btn-primary btn-sm press">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  MetricsHead, Trend, HeroMetric, KpiCard, Band, SectionLead, Funnel, BarChart, TrendLine,
  Distribution, TopInstituciones, DrillModal, Sparkline, fmt, ORIENT_VAR,
});
