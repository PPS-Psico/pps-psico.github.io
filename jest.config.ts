import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  // Indicates that each test environment is a browser-like environment
  testEnvironment: 'jsdom',
  
  // A list of paths to modules that run some code to configure or set up testing framework before each test
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  
  // The preset is a base configuration that Jest uses
  preset: 'ts-jest',
  
  // A map from regular expressions to module names that allows to stub out resources with a single module
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured soon)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Added so Jest knows how to transform TypeScript files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  
  // Mock Vite environment variables
  globals: {
    'import.meta.env': {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
  
  // Define custom environment variables
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"https://test.supabase.co"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test-anon-key"',
  },
};

export default config;