
/**
 * Centralized logger service.
 * Abstraction layer to handle console logging and potential future external error reporting services (e.g., Sentry).
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
    private isDev: boolean;

    constructor() {
        // Safe check for import.meta.env
        const meta = import.meta as any;
        this.isDev = meta && meta.env ? meta.env.DEV : false;
    }

    private formatMessage(level: LogLevel, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        return {
            timestamp,
            level,
            message,
            data
        };
    }

    info(message: string, data?: any) {
        if (this.isDev) {
            console.log(`ℹ️ [INFO] ${message}`, data || '');
        }
    }

    warn(message: string, data?: any) {
        console.warn(`⚠️ [WARN] ${message}`, data || '');
    }

    error(message: string, error?: any) {
        console.error(`🚨 [ERROR] ${message}`, error || '');
        // Hook for Sentry or other APM tools:
        // if (!this.isDev) Sentry.captureException(error);
    }

    debug(message: string, data?: any) {
        if (this.isDev) {
            console.debug(`🐛 [DEBUG] ${message}`, data || '');
        }
    }
}

export const logger = new Logger();
