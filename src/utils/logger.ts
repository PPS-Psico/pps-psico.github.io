/**
 * Centralized logger service.
 * Abstraction layer to handle console logging and potential future external error reporting services (e.g., Sentry).
 */

class Logger {
  private isDev: boolean;

  constructor() {
    // Safe check for process.env
    const meta = ({ env: process.env } as any) as any;
    this.isDev = meta && meta.env ? meta.env.DEV : false;
  }

  info(message: string, data?: any) {
    if (this.isDev) {
      console.log(`ℹ️ [INFO] ${message}`, data || "");
    }
  }

  warn(message: string, data?: any) {
    console.warn(`⚠️ [WARN] ${message}`, data || "");
  }

  error(message: string, error?: any) {
    console.error(`🚨 [ERROR] ${message}`, error || "");
    // Hook for Sentry or other APM tools:
    // if (!this.isDev) Sentry.captureException(error);
  }

  debug(message: string, data?: any) {
    if (this.isDev) {
      console.debug(`🐛 [DEBUG] ${message}`, data || "");
    }
  }
}

export const logger = new Logger();
