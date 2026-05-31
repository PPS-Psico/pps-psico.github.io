/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor */
const { useState, useEffect } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "showBriefing": true,
  "showDrafts": true,
  "accentLight": "#1F3A8A",
  "accentDark": "#8FB1FF",
  "theme": "light"
}/*EDITMODE-END*/;

const ACCENT_OPTIONS_LIGHT = ['#1F3A8A', '#1E4D3A', '#9C3D14', '#3A3A3A'];
const ACCENT_DARK_FOR = {
  '#1F3A8A': '#8FB1FF',
  '#1E4D3A': '#8FC7A5',
  '#9C3D14': '#E69A6B',
  '#3A3A3A': '#C4C4C4',
};

function App() {
  const [t, setTweak] = useTweaks(DEFAULTS);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', t.theme === 'dark');
  }, [t.theme]);

  useEffect(() => {
    const c = t.theme === 'dark' ? (ACCENT_DARK_FOR[t.accentLight] || t.accentDark) : t.accentLight;
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-soft', c + (t.theme === 'dark' ? '1A' : '14'));
  }, [t.accentLight, t.theme]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar user={USER} today={TODAY} time={TIME} />

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 80px' }}>
        <PageHead today={TODAY} time={TIME} />

        {t.showBriefing && <Briefing data={BRIEFING} compact={t.density === 'compact'} />}

        <Priorities items={PRIORITIES} density={t.density} />

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

        <footer style={{
          marginTop: 48,
          paddingTop: 24,
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
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
