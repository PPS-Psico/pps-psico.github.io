/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor,
   TopBar, IngresoCard, EgresoCard, CorreccionCard, VERIF_META,
   SOL_INGRESO, SOL_EGRESO, SOL_CORRECCIONES, SOL_PRIVACY */
const { useState, useEffect, useMemo } = React;

// ── SubTabs (top) ────────────────────────────────────────────────────
function SubTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--paper-2)', border: '1px solid var(--rule-2)' }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} className="press" style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '9px 14px', borderRadius: 9, border: 0,
            background: on ? 'var(--paper)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: on ? '0 1px 3px rgba(20,19,16,0.1)' : 'none', transition: 'all .12s ease',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className="mono" style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 999, background: on ? 'var(--ink)' : 'var(--rule-2)', color: on ? 'var(--paper)' : 'var(--ink-3)', fontWeight: 600 }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── FilterTabs (per tab) ─────────────────────────────────────────────
function FilterTabs({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const on = value === o.value;
        const special = o.tone === 'ai' || o.tone === 'warn';
        const toneC = o.tone === 'ai' ? 'var(--ai)' : o.tone === 'warn' ? 'var(--warn)' : 'var(--ink)';
        const toneS = o.tone === 'ai' ? 'var(--ai-soft)' : o.tone === 'warn' ? 'var(--warn-soft)' : 'var(--paper-2)';
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="press" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
            border: `1px solid ${on ? (special ? toneC : 'var(--ink)') : 'var(--rule-2)'}`,
            background: on ? (special ? toneS : 'var(--ink)') : 'transparent',
            color: on ? (special ? toneC : 'var(--paper)') : 'var(--ink-2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {o.icon && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{o.icon}</span>}
            {o.label}
            {o.count != null && <span className="mono" style={{ fontSize: 10.5, opacity: 0.75 }}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
      <span className="material-symbols-outlined" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: 'var(--ink-4)' }}>search</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field" style={{ paddingLeft: 36, fontSize: 13 }} />
    </div>
  );
}

function PrivacyChip() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, background: 'var(--ai-soft)', color: 'var(--ai)', fontSize: 11.5, fontWeight: 500 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield_lock</span>
      {SOL_PRIVACY.texto}
    </div>
  );
}

function GroupHeader({ dotColor, text, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px', paddingLeft: 2 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor }}></span>
      <span className="label">{text} ({count})</span>
    </div>
  );
}

function CollapsibleHistory({ count, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 24 }}>
      <button onClick={() => setOpen(o => !o)} className="press" style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '12px 14px',
        borderRadius: 10, border: '1px solid var(--rule-2)', background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--ink-4)' }}>history</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Historial</span>
        <span className="mono" style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: 'var(--paper-2)', color: 'var(--ink-3)' }}>{count}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ink-4)', marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
      </button>
      {open && <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>}
    </div>
  );
}

function EmptyState({ icon, title, msg }) {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ width: 54, height: 54, borderRadius: 999, background: 'var(--paper-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 26, color: 'var(--ink-4)' }}>{icon}</span>
      </div>
      <div className="serif" style={{ marginTop: 14, fontSize: 17, fontWeight: 700, color: 'var(--ink-2)' }}>{title}</div>
      <div className="meta" style={{ marginTop: 6, maxWidth: 280, marginInline: 'auto', lineHeight: 1.5 }}>{msg}</div>
    </div>
  );
}

// ── Reject modal (Correcciones) ──────────────────────────────────────
function RejectModal({ sol, onClose, onConfirm }) {
  const [comentario, setComentario] = useState('');
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--rule-2)' }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Rechazar solicitud</h3>
          <div className="meta" style={{ marginTop: 4 }}>{sol.alumno.nombre} · {sol.tipo === 'modificacion' ? 'modificación' : 'nueva PPS'}</div>
        </div>
        <div style={{ padding: 20 }}>
          <label className="label" style={{ display: 'block', marginBottom: 6, fontSize: 9.5 }}>Motivo del rechazo <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)', fontWeight: 400 }}>(se le envía al alumno)</span></label>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={4} className="field" placeholder="Explicá por qué se rechaza…"></textarea>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--rule-2)', background: 'var(--paper-2)' }}>
          <button onClick={onClose} className="btn btn-sm press">Cancelar</button>
          <button onClick={() => onConfirm(comentario)} disabled={!comentario.trim()} className="btn btn-sm press" style={{ background: 'var(--crit)', color: 'var(--paper)', borderColor: 'var(--crit)', opacity: comentario.trim() ? 1 : 0.5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
      display: 'flex', alignItems: 'center', gap: 9, padding: '11px 18px', borderRadius: 999,
      background: 'var(--ink)', color: 'var(--paper)', fontSize: 13, fontWeight: 500,
      boxShadow: '0 8px 30px rgba(20,19,16,0.25)', animation: 'fadeIn .15s ease',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{toast.icon || 'check'}</span>
      {toast.msg}
    </div>
  );
}

