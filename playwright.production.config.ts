import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

/** Mismos recorridos, transformados con React Compiler y servidos como estáticos. */
export default defineConfig({
  ...baseConfig,
  webServer: {
    ...baseConfig.webServer,
    command:
      "npx vite build --outDir .e2e-dist && npx vite preview --host 127.0.0.1 --port 4180 --strictPort --outDir .e2e-dist",
    url: "http://127.0.0.1:4180",
    // Nunca reutilizar un dev server o un build anterior como prueba de producción.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      VITE_SUPABASE_URL: "https://e2e-mock.supabase.co",
      VITE_SUPABASE_ANON_KEY: "e2e-anon-placeholder",
      VITE_TURNSTILE_SITE_KEY: "",
      VITE_ENABLE_MONITORING_IN_DEV: "false",
      VITE_VISUAL_BASELINE: "true",
    },
  },
  use: { ...baseConfig.use, baseURL: "http://127.0.0.1:4180" },
});
