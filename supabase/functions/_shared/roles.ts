/**
 * Vocabulario único de roles para las Edge Functions.
 *
 * POR QUÉ EXISTE
 *
 * Hasta el 2026-08-22 había TRES formas distintas de decidir quién es admin,
 * repartidas en 11 funciones:
 *
 *   - 8 funciones con un Set de 5 roles
 *   - `hermes-proxy` con un Set de 2
 *   - `list-backups` y `restore-backup` con una cadena de `||` de 4 roles,
 *     escrita a mano
 *
 * Ninguna de esas diferencias estaba documentada, así que para saber que
 * `AdminTester` puede disparar un backup pero no restaurarlo había que abrir 11
 * archivos y leer 3 sintaxis.
 *
 * El riesgo es asimétrico. Agregar un rol y olvidarse de un archivo da un 403
 * molesto pero visible. QUITAR un rol -- alguien deja el equipo, una cuenta se
 * compromete -- y olvidarse de uno deja la revocación incompleta: el error por
 * omisión falla del lado inseguro.
 *
 * IMPORTANTE: este módulo NO cambió ningún permiso. Cada set reproduce
 * exactamente lo que la función ya permitía; lo único que cambia es que ahora
 * las excepciones tienen nombre y aparecen en el diff cuando alguien las toca.
 */

/** Roles con acceso administrativo pleno. Es el set por defecto. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set([
  "admin",
  "SuperUser",
  "Jefe",
  "Directivo",
  "AdminTester",
]);

/**
 * Backups: mismo set pero sin `AdminTester`.
 *
 * Refleja lo que `list-backups` y `restore-backup` ya hacían. Para restaurar
 * tiene sentido -- pisa la base entera y no es una operación para un rol de
 * prueba -- pero en `list-backups`, que es sólo lectura, parece más un descuido
 * de copiar y pegar que una decisión. Se conserva tal cual para no cambiar
 * permisos de contrabando; queda anotado para revisarlo con intención.
 */
export const BACKUP_ROLES: ReadonlySet<string> = new Set([
  "admin",
  "SuperUser",
  "Jefe",
  "Directivo",
]);

/**
 * Hermes: sólo `admin` y `SuperUser`.
 *
 * Es un proxy hacia un servicio externo con allowlist propia, así que la
 * restricción se lee como deliberada y se mantiene.
 */
export const HERMES_ROLES: ReadonlySet<string> = new Set(["admin", "SuperUser"]);

/** Chequeo tolerante a `null`/`undefined`, que es como llega el rol de la DB. */
export const hasRole = (
  role: string | null | undefined,
  allowed: ReadonlySet<string> = ADMIN_ROLES
): boolean => !!role && allowed.has(role);
