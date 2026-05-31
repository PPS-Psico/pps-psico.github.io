/* global React */
const { useState, useMemo, useEffect, useRef } = React;

// ============================================================================
// Briefing — Hermes daily summary at the top
// ============================================================================

// Parse {mark:...}, {warn:...}, {em:...} tags
function parseBriefingLine(line) {
  const parts = [];
  const re = /\{(mark|warn|em):([^}]+)\}/g;
  let last = 0, m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push({ k: "t", v: line.slice(last, m.index) });
    parts.push({ k: m[1], v: m[2] });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ k: "t", v: line.slice(last) });
  return parts;
}

function BriefingText({ line }) {
  const parts = useMemo(() => parseBriefingLine(line), [line]);
  return (
    <>
      {parts.map((p, i) => {
        if (p.k === "t") return <span key={i}>{p.v}</span>;
        if (p.k === "mark") return <span key={i} className="mark">{p.v}</span>;
        if (p.k === "warn") return <span key={i} className="mark-warn">{p.v}</span>;
        if (p.k === "em") return <em key={i}>{p.v}</em>;
        return null;
      })}
    </>
  );
}

function Briefing({ data, compact, onAccept, onDismiss }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <section data-screen-label="01 Briefing" style={{
      borderTop: '1px solid var(--rule-2)',
      borderBottom: '1px solid var(--rule-2)',
      padding: '32px 0',
      position: 'relative',
    }}>
      {/* Header line */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="dot dot-accent dot-live" style={{ color: 'var(--accent)' }}></span>
            Hermes · briefing del día
          </span>
          <span className="mono meta">{data.written_at}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(e => !e)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {expanded ? 'unfold_less' : 'unfold_more'}
            </span>
            {expanded ? 'Plegar' : 'Expandir'}
          </button>
          <button className="btn btn-ghost btn-sm" title="Regenerar">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Greeting — editorial */}
          <h1 className="serif" style={{
            margin: '0 0 24px 0',
            fontSize: compact ? 36 : 48,
            lineHeight: 1.05,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            fontWeight: 400,
          }}>
            {data.greeting}
          </h1>

          {/* Body paragraphs */}
          <div style={{ maxWidth: 880, marginBottom: 28 }}>
            {data.body.map((line, i) => (
              <p key={i} className="briefing-body" style={{ margin: '0 0 16px 0' }}>
                <BriefingText line={line} />
              </p>
            ))}
          </div>

          {/* Inline metrics row */}
          <div style={{
            display: 'flex',
            gap: 0,
            borderTop: '1px solid var(--rule-2)',
            marginTop: 24,
            paddingTop: 20,
            flexWrap: 'wrap',
          }}>
            {data.metrics.map((m, i) => (
              <div key={m.k} style={{
                flex: '1 1 0',
                minWidth: 120,
                paddingRight: 24,
                borderRight: i < data.metrics.length - 1 ? '1px solid var(--rule-2)' : 'none',
                paddingLeft: i === 0 ? 0 : 24,
              }}>
                <div className="num-lg" style={{ color: m.k === 'datos' || m.k === 'solicitudes' ? 'var(--ink-3)' : 'var(--ink)' }}>
                  {m.n}
                </div>
                <div className="label" style={{ marginTop: 6 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <button className="btn btn-primary press" onClick={onAccept}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_downward</span>
              Empezar por lo prioritario
            </button>
            <button className="btn press">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
              Revisar 3 borradores
            </button>
            <button className="btn btn-ghost press" onClick={onDismiss}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
              Briefings anteriores
            </button>
            <div style={{ marginLeft: 'auto' }} className="meta">
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: '-3px' }}>info</span>
              {' '}Sugerencias supervisadas. Nada se envía sin tu aprobación.
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================================
// Priorities — Centro de Acción as numbered editorial list
// ============================================================================

function PriorityRow({ p, index, density }) {
  const dotClass = p.tone === 'warn' ? 'dot-warn' : p.tone === 'accent' ? 'dot-accent' : p.tone === 'ok' ? 'dot-ok' : 'dot-mute';
  const padV = density === 'compact' ? 14 : 20;
  return (
    <div className="row-hover" style={{
      display: 'grid',
      gridTemplateColumns: '48px 1fr auto',
      gap: 24,
      padding: `${padV}px 8px`,
      borderTop: '1px solid var(--rule-2)',
      alignItems: 'center',
    }}>
      {/* index */}
      <div className="mono" style={{ fontSize: 13, color: 'var(--ink-4)', fontWeight: 500 }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* body */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span className={`dot ${dotClass}`}></span>
          <span className="label">{p.eyebrow}</span>
          {p.extra.draftReady && (
            <span className="label" style={{ color: 'var(--accent)', borderLeft: '1px solid var(--rule-2)', paddingLeft: 10 }}>
              borrador listo
            </span>
          )}
          {!p.extra.phone && p.extra.phone === false && (
            <span className="label" style={{ color: 'var(--warn)', borderLeft: '1px solid var(--rule-2)', paddingLeft: 10 }}>
              falta teléfono
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: density === 'compact' ? 17 : 19, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            {p.title}
          </h3>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.4 }}>
          {p.detail}
        </p>
        <div className="meta mono" style={{ marginTop: 6 }}>{p.meta}</div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" title="Posponer">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>snooze</span>
        </button>
        <button className="btn btn-ghost btn-sm" title="Descartar">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
        <button className="btn press btn-sm">
          {p.cta}
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_outward</span>
        </button>
      </div>
    </div>
  );
}

function Priorities({ items, density }) {
  return (
    <section data-screen-label="02 Prioridades" style={{ padding: '40px 0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">Centro de acción · prioridades del día</span>
          <h2 className="serif" style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 400, letterSpacing: '-0.02em' }}>
            <em>Qué</em> hacer ahora
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="meta">
          <span className="mono">{items.length}</span> señales · ordenadas por urgencia
        </div>
      </div>

      <div>
        {items.map((p, i) => <PriorityRow key={p.id} p={p} index={i} density={density} />)}
        <div style={{ borderTop: '1px solid var(--rule-2)', padding: '14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="meta">Cuando esté la bandeja vacía, Hermes ofrecerá próximas oportunidades de relanzamiento.</span>
          <button className="btn btn-ghost btn-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
            Filtros
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Sparkline
// ============================================================================

function Sparkline({ values, w = 96, h = 28 }) {
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = w / Math.max(1, values.length - 1);
  const points = values.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4) - 2]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const fill = `M 0 ${h} ${path.slice(2)} L ${w} ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={fill} className="spark-fill" />
      <path d={path} className="spark" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2} fill="var(--ink)" />
    </svg>
  );
}

// ============================================================================
// Agenda + Pulse split
// ============================================================================

function Agenda({ items }) {
  return (
    <section data-screen-label="03 Agenda" style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span className="eyebrow">Agenda</span>
          <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em' }}>
            Hoy y esta semana
          </h3>
        </div>
        <button className="btn btn-ghost btn-sm">
          Ver todos
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_outward</span>
        </button>
      </div>
      <div>
        {items.map((it, i) => {
          const dotClass = it.tone === 'warn' ? 'dot-warn' : it.tone === 'accent' ? 'dot-accent' : 'dot-mute';
          return (
            <div key={i} className="row-hover" style={{
              display: 'grid',
              gridTemplateColumns: '68px 1fr auto',
              gap: 12,
              padding: '12px 6px',
              borderTop: '1px solid var(--rule-2)',
              alignItems: 'flex-start',
            }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {it.when}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span className={`dot ${dotClass}`}></span>
                  <span className="label" style={{ fontSize: 10 }}>{it.tag}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{it.title}</div>
                <div className="meta">{it.who}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" title="Marcar hecho">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Pulse({ items }) {
  return (
    <section data-screen-label="04 Pulse" style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span className="eyebrow">Pulso operativo</span>
          <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em' }}>
            Estado de las PPS
          </h3>
        </div>
        <span className="meta mono">últimos 14 días</span>
      </div>

      <div>
        {items.map((m, i) => (
          <div key={i} className="row-hover" style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 16,
            padding: '14px 6px',
            borderTop: '1px solid var(--rule-2)',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {m.warn && <span className="dot dot-warn"></span>}
              <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{m.k}</span>
            </div>
            <Sparkline values={m.trend} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 72, justifyContent: 'flex-end' }}>
              <span className="num-md">{m.n}</span>
              <span className="mono meta" style={{ color: m.delta.startsWith('+') && m.warn ? 'var(--warn)' : 'var(--ink-3)' }}>
                {m.delta}
              </span>
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--rule-2)', padding: '12px 6px' }}>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'space-between' }}>
            <span>Abrir métricas completas</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_outward</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Drafts panel — Hermes-prepared email drafts
// ============================================================================

function Drafts({ items }) {
  return (
    <section data-screen-label="05 Borradores" style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="dot dot-accent"></span>
            Borradores listos · revisión humana
          </span>
          <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em' }}>
            Para enviar después de revisar
          </h3>
        </div>
        <span className="meta mono">{items.length} borradores</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '1px solid var(--rule-2)' }}>
        {items.map((d, i) => (
          <div key={i} className="row-hover" style={{
            padding: '18px 18px',
            borderRight: i < items.length - 1 ? '1px solid var(--rule-2)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 160,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="label">Para</span>
              <span className="mono meta" title="Confianza del modelo">
                {Math.round(d.confidence * 100)}%
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{d.to}</div>
            <div className="serif" style={{ fontSize: 18, lineHeight: 1.25, color: 'var(--ink-2)', fontStyle: 'italic' }}>
              "{d.subject}"
            </div>
            <div className="meta">{d.lines} líneas · estilo formal</div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm press" style={{ flex: 1, justifyContent: 'center' }}>
                Revisar
              </button>
              <button className="btn btn-ghost btn-sm" title="Descartar">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Activity log
// ============================================================================

function ActivityLog({ items }) {
  const kindIcon = {
    ai: 'auto_awesome',
    student: 'school',
    institution: 'apartment',
    system: 'memory',
    you: 'person',
  };
  const kindColor = {
    ai: 'var(--accent)',
    student: 'var(--ink-2)',
    institution: 'var(--ink-2)',
    system: 'var(--ink-4)',
    you: 'var(--ink-2)',
  };
  return (
    <section data-screen-label="06 Actividad" style={{ padding: '40px 0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span className="eyebrow">Bitácora</span>
          <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em' }}>
            Actividad reciente
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm">Hermes</button>
          <button className="btn btn-ghost btn-sm">Estudiantes</button>
          <button className="btn btn-ghost btn-sm">Instituciones</button>
          <button className="btn btn-ghost btn-sm">Sistema</button>
        </div>
      </div>
      <div>
        {items.map((a, i) => (
          <div key={i} className="row-hover" style={{
            display: 'grid',
            gridTemplateColumns: '80px 28px 1fr auto',
            gap: 16,
            padding: '10px 6px',
            borderTop: '1px solid var(--rule-2)',
            alignItems: 'center',
          }}>
            <div className="mono meta">{a.t}</div>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: kindColor[a.kind] }}>
              {kindIcon[a.kind]}
            </span>
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{a.who}</span>
              {' '}<span style={{ color: 'var(--ink-3)' }}>·</span>{' '}
              {a.text}
            </div>
            <div>
              {a.link && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}>
                  {a.link}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Top bar
// ============================================================================

function TopBar({ user, today, time }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'color-mix(in oklab, var(--paper) 92%, transparent)',
      backdropFilter: 'blur(8px) saturate(1.1)',
      WebkitBackdropFilter: 'blur(8px) saturate(1.1)',
      borderBottom: '1px solid var(--rule-2)',
    }}>
      <div className="topbar-inner" style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
        {/* Logo / wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            ψ
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Mi Panel Académico</span>
            <span className="meta wordmark-sub" style={{ whiteSpace: 'nowrap' }}>PPS · UFLO Psicología</span>
          </div>
        </div>

        {/* Tabs */}
        <nav className="topbar-tabs" style={{ display: 'flex', gap: 2, marginLeft: 16, flexShrink: 0 }}>
          {[
            { k: 'inicio', label: 'Inicio', active: true },
            { k: 'lanzador', label: 'Lanzador' },
            { k: 'gestion', label: 'Gestión' },
            { k: 'solicitudes', label: 'Solicitudes', badge: 7 },
            { k: 'metricas', label: 'Métricas' },
            { k: 'herramientas', label: 'Herramientas' },
          ].map(t => (
            <button key={t.k} className="press" style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '6px 12px', borderRadius: 8,
              fontSize: 13, fontWeight: t.active ? 600 : 500,
              color: t.active ? 'var(--ink)' : 'var(--ink-3)',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              position: 'relative',
            }}>
              {t.label}
              {t.badge && (
                <span className="mono" style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 4,
                  background: 'var(--warn-soft)', color: 'var(--warn)', fontWeight: 600,
                }}>
                  {t.badge}
                </span>
              )}
              {t.active && (
                <span style={{ position: 'absolute', left: 12, right: 12, bottom: -15, height: 2, background: 'var(--ink)' }}></span>
              )}
            </button>
          ))}
        </nav>

        {/* Search */}
        <div className="topbar-right" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexShrink: 1 }}>
          <button className="btn btn-ghost btn-sm topbar-search" style={{ gap: 10, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0 }}>search</span>
            <span className="meta topbar-search-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Buscar estudiante, institución, PPS…</span>
            <span className="mono topbar-kbd" style={{ fontSize: 10, padding: '2px 5px', border: '1px solid var(--rule-2)', borderRadius: 4, color: 'var(--ink-3)', flexShrink: 0 }}>⌘K</span>
          </button>
          <button className="btn btn-ghost btn-sm" title="Notificaciones" style={{ flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>notifications</span>
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--rule-2)', flexShrink: 0 }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
              LB
            </div>
            <div className="topbar-user" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{user}</span>
              <span className="meta" style={{ fontSize: 10 }}>Coord. PPS</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Page header (the date / greeting line)
// ============================================================================

function PageHead({ today, time }) {
  return (
    <div style={{ padding: '36px 0 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
      <div>
        <span className="eyebrow">Admin · Inicio</span>
        <h1 style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--ink-3)', fontWeight: 500 }}>
          {today} <span className="mono" style={{ marginLeft: 8 }}>· {time}</span>
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn press">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Nuevo lanzamiento
        </button>
        <button className="btn press">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event_note</span>
          Nuevo recordatorio
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  Briefing, Priorities, Agenda, Pulse, Drafts, ActivityLog, TopBar, PageHead, Sparkline
});
