/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakToggle,
   TopBar, PageHead, Briefing, DetectionBand, SolicitudesBand, DraftsPreview, Priorities,
   navToGestion, navToSolicitudes,
   INSTITUCIONES, INST_BY_ID, UNLINKED_CONTACTS, HERMES_SUGGESTIONS, CONTACT_TIPOS, HERMES_ALLOWLIST,
   SOL_INGRESO, SOL_EGRESO, SOL_CORRECCIONES */
const { useState, useEffect, useMemo } = React;

const TODAY = 'Martes 26 de mayo de 2026';
const TIME = '08:42';

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#1F3A8A",
  "showBriefing": true,
  "showSolicitudes": true,
  "showDrafts": true
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = ['#1F3A8A', '#1E4D3A', '#9C3D14', '#5A2D86'];

// Conversation status: newest message mine & unanswered → waiting days; else they wait on us.
function lastMsgOf(conv) {
  if (!conv) return null;
  const msgs = conv.filter(x => x.kind === 'msg').sort((a, b) => (a.iso || '').localeCompare(b.iso || ''));
  return msgs[msgs.length - 1] || null;
}

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--accent-soft', t.accent + '14');
  }, [t.accent]);

  const data = useMemo(() => {
    const sugg = (typeof HERMES_SUGGESTIONS !== 'undefined') ? HERMES_SUGGESTIONS : [];
    const unlinked = (typeof UNLINKED_CONTACTS !== 'undefined') ? UNLINKED_CONTACTS : [];
    const insts = (typeof INSTITUCIONES !== 'undefined') ? INSTITUCIONES : [];

    const drafts = sugg.filter(s => s.tipo === 'draft');
    const clasifs = sugg.filter(s => s.tipo === 'clasificacion');
    const decisions = sugg.filter(s => s.tipo === 'decision');

    // "Te toca responder": last message is from them, across institutions + unlinked
    const instReplies = insts.filter(i => { const m = lastMsgOf(i.conversacion); return m && !m.from_me; });
    const unlinkedReplies = unlinked.filter(u => u.ultimo && !u.ultimo.from_me && u.ultimo.estado === 'responder');
    const sinResponder = instReplies.length + unlinkedReplies.length;

    // "Esperando +5 días": last message mine, waiting > 5
    const esperando5 = insts.filter(i => {
      const m = lastMsgOf(i.conversacion);
      return m && m.from_me && (m.diasEsperando ?? 0) > 5;
    }).length;

    // New unlinked candidates (sin_convenio)
    const nuevos = unlinked.filter(u => u.contactTipo === 'sin_convenio').length;

    const metrics = [
      { id: 'm-resp', tone: 'warn', icon: 'reply', n: sinResponder, label: 'Te toca responder', sub: 'Mensajes sin contestar', onClick: () => navToGestion('bandeja', 'requiereDecision') },
      { id: 'm-esp', tone: 'accent', icon: 'schedule_send', n: esperando5, label: 'Esperando +5 días', sub: 'Te deben respuesta', onClick: () => navToGestion('bandeja', 'esperando5d') },
      { id: 'm-dec', tone: 'ai', icon: 'pan_tool', n: decisions.length, label: 'Requieren tu criterio', sub: 'Hermes no decide esto', onClick: () => navToGestion('hermes') },
      { id: 'm-new', tone: 'ok', icon: 'person_add', n: nuevos, label: 'Instituciones nuevas', sub: `${unlinked.length} chats sin vincular`, onClick: () => navToGestion('bandeja', 'sinVincular') },
    ];

    // ── Solicitudes de alumnos (lado entrante) ──
    const ingreso = (typeof SOL_INGRESO !== 'undefined') ? SOL_INGRESO : [];
    const egreso = (typeof SOL_EGRESO !== 'undefined') ? SOL_EGRESO : [];
    const correcciones = (typeof SOL_CORRECCIONES !== 'undefined') ? SOL_CORRECCIONES : [];

    const ingresoPend = ingreso.filter(s => !['Realizada', 'No se pudo concretar', 'Archivado'].includes(s.estado));
    const ingresoSinMov = ingresoPend.filter(s => s.daysSinceUpdate > 4).length;
    const ingresoNoCat = ingreso.filter(s => s.convenioStatus === 'no_catalogada').length;

    const egresoPend = egreso.filter(s => s.estado !== 'Finalizada');
    const egresoCrit = egresoPend.filter(s => s.hermes.estado === 'critico').length;
    const egresoObs = egresoPend.filter(s => s.hermes.estado === 'atencion').length;
    const egresoOk = egresoPend.filter(s => s.hermes.estado === 'aprobado').length;

    const corrPend = correcciones.filter(s => s.estado === 'pendiente').length;

    const egresoNote = egresoCrit > 0
      ? { note: `${egresoCrit} con problemas críticos`, noteTone: 'crit', noteIcon: 'error' }
      : egresoObs > 0
        ? { note: `${egresoObs} con observaciones de Hermes`, noteTone: 'warn', noteIcon: 'warning' }
        : { note: `${egresoOk} verificadas por Hermes`, noteTone: 'ai', noteIcon: 'verified' };

    const solicitudesMetrics = [
      { id: 's-ing', tone: ingresoSinMov > 0 ? 'warn' : 'accent', icon: 'login', n: ingresoPend.length, label: 'Ingreso · PPS propuestas', sub: `${ingresoSinMov} sin movimiento +4d`, note: ingresoNoCat > 0 ? `${ingresoNoCat} institución sin catalogar` : null, noteTone: 'warn', noteIcon: 'help', onClick: () => navToSolicitudes('ingreso') },
      { id: 's-egr', tone: egresoCrit > 0 ? 'crit' : egresoObs > 0 ? 'warn' : 'ok', icon: 'logout', n: egresoPend.length, label: 'Egreso · finalizaciones', sub: 'Por acreditar', ...egresoNote, onClick: () => navToSolicitudes('egreso') },
      { id: 's-cor', tone: 'accent', icon: 'edit_note', n: corrPend, label: 'Correcciones', sub: 'Modificaciones y nuevas PPS', onClick: () => navToSolicitudes('correcciones') },
    ];

    const totalSolicitudes = ingresoPend.length + egresoPend.length + corrPend;

    const briefing = {
      generadoAgo: 'generado 07:38 · hace 1 h 4 min',
      lead: `Buenos días. Tenés ${totalSolicitudes} solicitudes de alumnos esperando y ${sugg.length} novedades de instituciones por WhatsApp y mail desde anoche.`,
      body: [
        `Del lado de las instituciones: Liens confirmó que quieren continuar y piden fecha de inicio — te dejé un borrador listo para enviar. El Hospital Naval y el Pirovano escribieron por primera vez; los clasifiqué como candidatos, pero sos vos quien decide si entran al catálogo.`,
        `Del lado de los alumnos: hay ${ingresoPend.length} solicitudes de PPS para gestionar${ingresoNoCat > 0 ? ` (una con institución que no está en el catálogo)` : ''} y ${egresoPend.length} finalizaciones por acreditar. Verifiqué las tres planillas de cada una: ${egresoCrit > 0 ? `${egresoCrit} tiene problemas serios — fechas firmadas antes del inicio de la práctica, conviene frenar esa antes de mandarla al SAC.` : 'la mayoría están en orden.'}`,
        `Lo más urgente sigue siendo CESAC 8: la inscripción cierra mañana con 12 anotados para 8 cupos, así que hay que seleccionar.`,
      ],
    };

    const priorities = [
      { id: 'p1', tone: 'warn', eyebrow: 'Cierra mañana', title: 'Seleccionar inscriptos de CESAC 8', detail: '12 anotados para 8 cupos · la inscripción cierra el 27 a las 23:59.', cta: 'Resolver', onClick: () => navToGestion('hermes') },
      { id: 'p2', tone: 'crit', eyebrow: 'Hermes detectó', title: 'Frenar una finalización con fechas inconsistentes', detail: 'Camilo Ruiz (Borda): la planilla tiene fechas firmadas antes del inicio de la práctica e informe casi vacío.', cta: 'Revisar', onClick: () => navToSolicitudes('egreso') },
      { id: 'p3', tone: 'accent', eyebrow: 'Borrador listo', title: 'Responder a Liens con fechas', detail: 'Quieren 4 cupos y piden cuándo arrancar. Hermes ya redactó la propuesta.', cta: 'Revisar', onClick: () => navToGestion('hermes') },
    ];

    return { drafts, totalDrafts: drafts.length, metrics, solicitudesMetrics, briefing, priorities };
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar user="Luis Battaglia" active="inicio" />

      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '0 32px 64px' }}>
        <PageHead today={TODAY} time={TIME} />

        {t.showBriefing && <Briefing data={data.briefing} />}

        <DetectionBand metrics={data.metrics} />

        {t.showSolicitudes && <SolicitudesBand metrics={data.solicitudesMetrics} />}

        {t.showDrafts && <DraftsPreview drafts={data.drafts.slice(0, 3)} total={data.totalDrafts} />}

        <Priorities items={data.priorities} />

        <footer style={{
          marginTop: 8, paddingTop: 24, borderTop: '1px solid var(--rule-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        }}>
          <div className="meta">Mi Panel Académico · PPS · UFLO Psicología</div>
          <div className="meta mono" style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11 }}>
            <span>v3.2 · build 2026.05.26</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="dot dot-ok dot-live" style={{ color: 'var(--ok)' }}></span> Hermes online
            </span>
          </div>
        </footer>
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Secciones" />
        <TweakToggle label="Briefing de Hermes" value={t.showBriefing} onChange={(v) => setTweak('showBriefing', v)} />
        <TweakToggle label="Solicitudes de alumnos" value={t.showSolicitudes} onChange={(v) => setTweak('showSolicitudes', v)} />
        <TweakToggle label="Borradores preparados" value={t.showDrafts} onChange={(v) => setTweak('showDrafts', v)} />
        <TweakSection label="Acento" />
        <TweakColor label="Color" value={t.accent} options={ACCENT_OPTIONS} onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
