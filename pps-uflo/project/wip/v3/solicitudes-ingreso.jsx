/* global React */
/* Solicitudes · INGRESO tab — student proposes an institution.
   Collapsed card: convenio badge + activity mini-tags + Hermes-priorized chip.
   Expanded: institutional + practice data, PANEL HERMES (sugiere · historial ·
   PPS anteriores), non-catalogued special case, management, Borrador con Hermes. */
const { useState: useStateIn, useMemo: useMemoIn } = React;

// ── shared bits ──────────────────────────────────────────────────────
const ConvenioBadge = ({ status, size }) => {
  const map = {
    con:           { label: 'Con convenio', icon: 'verified',     c: 'var(--ok)',   s: 'var(--ok-soft)' },
    sin:           { label: 'Sin convenio', icon: 'pending',      c: 'var(--warn)', s: 'var(--warn-soft)' },
    no_catalogada: { label: 'No catalogada', icon: 'help',        c: 'var(--crit)', s: 'var(--crit-soft)' },
  };
  const m = map[status] || map.sin;
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 5,
      padding: sm ? '2px 8px 2px 6px' : '3px 10px 3px 7px', borderRadius: 999,
      background: m.s, color: m.c, fontSize: sm ? 10.5 : 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: sm ? 12 : 13 }}>{m.icon}</span>
      {m.label}
    </span>
  );
};

const HermesPrioritizedChip = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px 3px 7px', borderRadius: 999,
    background: 'var(--ai-soft)', color: 'var(--ai)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  }}>
    <span className="material-symbols-outlined dot-live" style={{ fontSize: 13, color: 'var(--ai)' }}>auto_awesome</span>
    Hermes priorizó
  </span>
);

const ActivityTags = ({ activity, onClick }) => {
  if (!activity || (activity.mails === 0 && activity.whatsapps === 0)) return null;
  return (
    <button
      onClick={onClick}
      className="press"
      title="Actividad últimos 60 días · ver historial"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '3px 9px',
        borderRadius: 999, border: '1px solid var(--rule-2)', background: 'transparent',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {activity.mails > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>mail</span>{activity.mails}
        </span>
      )}
      {activity.whatsapps > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#2F8F43' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chat</span>{activity.whatsapps}
        </span>
      )}
    </button>
  );
};

const INGRESO_STATES = ['Pendiente', 'En conversaciones', 'Realizando convenio', 'Realizada', 'No se pudo concretar', 'Archivado'];
const ingresoStateTone = (estado) => {
  const e = (estado || '').toLowerCase();
  if (e === 'pendiente') return { c: 'var(--warn)', s: 'var(--warn-soft)' };
  if (e === 'en conversaciones') return { c: 'var(--accent)', s: 'var(--accent-soft)' };
  if (e === 'realizando convenio') return { c: 'var(--ai)', s: 'var(--ai-soft)' };
  if (e === 'realizada') return { c: 'var(--ok)', s: 'var(--ok-soft)' };
  return { c: 'var(--ink-3)', s: 'var(--paper-2)' };
};

