/* global React, STATES, STEPS, INSTITUCIONES, ORIENTACIONES */
const { useState: useStateV, useMemo: useMemoV, useEffect: useEffectV, useRef: useRefV } = React;

// ============================================================================
// Canvas header — title, status, action bar (shared across states)
// ============================================================================

function StepIndicator({ currentStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {STEPS.map((s, i) => {
        const step = i + 1;
        const done = step < currentStep;
        const active = step === currentStep;
        const cls = `step ${done ? 'done' : ''} ${active ? 'active' : ''}`;
        return (
          <React.Fragment key={s}>
            <div className={cls} style={{ display: 'inline-flex' }}>
              <span className="step-num">
                {done ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> : step}
              </span>
              <span>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`step-bar ${done ? 'done' : ''}`}></div>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CanvasHeader({ c, primaryAction, secondaryActions = [] }) {
  const state = STATES[c.state];
  return (
    <header style={{ padding: '32px 48px 24px', borderBottom: '1px solid var(--rule-2)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{state.icon}</span>
              {state.label}
            </span>
            {c.institucion && (
              <span className="meta" style={{ borderLeft: '1px solid var(--rule-2)', paddingLeft: 10 }}>
                {c.institucion.nombre}
              </span>
            )}
          </div>
          <h1 className="serif" style={{
            margin: 0, fontSize: 38, lineHeight: 1.1, fontWeight: 400,
            letterSpacing: '-0.025em', color: 'var(--ink)',
          }}>
            {c.nombre || <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>Convocatoria sin nombre</span>}
          </h1>
          {c.orientaciones && c.orientaciones.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
              {c.orientaciones.map(o => (
                <span key={o} className="chip on" style={{ cursor: 'default', pointerEvents: 'none' }}>{o}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginTop: 4 }}>
          {secondaryActions.map((a, i) => (
            <button key={i} className="btn btn-sm press" onClick={a.onClick} title={a.title}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{a.icon}</span>
              {a.label}
            </button>
          ))}
          {primaryAction && (
            <button className="btn btn-primary press" onClick={primaryAction.onClick}>
              {primaryAction.icon && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{primaryAction.icon}</span>}
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>

      <StepIndicator currentStep={state.step > 5 ? 6 : state.step} />
    </header>
  );
}

// ============================================================================
// BORRADOR — full editor with live WhatsApp preview + AI
// ============================================================================

function BorradorView({ c }) {
  // Form state — initialize from c
  const [form, setForm] = useStateV({
    institucion: c.institucion,
    nombre: c.nombre || '',
    orientaciones: c.orientaciones || [],
    direccion: c.direccion || '',
    online: c.online || false,
    cupos: c.cupos ?? '',
    horas: c.horas ?? '',
    fechaInicio: c.fechaInicio || '',
    fechaFin: c.fechaFin || '',
    encuentroInicial: c.encuentroInicial || '',
    inicioInscripcion: c.inicioInscripcion || '',
    cierreInscripcion: c.cierreInscripcion || '',
    materialReferencia: c.materialReferencia || '',
    descripcion: c.descripcion || '',
    actividades: c.actividades || [],
    requisitoExcluyente: c.requisitoExcluyente || '',
    archivoNombre: c.archivoNombre || '',
    archivoUrl: c.archivoUrl || '',
    horarios: c.horarios || [{ dia: '', desde: '', hasta: '', supervisor: '' }],
    horariosFijos: c.horariosFijos ?? true,
    certTrabajo: c.certTrabajo || false,
    solicitarCV: c.solicitarCV || false,
    requisitos: c.requisitos || [],
    programarLanzamiento: c.programarLanzamiento || false,
    fechaProgramada: c.fechaProgramada || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleOrientacion = (o) => set('orientaciones', form.orientaciones.includes(o)
    ? form.orientaciones.filter(x => x !== o)
    : [...form.orientaciones, o]);

  // AI state
  const [aiThinking, setAiThinking] = useStateV(false);
  const runAI = () => {
    if (!form.materialReferencia.trim()) return;
    setAiThinking(true);
    // pretend AI fills the form
    setTimeout(() => {
      setAiThinking(false);
      if (!form.descripcion) {
        set('descripcion', 'Generado por IA: práctica en contexto institucional con foco en acompañamiento y supervisión semanal.');
      }
    }, 1800);
  };

  // Preview side state
  const [previewTab, setPreviewTab] = useStateV('whatsapp');
  const [copied, setCopied] = useStateV(false);

  // Build WhatsApp message from form
  const whatsappMsg = useMemoV(() => buildWhatsAppMessage(form), [form]);

  const copyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error(e);
    }
  };

  // Completeness — compute per-section so we can dot the heads
  const sectionMissing = useMemoV(() => {
    return {
      s1: [
        !form.institucion && 'institución',
        !form.nombre && 'nombre',
        form.orientaciones.length === 0 && 'orientación',
        !form.online && !form.direccion && 'lugar o modalidad online',
      ].filter(Boolean),
      s2: [
        !form.descripcion && 'descripción',
        form.actividades.filter(a => a.trim()).length === 0 && 'al menos 1 actividad',
      ].filter(Boolean),
      s3: [
        !form.cupos && 'cupos',
        !form.horas && 'horas',
        (!form.fechaInicio || !form.fechaFin) && 'fechas de práctica',
        (!form.inicioInscripcion || !form.cierreInscripcion) && 'ventana de inscripción',
        !form.encuentroInicial && 'encuentro inicial',
        form.horarios.filter(h => h.dia && h.desde && h.hasta).length === 0 && 'al menos 1 franja horaria',
      ].filter(Boolean),
      s4: [],
    };
  }, [form]);
  const missingTotal = sectionMissing.s1.length + sectionMissing.s2.length + sectionMissing.s3.length + sectionMissing.s4.length;
  const ready = missingTotal === 0;

  // What's missing as a flat list (for tooltip)
  const missingFlat = [...sectionMissing.s1, ...sectionMissing.s2, ...sectionMissing.s3, ...sectionMissing.s4];
  const missingText = missingFlat.length
    ? `Faltan: ${missingFlat.slice(0, 3).join(', ')}${missingFlat.length > 3 ? ` y ${missingFlat.length - 3} más` : ''}`
    : '';

  // Did the form arrive pre-filled (institution had prior data)?
  const isPreFilled = !!form.institucion && !!form.descripcion && form.actividades.filter(a => a.trim()).length > 0;
  const needsAIHelp  = !!form.institucion && !form.descripcion && form.actividades.filter(a => a.trim()).length === 0;

  // For scroll-on-fail: assign refs per section
  const refs = { s1: useRefV(null), s2: useRefV(null), s3: useRefV(null), s4: useRefV(null) };
  const tryLaunch = () => {
    if (ready) return; // would actually launch
    // scroll to first section with errors
    const target = ['s1', 's2', 's3', 's4'].find(k => sectionMissing[k].length > 0);
    if (target && refs[target].current) {
      refs[target].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <CanvasHeader
        c={{ ...c, nombre: form.nombre || c.nombre, institucion: form.institucion, orientaciones: form.orientaciones }}
        primaryAction={{
          label: form.programarLanzamiento ? 'Programar lanzamiento' : 'Lanzar ahora',
          icon: form.programarLanzamiento ? 'schedule_send' : 'rocket_launch',
          onClick: tryLaunch,
        }}
        secondaryActions={[
          { label: 'Guardar borrador', icon: 'save', onClick: () => {} },
          { label: 'Duplicar de anterior', icon: 'history', onClick: () => {} },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 0 }}>
        {/* ====== FORM COLUMN ====== */}
        <div style={{ padding: '32px 48px 48px', minWidth: 0 }}>

          {/* Pre-filled banner */}
          {isPreFilled && (
            <div style={{
              padding: '12px 16px', marginBottom: 24,
              borderRadius: 10, border: '1px solid var(--rule-2)',
              background: 'var(--paper-2)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ok)' }}>history</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Datos cargados desde la última PPS con {form.institucion.nombre}</div>
                <div className="meta">{form.institucion.ultima}. Revisá y ajustá lo necesario.</div>
              </div>
              <button className="btn btn-ghost btn-sm">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                Empezar de cero
              </button>
            </div>
          )}

          {/* ============= 01. LA CONVOCATORIA ============= */}
          <div ref={refs.s1}>
            <BorradorSection number="01" title="La convocatoria" subtitle="Institución, nombre y orientación" missing={sectionMissing.s1.length}>

              <FormRow label="Institución">
                {form.institucion ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid var(--rule-2)', borderRadius: 10, background: 'var(--paper-2)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{form.institucion.nombre}</div>
                      <div className="meta" style={{ marginTop: 2 }}>{form.institucion.tipo} · {form.institucion.contacto} · {form.institucion.tel}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => set('institucion', null)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>swap_horiz</span>
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span className="material-symbols-outlined" style={{
                        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 16, color: 'var(--ink-4)',
                      }}>search</span>
                      <input className="field" style={{ paddingLeft: 40 }} placeholder="Buscar institución existente…" />
                    </div>
                    <button className="btn">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                      Nueva institución
                    </button>
                  </div>
                )}
              </FormRow>

              <FormRow label="Nombre PPS · visible para estudiantes">
                <input className="field" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: PPS Clínica pediátrica · cohorte 2026-2" />
                {!form.nombre && form.institucion && form.orientaciones.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 6, color: 'var(--ai)' }}
                    onClick={() => set('nombre', `PPS ${form.orientaciones[0]} · ${form.institucion.nombre.split(' ').slice(0, 3).join(' ')} · 2026-2`)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                    Sugerir nombre
                  </button>
                )}
              </FormRow>

              <FormRow label="Orientaciones">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ORIENTACIONES.map(o => (
                    <button key={o} className={`chip ${form.orientaciones.includes(o) ? 'on' : ''}`} onClick={() => toggleOrientacion(o)}>{o}</button>
                  ))}
                </div>
              </FormRow>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'flex-end' }}>
                <FormRow label="Dirección / lugar" style={{ margin: 0 }}>
                  <input
                    className="field"
                    value={form.direccion}
                    onChange={e => set('direccion', e.target.value)}
                    placeholder={form.online ? 'Online · sin dirección' : 'Ej: Gallo 1330, CABA'}
                    disabled={form.online}
                    style={{ opacity: form.online ? 0.4 : 1 }}
                  />
                </FormRow>
                <CheckRow label="Online" checked={form.online} onChange={v => set('online', v)} />
              </div>
            </BorradorSection>
          </div>

          {/* ============= 02. CONTENIDO ============= */}
          <div ref={refs.s2}>
            <BorradorSection number="02" title="Contenido" subtitle="Qué hace el estudiante en esta práctica" missing={sectionMissing.s2.length}>

              {/* AI helper — ONLY when no content yet */}
              {needsAIHelp && (
                <div style={{
                  padding: 16, borderRadius: 10, border: '1px dashed var(--ai)',
                  background: 'var(--ai-soft)', marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                    <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ai)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                      Asistente IA · esta institución no tiene PPS previas
                    </span>
                    <button
                      className="btn btn-ai press btn-sm"
                      onClick={runAI}
                      disabled={aiThinking || !form.materialReferencia.trim()}
                      style={{ opacity: aiThinking || !form.materialReferencia.trim() ? .5 : 1 }}
                    >
                      {aiThinking
                        ? <><span className="material-symbols-outlined" style={{ fontSize: 14, animation: 'spin 1s linear infinite' }}>autorenew</span> Analizando…</>
                        : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span> Generar todo con IA</>
                      }
                    </button>
                  </div>
                  <div className="meta" style={{ marginBottom: 8 }}>
                    Pegá el email, propuesta o programa que te mandaron. La IA arma descripción, actividades y requisitos.
                  </div>
                  <textarea
                    className="field"
                    value={form.materialReferencia}
                    onChange={e => set('materialReferencia', e.target.value)}
                    placeholder="Pegá acá el material de referencia…"
                    style={{ minHeight: 100, background: 'var(--paper)' }}
                  />
                  {aiThinking && (
                    <div className="ai-thinking" style={{ marginTop: 10, height: 4, borderRadius: 999 }}></div>
                  )}
                </div>
              )}

              <FormRow label="Descripción de la propuesta · visible para estudiantes">
                <textarea
                  className="field"
                  value={form.descripcion}
                  onChange={e => set('descripcion', e.target.value)}
                  placeholder="¿En qué consiste la práctica? ¿Quién supervisa? ¿Cómo es la dinámica?"
                  style={{ minHeight: 120 }}
                />
              </FormRow>

              <FormRow label="Actividades">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.actividades.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="mono meta" style={{ width: 24 }}>{String(i + 1).padStart(2, '0')}</span>
                      <input
                        className="field"
                        value={a}
                        onChange={e => set('actividades', form.actividades.map((x, j) => j === i ? e.target.value : x))}
                        placeholder="Ej: Observación y registro en sala…"
                      />
                      <button className="btn btn-ghost btn-sm" onClick={() => set('actividades', form.actividades.filter((_, j) => j !== i))} title="Eliminar">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('actividades', [...form.actividades, ''])}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    Agregar actividad
                  </button>
                </div>
              </FormRow>

              <FormRow label="Requisito excluyente · opcional">
                <input
                  className="field"
                  value={form.requisitoExcluyente}
                  onChange={e => set('requisitoExcluyente', e.target.value)}
                  placeholder="Ej: Tener aprobada Psicopatología I"
                />
              </FormRow>

              <FormRow label="Archivo descargable · opcional">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                    {form.archivoNombre || 'Subir archivo'}
                  </button>
                  <input
                    className="field"
                    value={form.archivoUrl}
                    onChange={e => set('archivoUrl', e.target.value)}
                    placeholder="o pegá una URL externa"
                  />
                </div>
              </FormRow>
            </BorradorSection>
          </div>

          {/* ============= 03. TIEMPO Y CUPOS ============= */}
          <div ref={refs.s3}>
            <BorradorSection number="03" title="Tiempo y cupos" subtitle="Cuándo se hace, cuántos van y con qué horarios" missing={sectionMissing.s3.length}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormRow label="Inscripción desde" style={{ margin: 0 }}>
                  <input className="field" value={form.inicioInscripcion} onChange={e => set('inicioInscripcion', e.target.value)} placeholder="dd/mm/aaaa" />
                </FormRow>
                <FormRow label="Inscripción hasta" style={{ margin: 0 }}>
                  <input className="field" value={form.cierreInscripcion} onChange={e => set('cierreInscripcion', e.target.value)} placeholder="dd/mm/aaaa" />
                </FormRow>
                <FormRow label="Inicio de práctica" style={{ margin: 0 }}>
                  <input className="field" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} placeholder="dd/mm/aaaa" />
                </FormRow>
                <FormRow label="Fin de práctica" style={{ margin: 0 }}>
                  <input className="field" value={form.fechaFin} onChange={e => set('fechaFin', e.target.value)} placeholder="dd/mm/aaaa" />
                </FormRow>
              </div>
              <FormRow label="Encuentro inicial" style={{ marginTop: 16 }}>
                <input className="field" value={form.encuentroInicial} onChange={e => set('encuentroInicial', e.target.value)} placeholder="Ej: 28 jul 2026 · 18:00 hs" />
              </FormRow>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormRow label="Cupos">
                  <input className="field" type="number" value={form.cupos} onChange={e => set('cupos', e.target.value)} placeholder="4" />
                </FormRow>
                <FormRow label="Horas totales">
                  <input className="field" type="number" value={form.horas} onChange={e => set('horas', e.target.value)} placeholder="80" />
                </FormRow>
              </div>

              <FormRow label="Horarios y supervisor" style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 10 }}>
                  <CheckRow label="Horarios fijos (obligatorio asistir todos)" checked={form.horariosFijos} onChange={v => set('horariosFijos', v)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {form.horarios.map((h, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '90px 110px 110px 1fr auto',
                      gap: 8, alignItems: 'center',
                    }}>
                      <select className="field" value={h.dia} onChange={e => set('horarios', form.horarios.map((x, j) => j === i ? { ...x, dia: e.target.value } : x))}>
                        <option value="">Día…</option>
                        {['Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input className="field" value={h.desde} onChange={e => set('horarios', form.horarios.map((x, j) => j === i ? { ...x, desde: e.target.value } : x))} placeholder="14:00" />
                      <input className="field" value={h.hasta} onChange={e => set('horarios', form.horarios.map((x, j) => j === i ? { ...x, hasta: e.target.value } : x))} placeholder="18:00" />
                      <input className="field" value={h.supervisor || ''} onChange={e => set('horarios', form.horarios.map((x, j) => j === i ? { ...x, supervisor: e.target.value } : x))} placeholder="Supervisor (opcional)" />
                      <button className="btn btn-ghost btn-sm" onClick={() => set('horarios', form.horarios.filter((_, j) => j !== i))}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => set('horarios', [...form.horarios, { dia: '', desde: '', hasta: '', supervisor: '' }])}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    Agregar franja
                  </button>
                </div>
              </FormRow>
            </BorradorSection>
          </div>

          {/* ============= 04. INSCRIPCIÓN Y LANZAMIENTO ============= */}
          <div ref={refs.s4}>
            <BorradorSection number="04" title="Inscripción y lanzamiento" subtitle="Qué le pedís al estudiante y cuándo se publica" missing={sectionMissing.s4.length}>

              <FormRow label="Documentación que debe presentar el estudiante">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <CheckRow label="Pedir certificado de trabajo" sublabel="Para estudiantes con trabajo en horario laboral" checked={form.certTrabajo} onChange={v => set('certTrabajo', v)} />
                  <CheckRow label="Solicitar CV" sublabel="Adjunto en la inscripción" checked={form.solicitarCV} onChange={v => set('solicitarCV', v)} />
                </div>
              </FormRow>

              <FormRow label="Otros requisitos académicos · opcional">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.requisitos.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ink-3)' }}>check_box</span>
                      <input className="field" value={r} onChange={e => set('requisitos', form.requisitos.map((x, j) => j === i ? e.target.value : x))} />
                      <button className="btn btn-ghost btn-sm" onClick={() => set('requisitos', form.requisitos.filter((_, j) => j !== i))}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('requisitos', [...form.requisitos, ''])}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                    Agregar requisito
                  </button>
                </div>
              </FormRow>

              <div style={{ padding: 16, border: '1px solid var(--rule-2)', borderRadius: 10, marginTop: 8, background: 'var(--paper-2)' }}>
                <CheckRow
                  label="Programar lanzamiento automático"
                  sublabel="La convocatoria se publicará sola en la fecha y hora indicadas"
                  checked={form.programarLanzamiento}
                  onChange={v => set('programarLanzamiento', v)}
                />
                {form.programarLanzamiento && (
                  <div style={{ marginTop: 12 }}>
                    <input className="field" value={form.fechaProgramada} onChange={e => set('fechaProgramada', e.target.value)} placeholder="Ej: 10 jun 2026 · 09:00" />
                  </div>
                )}
              </div>

              {/* Launch CTA */}
              <div style={{
                marginTop: 28, paddingTop: 24,
                borderTop: '1px solid var(--rule-2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
              }}>
                <div className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>
                    Última edición: <span className="mono">{c.updatedAt}</span> · creada <span className="mono">{c.createdAt}</span>
                  </span>
                  {c.iaUsed && <span style={{ color: 'var(--ai)' }}>IA contribuyó al armado inicial</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn">Guardar borrador</button>
                  <button
                    onClick={tryLaunch}
                    className="press"
                    title={ready ? '' : missingText}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 18px', borderRadius: 999,
                      background: ready ? 'var(--ink)' : 'var(--rule-3)',
                      color: ready ? 'var(--paper)' : 'var(--ink-4)',
                      border: 'none',
                      cursor: ready ? 'pointer' : 'help',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {form.programarLanzamiento ? 'schedule_send' : 'rocket_launch'}
                    </span>
                    {form.programarLanzamiento ? 'Programar lanzamiento' : 'Lanzar ahora'}
                    {!ready && (
                      <span className="mono" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                        {missingTotal}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </BorradorSection>
          </div>
        </div>

        {/* ====== PREVIEW SIDEBAR ====== */}
        <aside style={{
          borderLeft: '1px solid var(--rule-2)',
          background: 'var(--paper)',
          position: 'sticky', top: 56,
          height: 'calc(100vh - 56px)',
          display: 'flex', flexDirection: 'column',
          minWidth: 0,
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--rule-2)', padding: '12px 16px 0', gap: 4, alignItems: 'flex-end' }}>
            <PreviewTab id="whatsapp" active={previewTab === 'whatsapp'} onClick={() => setPreviewTab('whatsapp')} icon="forum">WhatsApp</PreviewTab>
            <PreviewTab id="card"     active={previewTab === 'card'}     onClick={() => setPreviewTab('card')}     icon="badge">Tarjeta</PreviewTab>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {previewTab === 'whatsapp' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="label">Posteo de WhatsApp</span>
                  <button className="btn btn-sm press" onClick={copyWhatsApp}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      {copied ? 'check' : 'content_copy'}
                    </span>
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <WhatsAppPreview msg={whatsappMsg} />
                <div className="meta" style={{ marginTop: 12, lineHeight: 1.4 }}>
                  Se actualiza solo mientras editás. Copialo y pegalo en el grupo cuando estés listo.
                </div>
              </>
            )}
            {previewTab === 'card' && (
              <>
                <span className="label">Tarjeta del estudiante</span>
                <StudentCardPreview form={form} />
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

// Section block with optional missing-dot indicator
function BorradorSection({ number, title, subtitle, missing, children }) {
  return (
    <section style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--rule-2)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          {number && <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 13, paddingTop: 2 }}>{number}</span>}
          <div>
            <h3 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {title}
              {missing > 0 && (
                <span title={`Faltan ${missing} dato${missing === 1 ? '' : 's'} en esta sección`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--warn)', fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 500 }}>
                  <span className="dot dot-warn" style={{ width: 6, height: 6 }}></span>
                  {missing} pendiente{missing === 1 ? '' : 's'}
                </span>
              )}
            </h3>
            {subtitle && <div className="meta" style={{ marginTop: 4 }}>{subtitle}</div>}
          </div>
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}

// ---------- BorradorView helpers ----------

function CheckRow({ label, sublabel, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: 'var(--ink)' }}
      />
      <div>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{label}</div>
        {sublabel && <div className="meta" style={{ marginTop: 2 }}>{sublabel}</div>}
      </div>
    </label>
  );
}

function PreviewTab({ active, onClick, icon, children, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '8px 12px', fontFamily: 'inherit',
        fontSize: 12, fontWeight: active ? 600 : 500,
        color: active ? 'var(--ink)' : 'var(--ink-3)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
      {children}
      {badge != null && (
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 999,
          background: 'var(--warn-soft)', color: 'var(--warn)', fontWeight: 700,
        }}>{badge}</span>
      )}
    </button>
  );
}

function WhatsAppPreview({ msg }) {
  return (
    <div style={{
      background: 'var(--paper-2)', color: 'var(--ink-2)',
      borderRadius: 10, padding: 16,
      border: '1px solid var(--rule-2)',
      fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
      fontSize: 12, lineHeight: 1.55,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      maxHeight: '60vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--rule-2)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ok)' }}>chat</span>
        <span className="label" style={{ fontSize: 10 }}>Texto a pegar en WhatsApp</span>
      </div>
      {msg}
    </div>
  );
}

function StudentCardPreview({ form }) {
  const first = form.orientaciones[0] || '—';
  const orientColor = { 'Clínica': '#3B82F6', 'Educacional': '#10B981', 'Laboral': '#F59E0B', 'Comunitaria': '#8B5CF6' }[first] || '#64748B';
  return (
    <div style={{
      marginTop: 12, padding: 18,
      background: 'var(--paper)', border: '1px solid var(--rule-2)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)' }}></span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, marginBottom: 12 }}>
        {form.institucion?.nombre || 'Institución'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ padding: '2px 10px', borderRadius: 4, background: orientColor + '20', color: orientColor, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{first}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-3)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
          {form.horas || '—'} hs
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-3)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span>
          {form.online ? 'Online' : (form.direccion || 'sin dirección')}
        </span>
      </div>
      <button style={{
        background: 'linear-gradient(180deg, #4F6BED, #3851C7)', color: 'white',
        border: 'none', padding: '10px 16px', borderRadius: 6,
        fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        width: '100%', cursor: 'default',
      }} disabled>
        INSCRIBIRME →
      </button>
    </div>
  );
}

function ChecklistPanel({ form, missing }) {
  const fields = [
    { k: 'institucion', label: 'Institución',         ok: !!form.institucion },
    { k: 'nombre',      label: 'Nombre',              ok: !!form.nombre },
    { k: 'orient',      label: 'Orientación',         ok: form.orientaciones.length > 0 },
    { k: 'lugar',       label: 'Lugar (o online)',    ok: form.online || !!form.direccion },
    { k: 'cupos',       label: 'Cupos',               ok: !!form.cupos },
    { k: 'horas',       label: 'Horas',               ok: !!form.horas },
    { k: 'fechas',      label: 'Fechas de práctica',  ok: !!form.fechaInicio && !!form.fechaFin },
    { k: 'inscr',       label: 'Ventana inscripción', ok: !!form.inicioInscripcion && !!form.cierreInscripcion },
    { k: 'encuentro',   label: 'Encuentro inicial',   ok: !!form.encuentroInicial },
    { k: 'desc',        label: 'Descripción',         ok: !!form.descripcion },
    { k: 'act',         label: 'Al menos 1 actividad', ok: form.actividades.filter(a => a.trim()).length > 0 },
    { k: 'horarios',    label: 'Horarios',            ok: form.horarios.filter(h => h.dia && h.desde && h.hasta).length > 0 },
  ];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="label">Revisión previa</span>
        <span className="mono meta">{fields.filter(f => f.ok).length}/{fields.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {fields.map(f => (
          <div key={f.k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--rule-2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: f.ok ? 'var(--ok)' : 'var(--ink-4)' }}>
              {f.ok ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span style={{ color: f.ok ? 'var(--ink-2)' : 'var(--ink-3)' }}>{f.label}</span>
          </div>
        ))}
      </div>
      {missing.length === 0 && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: 'var(--ok-soft)', color: 'var(--ok)', fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
          <span>Todo en orden. La convocatoria está lista para publicarse.</span>
        </div>
      )}
    </div>
  );
}

// Compute missing-fields list
function computeMissing(form) {
  const missing = [];
  if (!form.institucion) missing.push('institucion');
  if (!form.nombre) missing.push('nombre');
  if (form.orientaciones.length === 0) missing.push('orientacion');
  if (!form.online && !form.direccion) missing.push('lugar');
  if (!form.cupos) missing.push('cupos');
  if (!form.horas) missing.push('horas');
  if (!form.fechaInicio || !form.fechaFin) missing.push('fechas');
  if (!form.inicioInscripcion || !form.cierreInscripcion) missing.push('inscripcion');
  if (!form.descripcion) missing.push('descripcion');
  if (form.horarios.filter(h => h.dia && h.desde && h.hasta).length === 0) missing.push('horarios');
  return missing;
}

// Build the WhatsApp message from form
function buildWhatsAppMessage(f) {
  const lines = [];
  lines.push(`📣 *¡Nueva Convocatoria PPS${f.nombre ? `: ${f.nombre}` : ''}!* 📣`);
  lines.push('');
  if (f.institucion?.nombre) lines.push(`✨ *Institución:* ${f.institucion.nombre}`);
  if (f.online) lines.push(`💻 *Modalidad:* Online`);
  else if (f.direccion) lines.push(`📍 *Lugar:* ${f.direccion}`);
  if (f.orientaciones.length) lines.push(`🎓 *Orientación:* ${f.orientaciones.join(', ')}`);
  if (f.cupos) lines.push(`👥 *Cupos:* ${f.cupos}`);
  if (f.horas) lines.push(`⏱️ *Horas:* ${f.horas} hs`);
  lines.push('');
  if (f.cierreInscripcion) lines.push(`📅 *Inscripción:* hasta ${f.cierreInscripcion}`);
  if (f.fechaInicio) lines.push(`🚀 *Inicio práctica:* ${f.fechaInicio}`);
  if (f.encuentroInicial) lines.push(`👋 *Encuentro inicial:* ${f.encuentroInicial}`);
  lines.push('');
  if (f.descripcion) {
    lines.push(`🎯 *Sobre la práctica:*`);
    lines.push(f.descripcion);
    lines.push('');
  }
  const valid = f.actividades.filter(a => a.trim());
  if (valid.length) {
    lines.push(`📝 *Actividades:*`);
    valid.forEach(a => lines.push(`• ${a}`));
    lines.push('');
  }
  const validH = f.horarios.filter(h => h.dia && h.desde);
  if (validH.length) {
    lines.push(`🕒 *Horarios:*`);
    validH.forEach(h => lines.push(`• ${h.dia} ${h.desde}-${h.hasta}${h.supervisor ? ` · ${h.supervisor}` : ''}`));
    lines.push('');
  }
  if (f.requisitos.filter(r => r.trim()).length || f.certTrabajo || f.solicitarCV || f.requisitoExcluyente) {
    lines.push(`✅ *Requisitos:*`);
    f.requisitos.filter(r => r.trim()).forEach(r => lines.push(`• ${r}`));
    if (f.certTrabajo) lines.push(`• Certificado de trabajo (si aplica)`);
    if (f.solicitarCV) lines.push(`• CV adjunto`);
    if (f.requisitoExcluyente) lines.push(`• *Excluyente:* ${f.requisitoExcluyente}`);
    lines.push('');
  }
  lines.push(`🔗 *Inscribirse:* pps.uflo.edu.ar/c/nueva`);
  return lines.join('\n');
}

// ============================================================================
// ABIERTA — horario health + mix + difusion + full inscriptos
// ============================================================================

function MiniSpark({ values, w = 280, h = 60 }) {
  if (!values?.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, h - ((v - min) / range) * (h - 8) - 4]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const fill = `M 0 ${h} ${path.slice(2)} L ${w} ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={fill} fill="var(--ink)" opacity=".06" />
      <path d={path} stroke="var(--ink)" fill="none" strokeWidth="1.5" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill="var(--ink)" />
    </svg>
  );
}

function AbiertaView({ c }) {
  const urgent = c.cierreEn === 'mañana' || c.cierreEn?.includes('hoy');

  // Compute horarios alerts
  const lowHorarios = (c.horarioBreakdown || []).filter(h => h.status === 'low');

  return (
    <>
      <CanvasHeader
        c={c}
        primaryAction={{ label: urgent ? 'Cerrar y seleccionar' : 'Cerrar inscripción', icon: 'lock', onClick: () => {} }}
        secondaryActions={[
          { label: 'Difundir', icon: 'campaign', onClick: () => {} },
          { label: 'Editar', icon: 'edit', onClick: () => {} },
        ]}
      />

      <div style={{ padding: '32px 48px 48px' }}>
        {/* IA alert about gaps */}
        {lowHorarios.length > 0 && (
          <div style={{
            padding: '14px 18px', marginBottom: 24,
            border: '1px solid var(--warn)', borderRadius: 12,
            background: 'var(--warn-soft)',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--warn)', marginTop: 2 }}>warning</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>
                {lowHorarios.length === 1
                  ? `Falta gente en "${lowHorarios[0].label}"`
                  : `${lowHorarios.length} horarios con poca inscripción`}
              </div>
              <div className="meta">
                Esa franja tiene {lowHorarios[0].inscriptos} de {lowHorarios[0].cuposLocal} cupos. La IA sugiere reanunciar mencionando ese horario específicamente.
              </div>
            </div>
            <button className="btn btn-sm press" style={{ flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              Generar reanuncio
            </button>
          </div>
        )}

        {/* Top stats: total + cierre + cohorte mix */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr', gap: 0,
          borderTop: '1px solid var(--rule-2)', borderBottom: '1px solid var(--rule-2)',
          padding: '24px 0', marginBottom: 32,
        }}>
          <div style={{ paddingRight: 24, borderRight: '1px solid var(--rule-2)' }}>
            <span className="label">Inscriptos</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 52, lineHeight: 1, fontWeight: 300, letterSpacing: '-0.04em' }}>{c.inscriptos}</span>
              <span className="meta">de {c.cupos} cupos · {(c.inscriptos / c.cupos).toFixed(1)}× sobre demanda</span>
            </div>
            <div style={{ marginTop: 14 }}>
              <MiniSpark values={c.inscripcionTrend} w={320} h={50} />
            </div>
          </div>

          <div style={{ paddingLeft: 24, paddingRight: 24, borderRight: '1px solid var(--rule-2)' }}>
            <span className="label">Cierra</span>
            <div className="serif" style={{ fontSize: 32, marginTop: 6, color: urgent ? 'var(--warn)' : 'var(--ink)' }}>
              {c.cierreEn}
            </div>
            <div className="meta mono" style={{ marginTop: 6 }}>
              {c.cierreFecha} · 23:59 hs
            </div>
            <div className="meta" style={{ marginTop: 8 }}>
              Abierta desde {c.abiertaDesde}
            </div>
          </div>

          <div style={{ paddingLeft: 24 }}>
            <span className="label">Mix de inscriptos</span>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MixRow data={c.mix.orientaciones} total={c.inscriptos} label="Orientación" />
              <MixRow data={c.mix.anios} total={c.inscriptos} label="Año" />
            </div>
            <div className="meta" style={{ marginTop: 10 }}>
              <span className="mono">{c.mix.conPPSPrevia}</span> ya hicieron al menos 1 PPS
            </div>
          </div>
        </div>

        {/* Horario health — the most actionable section */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <span className="eyebrow">Lo importante hoy</span>
              <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em' }}>
                <em>Salud</em> por franja horaria
              </h3>
            </div>
            <span className="meta">Las PPS suelen llenarse rápido. Lo crítico es que cada franja tenga gente.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {(c.horarioBreakdown || []).map(h => (
              <HorarioCard key={h.id} h={h} />
            ))}
          </div>
        </section>

        {/* Two columns: full inscriptos + difusion */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 40 }}>
          {/* Inscriptos preview list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span className="eyebrow">Preselección</span>
                <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400 }}>
                  <em>Quiénes</em> ya se inscribieron
                </h3>
              </div>
              <button className="btn btn-ghost btn-sm">Ver los {c.inscriptos}</button>
            </div>
            <div style={{ border: '1px solid var(--rule-2)', borderRadius: 12, overflow: 'hidden' }}>
              {c.ultimos.map((u, i) => (
                <div key={i} className="row-hover" style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr auto',
                  gap: 12, padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--rule-2)',
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600, color: 'var(--ink-2)',
                  }}>
                    {u.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{u.name}</span>
                      <span className="meta">·</span>
                      <span className="meta">{u.year}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="meta mono" style={{ fontSize: 10.5 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: '-2px' }}>schedule</span> {u.horario}
                      </span>
                      {(u.tags || []).map(t => (
                        <span key={t} style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 3,
                          background: 'var(--paper-2)', color: 'var(--ink-3)',
                          fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="mono meta" style={{ fontSize: 10.5 }}>{u.when}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Difusión history */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span className="eyebrow">Difusión</span>
                <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400 }}>
                  Lo que <em>ya</em> se mandó
                </h3>
              </div>
            </div>
            <div style={{ border: '1px solid var(--rule-2)', borderRadius: 12, overflow: 'hidden' }}>
              {c.difusion.map((d, i) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--rule-2)',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: d.canal === 'whatsapp' ? 'var(--ok)' : 'var(--accent)', marginTop: 2 }}>
                    {d.canal === 'whatsapp' ? 'chat' : 'mail'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{d.detalle}</div>
                    <div className="meta mono" style={{ marginTop: 2, fontSize: 10.5 }}>{d.cuando}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>+{d.desde}</div>
                    <div className="meta" style={{ fontSize: 10 }}>llegaron</div>
                  </div>
                </div>
              ))}
              <div style={{ padding: 12, borderTop: '1px solid var(--rule-2)' }}>
                <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                  Reanunciar
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 14, background: 'var(--paper-2)', borderRadius: 10, border: '1px solid var(--rule-2)' }}>
              <span className="label">Link público</span>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', wordBreak: 'break-all', marginTop: 6, marginBottom: 10 }}>
                pps.uflo.edu.ar/c/{c.id}-investigacion-ii
              </div>
              <button className="btn btn-sm press" style={{ width: '100%', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                Copiar link
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function HorarioCard({ h }) {
  const pct = (h.inscriptos / h.cuposLocal);
  const tone = h.status === 'low' ? 'warn' : h.status === 'over' ? 'ok' : 'ok';
  const toneColor = tone === 'warn' ? 'var(--warn)' : 'var(--ok)';
  const toneBg = tone === 'warn' ? 'var(--warn-soft)' : 'var(--ok-soft)';

  return (
    <div style={{
      padding: 18, borderRadius: 12,
      border: `1px solid ${h.status === 'low' ? 'var(--warn)' : 'var(--rule-2)'}`,
      background: h.status === 'low' ? toneBg : 'var(--paper)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="label" style={{ marginBottom: 4 }}>Horario</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{h.label}</div>
        </div>
        {h.status === 'low' && (
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--warn)' }}>warning</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 28, fontWeight: 300, color: toneColor }}>{h.inscriptos}</span>
        <span className="meta">de {h.cuposLocal} cupos</span>
        <span className="meta" style={{ marginLeft: 'auto' }}>
          {pct >= 1 ? `${pct.toFixed(1)}× sobre demanda` : `${Math.round(pct * 100)}% del cupo`}
        </span>
      </div>

      <div style={{ height: 4, background: 'var(--rule-2)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: `${Math.min(100, pct * 100)}%`, height: '100%',
          background: toneColor, borderRadius: 999,
        }}></div>
        {/* cupo marker at 100% */}
        {pct > 1 && (
          <div style={{ position: 'absolute', left: `${100 / pct}%`, top: -2, height: 8, width: 1, background: 'var(--ink-3)' }}></div>
        )}
      </div>

      {h.status === 'low' && (
        <div className="meta" style={{ marginTop: 10, color: 'var(--warn)' }}>
          Probablemente quede vacía si no se difunde con foco en este día.
        </div>
      )}
    </div>
  );
}

function MixRow({ data, total, label }) {
  const items = Object.entries(data).filter(([_, v]) => v > 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="meta" style={{ minWidth: 60 }}>{label}</span>
      <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', flex: 1, background: 'var(--rule-2)' }}>
        {items.map(([k, v], i) => (
          <div
            key={k}
            title={`${k}: ${v}`}
            style={{
              width: `${(v / total) * 100}%`,
              background: ['var(--ink)', 'var(--ink-3)', 'var(--ink-4)', 'var(--rule-3)'][i % 4],
            }}
          ></div>
        ))}
      </div>
      <span className="mono meta" style={{ fontSize: 10, minWidth: 100, textAlign: 'right', display: 'block' }}>
        {items.map(([k, v]) => `${k.slice(0, 4)}:${v}`).join(' · ')}
      </span>
    </div>
  );
}

// ============================================================================
// CERRADA — student selector (cards, smart shortlist, conflicts)
// ============================================================================

function CerradaView({ c }) {
  const [candidatos, setCandidatos] = useStateV(c.candidatos);
  const [filter, setFilter] = useStateV('all'); // all | confirmed | pending | conflict
  const [sortBy, setSortBy] = useStateV('score');
  const [emailOpen, setEmailOpen] = useStateV(false);

  const cupos = c.cupos;
  const selected   = candidatos.filter(s => s.selected === 'in');
  const reserve    = candidatos.filter(s => s.selected === 'reserve');
  const rejected   = candidatos.filter(s => s.selected === 'out');
  const confirmed  = candidatos.filter(s => s.compromiso?.estado === 'confirmado');

  const toggle = (id, mode) => {
    setCandidatos(prev => prev.map(s => s.id === id ? { ...s, selected: s.selected === mode ? null : mode } : s));
  };

  // AI shortlist — top 2 with no conflict and highest score (excluding already-selected for "suggest")
  const aiShortlist = useMemoV(() => {
    return [...candidatos]
      .filter(s => !s.conflict)
      .sort((a, b) => b.score - a.score)
      .slice(0, cupos);
  }, [candidatos, cupos]);

  // Apply IA suggestion
  const applyAI = () => {
    const ids = new Set(aiShortlist.map(s => s.id));
    setCandidatos(prev => prev.map(s => ({ ...s, selected: ids.has(s.id) ? 'in' : (s.selected === 'in' ? null : s.selected) })));
  };

  // Sort + filter
  const visible = useMemoV(() => {
    let arr = [...candidatos];
    if (filter === 'confirmed') arr = arr.filter(s => s.compromiso?.estado === 'confirmado');
    if (filter === 'pending')   arr = arr.filter(s => !s.compromiso);
    if (filter === 'conflict')  arr = arr.filter(s => s.conflict);
    if (filter === 'selected')  arr = arr.filter(s => s.selected === 'in');
    arr.sort((a, b) => sortBy === 'score' ? b.score - a.score : b.hsAcum - a.hsAcum);
    return arr;
  }, [candidatos, filter, sortBy]);

  return (
    <>
      <CanvasHeader
        c={c}
        primaryAction={{
          label: `Confirmar y comunicar (${selected.length}/${cupos})`,
          icon: 'send',
          onClick: () => setEmailOpen(true),
        }}
        secondaryActions={[
          { label: 'Ver seleccionados', icon: 'visibility', onClick: () => setFilter('selected') },
          { label: 'Guardar cambios', icon: 'save', onClick: () => {} },
        ]}
      />

      <div style={{ padding: '24px 48px 48px' }}>
        {/* Summary bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', marginBottom: 16,
          background: 'var(--paper-2)', borderRadius: 12, border: '1px solid var(--rule-2)',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <Stat label="Cupos" value={`${selected.length}/${cupos}`} />
            <Sep />
            <Stat label="Postulantes" value={candidatos.length} />
            <Sep />
            <Stat label="Confirmados" value={confirmed.length} tone="ok" />
            <Sep />
            <Stat label="Lista de espera" value={reserve.length} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="meta">Orden</span>
            <select className="field" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto', padding: '6px 28px 6px 10px', fontSize: 12 }}>
              <option value="score">Puntaje</option>
              <option value="hs">Hs acumuladas</option>
            </select>
            <div style={{ width: 1, height: 24, background: 'var(--rule-2)' }}></div>
            {[
              { k: 'all', label: 'Todos' },
              { k: 'selected', label: 'Seleccionados' },
              { k: 'confirmed', label: 'Confirmados' },
              { k: 'conflict', label: 'Conflictos' },
            ].map(f => (
              <button key={f.k}
                onClick={() => setFilter(f.k)}
                className={`btn btn-sm ${filter === f.k ? '' : 'btn-ghost'}`}
                style={{ padding: '6px 10px' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI shortlist banner */}
        {selected.length < cupos && aiShortlist.length > 0 && (
          <div style={{
            padding: '14px 20px', marginBottom: 16,
            border: '1px solid var(--ai)', borderRadius: 12,
            background: 'var(--ai-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 280 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ai)', marginTop: 2 }}>auto_awesome</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>
                  IA sugiere: <em style={{ fontFamily: 'Instrument Serif, serif', fontSize: 16 }}>
                    {aiShortlist.map(s => s.name.split(' ').slice(0, 2).join(' ')).join(' · ')}
                  </em>
                </div>
                <div className="meta" style={{ color: 'var(--ink-2)' }}>
                  Por puntaje, hs acumuladas, horario sin conflicto y compromiso confirmado.
                </div>
              </div>
            </div>
            <button className="btn press" style={{ background: 'var(--ai)', color: 'var(--paper)', borderColor: 'var(--ai)' }} onClick={applyAI}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
              Aplicar sugerencia
            </button>
          </div>
        )}

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((s) => (
            <CandidatoCard
              key={s.id}
              s={s}
              cupos={cupos}
              selectedCount={selected.length}
              isAIPicked={aiShortlist.some(a => a.id === s.id)}
              onToggle={(mode) => toggle(s.id, mode)}
            />
          ))}
        </div>

        {emailOpen && (
          <EmailPanel
            selected={selected}
            reserve={reserve}
            rejected={rejected}
            onClose={() => setEmailOpen(false)}
            c={c}
          />
        )}
      </div>
    </>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 400, marginTop: 2, color: tone === 'ok' ? 'var(--ok)' : 'var(--ink)' }}>{value}</div>
    </div>
  );
}
function Sep() { return <div style={{ width: 1, height: 28, background: 'var(--rule-2)' }}></div>; }

function CandidatoCard({ s, cupos, selectedCount, isAIPicked, onToggle }) {
  const isIn       = s.selected === 'in';
  const isReserve  = s.selected === 'reserve';
  const isOut      = s.selected === 'out';
  const confirmed  = s.compromiso?.estado === 'confirmado';

  const bg = isIn ? 'var(--ok-soft)' : isOut ? 'var(--paper-2)' : 'var(--paper)';
  const borderColor = isIn ? 'var(--ok)' : 'var(--rule-2)';

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderLeft: isIn ? `3px solid var(--ok)` : `1px solid ${borderColor}`,
      borderRadius: 12,
      background: bg,
      opacity: isOut ? 0.6 : 1,
      padding: '16px 18px',
      transition: 'all .15s ease',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 16, alignItems: 'flex-start' }}>
        {/* Score circle */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--paper-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--rule-2)',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <span className="mono" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{s.score}</span>
        </div>

        {/* Main */}
        <div style={{ minWidth: 0 }}>
          {/* Name + meta + tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</span>
            <span className="meta">·</span>
            <span className="meta mono">{s.hsAcum} hs acumuladas</span>
            <span className="meta">·</span>
            <span className="meta">{s.year}</span>
            {isAIPicked && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 4,
                background: 'var(--ai-soft)', color: 'var(--ai)',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>
                IA top
              </span>
            )}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {s.tags.map(t => (
              <span key={t} style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                padding: '3px 8px', borderRadius: 4,
                background: 'transparent', border: '1px solid var(--rule-2)',
                color: 'var(--ink-3)',
              }}>{t}</span>
            ))}
            {confirmed && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                padding: '3px 8px', borderRadius: 4,
                background: 'var(--ok-soft)', color: 'var(--ok)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check</span>
                CONFIRMADO
              </span>
            )}
            {s.conflict && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                padding: '3px 8px', borderRadius: 4,
                background: 'var(--warn-soft)', color: 'var(--warn)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>warning</span>
                CONFLICTO
              </span>
            )}
          </div>

          {/* Note */}
          {s.nota && (
            <div style={{
              padding: '8px 12px',
              background: 'var(--paper)',
              borderLeft: '3px solid var(--ink-4)',
              fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4,
              marginBottom: 10, fontStyle: 'italic',
              borderRadius: 4,
            }}>
              <span className="label" style={{ fontStyle: 'normal', display: 'inline', marginRight: 8 }}>Nota:</span>
              "{s.nota}"
            </div>
          )}

          {/* Conflict detail */}
          {s.conflict && (
            <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
              {s.conflict}
            </div>
          )}

          {/* Footer: horario + compromiso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
            {s.horarioElegido && (
              <span style={{ fontSize: 12, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ink-3)' }}>schedule</span>
                Eligió: <strong style={{ color: 'var(--ink)' }}>{s.horarioElegido}</strong>
              </span>
            )}
            {confirmed && (
              <span className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>verified</span>
                Compromiso aceptado el {s.compromiso.fecha} · {s.compromiso.hora}
              </span>
            )}
            {s.whatsapp && (
              <span className="mono meta">{s.whatsapp}</span>
            )}
          </div>
        </div>

        {/* Action column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <button
            onClick={() => onToggle('in')}
            className="press"
            disabled={!isIn && selectedCount >= cupos}
            style={{
              width: 44, height: 44, borderRadius: 10,
              background: isIn ? 'var(--ok)' : 'transparent',
              color: isIn ? 'var(--paper)' : 'var(--ink-3)',
              border: `1px solid ${isIn ? 'var(--ok)' : 'var(--rule-2)'}`,
              cursor: !isIn && selectedCount >= cupos ? 'not-allowed' : 'pointer',
              opacity: !isIn && selectedCount >= cupos ? 0.4 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
            }}
            title={isIn ? 'Quitar selección' : 'Seleccionar'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              {isIn ? 'check' : 'add'}
            </span>
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => onToggle('reserve')}
              className="btn btn-ghost btn-sm"
              title="Lista de espera"
              style={{ padding: 4, background: isReserve ? 'var(--accent-soft)' : 'transparent', color: isReserve ? 'var(--accent)' : 'var(--ink-4)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
            </button>
            <button
              onClick={() => onToggle('out')}
              className="btn btn-ghost btn-sm"
              title="Rechazar"
              style={{ padding: 4, color: isOut ? 'var(--warn)' : 'var(--ink-4)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailPanel({ selected, reserve, rejected, onClose, c }) {
  return (
    <div style={{
      marginTop: 28, padding: 24,
      border: '1px solid var(--rule-2)', borderRadius: 12, background: 'var(--paper-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 400 }}>
          Comunicar la decisión
        </h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>

      <div className="meta" style={{ marginBottom: 18 }}>
        Tres mensajes distintos · revisalos antes de enviar
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { who: 'Aceptados', count: selected.length, subject: '¡Quedaste en la PPS!', tone: 'ok' },
          { who: 'Lista de espera', count: reserve.length, subject: 'En lista de espera · te avisamos pronto', tone: 'accent' },
          { who: 'No esta vez', count: rejected.length, subject: 'Sobre tu inscripción a la PPS', tone: 'mute' },
        ].map((b, i) => (
          <div key={i} style={{
            padding: 16, background: 'var(--paper)',
            border: '1px solid var(--rule-2)', borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className={`dot dot-${b.tone}`}></span>
              <span className="label">{b.who}</span>
              <span className="mono meta" style={{ marginLeft: 'auto' }}>{b.count}</span>
            </div>
            <div className="serif" style={{ fontSize: 15, fontStyle: 'italic', color: 'var(--ink-2)', marginBottom: 10 }}>
              "{b.subject}"
            </div>
            <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center' }}>Ver y editar</button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--rule-2)' }}>
        <span className="meta">Total: <span className="mono">{selected.length + reserve.length + rejected.length}</span> correos · ninguno se envía hasta confirmar</span>
        <button className="btn btn-primary press">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
          Enviar los 3 correos
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SELECCIONADA — 4-step insurance flow
// ============================================================================

function SeleccionadaView({ c }) {
  // Consentimiento phase tracking
  const [consents, setConsents] = useStateV(c.consentimientos || []);
  const firmados = consents.filter(x => x.estado === 'firmado').length;
  const pendientes = consents.filter(x => x.estado === 'pendiente').length;
  const bajas = consents.filter(x => x.estado === 'baja').length;
  const consentReady = pendientes === 0 && consents.length > 0;

  // Local state for the 4 steps
  const [stepStates, setStepStates] = useStateV({
    1: consentReady ? 'done' : 'pending',
    2: consentReady ? 'active' : 'pending',
    3: 'pending',
    4: 'pending',
  });

  useEffectV(() => {
    // when consent finishes, unlock the seguro pipeline
    if (consentReady && stepStates[1] === 'pending') {
      setStepStates({ 1: 'done', 2: 'active', 3: 'pending', 4: 'pending' });
    }
  }, [consentReady]);

  const [studentChecks, _setStudentChecks] = useStateV(
    c.alumnos.map(a => ({ ...a, dniOk: true, datosOk: true, polizaOk: false, aviso: false }))
  );

  const allDone = Object.values(stepStates).every(s => s === 'done');

  const completeStep = (n) => setStepStates(prev => {
    const next = { ...prev, [n]: 'done' };
    if (n < 4 && prev[n + 1] === 'pending') next[n + 1] = 'active';
    return next;
  });

  // Mock: mark a pending consent as signed (simulating click)
  const markSigned = (name) => setConsents(prev => prev.map(c =>
    c.name === name && c.estado === 'pendiente'
      ? { ...c, estado: 'firmado', firmadoEn: 'Justo ahora' }
      : c
  ));
  const markBaja = (name) => setConsents(prev => prev.map(c =>
    c.name === name && c.estado === 'pendiente'
      ? { ...c, estado: 'baja' }
      : c
  ));

  return (
    <>
      <CanvasHeader
        c={c}
        primaryAction={
          !consentReady
            ? { label: `Esperando ${pendientes} consentimiento${pendientes === 1 ? '' : 's'}`, icon: 'hourglass_top', onClick: () => {} }
            : allDone
              ? { label: 'Cerrar trámite y archivar', icon: 'check_circle', onClick: () => {} }
              : { label: 'Hacer todo en automático', icon: 'auto_fix_high', onClick: () => setStepStates({ 1: 'done', 2: 'done', 3: 'done', 4: 'done' }) }
        }
        secondaryActions={[
          { label: 'Modificar selección', icon: 'edit', onClick: () => {} },
          { label: 'Reenviar consentimientos', icon: 'forward_to_inbox', onClick: () => {} },
        ]}
      />

      <div style={{ padding: '32px 48px 48px' }}>

        {/* PHASE 1: CONSENTIMIENTOS */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className={`dot dot-${consentReady ? 'ok' : 'accent'}${consentReady ? '' : ' dot-live'}`} style={{ color: 'var(--accent)' }}></span>
                Fase 1 · Consentimiento online
              </span>
              <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 400, letterSpacing: '-0.015em' }}>
                {consentReady
                  ? <>Todos firmaron · <em>listos para asegurar</em></>
                  : <><em>{firmados}</em> de {consents.length} firmaron · esperando {pendientes}</>
                }
              </h3>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }} className="meta">
              <span><span className="dot dot-ok"></span> {firmados} firmaron</span>
              {pendientes > 0 && <span><span className="dot dot-accent"></span> {pendientes} pendiente{pendientes === 1 ? '' : 's'}</span>}
              {bajas > 0 && <span><span className="dot dot-warn"></span> {bajas} baja{bajas === 1 ? '' : 's'} automática{bajas === 1 ? '' : 's'}</span>}
            </div>
          </div>

          {!consentReady && (
            <div style={{
              padding: '12px 16px', marginBottom: 14,
              borderRadius: 10, border: '1px solid var(--rule-2)',
              background: 'var(--paper-2)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent)' }}>info</span>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>
                Los seleccionados recibieron un mail con el consentimiento online. Tienen <strong>24 hs</strong> para firmarlo. Si no firman, se da de baja automática y se libera el cupo para la lista de espera.
              </div>
            </div>
          )}

          <div style={{ border: '1px solid var(--rule-2)', borderRadius: 12, overflow: 'hidden' }}>
            {consents.map((s, i) => (
              <ConsentRow key={s.name} s={s} onSign={() => markSigned(s.name)} onBaja={() => markBaja(s.name)} isLast={i === consents.length - 1} />
            ))}
          </div>
        </section>

        {/* PHASE 2: SEGURO — disabled until consent is ready */}
        <section style={{ opacity: consentReady ? 1 : 0.45, pointerEvents: consentReady ? 'auto' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className={`dot dot-${allDone ? 'ok' : consentReady ? 'accent' : 'mute'}`}></span>
                Fase 2 · Seguro y documentación
              </span>
              <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 400, letterSpacing: '-0.015em' }}>
                <em>Generador</em> de seguros y listas
              </h3>
            </div>
            <span className="meta">{Object.values(stepStates).filter(s => s === 'done').length}/4 pasos · {c.seleccionados - bajas} alumnos</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 32, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SeguroStep
                n={1} label="Descargar plantilla"
                detail={`Excel con los datos de ${c.seleccionados - bajas} alumnos seleccionados.`}
                cta="Descargar plantilla"
                ctaIcon="download"
                state={stepStates[1]}
                onComplete={() => completeStep(1)}
              />
              <SeguroStep
                n={2} label="Copiar datos al formato de la aseguradora"
                detail="Genera el bloque de texto listo para pegar en el portal de LaCaja."
                cta="Copiar datos"
                ctaIcon="content_copy"
                state={stepStates[2]}
                onComplete={() => completeStep(2)}
              />
              <SeguroStep
                n={3} label="Enviar a Administración"
                detail="Notifica a Sergio que la documentación está lista para tramitar."
                cta="Enviar a Sergio"
                ctaIcon="send"
                state={stepStates[3]}
                tone="ok"
                onComplete={() => completeStep(3)}
              />
              <SeguroStep
                n={4} label="Descargar Excel final con pólizas"
                detail="Cuando Sergio confirme, descargá el listado con N° de póliza por alumno."
                cta="Descargar Excel"
                ctaIcon="download"
                state={stepStates[4]}
                tone="ink"
                onComplete={() => completeStep(4)}
              />

              {allDone && (
                <div style={{
                  marginTop: 14, padding: '20px 24px',
                  background: 'var(--ok-soft)', border: '1px solid var(--ok)',
                  borderRadius: 12, display: 'flex', gap: 16, alignItems: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--ok)' }}>verified</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Trámite cerrado</div>
                    <div className="meta" style={{ marginTop: 2 }}>Los alumnos están asegurados. Avisales que ya pueden empezar.</div>
                  </div>
                  <button className="btn press">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
                    Avisar a alumnos
                  </button>
                </div>
              )}
            </div>

            <aside>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="label">Alumnos en trámite</span>
                <span className="mono meta">{c.seleccionados - bajas}</span>
              </div>
              <div style={{ border: '1px solid var(--rule-2)', borderRadius: 10, overflow: 'hidden' }}>
                {studentChecks.filter(a => !consents.find(c => c.name === a.name && c.estado === 'baja')).map((a, i) => (
                  <div key={i} style={{
                    padding: '12px 14px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--rule-2)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 600, color: 'var(--ink-2)',
                      flexShrink: 0,
                    }}>
                      {a.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div className="mono meta" style={{ fontSize: 10 }}>DNI {a.dni}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <Dot ok={a.dniOk}   title="DNI" />
                      <Dot ok={a.datosOk} title="Datos completos" />
                      <Dot ok={stepStates[3] === 'done'} title="Enviado a aseguradora" />
                      <Dot ok={stepStates[4] === 'done'} title="Póliza recibida" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="meta" style={{ marginTop: 10, lineHeight: 1.4 }}>
                Los 4 puntos siguen los pasos de arriba. Pasan a verde cuando completás cada paso.
              </div>
            </aside>
          </div>
        </section>
      </div>
    </>
  );
}

function ConsentRow({ s, onSign, onBaja, isLast }) {
  const firmado = s.estado === 'firmado';
  const baja = s.estado === 'baja';
  const pendiente = s.estado === 'pendiente';
  const tone = firmado ? 'ok' : baja ? 'warn' : 'accent';
  const bg = firmado ? 'transparent' : baja ? 'var(--paper-2)' : 'transparent';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '32px 1fr 200px 240px 140px',
      gap: 16, padding: '14px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--rule-2)',
      alignItems: 'center',
      background: bg, opacity: baja ? 0.6 : 1,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600, color: 'var(--ink-2)',
      }}>
        {s.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {s.name}
          {baja && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', background: 'var(--warn-soft)', color: 'var(--warn)', borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em' }}>BAJA AUTOMÁTICA</span>}
        </div>
        <div className="mono meta" style={{ fontSize: 11, marginTop: 2 }}>DNI {s.dni}</div>
      </div>

      <div>
        <div className="meta" style={{ fontSize: 11 }}>
          {firmado && <>Mail enviado {s.enviadoEn}</>}
          {pendiente && <>Mail enviado {s.enviadoEn}</>}
          {baja && <>No firmó en 24 hs</>}
        </div>
        {firmado && <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 2 }}>Firmó {s.firmadoEn}</div>}
        {pendiente && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>Vence {s.deadline}</div>}
      </div>

      <div>
        {pendiente && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CountdownBar hours={s.horasRestantes} />
            <span className="mono meta" style={{ fontSize: 11, color: s.horasRestantes < 4 ? 'var(--warn)' : 'var(--ink-3)' }}>
              {s.horasRestantes.toFixed(1)} h
            </span>
          </div>
        )}
        {firmado && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ok)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Consentimiento firmado</span>
          </div>
        )}
        {baja && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--warn)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Reasignar cupo</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {pendiente && (
          <>
            <button className="btn btn-ghost btn-sm" title="Recordatorio por WhatsApp">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chat</span>
            </button>
            <button className="btn btn-ghost btn-sm" title="Reenviar mail" onClick={() => {}}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>forward_to_inbox</span>
            </button>
          </>
        )}
        {baja && (
          <button className="btn btn-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span>
            Reasignar
          </button>
        )}
        {firmado && (
          <button className="btn btn-ghost btn-sm" title="Ver consentimiento firmado">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>description</span>
          </button>
        )}
      </div>
    </div>
  );
}

function CountdownBar({ hours }) {
  const pct = Math.max(0, Math.min(100, (hours / 24) * 100));
  const color = hours < 4 ? 'var(--warn)' : hours < 12 ? 'var(--accent)' : 'var(--ink-3)';
  return (
    <div style={{ width: 70, height: 3, background: 'var(--rule-2)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color }}></div>
    </div>
  );
}

function Dot({ ok, title }) {
  return (
    <span
      title={title}
      style={{
        width: 8, height: 8, borderRadius: 999,
        background: ok ? 'var(--ok)' : 'var(--rule-3)',
        display: 'inline-block',
      }}
    />
  );
}

function SeguroStep({ n, label, detail, cta, ctaIcon, state, tone = 'default', onComplete }) {
  const done = state === 'done';
  const active = state === 'active';
  const pending = state === 'pending';

  const ctaBg = tone === 'ok' ? 'var(--ok)' : tone === 'ink' ? 'var(--ink)' : 'var(--accent)';

  return (
    <div style={{
      padding: '18px 22px',
      borderRadius: 12,
      border: `1px solid ${active ? 'var(--ink)' : 'var(--rule-2)'}`,
      background: done ? 'var(--paper-2)' : active ? 'var(--paper)' : 'var(--paper-2)',
      opacity: pending ? 0.55 : 1,
      display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 16, alignItems: 'center',
      transition: 'all .15s ease',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: done ? 'var(--ok)' : active ? 'var(--paper)' : 'transparent',
        color: done ? 'var(--paper)' : active ? 'var(--ink)' : 'var(--ink-4)',
        border: done ? '1px solid var(--ok)' : active ? '1.5px solid var(--ink)' : '1px solid var(--rule-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 600, fontSize: 14,
      }} className="mono">
        {done
          ? <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
          : n}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
          Paso {n}: {label}
        </div>
        <div className="meta">{detail}</div>
      </div>

      <div>
        {done ? (
          <button className="btn btn-ghost btn-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
            Rehacer
          </button>
        ) : (
          <button
            onClick={onComplete}
            disabled={!active}
            className="press"
            style={{
              background: active ? ctaBg : 'transparent',
              color: active ? 'var(--paper)' : 'var(--ink-3)',
              border: `1px solid ${active ? ctaBg : 'var(--rule-2)'}`,
              padding: '10px 16px', borderRadius: 8,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              cursor: active ? 'pointer' : 'not-allowed',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{ctaIcon}</span>
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVA — read-only, points to Gestión
// ============================================================================

function ActivaView({ c }) {
  const finishingSoon = c.estadoGestion?.includes('finalizar');
  return (
    <>
      <CanvasHeader
        c={c}
        primaryAction={{ label: 'Abrir en Gestión', icon: 'arrow_outward', onClick: () => {} }}
        secondaryActions={[
          { label: 'Duplicar', icon: 'content_copy', onClick: () => {} },
          { label: 'Ver ficha', icon: 'description', onClick: () => {} },
        ]}
      />

      <div style={{ padding: '40px 48px 48px' }}>
        <div style={{
          padding: 20, background: 'var(--paper-2)', border: '1px solid var(--rule-2)',
          borderRadius: 12, marginBottom: 32, display: 'flex', gap: 16,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--ok)' }}>play_circle</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
              Esta convocatoria ya está en ejecución
            </div>
            <div className="meta">
              El seguimiento operativo pasa a la sección <strong style={{ color: 'var(--ink)' }}>Gestión</strong>. Acá podés ver la ficha completa o duplicarla como base para una nueva.
            </div>
          </div>
          <button className="btn btn-primary btn-sm press">
            Ir a Gestión
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_outward</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, borderTop: '1px solid var(--rule-2)', borderBottom: '1px solid var(--rule-2)', padding: '24px 0' }}>
          <BigStat label="Estudiantes activos" value={`${c.activos}/${c.total}`} hint="todos en curso" />
          <BigStat label="Progreso de horas" value={`${Math.round(c.progresoHoras * 100)}%`} hint={`${Math.round(c.progresoHoras * 80)} de 80 hs`} bar={c.progresoHoras} />
          <BigStat label="Estado de gestión" value={c.estadoGestion} hint={`${c.inicio} → ${c.fin}`} tone={finishingSoon ? 'warn' : 'ok'} />
        </div>
      </div>
    </>
  );
}

function BigStat({ label, value, hint, bar, tone = 'default' }) {
  const color = tone === 'warn' ? 'var(--warn)' : tone === 'ok' ? 'var(--ok)' : 'var(--ink)';
  return (
    <div style={{ padding: '0 32px', borderRight: '1px solid var(--rule-2)' }}>
      <span className="label">{label}</span>
      <div className="serif" style={{ fontSize: 32, fontWeight: 400, marginTop: 8, color, lineHeight: 1.1 }}>{value}</div>
      {bar != null && (
        <div style={{ marginTop: 10, height: 3, background: 'var(--rule-2)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${bar * 100}%`, height: '100%', background: 'var(--ink)' }}></div>
        </div>
      )}
      <div className="meta" style={{ marginTop: 8 }}>{hint}</div>
    </div>
  );
}

