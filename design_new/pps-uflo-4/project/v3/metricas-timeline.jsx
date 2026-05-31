/* global React, METRICS, TIMELINE, FUNNEL, TREND_DATA, fmt, ORIENT_VAR */

// ── LÍNEA DE TIEMPO · hitos del ciclo ─────────────────────────────────────
function TimelineView({ year }) {
  const events = (typeof TIMELINE !== 'undefined' && TIMELINE[year]) || [];
  const TONE = {
    accent: 'var(--accent)', warn: 'var(--warn)', ok: 'var(--ok)', ai: 'var(--ai)',
  };
  const ICON = { lanzamiento: 'rocket_launch', inscripcion: 'how_to_reg', seleccion: 'task_alt', inicio: 'play_circle', cierre: 'verified', convenio: 'handshake' };
  return (
    <section style={{ padding: '32px 0 0' }}>
      <div style={{ marginBottom: 8 }}>
        <span className="eyebrow">Cómo se movió el ciclo {year}</span>
        <h2 className="serif" style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Línea de tiempo del programa
        </h2>
      </div>
      <div style={{ position: 'relative', marginTop: 28, paddingLeft: 4 }}>
        {/* rail */}
        <div style={{ position: 'absolute', left: 19, top: 6, bottom: 6, width: 1, background: 'var(--rule-2)' }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.map((e, i) => {
            const c = TONE[e.tone] || 'var(--ink)';
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 18, alignItems: 'flex-start', padding: '12px 0' }}>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 9, background: `color-mix(in oklab, ${c} 13%, var(--paper))`,
                    color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--paper)', zIndex: 1,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{ICON[e.tipo] || 'circle'}</span>
                  </span>
                </div>
                <div style={{ minWidth: 0, paddingBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: c }}>{e.fecha}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{e.titulo}</span>
                  </div>
                  <div className="meta" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.45 }}>{e.detalle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── REPORTE EJECUTIVO · one-pager imprimible ──────────────────────────────
function ExecutiveReport({ year }) {
  const m = METRICS[year];
  const funnel = (typeof FUNNEL !== 'undefined' && FUNNEL[year]) || [];
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  const heroRows = [
    { label: 'Matrícula generada', v: m.matriculaGenerada.value, ctx: 'Nuevos ingresantes en el año' },
    { label: 'Finalizados', v: m.alumnosFinalizados.value, ctx: 'Acreditaciones cerradas' },
    { label: 'Matrícula activa', v: m.matriculaActiva.value, ctx: 'Alumnos en el sistema' },
  ];
  const segRows = [
    { label: 'Sin ninguna PPS', v: m.sinPps.value },
    { label: 'Próximos a finalizar', v: m.proximosFinalizar.value },
    { label: 'Haciendo PPS', v: m.haciendoPps.value },
  ];
  const instRows = [
    { label: 'PPS lanzadas', v: m.ppsLanzadas.value },
    { label: 'Instituciones activas', v: m.institucionesActivas.value },
    { label: 'Cupos ofrecidos', v: m.cuposOfrecidos.value },
    { label: 'Nuevos convenios', v: m.nuevosConvenios.value },
  ];

  return (
    <section className="exec-report" style={{ padding: '32px 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <span className="eyebrow">Para imprimir o llevar a reunión</span>
          <h2 className="serif" style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Reporte ejecutivo · {year}
          </h2>
        </div>
        <button className="btn btn-primary press no-print" onClick={() => window.print()}>
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>print</span>
          Imprimir / PDF
        </button>
      </div>

      {/* Hoja */}
      <div className="exec-sheet" style={{ marginTop: 22, border: '1px solid var(--rule-2)', borderRadius: 16, background: 'var(--paper)', padding: 36 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '2px solid var(--ink)', paddingBottom: 16, marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="serif" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Estado del programa de PPS</div>
            <div className="meta" style={{ fontSize: 13, marginTop: 4 }}>Ciclo lectivo {year} · UFLO Psicología</div>
          </div>
          <div className="meta mono" style={{ fontSize: 11.5, textAlign: 'right', lineHeight: 1.6 }}>
            <div>Emitido {today}</div>
            <div style={{ color: 'var(--ink-4)' }}>Coordinación PPS</div>
          </div>
        </div>

        <ReportBlock title="Matrícula" rows={heroRows} big />
        <ReportBlock title="Seguimiento de estudiantes" rows={segRows} />
        <ReportBlock title="Red de instituciones" rows={instRows} />

        {/* Embudo resumido */}
        <div style={{ marginTop: 26 }}>
          <div className="label" style={{ marginBottom: 12 }}>Embudo del ciclo</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${funnel.length}, 1fr)`, gap: 0, border: '1px solid var(--rule-2)', borderRadius: 10, overflow: 'hidden' }}>
            {funnel.map((s, i) => (
              <div key={s.key} style={{ padding: '14px 12px', borderRight: i < funnel.length - 1 ? '1px solid var(--rule-2)' : 'none' }}>
                <div className="mono" style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-0.03em', color: 'var(--ink)' }}>{s.value}</div>
                <div className="meta" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 28, paddingTop: 14, borderTop: '1px solid var(--rule-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ink-3)' }}>shield</span>
          <span className="meta" style={{ fontSize: 11.5 }}>
            Datos del sistema de gestión de PPS. Hermes solo detecta y propone; nunca envía ni cambia estados.
          </span>
        </div>
      </div>
    </section>
  );
}

function ReportBlock({ title, rows, big }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div className="label" style={{ marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 20 }}>
        {rows.map(r => (
          <div key={r.label}>
            <div className="mono" style={{ fontSize: big ? 38 : 28, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--ink)' }}>{fmt(r.v)}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 8 }}>{r.label}</div>
            {r.ctx && <div className="meta" style={{ fontSize: 11.5, marginTop: 2 }}>{r.ctx}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { TimelineView, ExecutiveReport });
