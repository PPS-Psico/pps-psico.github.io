/* global React */

function TopBar({ user = 'Luis Battaglia', active = 'lanzador' }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'color-mix(in oklab, var(--paper) 92%, transparent)',
      backdropFilter: 'blur(8px) saturate(1.1)',
      WebkitBackdropFilter: 'blur(8px) saturate(1.1)',
      borderBottom: '1px solid var(--rule-2)',
    }}>
      <div className="topbar-inner" style={{ maxWidth: '100%', margin: 0, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--ink)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            ψ
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Mi Panel Académico</span>
            <span className="meta wordmark-sub" style={{ whiteSpace: 'nowrap' }}>PPS · UFLO Psicología</span>
          </div>
        </div>

        <nav className="topbar-tabs" style={{ display: 'flex', gap: 2, marginLeft: 16, flexShrink: 0 }}>
          {[
            { k: 'inicio', label: 'Inicio' },
            { k: 'lanzador', label: 'Lanzador' },
            { k: 'gestion', label: 'Gestión' },
            { k: 'solicitudes', label: 'Solicitudes', badge: 7 },
            { k: 'metricas', label: 'Métricas' },
            { k: 'herramientas', label: 'Herramientas' },
          ].map(t => (
            <button key={t.k} className="press" style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '6px 12px', borderRadius: 8,
              fontSize: 13, fontWeight: t.k === active ? 600 : 500,
              color: t.k === active ? 'var(--ink)' : 'var(--ink-3)',
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
              {t.k === active && (
                <span style={{ position: 'absolute', left: 12, right: 12, bottom: -15, height: 2, background: 'var(--ink)' }}></span>
              )}
            </button>
          ))}
        </nav>

        <div className="topbar-right" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexShrink: 1 }}>
          <button className="btn btn-ghost btn-sm topbar-search" style={{ gap: 10, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0 }}>search</span>
            <span className="meta topbar-search-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Buscar convocatoria, institución, estudiante…</span>
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

Object.assign(window, { TopBar });
