/* global React, STATES, CONVOCATORIAS */
const { useState, useMemo } = React;

// Group convocatorias by state
function groupByState(convocatorias) {
  const order = ['borrador', 'abierta', 'cerrada', 'seleccionada', 'activa', 'archivada'];
  const groups = order.map(k => ({
    key: k,
    state: STATES[k],
    items: convocatorias.filter(c => c.state === k),
  }));
  return groups;
}

function StateBadge({ state }) {
  const tone = {
    borrador: 'mute', abierta: 'accent', cerrada: 'warn',
    seleccionada: 'accent', activa: 'ok', archivada: 'mute',
  }[state];
  return <span className={`dot dot-${tone}`}></span>;
}

function SideRow({ c, active, onClick }) {
  const tone = {
    borrador: 'mute', abierta: 'accent', cerrada: 'warn',
    seleccionada: 'accent', activa: 'ok', archivada: 'mute',
  }[c.state];

  // State-specific meta line
  let metaLine = '';
  if (c.state === 'borrador')     metaLine = c.institucion ? `${Math.round(c.completion * 100)}% completo` : 'sin institución';
  if (c.state === 'abierta')      metaLine = `${c.inscriptos} inscriptos · cierra ${c.cierreEn}`;
  if (c.state === 'cerrada')      metaLine = `${c.inscriptos} candidatos · ${c.cupos} cupos`;
  if (c.state === 'seleccionada') metaLine = `${c.seleccionados} seleccionados · paso ${c.pasoSeguro} de ${c.seguroSteps.length}`;
  if (c.state === 'activa')       metaLine = c.estadoGestion;
  if (c.state === 'archivada')    metaLine = c.archivadaEn;

  const title = c.nombre || <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>Sin nombre</span>;
  const inst = c.institucion?.nombre || '—';
  const orientaciones = c.orientaciones || [];

  // Highlight pending action
  const needsAction = c.state === 'cerrada' || (c.state === 'abierta' && c.cierreEn === 'mañana');

  return (
    <div className={`side-row ${active ? 'active' : ''}`} onClick={onClick}>
      <div style={{ paddingTop: 8 }}>
        <span className={`dot dot-${tone}`} style={{ display: 'block' }}></span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="side-row-title" style={{
          fontSize: 13, fontWeight: 500, color: 'var(--ink-2)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 2,
        }}>{title}</div>
        <div className="meta" style={{
          fontSize: 11.5,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{inst}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {orientaciones.length > 0 && (
            <span style={{ display: 'inline-flex', gap: 3 }} title={orientaciones.join(' · ')}>
              {orientaciones.slice(0, 3).map(o => (
                <span
                  key={o}
                  className={`dot dot-orient-${o.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`}
                  style={{ width: 6, height: 6, display: 'inline-block' }}
                ></span>
              ))}
            </span>
          )}
          <span className="meta mono" style={{
            fontSize: 10.5, opacity: .8,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{metaLine}</span>
        </div>
      </div>
      {needsAction && (
        <div style={{ paddingTop: 6 }}>
          <span style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
            background: 'var(--warn-soft)', color: 'var(--warn)',
            fontWeight: 700, letterSpacing: '0.04em',
          }}>!</span>
        </div>
      )}
    </div>
  );
}

function Sidebar({ selectedId, onSelect, onNew, collapsed, onToggleCollapsed }) {
  const [query, setQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set(['archivada']));

  const filtered = useMemo(() => {
    if (!query.trim()) return CONVOCATORIAS;
    const q = query.toLowerCase();
    return CONVOCATORIAS.filter(c =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.institucion?.nombre || '').toLowerCase().includes(q)
    );
  }, [query]);

  const groups = useMemo(() => groupByState(filtered), [filtered]);

  const toggle = (k) => setCollapsedGroups(s => {
    const next = new Set(s);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  // Collapsed rail — slim 48px with only state dots + counts
  if (collapsed) {
    return (
      <aside style={{
        width: 56, flexShrink: 0,
        borderRight: '1px solid var(--rule-2)',
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        position: 'sticky', top: 56,
        background: 'var(--paper)',
      }}>
        <button
          onClick={onToggleCollapsed}
          className="press"
          title="Mostrar lista"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '16px 0', borderBottom: '1px solid var(--rule-2)',
            display: 'flex', justifyContent: 'center', color: 'var(--ink-3)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
        </button>
        <button
          onClick={onNew}
          className="press"
          title="Nueva convocatoria"
          style={{
            border: 'none', background: 'var(--ink)', color: 'var(--paper)',
            width: 36, height: 36, borderRadius: 8,
            margin: '14px auto 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
        </button>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {groups.map(g => {
            if (g.items.length === 0) return null;
            const tone = {
              borrador: 'mute', abierta: 'accent', cerrada: 'warn',
              seleccionada: 'accent', activa: 'ok', archivada: 'mute',
            }[g.key];
            return (
              <button
                key={g.key}
                onClick={onToggleCollapsed}
                title={`${g.state.label}: ${g.items.length}`}
                className="press"
                style={{
                  width: '100%', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4,
                  padding: '10px 0', border: 'none', background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span className={`dot dot-${tone}`} style={{ width: 8, height: 8 }}></span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{g.items.length}</span>
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside style={{
      width: 320, flexShrink: 0,
      borderRight: '1px solid var(--rule-2)',
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 56px)',
      position: 'sticky', top: 56,
      background: 'var(--paper)',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em' }}>
            Convocatorias
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono meta" title={`${CONVOCATORIAS.length} en total`}>{CONVOCATORIAS.length}</span>
            <button
              onClick={onToggleCollapsed}
              className="btn btn-ghost btn-sm"
              title="Plegar lista"
              style={{ padding: 4 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
          </div>
        </div>

        <button
          onClick={onNew}
          className="press"
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--ink)', color: 'var(--paper)',
            border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Nueva convocatoria
        </button>

        <div style={{ position: 'relative', marginTop: 10 }}>
          <span className="material-symbols-outlined" style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: 'var(--ink-4)',
          }}>search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar…"
            className="field"
            style={{ paddingLeft: 32, fontSize: 13 }}
          />
        </div>
      </div>

      {/* Groups */}
      <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 16 }}>
        {groups.map(g => {
          if (g.items.length === 0) return null;
          const isCollapsed = collapsedGroups.has(g.key);
          return (
            <div key={g.key} style={{ marginBottom: 4 }}>
              <button
                onClick={() => toggle(g.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 20px 6px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: 14, transition: 'transform .15s ease',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
                    color: 'var(--ink-4)',
                  }}>expand_more</span>
                  {g.state.label}
                </span>
                <span className="mono meta">{g.items.length}</span>
              </button>
              {!isCollapsed && (
                <div>
                  {g.items.map(c => (
                    <SideRow
                      key={c.id}
                      c={c}
                      active={selectedId === c.id}
                      onClick={() => onSelect(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="dot dot-ok dot-live" style={{ color: 'var(--ok)' }}></span>
          Sincronizado
        </span>
        <button className="btn btn-ghost btn-sm" title="Configuración">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
        </button>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar, groupByState });
