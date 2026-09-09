export interface InicioSectionState {
  status: "loading" | "ready" | "empty" | "stale" | "error";
  updatedAt: number | null;
  isFetching: boolean;
}

/** React Query conserva el último dato válido cuando falla una actualización. */
export function inicioQueryState(
  query: {
    data: unknown;
    dataUpdatedAt: number;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
  },
  empty = false
): InicioSectionState {
  const hasData = query.data !== undefined;
  return {
    status: query.isError
      ? hasData
        ? "stale"
        : "error"
      : query.isPending
        ? "loading"
        : empty
          ? "empty"
          : "ready",
    updatedAt: hasData && query.dataUpdatedAt > 0 ? query.dataUpdatedAt : null,
    isFetching: query.isFetching,
  };
}
