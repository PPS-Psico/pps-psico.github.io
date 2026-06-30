/**
 * Centralized logger service.
 *
 * Abstracción sobre `console` con dos objetivos:
 *  - Silenciar logs de desarrollo (`info`/`debug`) en producción y dejar un único
 *    punto de salida para enganchar un APM externo (Sentry, Datadog, etc.).
 *  - Dar herramientas de DIAGNÓSTICO DE RENDIMIENTO en dev: timestamps relativos,
 *    niveles con etiqueta, namespaces (scopes), medición de tiempos (`time`),
 *    contadores (`count`) y marcas en la Performance API del browser para poder
 *    inspeccionarlas en la pestaña "Performance" de DevTools.
 *
 * Sigue siendo un reemplazo directo de `console.*` (API variádica), así que el
 * código existente que llama `logger.info(...)` no necesita cambios.
 */

type LogArgs = unknown[];
type Level = "info" | "debug" | "warn" | "error";

// Reloj monotónico para timestamps relativos. `performance.now()` cuando existe
// (browser), si no `Date.now()` (Node/Jest).
const now = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const START = now();

// Etiquetas cortas por nivel para escanear la consola de un vistazo.
const TAG: Record<Level, string> = {
  info: "ℹ️",
  debug: "🐛",
  warn: "⚠️",
  error: "⛔",
};

class Logger {
  private isDev: boolean;
  private counters = new Map<string, number>();
  private timers = new Map<string, number>();
  private supportsPerfApi: boolean;

  constructor() {
    // Safe check for import.meta.env (Vite) or process.env (Node/Jest)
    this.isDev = import.meta.env?.DEV ?? false;
    this.supportsPerfApi =
      typeof performance !== "undefined" && typeof performance.mark === "function";
  }

  /** `[+1.234s]` desde que cargó el módulo. Útil para ubicar cuándo pasó algo. */
  private stamp(): string {
    const elapsed = now() - START;
    return elapsed < 1000 ? `[+${elapsed.toFixed(0)}ms]` : `[+${(elapsed / 1000).toFixed(2)}s]`;
  }

  private prefix(level: Level, scope?: string): string {
    return `${this.stamp()} ${TAG[level]}${scope ? ` [${scope}]` : ""}`;
  }

  // ── API básica (drop-in de console.*) ─────────────────────────────────────
  info(message?: unknown, ...args: LogArgs) {
    if (this.isDev) console.log(this.prefix("info"), message, ...args);
  }

  debug(message?: unknown, ...args: LogArgs) {
    if (this.isDev) console.debug(this.prefix("debug"), message, ...args);
  }

  warn(message?: unknown, ...args: LogArgs) {
    console.warn(this.prefix("warn"), message, ...args);
  }

  error(message?: unknown, ...args: LogArgs) {
    console.error(this.prefix("error"), message, ...args);
    // Hook para Sentry u otra herramienta de APM en producción:
    // if (!this.isDev) Sentry.captureException(args[0] ?? message);
  }

  // ── Logging con namespace (scope) ─────────────────────────────────────────
  /** Log con scope para agrupar por subsistema: `logger.scoped("Auth", "...")`. */
  scoped(scope: string, message?: unknown, ...args: LogArgs) {
    if (this.isDev) console.log(this.prefix("info", scope), message, ...args);
  }

  // ── Medición de tiempos ───────────────────────────────────────────────────
  /**
   * Marca el inicio de una operación. Devuelve una función `end()` que, al
   * llamarse, loguea el tiempo transcurrido (en dev) y lo devuelve en ms.
   * También deja una `measure` en la Performance API para verla en DevTools.
   *
   *   const end = logger.time("fetch perfil");
   *   ... await query ...
   *   end();  // → "[+1.2s] ⏱️ fetch perfil: 234ms"
   */
  time(label: string): () => number {
    const t0 = now();
    const markStart = `${label}:start`;
    if (this.supportsPerfApi) {
      try {
        performance.mark(markStart);
      } catch {
        /* noop */
      }
    }
    this.timers.set(label, t0);
    return () => {
      const elapsed = now() - t0;
      this.timers.delete(label);
      if (this.supportsPerfApi) {
        try {
          performance.measure(`⏱️ ${label}`, markStart);
        } catch {
          /* noop */
        }
      }
      if (this.isDev) {
        const slow = elapsed > 500 ? " 🐢 LENTO" : "";
        console.log(`${this.stamp()} ⏱️ ${label}: ${elapsed.toFixed(0)}ms${slow}`);
      }
      return elapsed;
    };
  }

  /** Envuelve una promesa y loguea cuánto tardó en resolverse/rechazarse. */
  async timeAsync<T>(label: string, promise: Promise<T>): Promise<T> {
    const end = this.time(label);
    try {
      const result = await promise;
      end();
      return result;
    } catch (err) {
      end();
      throw err;
    }
  }

  // ── Contadores ─────────────────────────────────────────────────────────────
  /**
   * Incrementa y loguea un contador con nombre. Sirve para detectar fetches o
   * renders duplicados: si ves "Profile fetch (x3)" sabés que se llamó 3 veces.
   */
  count(label: string) {
    const next = (this.counters.get(label) ?? 0) + 1;
    this.counters.set(label, next);
    if (this.isDev) console.log(`${this.stamp()} 🔢 ${label} (x${next})`);
    return next;
  }

  resetCount(label?: string) {
    if (label) this.counters.delete(label);
    else this.counters.clear();
  }

  // ── Agrupación ──────────────────────────────────────────────────────────────
  group(label: string) {
    if (this.isDev && typeof console.group === "function")
      console.group(this.prefix("info"), label);
  }

  groupEnd() {
    if (this.isDev && typeof console.groupEnd === "function") console.groupEnd();
  }

  /** Tabla (para listas de datos): pasa a `console.table` en dev. */
  table(data: unknown) {
    if (this.isDev && typeof console.table === "function") console.table(data);
  }
}

export const logger = new Logger();
