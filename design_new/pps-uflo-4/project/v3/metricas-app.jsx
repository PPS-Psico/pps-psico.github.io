/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor,
   TopBar, MetricsHead, HeroMetric, KpiCard, Band, SectionLead, Funnel, BarChart, Distribution, TrendLine, TopInstituciones, DrillModal,
   TimelineView, ExecutiveReport,
   METRICS, FUNNEL, TIMELINE, ENROLLMENT_EVOLUTION, TREND_DATA, AVAILABLE_YEARS, buildOccupancy, HERO_SPARK, buildTopInst, fmt */
const { useState, useEffect, useMemo } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#1F3A8A",
  "theme": "light"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = ['#1F3A8A', '#1E4D3A', '#9C3D14', '#3A3A3A'];
const ACCENT_DARK = { '#1F3A8A': '#8FB1FF', '#1E4D3A': '#8FC7A5', '#9C3D14': '#E69A6B', '#3A3A3A': '#C4C4C4' };

// Orientation palette tokens (carried here so Métricas matches Lanzador's register)
const ORIENT_TOKENS = `
  :root {
    --orient-clinica: #3D7A4B; --orient-educacional: #2E5BA8;
    --orient-laboral: #A66626; --orient-comunitaria: #6E429E;
  }
  html.dark {
    --orient-clinica: #88BD96; --orient-educacional: #8FB1FF;
    --orient-laboral: #E4965D; --orient-comunitaria: #C9A4F2;
  }
  @media (max-width: 860px) {
    .grid-3, .grid-4 { grid-template-columns: 1fr 1fr !important; }
    .charts-2col { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 560px) {
    .grid-3, .grid-4 { grid-template-columns: 1fr !important; }
  }
  @media print {
    .no-print, .twk-panel, header[role], .subtabs-row { display: none !important; }
    body { background: #fff; }
    .exec-sheet { border: none !important; padding: 0 !important; }
  }
`;

const SUBTABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'bar_chart' },
  { id: 'timeline', label: 'Línea de tiempo', icon: 'timeline' },
  { id: 'reporte', label: 'Reporte ejecutivo', icon: 'summarize' },
];

