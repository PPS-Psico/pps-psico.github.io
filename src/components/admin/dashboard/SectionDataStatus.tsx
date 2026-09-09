import type { InicioSectionState } from "../../../hooks/inicioQueryState";

export function SectionDataStatus({
  state,
  label,
  onRetry,
}: {
  state: InicioSectionState;
  label: string;
  onRetry?: () => void;
}) {
  if (state.status === "ready" || state.status === "empty") return null;
  const updated = state.updatedAt
    ? new Date(state.updatedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
    : null;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "10px 0",
        color: "var(--ink-2)",
        fontSize: 13,
      }}
    >
      <span>
        {state.status === "loading"
          ? `Consultando ${label.toLowerCase()}…`
          : state.status === "stale"
            ? `No se pudo actualizar ${label.toLowerCase()}. Último dato confirmado${updated ? `: ${updated}` : ""}.`
            : `No se pudo consultar ${label.toLowerCase()}.`}
      </span>
      {state.status !== "loading" && onRetry && (
        <button
          className="btn btn-sm press"
          onClick={onRetry}
          disabled={state.isFetching}
          aria-label={`Reintentar ${label.toLowerCase()}`}
        >
          {state.isFetching ? "Reintentando…" : "Reintentar"}
        </button>
      )}
    </div>
  );
}
