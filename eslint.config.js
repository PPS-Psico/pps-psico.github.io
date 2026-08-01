import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';

export default [
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      'build',
      'storybook-static',
      'public/**',
      'scripts/**',
      'test-notification.js',
      '*.config.js',
      '*.config.ts',
      'main.tsx',
      'vite-env.d.ts',
      'jest.d.ts',
      'jest-setup.ts',
      'supabase/**',
      'src/types/supabase.ts',
      '__ANTIGRAVITY_PROBE__.txt',
      '.storybook/**',
      '.agent/**',
      '.kiro/**',
      '.impeccable/**',
      'output/**',
      'temp_skills/**',
      'testsprite_tests/**',
      'scratch/**',
      '.preview-site/**',
      '.preview-pages/**',
      '*.cjs'
    ]
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: false
      },
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        Storage: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      security
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // Bug real: usar hooks fuera del tope de un componente rompe React.
      // Debe ser error, no warning.
      'react-hooks/rules-of-hooks': 'error',
      // Dependencias faltantes en hooks = fuente clasica de stale state.
      // Se sube a warn primero para medir impacto antes de escalar a error.
      'react-hooks/exhaustive-deps': 'warn',
      // El tipado fuerte se anula con `any`. Se marca como warn para visibilizar
      // la deuda (684 ocurrencias) sin frenar el build mientras se reduce.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Codigo muerto: variables/imports sin usar. Warn para limpieza gradual.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // El logger centralizado es el unico canal permitido. console.warn/error
      // se toleran para soporte; el resto se silencia en build de produccion.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'no-undef': 'off',
      // Desactivada: marca CUALQUIER acceso `obj[variable]`, patrón ubicuo y ya
      // tipado en este código (acceso por clave dinámica a filas de Supabase).
      // Generaba ~1265 falsos positivos (80% del ruido de lint) que tapaban los
      // warnings que sí importan. La propia plugin documenta su alta tasa de
      // falsos positivos. Si hiciera falta, validar índices puntuales a mano.
      // ── Accesibilidad (WCAG 2.2 AA, comprometido en PRODUCT.md) ──────────
      // El plugin estaba instalado pero nunca configurado: no corria ninguna
      // regla. Se activa el set recomendado; las reglas que detectan barreras
      // reales de teclado/lector van como error, el resto como warn para
      // limpieza gradual sin frenar el build.
      ...jsxA11y.configs.recommended.rules,
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      // Un handler de click sin equivalente de teclado deja el control fuera
      // del alcance de quien no usa mouse.
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      // Un rol interactivo que no se puede tabular es una barrera dura: se
      // queda como error.
      'jsx-a11y/interactive-supports-focus': 'error',
      // Degradada a warn a proposito. WCAG no prohibe autofocus; el riesgo real
      // es el cambio de contexto inesperado. Todos los usos actuales son el
      // input principal de un modal o del paso activo del login, donde mover el
      // foco es lo correcto para quien navega con teclado. Se deja en warn para
      // que un autofocus nuevo fuera de ese patron se note.
      'jsx-a11y/no-autofocus': 'warn',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-buffer-noassert': 'warn',
      'security/detect-child-process': 'warn',
      'security/detect-eval-with-expression': 'warn',
      'security/detect-no-csrf-before-method-override': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn'
    }
  },
  {
    files: ['main.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off'
    }
  },
  prettier
];