const DEFAULTS = /*EDITMODE-BEGIN*/{ "accent": "#1F3A8A" }/*EDITMODE-END*/;
const ACCENT_OPTIONS = ['#1F3A8A', '#1E4D3A', '#9C3D14', '#5A2D86'];

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('sol-tab') || 'ingreso'; } catch { return 'ingreso'; }
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  useEffect(() => { try { localStorage.setItem('sol-tab', tab); } catch {} }, [tab]);
  useEffect(() => { document.documentElement.style.setProperty('--accent', t.accent); document.documentElement.style.setProperty('--accent-soft', t.accent + '14'); }, [t.accent]);
  useEffect(() => { setFilter('all'); setExpandedId(null); }, [tab]);

  const showToast = (info) => { setToast(info); setTimeout(() => setToast(null), 2400); };
  const toggle = (id) => setExpandedId(prev => prev === id ? null : id);

  // counts for subtabs (pending only)
  const counts = useMemo(() => ({
    ingreso: SOL_INGRESO.filter(s => !['Realizada', 'No se pudo concretar', 'Archivado'].includes(s.estado)).length,
    egreso: SOL_EGRESO.filter(s => s.estado !== 'Finalizada').length,
    correcciones: SOL_CORRECCIONES.filter(s => s.estado === 'pendiente').length,
  }), []);

  const tabs = [
    { id: 'ingreso', label: 'Ingreso', icon: 'login', count: counts.ingreso },
    { id: 'egreso', label: 'Egreso', icon: 'logout', count: counts.egreso },
    { id: 'correcciones', label: 'Correcciones', icon: 'edit_note', count: counts.correcciones },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar user="Luis Battaglia" active="solicitudes" />

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 32px 80px' }}>
        {/* Page head */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <span className="eyebrow">Panel académico · PPS</span>
            <h1 className="serif" style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em' }}>Solicitudes</h1>
          </div>
          <PrivacyChip />
        </div>

        <SubTabs tabs={tabs} active={tab} onChange={setTab} />

        <div style={{ marginTop: 20 }}>
          {tab === 'ingreso' && <IngresoView {...{ search, setSearch, filter, setFilter, expandedId, toggle, showToast }} />}
          {tab === 'egreso' && <EgresoView {...{ search, setSearch, expandedId, toggle, showToast }} />}
          {tab === 'correcciones' && <CorreccionesView {...{ filter, setFilter, expandedId, toggle, showToast, onReject: setRejecting }} />}
        </div>
      </main>

      {rejecting && (
        <RejectModal sol={rejecting} onClose={() => setRejecting(null)} onConfirm={() => { setRejecting(null); showToast({ msg: 'Solicitud rechazada · se notificó al alumno', icon: 'close' }); }} />
      )}
      <Toast toast={toast} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Acento" />
        <TweakColor label="Color" value={t.accent} options={ACCENT_OPTIONS} onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

// ── INGRESO view ─────────────────────────────────────────────────────
function IngresoView({ search, setSearch, filter, setFilter, expandedId, toggle, showToast }) {
  const norm = (s) => (s || '').toLowerCase();
  const list = useMemo(() => {
    const q = norm(search);
    return SOL_INGRESO.filter(s =>
      !q || norm(s.alumno.nombre).includes(q) || norm(s.alumno.legajo).includes(q) || norm(s.institucion.nombre).includes(q)
    );
  }, [search]);

  const filtered = useMemo(() => list.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'priorizo') return s.hermesPrioritized;
    if (filter === 'sin_mov') return s.daysSinceUpdate > 4 && !['Realizada', 'No se pudo concretar', 'Archivado'].includes(s.estado);
    return s.estado === filter;
  }), [list, filter]);

  const isHistory = (s) => ['Realizada', 'No se pudo concretar', 'Archivado'].includes(s.estado);
  const pend = filtered.filter(s => !isHistory(s));
  const hist = filtered.filter(isHistory);

  const opts = [
    { value: 'all', label: 'Todas', count: list.length },
    { value: 'priorizo', label: 'Hermes priorizó', icon: 'auto_awesome', tone: 'ai', count: list.filter(s => s.hermesPrioritized).length },
    { value: 'sin_mov', label: 'Sin movimiento +4d', icon: 'timer', tone: 'warn', count: list.filter(s => s.daysSinceUpdate > 4 && !['Realizada','No se pudo concretar','Archivado'].includes(s.estado)).length },
    { value: 'Pendiente', label: 'Pendiente' },
    { value: 'En conversaciones', label: 'En conversaciones' },
    { value: 'Realizando convenio', label: 'Realizando convenio' },
    { value: 'Realizada', label: 'Realizada' },
  ];

  const goGestion = () => { try { localStorage.setItem('gestion-view-mode', 'instituciones'); } catch {} window.location.href = 'Gestion.html'; };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por alumno, legajo o institución…" />
        <span className="meta">{list.length} solicitudes</span>
      </div>
      <div style={{ marginBottom: 20 }}><FilterTabs options={opts} value={filter} onChange={setFilter} /></div>

      {pend.length === 0 && hist.length === 0 ? (
        <EmptyState icon="inbox" title="Sin solicitudes" msg="No se encontraron registros con los filtros actuales." />
      ) : (
        <>
          {pend.length > 0 && <>
            <GroupHeader dotColor="var(--accent)" text="Pendientes de gestión" count={pend.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pend.map(s => <IngresoCard key={s.id} sol={s} expanded={expandedId === s.id} onToggle={() => toggle(s.id)} onToast={showToast} onVerGestion={goGestion} />)}
            </div>
          </>}
          {hist.length > 0 && (
            <CollapsibleHistory count={hist.length}>
              {hist.map(s => <IngresoCard key={s.id} sol={s} expanded={expandedId === s.id} onToggle={() => toggle(s.id)} onToast={showToast} onVerGestion={goGestion} />)}
            </CollapsibleHistory>
          )}
        </>
      )}
    </div>
  );
}

