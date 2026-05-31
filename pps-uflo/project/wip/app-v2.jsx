/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor */
const { useState, useEffect, useRef } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "showBriefing": true,
  "showDrafts": true,
  "accentLight": "#1F3A8A",
  "accentDark": "#8FB1FF",
  "theme": "light",
  "ritualMode": true
}/*EDITMODE-END*/;

const ACCENT_OPTIONS_LIGHT = ['#1F3A8A', '#1E4D3A', '#9C3D14', '#3A3A3A'];
const ACCENT_DARK_FOR = {
  '#1F3A8A': '#8FB1FF',
  '#1E4D3A': '#8FC7A5',
  '#9C3D14': '#E69A6B',
  '#3A3A3A': '#C4C4C4',
};

// Daily ritual state — persists per day in localStorage
function useDailyRitual() {
  const today = '2026-05-26'; // hardcoded for prototype
  const key = `pps_ritual_${today}`;
  const [state, setState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{"briefingRead":false,"dayClosed":false}');
    } catch { return { briefingRead: false, dayClosed: false }; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);
  return [state, (patch) => setState(s => ({ ...s, ...patch }))];
}

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);
  const [ritual, setRitual] = useDailyRitual();
  const prioritiesRef = useRef(null);
  const closingRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', t.theme === 'dark');
  }, [t.theme]);

  useEffect(() => {
    const c = t.theme === 'dark' ? (ACCENT_DARK_FOR[t.accentLight] || t.accentDark) : t.accentLight;
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-soft', c + (t.theme === 'dark' ? '1A' : '14'));
  }, [t.accentLight, t.theme]);

  // Auto-mark briefing as read when user scrolls past priorities
  useEffect(() => {
    if (!t.ritualMode || ritual.briefingRead) return;
    const handler = () => {
      if (!prioritiesRef.current) return;
      const rect = prioritiesRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.5) {
        setRitual({ briefingRead: true });
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [t.ritualMode, ritual.briefingRead]);

  const scrollToPriorities = () => {
    prioritiesRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const scrollToClosing = () => {
    closingRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar user={USER} today={TODAY} time={TIME} />

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 0px' }}>
        <PageHead today={TODAY} time={TIME} onCloseClick={scrollToClosing} dayClosed={ritual.dayClosed} />

        {t.showBriefing && (
          <Briefing
            data={BRIEFING}
            compact={t.density === 'compact'}
            isRead={t.ritualMode && ritual.briefingRead}
            onMarkRead={(read) => setRitual({ briefingRead: read })}
            onAccept={scrollToPriorities}
            onDismiss={() => {}}
            generatedAgo="hace 1 h 4 min"
          />
        )}

        <div ref={prioritiesRef}>
          <Priorities items={PRIORITIES} density={t.density} />
        </div>

        <section style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 56,
          padding: '32px 0',
          borderTop: '1px solid var(--rule-2)',
        }}>
          <Agenda items={AGENDA} />
          <Pulse items={PULSE} />
        </section>

        {t.showDrafts && (
          <div style={{ borderTop: '1px solid var(--rule-2)', paddingTop: 32 }}>
            <Drafts items={DRAFTS} />
          </div>
        )}

        <ActivityLog items={ACTIVITY} />

        {/* Closing the day */}
        <div ref={closingRef}>
          <CerrarElDia
            data={CIERRE}
            isClosed={ritual.dayClosed}
            onClose={() => setRitual({ dayClosed: true })}
            onReopen={() => setRitual({ dayClosed: false })}
          />
        </div>

        <footer style={{
          marginTop: 0,
          paddingTop: 24, paddingBottom: 32,
          borderTop: '1px solid var(--rule-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div className="meta">
            Mi Panel Académico · PPS · UFLO Psicología
          </div>
          <div className="meta mono" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>v3.2 · build 2026.05.26</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="dot dot-ok"></span> Supabase OK
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="dot dot-ok"></span> Hermes online
            </span>
          </div>
        </footer>
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Apariencia" />
        <TweakRadio
          label="Tema"
          value={t.theme}
          options={[
            { value: 'light', label: 'Claro' },
            { value: 'dark',  label: 'Oscuro' },
          ]}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakRadio
          label="Densidad"
          value={t.density}
          options={[
            { value: 'comfortable', label: 'Cómodo' },
            { value: 'compact', label: 'Compacto' },
          ]}
          onChange={(v) => setTweak('density', v)}
        />

        <TweakSection label="Ritual diario" />
        <TweakToggle
          label="Modo ritual matutino"
          value={t.ritualMode}
          onChange={(v) => setTweak('ritualMode', v)}
        />
        <div style={{ padding: '4px 12px 12px', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
          El briefing ocupa la pantalla al entrar y se pliega cuando lo marcás como leído o scrolleás.
        </div>

        <TweakSection label="Acento" />
        <TweakColor
          label="Color"
          value={t.accentLight}
          options={ACCENT_OPTIONS_LIGHT}
          onChange={(v) => setTweak('accentLight', v)}
        />

        <TweakSection label="Secciones" />
        <TweakToggle label="Briefing Hermes" value={t.showBriefing} onChange={(v) => setTweak('showBriefing', v)} />
        <TweakToggle label="Borradores IA" value={t.showDrafts} onChange={(v) => setTweak('showDrafts', v)} />

        <TweakSection label="Estado del día (demo)" />
        <button
          onClick={() => setRitual({ briefingRead: false, dayClosed: false })}
          style={{
            margin: '8px 12px 12px', padding: '8px 12px', width: 'calc(100% - 24px)',
            background: 'transparent', border: '1px solid var(--rule-2)',
            borderRadius: 8, fontSize: 12, cursor: 'pointer', color: 'inherit',
            fontFamily: 'inherit',
          }}>
          Reiniciar día (volver a la mañana)
        </button>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
