import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  // Indicates that each test environment is a browser-like environment
  testEnvironment: 'jsdom',

  // Limit parallelism so the heavier integration tests (which render lazy
  // component trees and rely on waitFor) don't time out under CPU contention,
  // especially on CI runners with few cores. This keeps the suite stable.
  maxWorkers: '50%',

  // Generous default timeout for async waitFor() polling in integration tests.
  testTimeout: 15000,

  // A list of paths to modules that run some code to configure or set up testing framework before each test
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],

  // The preset is a base configuration that Jest uses
  preset: 'ts-jest',

  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured soon)
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Added so Jest knows how to transform TypeScript files.
  // We attach the `ts-jest-mock-import-meta` AST transformer so that
  // `import.meta.env.*` usages compile cleanly under CommonJS (ts-jest).
  // Without this, ts-jest throws: "Cannot use 'import.meta' outside a module".
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        diagnostics: {
          // TS1343: 'import.meta' is only allowed when module is esnext/system.
          // The AST transformer rewrites it, so we silence the diagnostic.
          ignoreCodes: [1343],
        },
        astTransformers: {
          before: [
            {
              path: 'ts-jest-mock-import-meta',
              options: {
                metaObjectReplacement: {
                  env: {
                    DEV: false,
                    PROD: true,
                    MODE: 'test',
                    VITE_SUPABASE_URL: 'https://test.supabase.co',
                    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
                    VITE_VAPID_PUBLIC_KEY: 'test-vapid-key',
                    VITE_GA4_MEASUREMENT_ID: 'G-TEST123456',
                    VITE_ENABLE_MONITORING_IN_DEV: 'true',
                    VITE_APP_VERSION: 'test',
                    VITE_HERMES_API_URL: 'https://test.hermes.local',
                    VITE_HERMES_INTERNAL_TOKEN: 'test-hermes-token',
                    VITE_HERMES_WEBHOOK_URL: 'https://test.hermes.local/webhook',
                    VITE_PUBLIC_APP_URL: 'https://test.app.local',
                  },
                },
              },
            },
          ],
        },
      },
    ],
  },
};

export default config;