// ── EGRESO view ──────────────────────────────────────────────────────
function EgresoView({ search, setSearch, expandedId, toggle, showToast }) {
  const norm = (s) => (s || '').toLowerCase();
  const list = useMemo(() => {
    const q = norm(search);
    return SOL_EGRESO.filter(s => !q || norm(s.alumno.nombre).includes(q) || norm(s.alumno.legajo).includes(q));
  }, [search]);
  const pend = list.filter(s => s.estado !== 'Finalizada');
  const hist = list.filter(s => s.estado === 'Finalizada');

  // summary of verification states among pending
  const summary = useMemo(() => {
    const c = { aprobado: 0, atencion: 0, critico: 0, procesando: 0 };
    pend.forEach(s => { c[s.hermes.estado] = (c[s.hermes.estado] || 0) + 1; });
    return c;
  }, [pend]);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por estudiante o legajo…" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['aprobado','Verificadas'],['atencion','Con observaciones'],['critico','Críticas']].map(([k, lbl]) => summary[k] > 0 && (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: VERIF_META[k].c }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{VERIF_META[k].icon}</span>
              {summary[k]} {lbl}
            </span>
          ))}
        </div>
      </div>

      {pend.length === 0 && hist.length === 0 ? (
        <EmptyState icon="task_alt" title="No hay solicitudes pendientes" msg="Cuando un alumno suba su documentación de finalización, la vas a ver acá." />
      ) : (
        <>
          {pend.length > 0 && <>
            <GroupHeader dotColor="var(--warn)" text="Pendientes" count={pend.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pend.map(s => <EgresoCard key={s.id} sol={s} expanded={expandedId === s.id} onToggle={() => toggle(s.id)} onToast={showToast} />)}
            </div>
          </>}
          {hist.length > 0 && (
            <CollapsibleHistory count={hist.length}>
              {hist.map(s => <EgresoCard key={s.id} sol={s} expanded={expandedId === s.id} onToggle={() => toggle(s.id)} onToast={showToast} />)}
            </CollapsibleHistory>
          )}
        </>
      )}
    </div>
  );
}

// ── CORRECCIONES view ────────────────────────────────────────────────
function CorreccionesView({ filter, setFilter, expandedId, toggle, showToast, onReject }) {
  const [subtab, setSubtab] = useState('modificaciones');
  const all = SOL_CORRECCIONES.filter(s => subtab === 'modificaciones' ? s.tipo === 'modificacion' : s.tipo === 'nueva');
  const filtered = all.filter(s => filter === 'all' ? true : s.estado === filter);

  const opts = [
    { value: 'all', label: 'Todas', count: all.length },
    { value: 'pendiente', label: 'Pendiente', count: all.filter(s => s.estado === 'pendiente').length },
    { value: 'aprobada', label: 'Aprobada', count: all.filter(s => s.estado === 'aprobada').length },
    { value: 'rechazada', label: 'Rechazada', count: all.filter(s => s.estado === 'rechazada').length },
  ];

  return (
    <div>
      {/* inner subtabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['modificaciones', 'Modificaciones', 'edit'], ['nuevas', 'Nuevas PPS', 'add_circle']].map(([id, lbl, ic]) => {
          const on = subtab === id;
          return (
            <button key={id} onClick={() => { setSubtab(id); setFilter('all'); }} className="press" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9,
              border: `1px solid ${on ? 'var(--ink)' : 'var(--rule-2)'}`, background: on ? 'var(--ink)' : 'transparent',
              color: on ? 'var(--paper)' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{ic}</span>{lbl}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 20 }}><FilterTabs options={opts} value={filter} onChange={setFilter} /></div>

      {filtered.length === 0 ? (
        <EmptyState icon="inbox" title="Sin solicitudes" msg={`No hay ${subtab === 'modificaciones' ? 'modificaciones' : 'nuevas PPS'} con este filtro.`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(s => <CorreccionCard key={s.id} sol={s} expanded={expandedId === s.id} onToggle={() => toggle(s.id)} onToast={showToast} onReject={onReject} />)}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
