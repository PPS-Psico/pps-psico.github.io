import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de los tests end-to-end.
 *
 * SEGURIDAD: `VITE_SUPABASE_URL` apunta a `e2e-mock.supabase.co`, un host que
 * no puede existir -- los refs de proyecto de Supabase son cadenas aleatorias
 * de 20 caracteres, nunca una palabra. Tiene esa forma y no un `.invalid`
 * porque el CSP de `index.html` sólo admite `https://*.supabase.co` en
 * `connect-src`, y si no la petición se bloquea antes de que Playwright pueda
 * interceptarla.
 *
 * Además, `supabaseMock` aborta cualquier request a ese host que no esté
 * mockeada. Entre las dos cosas, un test no puede tocar la Supabase real ni
 * por olvido.
 *
 * Los datos los sirve `e2e/supabaseMock.ts` interceptando la red con
 * `page.route`. Ningún test crea inscripciones, usuarios ni consentimientos
 * reales.
 *
 * QUÉ CUBRE Y QUÉ NO: estos tests verifican el cableado de la interfaz —
 * rutas, formularios, guards, estado, que el botón haga lo que dice. NO
 * verifican que Supabase acepte los payloads, ni las policies de RLS, ni el
 * login real: de eso se ocupa el mock, no la API. Para el contrato con la base
 * están los tests de la capa de datos y `npm run check:functions`.
 */
export default defineConfig({
  testDir: "./e2e",
  // En CI conviene fallar rápido ante un `test.only` olvidado.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: "http://127.0.0.1:4179",
    trace: "on-first-retry",
    // El service worker de FCM interfiere con la interceptación de red y no
    // aporta nada a estos flujos.
    serviceWorkers: "block",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Puerto propio para no chocar con el dev server (5173) ni con el del
    // baseline visual (4178).
    command: "npx vite --host 127.0.0.1 --port 4179 --strictPort",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: "https://e2e-mock.supabase.co",
      VITE_SUPABASE_ANON_KEY: "e2e-anon-placeholder",
      VITE_TURNSTILE_SITE_KEY: "",
      VITE_ENABLE_MONITORING_IN_DEV: "false",
      VITE_VISUAL_BASELINE: "true",
    },
  },
});
