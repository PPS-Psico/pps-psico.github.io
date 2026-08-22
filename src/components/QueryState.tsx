import React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import Loader from "./Loader";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import { getDbErrorMessage, isRetryable } from "../lib/dbError";

/**
 * Cablea el resultado de una query de React Query a los estados visuales que ya
 * existen en el proyecto (`Loader`, `ErrorState`, `EmptyState`).
 *
 * POR QUE EXISTE
 *
 * La capa de datos ya lanza `DbError` clasificado y React Query lo captura, pero
 * eso no alcanza para que la persona se entere: de ~120 llamadas a `useQuery`
 * sólo un puñado renderizaba el estado de error. En el resto, una consulta
 * fallida y una tabla vacía se veían igual — el silencio se había corrido de la
 * capa de datos a la UI.
 *
 * Parchear 120 lugares a mano habría dejado 120 criterios distintos. Esto es un
 * único lugar donde decidir qué se muestra en cada caso.
 *
 * QUE APORTA SOBRE UN `if (isError)` SUELTO
 *
 * - El texto sale de `getDbErrorMessage`, así que la persona lee "tu sesión
 *   expiró" o "revisá tu conexión", nunca el mensaje crudo de Postgres.
 * - El botón "Reintentar" aparece SOLO si reintentar puede servir
 *   (`isRetryable`). Ofrecerlo ante un "no tenés permisos" es mentirle a quien
 *   lo va a apretar tres veces.
 * - Distingue "no hay datos" de "falló la consulta", que es justamente lo que
 *   no se podía distinguir antes.
 *
 * USO
 *
 *   <QueryState query={practicasQuery} empty={{ title: "Sin prácticas", message: "..." }}>
 *     {(practicas) => <PracticasTable rows={practicas} />}
 *   </QueryState>
 *
 * `children` es una función para que `data` quede tipado sin `undefined`: dentro
 * del render la query ya resolvió.
 */

/** Sólo lo que este componente necesita, para poder testearlo sin un QueryClient. */
export type QueryLike<TData> = Pick<
  UseQueryResult<TData>,
  "isPending" | "isError" | "error" | "data"
> & {
  refetch?: () => unknown;
};

interface QueryStateProps<TData> {
  query: QueryLike<TData>;
  children: (data: TData) => React.ReactNode;
  /**
   * Qué mostrar cuando la consulta funcionó pero no trajo nada. Omitir para que
   * el propio `children` resuelva el caso vacío (útil en tablas que ya tienen su
   * propia fila de "sin resultados").
   */
  empty?: {
    title: string;
    message: string;
    action?: React.ReactNode;
    /** Ilustración del kit: "no-practicas", "no-solicitudes", "search"... */
    type?: React.ComponentProps<typeof EmptyState>["type"];
  };
  /** Reemplaza el loader por un skeleton propio de la vista. */
  loading?: React.ReactNode;
  /**
   * Cuándo considerar que no hay datos. Por defecto, un array vacío. Se puede
   * pasar otra cosa para respuestas que no son listas.
   */
  isEmpty?: (data: TData) => boolean;
}

const defaultIsEmpty = (data: unknown): boolean => Array.isArray(data) && data.length === 0;

function QueryState<TData>({
  query,
  children,
  empty,
  loading,
  isEmpty = defaultIsEmpty as (data: TData) => boolean,
}: QueryStateProps<TData>) {
  if (query.isPending) {
    return <>{loading ?? <Loader />}</>;
  }

  if (query.isError) {
    return (
      <ErrorState
        error={getDbErrorMessage(query.error)}
        onRetry={isRetryable(query.error) && query.refetch ? () => query.refetch?.() : undefined}
      />
    );
  }

  // `isPending` false y sin error implica que hay dato; el chequeo explícito es
  // para no depender de esa inferencia si el objeto viene armado a mano.
  if (query.data === undefined) {
    return <>{loading ?? <Loader />}</>;
  }

  if (empty && isEmpty(query.data)) {
    return (
      <EmptyState
        type={empty.type ?? "empty"}
        title={empty.title}
        message={empty.message}
        action={empty.action}
      />
    );
  }

  return <>{children(query.data)}</>;
}

export default QueryState;
