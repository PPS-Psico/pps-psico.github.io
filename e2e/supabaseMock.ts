import type { Page, Route } from "@playwright/test";

/**
 * Intercepta la red hacia Supabase y responde con fixtures.
 *
 * El host de `VITE_SUPABASE_URL` no existe (ver `playwright.config.ts`), así
 * que lo que no se mockee acá no llega a ningún lado. Eso es a propósito: un
 * test no puede tocar producción ni por error.
 *
 * Se interceptan tres superficies:
 *   - `/functions/v1/*`  Edge Functions (el login del alumno pasa por acá)
 *   - `/auth/v1/*`       sesión y usuario
 *   - `/rest/v1/*`       PostgREST, tabla por tabla
 */

/** Estudiante de prueba. Legajo inventado, fuera del rango real. */
export const ALUMNO = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-0000000000a1",
  legajo: "E2E001",
  nombre: "Alumna De Prueba",
  correo: "alumna.prueba@e2e.invalid",
  dni: 30111222,
  telefono: "2995550001",
  estado: "Activo",
  role: "Estudiante",
  must_change_password: false,
  orientacion_elegida: "Clínica",
  cohorte: 2026,
};

export const LANZAMIENTO = {
  id: "00000000-0000-4000-8000-000000000010",
  nombre_pps: "Hospital de Prueba E2E",
  estado_convocatoria: "Abierta",
  cupos_disponibles: 5,
  horas_acreditadas: 60,
  orientacion: "Clínica",
  es_online: false,
  fecha_inicio: "2026-09-01",
  fecha_finalizacion: "2026-12-01",
  horario_seleccionado: "Lunes y Miércoles de 9 a 13",
  created_at: "2026-08-01T10:00:00.000Z",
  /*
    Imprescindible y fácil de pasar por alto: `isLaunchVisibleToStudent` toma la
    fecha de publicación y, si no hay, cae a `fecha_inicio`. Con una fecha futura
    la convocatoria se considera "programada" y no se le muestra al alumno. Sin
    esta línea el lanzamiento existe pero es invisible.
  */
  fecha_publicacion: "2026-08-05T09:00:00.000Z",
  fecha_inicio_inscripcion: "2026-08-05",
};

/**
 * JWT sintácticamente válido. La firma es de mentira, pero supabase-js decodifica
 * el payload para leer el `exp`, así que tiene que parsear bien o `setSession`
 * falla antes de llegar a la red.
 */
const fakeJwt = (sub: string): string => {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub,
    aud: "authenticated",
    role: "authenticated",
    email: ALUMNO.correo,
    // Bien lejos: que no expire en medio de la corrida.
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    iat: Math.floor(Date.now() / 1000),
  });
  return `${header}.${payload}.e2e-signature-no-verificada`;
};

const ACCESS_TOKEN = fakeJwt(ALUMNO.user_id);

const AUTH_USER = {
  id: ALUMNO.user_id,
  aud: "authenticated",
  role: "authenticated",
  email: ALUMNO.correo,
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

const SESSION = {
  access_token: ACCESS_TOKEN,
  refresh_token: "e2e-refresh-token",
  token_type: "bearer",
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user: AUTH_USER,
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  });

/** Qué devuelve cada tabla. Lo que no esté acá responde `[]`. */
export type TableFixtures = Record<string, unknown[]>;

export interface MockOptions {
  /** `false` para probar el camino de credenciales incorrectas. */
  loginOk?: boolean;
  tables?: TableFixtures;
  /** Registra las escrituras para poder afirmar sobre ellas en el test. */
  onWrite?: (table: string, method: string, body: unknown) => void;
}

export async function mockSupabase(page: Page, options: MockOptions = {}): Promise<void> {
  const { loginOk = true, tables = {}, onWrite } = options;

  // --- Cortafuegos ----------------------------------------------------------
  // Va PRIMERO a propósito: Playwright evalúa las rutas en orden inverso al
  // registro, así que las específicas de abajo tienen prioridad sobre ésta.
  // Todo lo que no mockeemos se aborta en vez de dejarlo salir; si un test
  // falla acá es porque le falta un mock, que es justo lo que queremos ver.
  await page.route("**://*.supabase.co/**", (route) => route.abort("blockedbyclient"));

  // --- Edge Functions -------------------------------------------------------
  await page.route("**/functions/v1/**", async (route) => {
    const url = route.request().url();

    if (url.includes("student-login")) {
      if (!loginOk) {
        return json(route, { ok: false, error: "Credenciales inválidas" }, 401);
      }
      return json(route, {
        ok: true,
        accessToken: ACCESS_TOKEN,
        refreshToken: SESSION.refresh_token,
      });
    }

    return json(route, { ok: true });
  });

  // --- Auth -----------------------------------------------------------------
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();

    // `setSession` valida el token contra este endpoint.
    if (url.includes("/user")) return json(route, AUTH_USER);
    if (url.includes("/token")) return json(route, SESSION);
    if (url.includes("/logout")) return route.fulfill({ status: 204, body: "" });

    return json(route, {});
  });

  // --- PostgREST ------------------------------------------------------------
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    // `/rest/v1/estudiantes?select=...` -> "estudiantes"
    const table = new URL(request.url()).pathname.replace(/^.*\/rest\/v1\//, "").split("?")[0];

    if (method !== "GET" && method !== "HEAD") {
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
      onWrite?.(table, method, body);
      // PostgREST devuelve la fila escrita cuando se pide `return=representation`.
      return json(route, Array.isArray(body) ? body : [body]);
    }

    return json(route, tables[table] ?? []);
  });
}

export { ACCESS_TOKEN, SESSION };