// ── data grid item ───────────────────────────────────────────────────
function DataItem({ label, value, icon, full }) {
  const empty = !value;
  return (
    <div style={{
      gridColumn: full ? '1 / -1' : 'auto',
      background: 'var(--paper)', border: '1px solid var(--rule-2)', borderRadius: 10,
      padding: '10px 12px', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        {icon && <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--ink-4)' }}>{icon}</span>}
        <span className="label" style={{ fontSize: 9.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: empty ? 'var(--ink-4)' : 'var(--ink)', fontStyle: empty ? 'italic' : 'normal', lineHeight: 1.4, wordBreak: 'break-word' }}>
        {value || 'No especificado'}
      </div>
    </div>
  );
}

// ── PANEL HERMES ─────────────────────────────────────────────────────
function PanelHermesIngreso({ sol, onVerGestion }) {
  const hasHistorial = sol.historial && sol.historial.length > 0;
  const hasPps = sol.ppsAnteriores && sol.ppsAnteriores.length > 0;
  return (
    <div style={{
      border: '1px solid #5A2D8626', borderRadius: 14, overflow: 'hidden',
      background: 'var(--paper)', animation: 'hermesIn .32s cubic-bezier(0.2,0.7,0.2,1)',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--rule-2)', background: 'var(--ai-soft)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ai)' }}>auto_awesome</span>
        <span className="label" style={{ color: 'var(--ai)', letterSpacing: '0.08em' }}>Panel Hermes</span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 1.1 Sugiere */}
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Hermes sugiere</div>
          {sol.hermes && sol.hermes.sugerencia ? (
            <div style={{
              padding: '12px 14px', borderRadius: 10, background: 'var(--ai-soft)',
              border: '1px solid #5A2D8622', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)',
            }}>
              {sol.hermes.sugerencia}
              {sol.hermes.requiereDecision && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 10, paddingTop: 10, borderTop: '1px solid #5A2D8622' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--ai)', flexShrink: 0, marginTop: 1 }}>pan_tool</span>
                  <span style={{ fontSize: 12, color: 'var(--ai)', fontWeight: 600 }}>
                    Hermes piensa que esto requiere tu decisión: <span style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{sol.hermes.motivo}</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderRadius: 10, background: 'var(--paper-2)' }}>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ai)', opacity: 0.4, animation: `blink 1.2s ${i*0.2}s infinite` }}></span>)}
              </span>
              <span className="meta" style={{ fontSize: 12 }}>Hermes está procesando esta institución…</span>
            </div>
          )}
        </div>

        {/* 1.2 Historial reciente */}
        {hasHistorial && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Historial reciente · Gmail + WhatsApp</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sol.historial.map((h, i) => <HistorialRow key={i} h={h} />)}
            </div>
          </div>
        )}

        {/* 1.3 PPS anteriores */}
        {hasPps && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="label">PPS anteriores con esta institución</span>
              {sol.instId && (
                <button onClick={onVerGestion} className="btn btn-ghost btn-sm press" style={{ fontSize: 11, color: 'var(--ai)' }}>
                  Ver en Gestión
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {sol.ppsAnteriores.map((p, i) => <PpsMiniCard key={i} p={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HistorialRow({ h }) {
  const isMail = h.canal === 'mail';
  const color = isMail ? 'var(--accent)' : '#2F8F43';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 9, alignItems: 'center',
      padding: '7px 10px', borderRadius: 8,
      background: h.estado === 'esperando' ? 'var(--warn-soft)' : (h.fromMe ? 'var(--ok-soft)' : 'transparent'),
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14, color }}>{isMail ? 'mail' : 'chat'}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {h.fromMe && <span style={{ color: 'var(--ink-4)', fontWeight: 600 }}>→ </span>}{h.snippet}
        </div>
        {h.estado === 'esperando' && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warn)' }}>Esperando tu respuesta</span>
        )}
      </div>
      <span className="mono meta" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{h.hace}</span>
    </div>
  );
}

function PpsMiniCard({ p }) {
  return (
    <div style={{
      flexShrink: 0, width: 150, padding: '10px 12px', borderRadius: 10,
      border: '1px solid var(--rule-2)', background: 'var(--paper-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{p.cohorte}</span>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ok)' }}>{p.estado}</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>
        {p.orientacion} · {p.cupos} cupos
      </div>
      <div className="meta" style={{ fontSize: 10.5, marginTop: 2 }}>Fin · {p.fin}</div>
    </div>
  );
}

// ── Non-catalogued banner ────────────────────────────────────────────
function NoCatalogadaBanner({ sol, onAdd }) {
  return (
    <div style={{
      border: '1px solid var(--crit)', borderRadius: 12, overflow: 'hidden',
      background: 'var(--crit-soft)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: 16 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--crit)', flexShrink: 0, marginTop: 1 }}>error</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Esta institución no está en el catálogo</div>
          <div className="meta" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
            {sol.noCatalogadaInfo && sol.noCatalogadaInfo.pedidos90d > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ai)', fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>
                {sol.noCatalogadaInfo.pedidos90d} {sol.noCatalogadaInfo.pedidos90d === 1 ? 'alumno pidió' : 'alumnos pidieron'} esta institución en los últimos 90 días.
              </span>
            )}
          </div>
        </div>
        <button onClick={onAdd} className="btn btn-mail btn-sm press" style={{ flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_business</span>
          Agregar al catálogo
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  ConvenioBadge, HermesPrioritizedChip, ActivityTags, DataItem,
  PanelHermesIngreso, NoCatalogadaBanner, INGRESO_STATES, ingresoStateTone,
});
