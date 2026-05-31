/**
 * Centralized logger service.
 *
 * Abstraction layer over `console` to:
 *  - Silenciar logs de desarrollo (`info`/`debug`) en producción.
 *  - Mantener un único punto de salida para enganchar un APM externo
 *    (Sentry, Datadog, etc.) sin tocar el resto del código.
 *
 * Acepta argumentos variádicos para ser un reemplazo directo de `console.*`
 * sin perder información en los logs.
 */

type LogArgs = unknown[];

class Logger {
  private isDev: boolean;

  constructor() {
    // Safe check for import.meta.env (Vite) or process.env (Node/Jest)
    this.isDev = import.meta.env?.DEV ?? false;
  }

  info(message?: unknown, ...args: LogArgs) {
    if (this.isDev) {
      console.log(message, ...args);
    }
  }

  warn(message?: unknown, ...args: LogArgs) {
    console.warn(message, ...args);
  }

  error(message?: unknown, ...args: LogArgs) {
    console.error(message, ...args);
    // Hook para Sentry u otra herramienta de APM en producción:
    // if (!this.isDev) Sentry.captureException(args[0] ?? message);
  }

  debug(message?: unknown, ...args: LogArgs) {
    if (this.isDev) {
      console.debug(message, ...args);
    }
  }
}

export const logger = new Logger();
