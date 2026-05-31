// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// Raise the default async timeout for findBy*/waitFor queries. The default of
// 1000ms is too tight when the full suite runs in parallel and the heavier
// integration tests compete for CPU, which caused intermittent CI failures.
configure({ asyncUtilTimeout: 5000 });

// Mock environment variables for tests
process.env.VITE_SUPABASE_URL = "https://test.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";
process.env.VITE_VAPID_PUBLIC_KEY = "test-vapid-key";
process.env.VITE_GA4_MEASUREMENT_ID = "G-TEST123456";
process.env.VITE_ENABLE_MONITORING_IN_DEV = "true";
process.env.VITE_APP_VERSION = "test";

// NOTE: `import.meta.env.*` usages are handled at compile time by the
// `ts-jest-mock-import-meta` AST transformer configured in jest.config.ts.
// The process.env values above remain as a convenience for any code that
// reads process.env directly.

// Polyfills for JSDOM
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: jest.fn().mockImplementation((callback) => {
      // Store the callback so we can trigger it manually if needed
      (window as any).__supabaseAuthCallback = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
    signInWithPassword: jest.fn().mockImplementation(async ({ email }) => {
      const session = { user: { id: "test-user-id", email: email || "test@test.com" } };
      if ((window as any).__supabaseAuthCallback) {
        (window as any).__supabaseAuthCallback("SIGNED_IN", session);
      }
      return { data: session, error: null };
    }),
    signOut: jest.fn().mockImplementation(async () => {
      if ((window as any).__supabaseAuthCallback) {
        (window as any).__supabaseAuthCallback("SIGNED_OUT", null);
      }
      return { error: null };
    }),
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } }, error: null }),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({
    data: {
      legajo: "12345",
      nombre: "Estudiante de Prueba",
      orientacion_elegida: "Clinica",
      must_change_password: false,
      role: "Student",
    },
    error: null,
  }),
  rpc: jest.fn().mockImplementation((fn, args) => {
    if (fn === "get_student_details_by_legajo" || fn === "get_student_for_signup") {
      return Promise.resolve({
        data: [
          {
            correo: "test@test.com",
            legajo: args?.legajo_input || "12345",
            nombre: "Estudiante de Prueba",
            role: "Student",
          },
        ],
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  }),
};

jest.mock("@/lib/supabaseClient", () => ({
  supabase: mockSupabase,
}));