function SubTabs({ active, onChange }) {
  return (
    <div className="subtabs-row" style={{ display: 'flex', gap: 4, padding: '20px 0 0', borderBottom: '1px solid var(--rule-2)' }}>
      {SUBTABS.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} className="press" style={{
          border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
          padding: '10px 14px', fontSize: 13.5, fontWeight: t.id === active ? 600 : 500,
          color: t.id === active ? 'var(--ink)' : 'var(--ink-3)',
          display: 'inline-flex', alignItems: 'center', gap: 7, position: 'relative',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{t.icon}</span>
          {t.label}
          {t.id === active && <span style={{ position: 'absolute', left: 8, right: 8, bottom: -1, height: 2, background: 'var(--ink)' }}></span>}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);
  const [year, setYear] = useState(AVAILABLE_YEARS[0]);
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('metricas-tab') || 'dashboard'; } catch { return 'dashboard'; } });
  const [modal, setModal] = useState(null); // { title, subtitle, rows, kind }

  useEffect(() => { try { localStorage.setItem('metricas-tab', tab); } catch {} }, [tab]);
  useEffect(() => { document.documentElement.classList.toggle('dark', t.theme === 'dark'); }, [t.theme]);
  useEffect(() => {
    const c = t.theme === 'dark' ? ACCENT_DARK[t.accent] : t.accent;
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-soft', c + (t.theme === 'dark' ? '1A' : '14'));
  }, [t.accent, t.theme]);

  const m = METRICS[year];
  const prev = METRICS[year - 1];
  const occupancy = useMemo(() => buildOccupancy(year), [year]);
  const topInst = useMemo(() => buildTopInst(year), [year]);
  const asOf = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

  const openKpi = (kpi, title, subtitle, kind = 'student') => setModal({ title, subtitle, rows: kpi.list, kind });
  const openArea = (area) => {
    const row = occupancy.find(r => r.area === area);
    if (row) setModal({ title: `Orientación · ${area}`, subtitle: `${row.value} alumnos en ${year}`, rows: row.list, kind: 'student' });
  };
  const openStage = (s) => setModal({ title: s.label, subtitle: `${s.note} · ${fmt(s.value)} en ${year}`, rows: m.matriculaActiva.list.slice(0, Math.min(s.value, 40)), kind: 'student' });
  const openInst = (r) => setModal({ title: r.nombre, subtitle: `${r.ocupados} de ${r.ofrecidos} cupos ocupados en ${year}`, rows: r.list, kind: 'student' });

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{ORIENT_TOKENS}</style>
      <TopBar user="Luis Battaglia" active="metricas" />

      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px 64px' }}>
        <MetricsHead year={year} years={AVAILABLE_YEARS} onYear={setYear} asOf={asOf} />
        <SubTabs active={tab} onChange={setTab} />

        {tab === 'dashboard' && (
          <>
            {/* — Banda matrícula (3 hero con sparkline) — */}
            <Band cols={3}>
              <HeroMetric kpi={m.matriculaGenerada} label="Matrícula generada" context="Nuevos ingresantes en el año"
                tone="ink" trend={m.trends.matricula_generada} prevYear={prev?.matriculaGenerada.value} spark={HERO_SPARK.matriculaGenerada} year={year}
                onClick={() => openKpi(m.matriculaGenerada, 'Matrícula generada', `${m.matriculaGenerada.value} ingresantes en ${year}`)} />
              <HeroMetric kpi={m.alumnosFinalizados} label="Finalizados" context="Acreditaciones cerradas en el ciclo"
                tone="ok" trend={m.trends.acreditados} prevYear={prev?.alumnosFinalizados.value} spark={HERO_SPARK.finalizados} year={year}
                onClick={() => openKpi(m.alumnosFinalizados, 'Alumnos finalizados', `${m.alumnosFinalizados.value} acreditados en ${year}`)} />
              <HeroMetric kpi={m.matriculaActiva} label="Matrícula activa" context="Alumnos vigentes en el sistema"
                tone="accent" trend={m.trends.activos} prevYear={prev?.matriculaActiva.value} spark={HERO_SPARK.matriculaActiva} year={year}
                onClick={() => openKpi(m.matriculaActiva, 'Matrícula activa', `${m.matriculaActiva.value} alumnos activos en ${year}`)} />
            </Band>

            {/* — Banda seguimiento (4) — */}
            <Band title="Seguimiento de estudiantes" cols={4} top>
              <KpiCard kpi={m.sinPps} label="Sin ninguna PPS" context="Activos sin práctica" tone="warn"
                onClick={() => openKpi(m.sinPps, 'Alumnos sin ninguna PPS', `${m.sinPps.value} activos sin práctica`)} />
              <KpiCard kpi={m.proximosFinalizar} label="Próximos a finalizar" context="≥ 230 hs acumuladas" tone="accent"
                onClick={() => openKpi(m.proximosFinalizar, 'Próximos a finalizar', `${m.proximosFinalizar.value} con ≥230 hs`)} />
              <KpiCard kpi={m.haciendoPps} label="Haciendo PPS" context="Con práctica en curso" tone="ok"
                onClick={() => openKpi(m.haciendoPps, 'Haciendo PPS', `${m.haciendoPps.value} en curso`)} />
              <KpiCard kpi={m.ingresantes} label="Ingresantes del año" context="Crearon cuenta en el ciclo" tone="ink"
                onClick={() => openKpi(m.ingresantes, 'Ingresantes del año', `${m.ingresantes.value} cuentas nuevas en ${year}`)} />
            </Band>

            {/* — Embudo — */}
            <Funnel stages={FUNNEL[year]} onStage={openStage} />

            {/* — Dos columnas de gráficos — */}
            <section style={{ padding: '28px 0', borderTop: '1px solid var(--rule-2)' }}>
              <div className="charts-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <BarChart data={ENROLLMENT_EVOLUTION} year={year} />
                  <Distribution dist={m.orientation_distribution} onArea={openArea} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <TrendLine data={TREND_DATA} year={year} />
                  <TopInstituciones rows={topInst} onInst={openInst} />
                </div>
              </div>
            </section>

            {/* — Banda instituciones (4) — */}
            <Band title="Red de instituciones" cols={4} top>
              <KpiCard kpi={m.ppsLanzadas} label="PPS lanzadas" context="Convocatorias del año" tone="ink"
                onClick={() => openKpi(m.ppsLanzadas, 'PPS lanzadas', `${m.ppsLanzadas.value} convocatorias en ${year}`, 'inst')} />
              <KpiCard kpi={m.institucionesActivas} label="Instituciones activas" context="Con PPS este año" tone="ink"
                onClick={() => openKpi(m.institucionesActivas, 'Instituciones activas', `${m.institucionesActivas.value} con PPS en ${year}`, 'inst')} />
              <KpiCard kpi={m.cuposOfrecidos} label="Cupos ofrecidos" context="Sumados en el año" tone="ink"
                onClick={() => openKpi(m.cuposOfrecidos, 'Cupos ofrecidos', `${m.cuposOfrecidos.value} cupos en ${year}`, 'inst')} />
              <KpiCard kpi={m.nuevosConvenios} label="Nuevos convenios" context="Firmados en el ciclo" tone="ok"
                onClick={() => openKpi(m.nuevosConvenios, 'Nuevos convenios', `${m.nuevosConvenios.value} firmados en ${year}`, 'inst')} />
            </Band>

            {/* — Hermes como FUENTE (no como voz) — una métrica dura — */}
            <section style={{ padding: '28px 0', borderTop: '1px solid var(--rule-2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {/* PLACEHOLDER: enchufar a count(gestion_log WHERE accion='sent' / analizado) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 18px', border: '1px solid var(--rule-2)', borderRadius: 14, background: 'var(--paper)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="dot" style={{ background: 'var(--ai)', width: 7, height: 7 }} title="Fuente: Hermes"></span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Conversaciones analizadas por Hermes</div>
                      <div className="meta" style={{ fontSize: 11.5, marginTop: 2 }}>WhatsApp y mail de la lista «Instituciones» · en {year}</div>
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.03em', color: m.hermesConversaciones.value ? 'var(--ink)' : 'var(--ink-4)' }}>
                    {fmt(m.hermesConversaciones.value)}
                  </span>
                </div>
              </div>
              {/* Línea de privacidad — transparencia, no narrativa */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 11.5, color: 'var(--ink-3)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield</span>
                Hermes lee los chats de tu lista «Instituciones» y la casilla de mail. Solo detecta y propone; nunca envía ni cambia estados.
              </div>
            </section>
          </>
        )}

        {tab === 'timeline' && <TimelineView year={year} />}
        {tab === 'reporte' && <ExecutiveReport year={year} />}

        <footer style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--rule-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div className="meta">Mi Panel Académico · PPS · UFLO Psicología</div>
          <div className="meta mono" style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11 }}>
            <span>v3.2 · build 2026.05.26</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="dot dot-ok dot-live" style={{ color: 'var(--ok)', background: 'var(--ok)' }}></span> Hermes online
            </span>
          </div>
        </footer>
      </main>

      <DrillModal open={!!modal} title={modal?.title} subtitle={modal?.subtitle} rows={modal?.rows || []} kind={modal?.kind} onClose={() => setModal(null)} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Apariencia" />
        <TweakRadio label="Tema" value={t.theme} options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} onChange={v => setTweak('theme', v)} />
        <TweakColor label="Acento" value={t.accent} options={ACCENT_OPTIONS} onChange={v => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