// ============================================================================
// ARCHIVADA — lifeline + 3 actions + outcomes + IA insights
// ============================================================================

function ArchivadaView({ c }) {
  const ok = c.completedSuccess;
  const taxa = c.acreditados && c.seleccionados ? Math.round((c.acreditados / c.seleccionados) * 100) : null;

  return (
    <>
      <CanvasHeader
        c={c}
        primaryAction={{ label: 'Duplicar como base', icon: 'content_copy', onClick: () => {} }}
        secondaryActions={[
          { label: 'Exportar reporte', icon: 'download', onClick: () => {} },
        ]}
      />

      <div style={{ padding: '32px 48px 48px' }}>
        {/* Outcome banner */}
        <div style={{
          padding: '16px 20px', marginBottom: 28,
          background: ok ? 'var(--ok-soft)' : 'var(--paper-2)',
          border: `1px solid ${ok ? 'var(--ok)' : 'var(--rule-2)'}`,
          borderLeft: `3px solid ${ok ? 'var(--ok)' : 'var(--ink-3)'}`,
          borderRadius: 12,
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: ok ? 'var(--ok)' : 'var(--ink-3)' }}>
            {ok ? 'check_circle' : 'archive'}
          </span>
          <div style={{ flex: 1 }}>
            <div className="label">{ok ? 'Ciclo completado' : 'Archivado sin completar'}</div>
            <div style={{ fontSize: 14, marginTop: 2 }}>{c.motivo}</div>
          </div>
          <div className="meta mono">Cohorte {c.cohorte} · {c.archivadaEn}</div>
        </div>

        {/* Lifeline */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 14 }}>
            <span className="eyebrow">Historia</span>
            <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em' }}>
              <em>Qué pasó</em> con esta convocatoria
            </h3>
          </div>
          <Lifeline events={c.lifeline || []} />
        </section>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid var(--rule-2)', borderBottom: '1px solid var(--rule-2)', padding: '24px 0', marginBottom: 32 }}>
          <BigStat label="Inscriptos" value={c.inscriptos} hint="se postularon" />
          <BigStat label="Seleccionados" value={c.seleccionados} hint="comenzaron" />
          <BigStat label="Acreditados" value={c.acreditados ?? '—'} hint="finalizaron PPS" tone={ok ? 'ok' : 'default'} />
          <BigStat label="Tasa de éxito" value={taxa ? `${taxa}%` : '—'} hint="acred. / selecc." />
        </div>

        {/* 3 main actions */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 14 }}>
            <span className="eyebrow">Qué podés hacer con esta convocatoria</span>
            <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em' }}>
              No es sólo archivo · sigue siendo útil
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <BigActionCard
              icon="content_copy"
              title="Duplicar como base"
              desc="Crea un nuevo borrador con todos estos datos. Ideal para relanzar el próximo año."
              cta="Crear borrador"
              tone="primary"
            />
            <BigActionCard
              icon="restart_alt"
              title="Reabrir convocatoria"
              desc="Vuelve a abrir inscripción manteniendo los inscriptos originales. Útil si alguien se dio de baja."
              cta="Reabrir"
              tone="default"
              disabled={!ok}
            />
            <BigActionCard
              icon="how_to_reg"
              title="Volver a seleccionar"
              desc="Reabre el seleccionador sobre los postulantes originales. Sin abrir nuevas inscripciones."
              cta="Reseleccionar"
              tone="default"
              disabled={!c.inscriptos}
            />
          </div>
        </section>

        {/* Participantes */}
        {c.participantes && c.participantes.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <span className="eyebrow">Participantes</span>
                <h3 className="serif" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 400 }}>
                  <em>Quiénes</em> pasaron por esta PPS
                </h3>
              </div>
              <button className="btn btn-ghost btn-sm">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
                Descargar lista
              </button>
            </div>
            <div style={{ border: '1px solid var(--rule-2)', borderRadius: 12, overflow: 'hidden' }}>
              {c.participantes.map((p, i) => (
                <ParticipanteRow key={i} p={p} isLast={i === c.participantes.length - 1} />
              ))}
            </div>
          </section>
        )}

        {/* IA insights */}
        {c.insights && c.insights.length > 0 && (
          <section style={{
            padding: 20, borderRadius: 12,
            background: 'var(--ai-soft)', border: '1px solid var(--ai)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--ai)' }}>auto_awesome</span>
              <span className="label" style={{ color: 'var(--ai)' }}>Memoria institucional · lecciones de la IA</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {c.insights.map((ins, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: 16,
                    color: ins.kind === 'good' ? 'var(--ok)' : ins.kind === 'warn' ? 'var(--warn)' : 'var(--ink-3)',
                    marginTop: 1,
                  }}>
                    {ins.kind === 'good' ? 'star' : ins.kind === 'warn' ? 'warning' : 'lightbulb'}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{ins.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Lifeline({ events }) {
  if (!events.length) return null;
  return (
    <div style={{ position: 'relative', paddingLeft: 8 }}>
      <div style={{ position: 'absolute', left: 14, top: 8, bottom: 8, width: 1, background: 'var(--rule-2)' }}></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {events.map((e, i) => {
          const isLast = i === events.length - 1;
          const isFirst = i === 0;
          const iconMap = {
            lanzada: 'rocket_launch',
            cierre:  isLast ? 'archive' : 'lock',
            select:  'how_to_reg',
            inicio:  'play_arrow',
            pausa:   'pause',
          };
          const colorMap = {
            lanzada: 'var(--ink)',
            cierre:  isLast ? (events[i-1] ? 'var(--ok)' : 'var(--ink-3)') : 'var(--ink-2)',
            select:  'var(--accent)',
            inicio:  'var(--ok)',
            pausa:   'var(--warn)',
          };
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 120px 1fr', gap: 12, padding: '8px 0', alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--paper)',
                border: `1px solid ${colorMap[e.kind] || 'var(--rule-2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1, position: 'relative',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: colorMap[e.kind] || 'var(--ink-3)' }}>
                  {iconMap[e.kind] || 'circle'}
                </span>
              </div>
              <div className="mono meta" style={{ fontSize: 11.5 }}>{e.fecha}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{e.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BigActionCard({ icon, title, desc, cta, tone, disabled }) {
  return (
    <button className="press" disabled={disabled} style={{
      textAlign: 'left', padding: 18,
      background: tone === 'primary' ? 'var(--ink)' : 'var(--paper)',
      color: tone === 'primary' ? 'var(--paper)' : 'var(--ink)',
      border: `1px solid ${tone === 'primary' ? 'var(--ink)' : 'var(--rule-2)'}`,
      borderRadius: 12,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 10,
      opacity: disabled ? 0.45 : 1,
      transition: 'transform .15s ease',
      minHeight: 180,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12.5, opacity: 0.7, lineHeight: 1.4, flex: 1 }}>{desc}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, marginTop: 4 }}>
        {cta}
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_outward</span>
      </div>
    </button>
  );
}

function ParticipanteRow({ p, isLast }) {
  const outcomeColor = {
    acreditado: 'var(--ok)',
    baja:       'var(--warn)',
    abandono:   'var(--warn)',
    'no-selec': 'var(--ink-4)',
  }[p.outcome] || 'var(--ink-3)';
  const outcomeLabel = {
    acreditado: 'Acreditado',
    baja:       'Baja',
    abandono:   'Abandonó',
    'no-selec': 'No seleccionado',
  }[p.outcome] || p.outcome;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '32px 1fr 140px 100px 1fr',
      gap: 12, padding: '12px 16px',
      borderTop: isLast ? 'none' : '1px solid var(--rule-2)',
      alignItems: 'center',
      borderBottom: isLast ? 'none' : '',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600, color: 'var(--ink-2)',
      }}>
        {p.name.split(' ').map(s => s[0]).slice(0, 2).join('')}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
      <div className="mono meta">DNI {p.dni}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: outcomeColor }}></span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: outcomeColor }}>{outcomeLabel}</span>
        {p.hs > 0 && <span className="mono meta" style={{ fontSize: 11 }}>· {p.hs} hs</span>}
      </div>
      <div className="meta" style={{ fontSize: 12, fontStyle: 'italic' }}>{p.nota || ''}</div>
    </div>
  );
}

// ============================================================================
// Section primitives
// ============================================================================

function Section({ number, title, subtitle, children, collapsible, defaultOpen = true }) {
  const [open, setOpen] = useStateV(defaultOpen);
  return (
    <section style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--rule-2)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          {number && <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 13, paddingTop: 2 }}>{number}</span>}
          <div>
            <h3 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em' }}>
              {title}
            </h3>
            {subtitle && <div className="meta" style={{ marginTop: 4 }}>{subtitle}</div>}
          </div>
        </div>
        {collapsible && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {open ? 'unfold_less' : 'unfold_more'}
            </span>
          </button>
        )}
      </header>
      {open && <div>{children}</div>}
    </section>
  );
}

function FormRow({ label, children, style }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <label className="label" style={{ display: 'block', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

// ============================================================================
// Canvas dispatcher
// ============================================================================

function Canvas({ convocatoria }) {
  const c = convocatoria;
  if (!c) return <EmptyCanvas />;
  if (c.state === 'borrador')     return <BorradorView c={c} />;
  if (c.state === 'abierta')      return <AbiertaView c={c} />;
  if (c.state === 'cerrada')      return <CerradaView c={c} />;
  if (c.state === 'seleccionada') return <SeleccionadaView c={c} />;
  if (c.state === 'activa')       return <ActivaView c={c} />;
  if (c.state === 'archivada')    return <ArchivadaView c={c} />;
  return <EmptyCanvas />;
}

function EmptyCanvas() {
  return (
    <div style={{ padding: '120px 48px', textAlign: 'center', color: 'var(--ink-3)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 32 }}>arrow_back</span>
      <div style={{ marginTop: 12, fontSize: 14 }}>Elegí una convocatoria de la lista o creá una nueva.</div>
    </div>
  );
}

// Add small spin animation
if (!document.getElementById('lanzador-anims')) {
  const style = document.createElement('style');
  style.id = 'lanzador-anims';
  style.textContent = `@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

Object.assign(window, { Canvas, BorradorView, AbiertaView, CerradaView, SeleccionadaView, ActivaView, ArchivadaView });
