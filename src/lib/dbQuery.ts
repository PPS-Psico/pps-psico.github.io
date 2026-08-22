/**
 * Puente entre una query cruda de PostgREST y el contrato de errores de
 * `dbError.ts`.
 *
 * POR QUE EXISTE
 *
 * `db.ts` cubre CRUD simple sobre una tabla y nada mas. No sabe hacer joins,
 * ni contar sin traer filas, ni actualizar/borrar filtrando por una columna que
 * no sea `id`. Los componentes que necesitaban eso no tenian a donde ir, asi
 * que llamaban a `supabase.from(...)` directo -- y al hacerlo se quedaban
 * afuera de la clasificacion de errores, del logging con contexto y de
 * cualquier posibilidad de testearse sin mockear el cliente entero.
 *
 * La salida NO es engordar `db.ts` hasta reimplementar PostgREST: la propia
 * documentacion de Supabase recomienda escribir la query y derivar su tipo con
 * `QueryData<typeof query>` cuando hay relaciones embebidas. Lo que faltaba era
 * que esas queries pudieran compartir el contrato de errores.
 *
 * COMO SE USA
 *
 * La query se escribe igual que siempre, vive en un service (no en un
 * componente) y se envuelve al final:
 *
 *   const rows = await runQuery(
 *     supabase
 *       .from("practicas")
 *       .select("id, lanzamiento:lanzamientos_pps!fk_practica_lanzamiento(nombre_pps)")
 *       .eq("estudiante_id", studentId),
 *     { table: "practicas", operation: "practicasConLanzamiento" }
 *   );
 *
 * `rows` queda tipado por inferencia -- incluida la relacion embebida -- y
 * cualquier fallo sale como `DbError` clasificado, igual que `db.getAll`.
 */

import { classifyDbError, type DbErrorContext } from "./dbError";

/**
 * Forma estructural de lo que resuelve un builder de PostgREST. Se describe a
 * mano en vez de importar los genericos de supabase-js para no atarse a su
 * firma interna, que cambia entre versiones.
 */
type PostgrestLike<TData> = PromiseLike<{
  data: TData;
  error: { message: string; code?: string; details?: string | null } | null;
}>;

/** Igual que arriba pero para las queries que piden `count`. */
type PostgrestCountLike = PromiseLike<{
  error: { message: string; code?: string; details?: string | null } | null;
  count: number | null;
}>;

/**
 * Ejecuta la query y devuelve `data`, o lanza un `DbError` clasificado.
 *
 * El tipo de retorno sale por inferencia del builder, asi que un `.select()`
 * con relaciones embebidas conserva su forma anidada y un `.maybeSingle()`
 * conserva su `| null`.
 */
export const runQuery = async <TData>(
  query: PostgrestLike<TData>,
  context: DbErrorContext
): Promise<TData> => {
  const { data, error } = await query;
  if (error) throw classifyDbError(error, context);
  return data;
};

/**
 * Para las queries de solo conteo (`select("id", { count: "exact", head: true })`).
 * Devuelve 0 y no `null` cuando PostgREST no informa cuenta: quien cuenta
 * quiere un numero, y propagar el `null` obliga a repetir el `?? 0` en cada
 * call-site.
 */
export const runCount = async (
  query: PostgrestCountLike,
  context: DbErrorContext
): Promise<number> => {
  const { count, error } = await query;
  if (error) throw classifyDbError(error, context);
  return count ?? 0;
};

/**
 * Para escrituras que no devuelven filas (`update`/`delete` filtrando por una
 * columna cualquiera). Solo propaga el error; no hay dato que devolver.
 */
export const runMutation = async (
  query: PostgrestLike<unknown>,
  context: DbErrorContext
): Promise<void> => {
  const { error } = await query;
  if (error) throw classifyDbError(error, context);
};
