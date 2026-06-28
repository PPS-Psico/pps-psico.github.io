import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
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
      '__ANTIGRAVITY_PROBE__.txt',
      '.storybook/**',
      '.agent/**',
      'temp_skills/**',
      'testsprite_tests/**',
      'scratch/**',
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
      'security/detect-object-injection': 'warn',
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
  {
    files: ['src/components/admin/EditorEstudiantes.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off'
    }
  },
  prettier
];
