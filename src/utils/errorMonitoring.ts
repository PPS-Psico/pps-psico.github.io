import type { ErrorEvent } from "@sentry/browser";

let capture: ((error: Error) => void) | undefined;
let starting: Promise<void> | undefined;

/** Allowlist: nunca enviar mensajes, formularios, URLs de navegación ni datos académicos. */
export function sanitizeMonitoringEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: "javascript",
    level: "error",
    release: event.release,
    environment: event.environment,
    exception: {
      values: event.exception?.values?.map((exception) => ({
        type: "ApplicationError",
        value: "Error de aplicación (contenido omitido)",
        stacktrace: {
          frames: exception.stacktrace?.frames?.flatMap((frame) => {
            // Sólo nombres de bundles generados, sin querystring, hash ni rutas de usuarios.
            const asset = frame.filename?.split(/[?#]/, 1)[0].match(/\/assets\/([\w.-]+\.js)$/);
            return asset
              ? [{ filename: `/assets/${asset[1]}`, lineno: frame.lineno, colno: frame.colno }]
              : [];
          }),
        },
      })),
    },
  };
}

export function startErrorMonitoring(): Promise<void> {
  if (starting) return starting;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!import.meta.env.PROD || import.meta.env.VITE_VISUAL_BASELINE === "true" || !dsn) {
    return Promise.resolve();
  }
  starting = import("@sentry/browser")
    .then((sentry) => {
      sentry.init({
        dsn,
        environment: "production",
        release: import.meta.env.VITE_APP_RELEASE,
        sendDefaultPii: false,
        defaultIntegrations: false,
        integrations: [sentry.globalHandlersIntegration(), sentry.dedupeIntegration()],
        sendClientReports: false,
        beforeSend: sanitizeMonitoringEvent,
      });
      capture = (error) => {
        sentry.captureException(error);
      };
    })
    .catch(() => {
      // La observabilidad nunca debe bloquear el inicio o la recuperación del panel.
      console.warn("No se pudo iniciar el monitoreo de errores.");
    });
  return starting;
}

export function reportUnexpectedError(error: Error): void {
  if (capture) capture(error);
}
