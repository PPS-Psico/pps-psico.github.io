/* global React, ConvenioBadge, HermesPrioritizedChip, ActivityTags, DataItem,
   PanelHermesIngreso, NoCatalogadaBanner, INGRESO_STATES, ingresoStateTone */
/* Solicitudes · INGRESO card (collapsed + expanded) + Borrador con Hermes modal. */
const { useState: useStateCard, useRef: useRefCard } = React;

function IngresoCard({ sol, expanded, onToggle, onToast, onVerGestion }) {
  const [estado, setEstado] = useStateCard(sol.estado);
  const [notas, setNotas] = useStateCard(sol.notas || '');
  const [borrador, setBorrador] = useStateCard(null); // {generando, draft}
  const dirty = estado !== sol.estado || notas !== (sol.notas || '');
  const tone = ingresoStateTone(estado);

  const stagnant = sol.daysSinceUpdate > 4 &&
    !['realizada', 'no se pudo concretar', 'archivado'].includes((estado || '').toLowerCase());

  const histRef = useRefCard(null);

  const openBorrador = () => {
    setBorrador({ generando: true, draft: null });
    setTimeout(() => {
      setBorrador({
        generando: false,
        confidence: 0.8,
        requiereDecision: sol.hermes && sol.hermes.requiereDecision,
        motivo: sol.hermes && sol.hermes.motivo,
        to: sol.institucion.email || '—',
        institution: sol.institucion.nombre,
        subject: `Prácticas profesionales · ${sol.alumno.nombre} — UFLO Psicología`,
        body: buildDraftBody(sol),
      });
    }, 1200);
  };

  return (
    <div style={{
      border: `1px solid ${expanded ? 'var(--ink)' : (stagnant ? '#B4501E44' : 'var(--rule-2)')}`,
      borderRadius: 14, background: stagnant && !expanded ? 'var(--warn-soft)' : 'var(--paper)',
      overflow: 'hidden', transition: 'all .14s ease', position: 'relative',
    }}>
      {/* accent rail */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: tone.c }}></div>

      {/* Collapsed header */}
      <div onClick={onToggle} style={{ padding: '15px 18px 15px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 999, flexShrink: 0,
            background: expanded ? 'var(--ink)' : 'var(--paper-2)', color: expanded ? 'var(--paper)' : 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
          }}>
            {sol.alumno.nombre.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                {sol.institucion.nombre}
              </h4>
              <ConvenioBadge status={sol.convenioStatus} size="sm" />
              {stagnant && (
                <span className="dot-live" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
                  background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>timer</span>
                  {sol.daysSinceUpdate} d sin novedad
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="meta" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>{sol.alumno.nombre}</span>
              <span className="mono" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--paper-2)', color: 'var(--ink-3)' }}>{sol.alumno.legajo}</span>
              {sol.hermesPrioritized && <HermesPrioritizedChip />}
              <ActivityTags activity={sol.activity} onClick={(e) => { e.stopPropagation(); if (!expanded) onToggle(); setTimeout(() => histRef.current && histRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 120); }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: tone.s, color: tone.c, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
            {estado}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ink-4)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--rule-2)', padding: 18, background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sol.convenioStatus === 'no_catalogada' && (
            <NoCatalogadaBanner sol={sol} onAdd={() => onToast({ msg: `"${sol.institucion.nombre}" — abriendo alta en catálogo`, icon: 'add_business' })} />
          )}

          {/* Data: two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div>
              <SectionLabel icon="business" text="Datos institucionales" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <DataItem label="Localidad" value={sol.institucion.localidad} icon="location_on" />
                <DataItem label="Referente" value={sol.institucion.referente} icon="person" />
                <DataItem label="Email" value={sol.institucion.email} icon="mail" />
                <DataItem label="Teléfono" value={sol.institucion.telefono} icon="phone" />
                <DataItem label="Dirección" value={sol.institucion.direccion} icon="map" full />
                <DataItem label="Lic. Psicología (tutor)" value={sol.institucion.tutor} icon="psychology" full />
              </div>
            </div>
            <div>
              <SectionLabel icon="description" text="Detalles de la práctica" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 10 }}>
                <DataItem label="Modalidad" value={sol.modalidad} icon="group_work" />
                <DataItem label="Descripción de actividades" value={sol.descripcion} icon="article" full />
              </div>
            </div>
          </div>

          {/* PANEL HERMES */}
          <div ref={histRef}>
            <PanelHermesIngreso sol={sol} onVerGestion={onVerGestion} />
          </div>

          {/* Management */}
          <div>
            <SectionLabel icon="tune" text="Gestión interna" />
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10, marginTop: 10 }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6, fontSize: 9.5 }}>Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} className="field" style={{ fontSize: 13, cursor: 'pointer' }}>
                  {INGRESO_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6, fontSize: 9.5 }}>Notas internas <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)', fontWeight: 400 }}>(visible al alumno solo si falla)</span></label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="field" style={{ fontSize: 13, minHeight: 0 }} placeholder="Bitácora de gestión…"></textarea>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
            <button onClick={openBorrador} className="btn btn-ai btn-sm press">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span>
              Borrador con Hermes
            </button>
            {sol.institucion.email && (
              <button onClick={() => onToast({ msg: 'Abriendo redacción de correo…', icon: 'mail' })} className="btn btn-mail btn-sm press">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>send</span>
                Enviar email
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={onToggle} className="btn btn-ghost btn-sm press">Cerrar</button>
              <button
                disabled={!dirty}
                onClick={() => { onToast({ msg: 'Solicitud actualizada', icon: 'check' }); }}
                className="btn btn-primary btn-sm press"
                style={{ opacity: dirty ? 1 : 0.5 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {borrador && (
        <BorradorModal
          state={borrador}
          onClose={() => setBorrador(null)}
          onSend={() => { setBorrador(null); onToast({ msg: `Email enviado a ${sol.institucion.nombre}`, icon: 'send' }); }}
        />
      )}
    </div>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8, borderBottom: '1px solid var(--rule-2)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--ink-4)' }}>{icon}</span>
      <span className="label">{text}</span>
    </div>
  );
}

