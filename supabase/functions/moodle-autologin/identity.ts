/**
 * Lógica de identidad del ingreso desde el campus, sin dependencias.
 *
 * Vive aparte de `index.ts` para poder probarse: el archivo de la Edge Function
 * importa Supabase desde una URL de esm.sh, así que no se puede cargar desde
 * jest, y `tsconfig.json` sólo incluye `src`, con lo cual tampoco lo alcanza
 * `tsc --noEmit`. Estas funciones son las que deciden si un perfil de Moodle
 * corresponde a una ficha: son las que hay que tener cubiertas.
 *
 * Sin imports a propósito, para que corra igual en Deno.
 */

export type StudentIdentity = {
  correo: string | null;
  nombre: string | null;
  nombre_separado: string | null;
  apellido_separado: string | null;
};

export const normalizeName = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const normalizeEmail = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const normalizeDni = (value: unknown): string => String(value ?? "").replace(/\D/g, "");

/** Multiset de tokens: "Navarrete María Victoria" == "María Victoria Navarrete". */
export const nameTokens = (value: unknown): string =>
  normalizeName(value).split(" ").filter(Boolean).sort().join(" ");

export const isValidProfile = (
  email: string,
  dni: string,
  firstname: string,
  lastname: string
): boolean =>
  email.length <= 320 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
  /^\d{6,9}$/.test(dni) &&
  firstname.length >= 2 &&
  firstname.length <= 120 &&
  lastname.length >= 2 &&
  lastname.length <= 120;

/**
 * ¿El nombre que informa el campus corresponde al de la ficha?
 *
 * La comparación canónica es contra `nombre_separado`/`apellido_separado`. Pero
 * 54 fichas nunca tuvieron esas columnas cargadas —11 de ellas con cuenta— y
 * ahí `normalizeName(null)` daba "" y no coincidía nunca: esos alumnos quedaban
 * excluidos del ingreso desde el campus sin motivo real. Para ellos se compara
 * contra `nombre` completo: es el mismo control de identidad leído de otra
 * columna, tolerando el orden (algunas fichas son "Apellido Nombre").
 *
 * Si la ficha no tiene ningún nombre cargado no hay contra qué comparar, y la
 * identidad se apoya en lo que ya exigía el llamador: correo y DNI —dos claves
 * independientes— resolviendo a la misma fila única, cuenta vinculada, correo
 * de Auth confirmado y rol Alumno.
 */
export const namesAgree = (
  student: StudentIdentity,
  firstname: string,
  lastname: string
): boolean => {
  const tieneSeparados =
    normalizeName(student.nombre_separado) !== "" &&
    normalizeName(student.apellido_separado) !== "";

  if (tieneSeparados) {
    return (
      normalizeName(student.nombre_separado) === firstname &&
      normalizeName(student.apellido_separado) === lastname
    );
  }

  if (normalizeName(student.nombre) !== "") {
    return nameTokens(student.nombre) === nameTokens(`${firstname} ${lastname}`);
  }

  return true;
};

/**
 * Qué campos de nombre hay que completar en la ficha con lo que informa el
 * campus. Sólo rellena huecos: nunca pisa un valor ya cargado, así una
 * diferencia real de datos queda para que la corrija coordinación en vez de
 * reescribirse sola desde una URL.
 */
export const pendingNameBackfill = (
  student: StudentIdentity,
  rawFirstname: string,
  rawLastname: string
): Record<string, string> => {
  const first = rawFirstname.trim();
  const last = rawLastname.trim();
  const updates: Record<string, string> = {};

  if (normalizeName(student.nombre_separado) === "" && first) {
    updates.nombre_separado = first;
  }
  if (normalizeName(student.apellido_separado) === "" && last) {
    updates.apellido_separado = last;
  }
  if (normalizeName(student.nombre) === "" && first && last) {
    updates.nombre = `${first} ${last}`;
  }

  return updates;
};
