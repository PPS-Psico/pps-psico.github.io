/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand UFLO oficial (ya estaba)
        uflo: {
          purple: '#46253D',
          navy: '#203B73',
          teal: '#3CB88D',
          aqua: '#20C4A8',
          'aqua-2': '#2DD4B3',
          deep: '#0F1B62',
          electric: '#2337C9',
        },
        warm: {
          50: '#FAFAF7',
        },
        // ============================================================
        // Sistema Estudiante (UFLO brand) — light
        // ============================================================
        student: {
          bg: 'var(--student-bg)',
          'bg-elevated': 'var(--student-bg-elevated)',
          'bg-sunken': 'var(--student-bg-sunken)',
          ink: 'var(--student-ink)',
          'ink-soft': 'var(--student-ink-soft)',
          'ink-muted': 'var(--student-ink-muted)',
          'ink-subtle': 'var(--student-ink-subtle)',
          line: 'var(--student-line)',
          'line-strong': 'var(--student-line-strong)',
          hairline: 'var(--student-hairline)',
        },
        // ============================================================
        // Áreas PPS — color coding institucional
        // ============================================================
        area: {
          clinica: '#3CB88D',
          educacional: '#203B73',
          laboral: '#C0392B',
          comunitaria: '#7A3F9E',
        },
        // ============================================================
        // Estados semánticos
        // ============================================================
        status: {
          ok: '#2F9C76',
          warn: '#B4501E',
          accent: '#203B73',
          ai: '#5A2D86',
        },
        // ============================================================
        // Accent variants (sistema data-accent)
        // ============================================================
        accent: {
          teal: '#3CB88D',
          aqua: '#20C4A8',
          navy: '#203B73',
          electric: '#2337C9',
        },
      },
      fontFamily: {
        // Display: Manrope (paper/ink v3 admin, ya estaba)
        display: ['"Manrope"', '"Geist"', 'sans-serif'],
        // Bricolage Grotesque — display UFLO brand (estudiante)
        bricolage: ['"Bricolage Grotesque"', '"Geist"', 'system-ui', 'sans-serif'],
        // UI principal
        sans: ['"Geist"', 'sans-serif'],
        // Numerales / IDs / cifras
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        'display': '-0.04em',
      },
      lineHeight: {
        'display': '0.92',
      },
      borderRadius: {
        'pill': '999px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(.2,.7,.2,1)',
      },
    },
  },
  plugins: [],
}