function buildDraftBody(sol) {
  return `Hola, ${sol.institucion.nombre}:

Soy Luis Battaglia, Coordinador de PPS de UFLO Psicología. Me contactó ${sol.alumno.nombre} (legajo ${sol.alumno.legajo}) comentándome su interés en realizar las prácticas profesionales con ustedes${sol.institucion.referente ? `, en contacto con ${sol.institucion.referente}` : ''}.

Me pongo a disposición para coordinar los aspectos formales y académicos del convenio si están interesados. Quedo atento a su respuesta.

Muchas gracias,
Luis`;
}

// ── Borrador con Hermes modal ────────────────────────────────────────
function BorradorModal({ state, onClose, onSend }) {
  const [subject, setSubject] = useStateCard(state.subject || '');
  const [body, setBody] = useStateCard(state.body || '');

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '18px 20px', borderBottom: '1px solid var(--rule-2)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ai)' }}>auto_awesome</span>
              <span className="label" style={{ color: 'var(--ai)' }}>Borrador generado por Hermes</span>
            </div>
            <h3 className="serif" style={{ margin: '6px 0 0', fontSize: 19, fontWeight: 700 }}>Revisá antes de enviar</h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm press" style={{ padding: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ink-3)' }}>close</span>
          </button>
        </div>

        {state.generando ? (
          <div style={{ padding: '56px 20px', textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--ai)', animation: `blink 1.2s ${i*0.2}s infinite` }}></span>)}
            </span>
            <div className="meta" style={{ marginTop: 16, fontSize: 13 }}>Hermes está redactando…</div>
          </div>
        ) : (
          <>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--ai-soft)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--ai)' }}>verified</span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  Borrador generado por Hermes <span className="mono" style={{ color: 'var(--ai)', fontWeight: 600 }}>(confidence: {state.confidence})</span>. Editá antes de enviar.
                </span>
              </div>

              {state.requiereDecision && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, background: 'var(--warn-soft)', border: '1px solid #B4501E22' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--warn)', flexShrink: 0, marginTop: 1 }}>pan_tool</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--warn)' }}>Hermes piensa que esto requiere tu decisión:</strong> {state.motivo}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'block' }}>
                  <span className="label" style={{ display: 'block', marginBottom: 6, fontSize: 9.5 }}>Para</span>
                  <input value={state.to} readOnly className="field" style={{ fontSize: 13, color: 'var(--ink-3)' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <span className="label" style={{ display: 'block', marginBottom: 6, fontSize: 9.5 }}>Institución</span>
                  <input value={state.institution} readOnly className="field" style={{ fontSize: 13, color: 'var(--ink-3)' }} />
                </label>
              </div>
              <label style={{ display: 'block' }}>
                <span className="label" style={{ display: 'block', marginBottom: 6, fontSize: 9.5 }}>Asunto</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="field" style={{ fontSize: 13 }} />
              </label>
              <label style={{ display: 'block' }}>
                <span className="label" style={{ display: 'block', marginBottom: 6, fontSize: 9.5 }}>Mensaje</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={11} className="field" style={{ fontSize: 13, lineHeight: 1.55 }}></textarea>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--rule-2)', background: 'var(--paper-2)' }}>
              <button onClick={onClose} className="btn btn-sm press">Cancelar</button>
              <button onClick={onSend} disabled={state.to === '—'} className="btn btn-mail btn-sm press" style={{ opacity: state.to === '—' ? 0.5 : 1 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>send</span>
                Enviar correo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { IngresoCard, BorradorModal });
