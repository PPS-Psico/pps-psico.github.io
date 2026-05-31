/* global React */
/* Solicitudes · EGRESO (verificación Hermes 4 estados) + CORRECCIONES (simple). */
const { useState: useStateEg } = React;

// ── verification meta ────────────────────────────────────────────────
const VERIF_META = {
  aprobado:   { label: 'Verificado por Hermes', sub: 'Todo coincide', icon: 'verified', c: 'var(--ok)',   s: 'var(--ok-soft)' },
  atencion:   { label: 'Hermes encontró observaciones', sub: 'Revisá antes de acreditar', icon: 'warning', c: 'var(--warn)', s: 'var(--warn-soft)' },
  critico:    { label: 'Hermes detectó posibles problemas', sub: 'Requiere tu atención', icon: 'error', c: 'var(--crit)', s: 'var(--crit-soft)' },
  procesando: { label: 'Hermes está verificando los archivos…', sub: '', icon: 'hourglass_top', c: 'var(--ai)', s: 'var(--ai-soft)' },
};

const egresoStatus = (estado) => {
  const e = (estado || '').toLowerCase();
  if (e === 'finalizada') return { label: 'Finalizada', c: 'var(--ok)', s: 'var(--ok-soft)' };
  if (e === 'en proceso sac') return { label: 'En Proceso SAC', c: 'var(--accent)', s: 'var(--accent-soft)' };
  return { label: 'Pendiente', c: 'var(--warn)', s: 'var(--warn-soft)' };
};

// Compact badge for collapsed card — colored dot of verification state
function VerifMiniBadge({ estado }) {
  const m = VERIF_META[estado] || VERIF_META.procesando;
  return (
    <span title={m.label} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: 999, background: m.s, color: m.c, flexShrink: 0,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{m.icon}</span>
    </span>
  );
}

