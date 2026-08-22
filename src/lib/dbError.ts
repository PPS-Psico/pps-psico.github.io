/**
 * Contrato unico de errores de la capa de datos.
 *
 * Antes convivian cuatro formas de contar que algo salio mal:
 *   - `db.getAll` / `db.get`  devolvian `[]`          (indistinguible de "no hay datos")
 *   - `db.getPage`            devolvia `{ error }`
 *   - `db.create` / `update`  lanzaban un objeto plano `{ error: { type, message } }`
 *   - los servicios           a veces devolvian `null`
 *
 * El primero era el peligroso: una consulta que falla y una tabla vacia se veian
 * exactamente igual, asi que un fallo de red o una sesion vencida se le mostraba
 * al estudiante como "no tenes practicas". Un error plausible y falso es peor que
 * un error visible.
 *
 * Ahora toda la capa lanza `DbError`, React Query lo captura y la UI decide que
 * mostrar segun `kind`.
 *
 * NOTA sobre RLS en lecturas: una policy de SELECT que no deja ver una fila la
 * filtra, no genera error. Ese caso sigue viendose como "sin resultados" y no hay
 * forma de distinguirlo desde el cliente -- es como funciona Postgres. Lo que este
 * contrato si vuelve visible son los fallos reales: red caida, JWT vencido,
 * columna inexistente, timeouts, y las denegaciones de RLS en escrituras.
 */

export type DbErrorKind =
  /** RLS o permisos: la operacion fue rechazada (42501). En escrituras. */
  | "permission-denied"
  /** El JWT vencio o es invalido. Hay que renovar sesion. */
  | "session-expired"
  /** Violacion de unicidad (23505): el registro ya existe. */
  | "duplicate"
  /** Violacion de clave foranea (23503): referencia a algo que no existe. */
  | "reference-violation"
  /** Falta un campo obligatorio (23502) o falla un CHECK (23514). */
  | "invalid-data"
  /** El esquema no coincide con lo que pide el cliente (PGRST204, 42703). */
  | "schema-mismatch"
  /** No hubo respuesta del servidor: red, DNS, timeout. */
  | "network"
  /** Cualquier otra cosa. */
  | "unknown";

export interface DbErrorContext {
  /** Tabla involucrada, para que el log diga donde paso. */
  table?: string;
  /** Operacion: "getAll", "create", etc. */
  operation?: string;
}

export class DbError extends Error {
  readonly kind: DbErrorKind;
  readonly code?: string;
  readonly table?: string;
  readonly operation?: string;

  constructor(
    kind: DbErrorKind,
    message: string,
    context: DbErrorContext & { code?: string; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "DbError";
    this.kind = kind;
    this.code = context.code;
    this.table = context.table;
    this.operation = context.operation;
    // `cause` es estandar desde ES2022; se asigna aparte para no depender del
    // target de compilacion.
    if (context.cause !== undefined) {
      (this as { cause?: unknown }).cause = context.cause;
    }
  }
}

/** Codigos de Postgres/PostgREST a categoria. */
const CODE_TO_KIND: Record<string, DbErrorKind> = {
  "42501": "permission-denied", // insufficient_privilege (RLS en escritura)
  "23505": "duplicate", // unique_violation
  "23503": "reference-violation", // foreign_key_violation
  "23502": "invalid-data", // not_null_violation
  "23514": "invalid-data", // check_violation
  "42703": "schema-mismatch", // undefined_column
  "42P01": "schema-mismatch", // undefined_table
  PGRST301: "session-expired", // JWT expirado o invalido
  PGRST204: "schema-mismatch", // columna no encontrada en el schema cache
};

/** Un fallo de fetch no trae codigo; se reconoce por el mensaje. */
const looksLikeNetworkFailure = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network error") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed") ||
    normalized.includes("timeout") ||
    // Postgres y fetch usan "timed out"; sin esto un timeout caia en "unknown".
    normalized.includes("timed out") ||
    normalized.includes("aborted")
  );
};

/** Mensajes de JWT que llegan sin codigo estructurado. */
const looksLikeExpiredSession = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("jwt expired") ||
    normalized.includes("jwt is expired") ||
    normalized.includes("invalid claim") ||
    normalized.includes("token is expired")
  );
};

/** Extrae `{ code, message }` de las formas en que llega un error acá. */
const unwrap = (raw: unknown): { code?: string; message: string } => {
  if (raw == null) return { message: "Error desconocido" };
  if (typeof raw === "string") return { message: raw };

  const candidate = raw as {
    code?: unknown;
    message?: unknown;
    error?: unknown;
  };

  // `AppErrorResponse`: { error: { type, message, code } } o { error: "texto" }
  if (candidate.error !== undefined) {
    const inner = candidate.error;
    if (typeof inner === "string") return { message: inner };
    if (inner && typeof inner === "object") {
      const shaped = inner as { code?: unknown; message?: unknown };
      return {
        code: typeof shaped.code === "string" ? shaped.code : undefined,
        message: typeof shaped.message === "string" ? shaped.message : "Error desconocido",
      };
    }
  }

  return {
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    message: typeof candidate.message === "string" ? candidate.message : String(raw),
  };
};

/**
 * Convierte cualquier error de la capa de datos en un `DbError` tipado.
 * Si ya lo es, lo devuelve tal cual para no perder el contexto original.
 */
export const classifyDbError = (raw: unknown, context: DbErrorContext = {}): DbError => {
  if (raw instanceof DbError) return raw;

  const { code, message } = unwrap(raw);

  let kind: DbErrorKind = "unknown";
  if (code && CODE_TO_KIND[code]) {
    kind = CODE_TO_KIND[code];
  } else if (looksLikeExpiredSession(message)) {
    kind = "session-expired";
  } else if (looksLikeNetworkFailure(message)) {
    kind = "network";
  }

  return new DbError(kind, message, { ...context, code, cause: raw });
};

/** Texto para mostrarle a una persona. Nunca expone detalles internos. */
export const getDbErrorMessage = (error: unknown): string => {
  const dbError = error instanceof DbError ? error : classifyDbError(error);

  switch (dbError.kind) {
    case "permission-denied":
      return "No tenés permisos para esta acción. Si creés que es un error, avisá a coordinación.";
    case "session-expired":
      return "Tu sesión expiró. Volvé a iniciar sesión para continuar.";
    case "duplicate":
      return "Ese registro ya existe.";
    case "reference-violation":
      return "No se puede completar: hay datos relacionados que lo impiden.";
    case "invalid-data":
      return "Faltan datos obligatorios o alguno no es válido.";
    case "schema-mismatch":
      return "Hubo un problema técnico al leer los datos. Probá recargar la página.";
    case "network":
      return "No pudimos conectarnos. Revisá tu conexión y volvé a intentar.";
    default:
      return "Ocurrió un error al acceder a los datos. Probá de nuevo en unos segundos.";
  }
};

/** Si conviene ofrecer un reintento o el problema es del usuario. */
export const isRetryable = (error: unknown): boolean => {
  const dbError = error instanceof DbError ? error : classifyDbError(error);
  return dbError.kind === "network" || dbError.kind === "unknown";
};
