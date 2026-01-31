import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-plugin-prettier/recommended';

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
      '.storybook/**'
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
      'react-hooks': reactHooks
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off'
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
