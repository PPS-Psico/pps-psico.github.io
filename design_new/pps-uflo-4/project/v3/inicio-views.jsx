/* global React, INSTITUCIONES, INST_BY_ID, UNLINKED_CONTACTS, HERMES_SUGGESTIONS, CONTACT_TIPOS, HERMES_ALLOWLIST */
const { useState: useStateI } = React;

// ─── Navigation bridge → opens Gestión on a specific tab/filter ──────
function navToGestion(view, cat) {
  try {
    if (view) localStorage.setItem('gestion-view-mode', view);
    if (cat) localStorage.setItem('gestion-deeplink-cat', cat);
  } catch {}
  window.location.href = 'Gestion.html';
}

// ─── Navigation bridge → opens Solicitudes on a specific sub-tab ──────
function navToSolicitudes(tab) {
  try { if (tab) localStorage.setItem('sol-tab', tab); } catch {}
  window.location.href = 'Solicitudes.html';
}

// ─── PAGE HEAD ───────────────────────────────────────────────────────
function PageHead({ today, time }) {
  return (
    <div style={{ padding: '40px 0 24px', borderBottom: '1px solid var(--rule-2)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">Tu mañana · coordinación PPS</span>
          <h1 className="serif" style={{ margin: '8px 0 0', fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            Buen día, Luis.
          </h1>
        </div>
        <div className="meta mono" style={{ fontSize: 12, textAlign: 'right', lineHeight: 1.6 }}>
          <div>{today}</div>
          <div style={{ color: 'var(--ink-4)' }}>{time}</div>
        </div>
      </div>
    </div>
  );
}

// ─── BRIEFING — editorial, escrito por Hermes ────────────────────────
function Briefing({ data }) {
  return (
    <section style={{ padding: '32px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--ai)' }}>auto_awesome</span>
        <span className="eyebrow" style={{ color: 'var(--ai)' }}>Briefing de Hermes</span>
        <span className="meta" style={{ fontSize: 11 }}>· {data.generadoAgo}</span>
      </div>

      <div className="serif" style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.32, color: 'var(--ink)', maxWidth: 760, textWrap: 'pretty' }}>
        {data.lead}
      </div>

      <div style={{ marginTop: 20, maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.body.map((p, i) => (
          <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--ink-2)', textWrap: 'pretty' }}>{p}</p>
        ))}
      </div>

      {/* Privacy line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22, fontSize: 11.5, color: 'var(--ink-3)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ai)' }}>shield_lock</span>
        Hermes lee {HERMES_ALLOWLIST.totalChats} chats de tu lista “{HERMES_ALLOWLIST.listaNombre}” y la casilla de mail. Nada personal entra al sistema.
      </div>
    </section>
  );
}

// ─── DETECCIONES — instituciones (lado saliente) ─────────────────────
function DetectionBand({ metrics }) {
  return (
    <section style={{ padding: '28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          En tus conversaciones · instituciones
        </h2>
        <button className="btn btn-ghost btn-sm press" onClick={() => navToGestion('hermes')}>
          Abrir bandeja Hermes
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {metrics.map(m => <DetectionCard key={m.id} m={m} />)}
      </div>
    </section>
  );
}

// ─── SOLICITUDES DE ALUMNOS — lado entrante ──────────────────────────
function SolicitudesBand({ metrics }) {
  return (
    <section style={{ padding: '28px 0', borderTop: '1px solid var(--rule-2)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          Solicitudes de alumnos
        </h2>
        <button className="btn btn-ghost btn-sm press" onClick={() => navToSolicitudes('ingreso')}>
          Ver todas
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {metrics.map(m => <DetectionCard key={m.id} m={m} />)}
      </div>
    </section>
  );
}

function DetectionCard({ m }) {
  const C = {
    accent: { c: 'var(--accent)', s: 'var(--accent-soft)' },
    warn:   { c: 'var(--warn)',   s: 'var(--warn-soft)' },
    ai:     { c: 'var(--ai)',     s: 'var(--ai-soft)' },
    ok:     { c: 'var(--ok)',     s: 'var(--ok-soft)' },
    crit:   { c: 'var(--crit)',   s: 'var(--crit-soft)' },
  }[m.tone] || { c: 'var(--ink)', s: 'var(--paper-2)' };
  return (
    <button
      onClick={m.onClick}
      className="press"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
        padding: '18px 18px 16px', borderRadius: 14,
        border: '1px solid var(--rule-2)', background: 'var(--paper)',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'all .12s ease', minWidth: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--rule-3)'; e.currentTarget.style.background = 'var(--paper-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--rule-2)'; e.currentTarget.style.background = 'var(--paper)'; }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 8, background: C.s, color: C.c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{m.icon}</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: m.n > 0 ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {m.n}
        </span>
      </div>
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{m.label}</div>
        <div className="meta" style={{ fontSize: 11.5, marginTop: 2 }}>{m.sub}</div>
        {m.note && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--rule-2)', fontSize: 11, fontWeight: 600, color: m.noteTone === 'crit' ? 'var(--crit)' : m.noteTone === 'warn' ? 'var(--warn)' : 'var(--ai)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{m.noteIcon || 'auto_awesome'}</span>
            {m.note}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── LO QUE HERMES PREPARÓ — preview de borradores ───────────────────
function DraftsPreview({ drafts, total }) {
  if (drafts.length === 0) return null;
  return (
    <section style={{ padding: '28px 0', borderTop: '1px solid var(--rule-2)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span className="eyebrow">Listo para tu visto</span>
          <h2 className="serif" style={{ margin: '5px 0 0', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Hermes preparó {total} {total === 1 ? 'respuesta' : 'respuestas'}
          </h2>
        </div>
        <button className="btn btn-ai btn-sm press" onClick={() => navToGestion('hermes')}>
          Revisar {total > drafts.length ? `las ${total}` : 'todas'}
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {drafts.map(d => <DraftPreviewRow key={d.id} d={d} />)}
      </div>
    </section>
  );
}

function DraftPreviewRow({ d }) {
  const isMail = d.canal === 'mail';
  const name = d.instId ? (INST_BY_ID[d.instId]?.nombre) : (d.enRespuestaA?.from || 'Contacto');
  const preview = (d.borrador || '').replace(/\n+/g, ' ').slice(0, 130);
  return (
    <button
      onClick={() => navToGestion('hermes')}
      className="press"
      style={{
        display: 'grid', gridTemplateColumns: '34px 1fr auto', gap: 14, alignItems: 'flex-start',
        padding: '14px 16px', borderRadius: 12, border: '1px solid var(--rule-2)',
        background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        borderLeft: '3px solid var(--ai)',
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 8, marginTop: 1,
        background: isMail ? 'var(--accent-soft)' : 'color-mix(in srgb, var(--ok) 14%, var(--paper))',
        color: isMail ? 'var(--accent)' : '#2F8F43',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isMail ? 'mail' : 'chat'}</span>
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{name}</span>
          <span className="meta" style={{ fontSize: 11 }}>· responder por {isMail ? 'mail' : 'WhatsApp'}</span>
        </div>
        <div className="meta" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.45, color: 'var(--ink-2)' }}>
          “{preview}…”
        </div>
      </div>
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ink-4)', alignSelf: 'center' }}>arrow_forward</span>
    </button>
  );
}

// ─── PRIORIDADES DEL DÍA ─────────────────────────────────────────────
function Priorities({ items }) {
  return (
    <section style={{ padding: '28px 0', borderTop: '1px solid var(--rule-2)' }}>
      <span className="eyebrow">Si hacés tres cosas hoy</span>
      <h2 className="serif" style={{ margin: '5px 0 18px', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>
        Prioridades
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((p, i) => <PriorityRow key={p.id} p={p} n={i + 1} />)}
      </div>
    </section>
  );
}

function PriorityRow({ p, n }) {
  const C = {
    warn:   { c: 'var(--warn)',   s: 'var(--warn-soft)' },
    accent: { c: 'var(--accent)', s: 'var(--accent-soft)' },
    ai:     { c: 'var(--ai)',     s: 'var(--ai-soft)' },
    ok:     { c: 'var(--ok)',     s: 'var(--ok-soft)' },
  }[p.tone] || { c: 'var(--ink)', s: 'var(--paper-2)' };
  return (
    <button
      onClick={p.onClick}
      className="press"
      style={{
        display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 16, alignItems: 'center',
        padding: '16px 12px', borderRadius: 10, border: 0,
        borderBottom: '1px solid var(--rule-2)',
        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: C.c }}>{String(n).padStart(2, '0')}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: C.s, color: C.c }}>
            {p.eyebrow}
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{p.title}</span>
        </div>
        <div className="meta" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>{p.detail}</div>
      </div>
      <span className="btn btn-sm" style={{ pointerEvents: 'none', flexShrink: 0 }}>
        {p.cta}
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
      </span>
    </button>
  );
}

Object.assign(window, { navToGestion, navToSolicitudes, PageHead, Briefing, DetectionBand, SolicitudesBand, DraftsPreview, Priorities });