function EgresoCard({ sol, expanded, onToggle, onToast }) {
  const st = egresoStatus(sol.estado);
  const v = VERIF_META[sol.hermes.estado] || VERIF_META.procesando;
  const docCount = (sol.docs.planillaHoras.length) + (sol.docs.informe.length) + (sol.docs.asistencia.length);

  return (
    <div style={{
      border: `1px solid ${expanded ? 'var(--ink)' : 'var(--rule-2)'}`,
      borderRadius: 14, background: 'var(--paper)', overflow: 'hidden', transition: 'all .14s ease', position: 'relative',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: st.c }}></div>

      {/* Collapsed */}
      <div onClick={onToggle} style={{ padding: '15px 18px 15px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 999, flexShrink: 0,
            background: expanded ? 'var(--ink)' : 'var(--paper-2)', color: expanded ? 'var(--paper)' : 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
          }}>{sol.alumno.nombre.charAt(0)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <VerifMiniBadge estado={sol.hermes.estado} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{sol.alumno.nombre}</h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--paper-2)', color: 'var(--ink-3)' }}>{sol.alumno.legajo}</span>
              <span className="meta" style={{ fontSize: 11.5 }}>{sol.institucion}</span>
              <span className="meta" style={{ fontSize: 11 }}>· {sol.createdLabel}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>attach_file</span>{docCount}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: st.s, color: st.c, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{st.label}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ink-4)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--rule-2)', padding: 18, background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* VERIFICATION PANEL — first */}
          <VerificacionPanel hermes={sol.hermes} horas={{ dec: sol.horasDeclaradas, lanz: sol.horasLanzamiento }} />

          {/* Docs */}
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Documentos del alumno</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {[
                { l: 'Planilla de horas', files: sol.docs.planillaHoras, i: 'table_view' },
                { l: 'Informe final', files: sol.docs.informe, i: 'description' },
                { l: 'Asistencias', files: sol.docs.asistencia, i: 'fact_check' },
              ].map((sec, idx) => (
                <div key={idx}>
                  <div className="label" style={{ fontSize: 9.5, marginBottom: 6 }}>{sec.l}</div>
                  {sec.files.length > 0 ? sec.files.map((f, fi) => (
                    <button key={fi} onClick={() => onToast({ msg: `Vista previa · ${f.filename}`, icon: 'visibility' })} className="press" style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 8,
                      border: '1px solid var(--rule-2)', background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ink-4)' }}>{sec.i}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.filename}</span>
                    </button>
                  )) : <span className="meta" style={{ fontSize: 11, fontStyle: 'italic' }}>No adjunto</span>}
                </div>
              ))}
            </div>
          </div>

          {sol.sugerenciasAlumno && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--paper)', border: '1px solid var(--rule-2)' }}>
              <div className="label" style={{ fontSize: 9.5, marginBottom: 4 }}>Sugerencias del alumno</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.5 }}>"{sol.sugerenciasAlumno}"</div>
            </div>
          )}

          {/* Actions */}
          {sol.estado !== 'Finalizada' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
              <button onClick={() => onToast({ msg: 'Datos copiados para Excel', icon: 'content_copy' })} className="btn btn-sm press">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>content_copy</span>Copiar
              </button>
              {(sol.hermes.estado === 'atencion' || sol.hermes.estado === 'critico') && (
                <button onClick={() => onToast({ msg: 'Borrador de corrección listo para revisar', icon: 'auto_awesome' })} className="btn btn-ai btn-sm press">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span>
                  Pedir corrección al alumno
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => onToast({ msg: 'Marcado · En Proceso SAC', icon: 'pending_actions' })} disabled={sol.estado === 'En Proceso SAC'} className="btn btn-sm press" style={{ opacity: sol.estado === 'En Proceso SAC' ? 0.5 : 1 }}>
                  En Proceso SAC
                </button>
                <button
                  onClick={() => onToast({ msg: `Acreditación confirmada · ${sol.alumno.nombre}`, icon: 'check_circle' })}
                  className="btn btn-sm press"
                  style={{ background: 'var(--ok)', color: 'var(--paper)', borderColor: 'var(--ok)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_circle</span>
                  Confirmar SAC
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VerificacionPanel({ hermes, horas }) {
  const m = VERIF_META[hermes.estado] || VERIF_META.procesando;
  const [openIssue, setOpenIssue] = useStateEg(null);

  return (
    <div style={{ border: `1px solid ${m.c}33`, borderRadius: 14, overflow: 'hidden', background: 'var(--paper)', animation: 'hermesIn .32s cubic-bezier(0.2,0.7,0.2,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: m.s }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: m.c }}>{m.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            {hermes.estado === 'atencion' && hermes.issues.length > 0 ? `Hermes encontró ${hermes.issues.length} ${hermes.issues.length === 1 ? 'observación' : 'observaciones'}` : m.label}
          </div>
          {m.sub && <div className="meta" style={{ fontSize: 10.5 }}>{m.sub}</div>}
        </div>
        <span className="label" style={{ color: m.c, fontSize: 9 }}>Hermes</span>
      </div>

      <div style={{ padding: 16 }}>
        {hermes.estado === 'procesando' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', gap: 5 }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ai)', animation: `blink 1.2s ${i*0.2}s infinite` }}></span>)}
            </span>
            <span className="meta" style={{ fontSize: 12 }}>Analizando planilla de horas, informe y asistencias…</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hermes.checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ok)', flexShrink: 0, marginTop: 1 }}>check_circle</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{c.label}</span>
              </div>
            ))}
            {hermes.issues.map((iss, i) => (
              <div key={i} style={{ borderRadius: 10, background: iss.sev === 'crit' ? 'var(--crit-soft)' : 'var(--warn-soft)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: iss.sev === 'crit' ? 'var(--crit)' : 'var(--warn)', flexShrink: 0, marginTop: 1 }}>{iss.sev === 'crit' ? 'cancel' : 'warning'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>{iss.label}</div>
                    {(iss.cita || iss.ref) && (
                      <button onClick={() => setOpenIssue(openIssue === i ? null : i)} className="press" style={{ marginTop: 5, background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: 11, fontWeight: 600, color: iss.sev === 'crit' ? 'var(--crit)' : 'var(--warn)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        Ver detalles
                        <span className="material-symbols-outlined" style={{ fontSize: 13, transform: openIssue === i ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                      </button>
                    )}
                    {openIssue === i && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {iss.cita && <DetailRef icon="format_quote" label="En el archivo" text={iss.cita} />}
                        {iss.ref && <DetailRef icon="link" label="Referencia" text={iss.ref} />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRef({ icon, label, text }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 8, background: 'var(--paper)', border: '1px solid var(--rule-2)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--ink-4)', flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <span className="label" style={{ fontSize: 9, display: 'block', marginBottom: 1 }}>{label}</span>
        <span style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>{text}</span>
      </div>
    </div>
  );
}

// ── CORRECCIONES — simple, sin Hermes ────────────────────────────────
const modTipoMeta = {
  horas:       { label: 'Horas', icon: 'schedule' },
  fechas:      { label: 'Fechas', icon: 'event' },
  institucion: { label: 'Institución', icon: 'business' },
};
const corrEstado = (e) => {
  if (e === 'aprobada') return { label: 'Aprobada', c: 'var(--ok)', s: 'var(--ok-soft)' };
  if (e === 'rechazada') return { label: 'Rechazada', c: 'var(--crit)', s: 'var(--crit-soft)' };
  return { label: 'Pendiente', c: 'var(--warn)', s: 'var(--warn-soft)' };
};

function CorreccionCard({ sol, expanded, onToggle, onToast, onReject }) {
  const isMod = sol.tipo === 'modificacion';
  const est = corrEstado(sol.estado);
  const tm = isMod ? (modTipoMeta[sol.tipoModificacion] || modTipoMeta.horas) : null;

  return (
    <div style={{
      border: `1px solid ${expanded ? 'var(--ink)' : 'var(--rule-2)'}`,
      borderRadius: 14, background: 'var(--paper)', overflow: 'hidden', transition: 'all .14s ease', position: 'relative',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: est.c }}></div>

      <div onClick={onToggle} style={{ padding: '15px 18px 15px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'var(--paper-2)', color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 19 }}>{isMod ? (tm.icon) : 'note_add'}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{sol.alumno.nombre}</h4>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
                {isMod ? `Modificación · ${tm.label}` : 'Nueva PPS'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span className="mono" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--paper-2)', color: 'var(--ink-3)' }}>{sol.alumno.legajo}</span>
              <span className="meta" style={{ fontSize: 11.5 }}>{isMod ? sol.practica.institucion : sol.institucionPropuesta}</span>
              <span className="meta" style={{ fontSize: 11 }}>· {sol.createdLabel}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: est.s, color: est.c, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{est.label}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--ink-4)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--rule-2)', padding: 18, background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Precarga de la PPS */}
          <div>
            <div className="label" style={{ marginBottom: 10 }}>{isMod ? 'PPS a modificar' : 'PPS propuesta'}</div>
            {isMod ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <PreItem label="Institución" value={sol.practica.institucion} />
                  <PreItem label="Cohorte" value={sol.practica.cohorte} />
                </div>
                {sol.cambios.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--paper)', border: '1px solid var(--rule-2)' }}>
                    <div style={{ minWidth: 0 }}>
                      <span className="label" style={{ fontSize: 9.5, display: 'block', marginBottom: 4 }}>{c.campo}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, color: 'var(--ink-3)', textDecoration: 'line-through' }}>{c.de}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ink-4)' }}>arrow_forward</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.a}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <PreItem label="Institución propuesta" value={sol.institucionPropuesta} />
                <PreItem label="Modalidad" value={sol.modalidad} />
                <PreItem label="Horas estimadas" value={`${sol.horasEstimadas} h`} />
                <PreItem label="Fecha de finalización" value={sol.fechaFin} />
              </div>
            )}
          </div>

          {/* Motivo del alumno */}
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--paper)', border: '1px solid var(--rule-2)' }}>
            <div className="label" style={{ fontSize: 9.5, marginBottom: 4 }}>Motivo del alumno</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, fontStyle: 'italic' }}>"{sol.motivo}"</div>
          </div>

          {/* Docs adjuntos */}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Documentos adjuntos {sol.docsAdjuntos.length === 0 && <span style={{ color: 'var(--crit)', textTransform: 'none', letterSpacing: 0 }}>· faltantes</span>}
            </div>
            {sol.docsAdjuntos.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sol.docsAdjuntos.map((d, i) => (
                  <button key={i} onClick={() => onToast({ msg: `Vista previa · ${d.filename}`, icon: 'visibility' })} className="press" style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 8,
                    border: '1px solid var(--rule-2)', background: 'var(--paper)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--ink-4)' }}>description</span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{d.filename}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 12, fontWeight: 500 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>error</span>
                El alumno no adjuntó documentación de respaldo.
              </div>
            )}
          </div>

          {sol.estado === 'rechazada' && sol.comentarioRechazo && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--crit-soft)', border: '1px solid var(--crit)' }}>
              <div className="label" style={{ fontSize: 9.5, color: 'var(--crit)', marginBottom: 4 }}>Motivo del rechazo</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{sol.comentarioRechazo}</div>
            </div>
          )}
          {sol.estado === 'aprobada' && sol.notasAdmin && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--ok-soft)', border: '1px solid #2F5F3A33' }}>
              <div className="label" style={{ fontSize: 9.5, color: 'var(--ok)', marginBottom: 4 }}>Nota de aprobación</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{sol.notasAdmin}</div>
            </div>
          )}

          {/* Actions — only when pending */}
          {sol.estado === 'pendiente' && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button onClick={() => onReject(sol)} className="btn btn-sm press" style={{ color: 'var(--crit)', borderColor: '#B23A4833' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>Rechazar
              </button>
              <button
                onClick={() => onToast({ msg: isMod ? 'Modificación aprobada · actualizada en el panel del alumno' : 'Nueva PPS aprobada · creada en el panel del alumno', icon: 'check_circle' })}
                className="btn btn-sm press"
                style={{ background: 'var(--ok)', color: 'var(--paper)', borderColor: 'var(--ok)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_circle</span>
                {isMod ? 'Aprobar cambio' : 'Aprobar y crear PPS'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreItem({ label, value }) {
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--rule-2)', borderRadius: 10, padding: '9px 12px' }}>
      <span className="label" style={{ fontSize: 9.5, display: 'block', marginBottom: 3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

Object.assign(window, { EgresoCard, CorreccionCard, VerifMiniBadge, VERIF_META });
