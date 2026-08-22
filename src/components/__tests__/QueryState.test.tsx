import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import QueryState, { type QueryLike } from "../QueryState";
import { DbError } from "../../lib/dbError";

/** Arma un objeto con la forma mínima que consume QueryState. */
const query = <T,>(over: Partial<QueryLike<T>>): QueryLike<T> =>
  ({
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    ...over,
  }) as QueryLike<T>;

describe("QueryState", () => {
  it("muestra el loader mientras la query está pendiente", () => {
    render(
      <QueryState query={query<string[]>({ isPending: true })}>
        {() => <div>contenido</div>}
      </QueryState>
    );
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });

  it("acepta un skeleton propio en lugar del loader", () => {
    render(
      <QueryState query={query<string[]>({ isPending: true })} loading={<div>esqueleto</div>}>
        {() => <div>contenido</div>}
      </QueryState>
    );
    expect(screen.getByText("esqueleto")).toBeInTheDocument();
  });

  it("renderiza los datos cuando la query resolvió", () => {
    render(
      <QueryState query={query({ data: ["a", "b"] })}>
        {(rows) => <div>{rows.length} filas</div>}
      </QueryState>
    );
    expect(screen.getByText("2 filas")).toBeInTheDocument();
  });

  /**
   * El punto de todo el ejercicio: una lista vacía y una consulta fallida tienen
   * que verse distinto. Antes las dos terminaban en el mismo cartel.
   */
  it("distingue 'no hay datos' de 'falló la consulta'", () => {
    const { unmount } = render(
      <QueryState
        query={query({ data: [] as string[] })}
        empty={{ title: "Sin prácticas", message: "Todavía no cargaste ninguna" }}
      >
        {() => <div>contenido</div>}
      </QueryState>
    );
    expect(screen.getByText("Sin prácticas")).toBeInTheDocument();
    unmount();

    render(
      <QueryState
        query={query<string[]>({ isError: true, error: new DbError("network", "boom") })}
        empty={{ title: "Sin prácticas", message: "Todavía no cargaste ninguna" }}
      >
        {() => <div>contenido</div>}
      </QueryState>
    );
    expect(screen.queryByText("Sin prácticas")).not.toBeInTheDocument();
    expect(screen.getByText(/Error al Cargar Datos/i)).toBeInTheDocument();
  });

  it("traduce el error con el contrato y no filtra el mensaje interno", () => {
    render(
      <QueryState
        query={query<string[]>({
          isError: true,
          error: new DbError("session-expired", 'JWT expired for user 9f2a on table "practicas"'),
        })}
      >
        {() => <div>contenido</div>}
      </QueryState>
    );
    expect(screen.getByText(/sesión expiró/i)).toBeInTheDocument();
    expect(screen.queryByText(/9f2a/)).not.toBeInTheDocument();
    expect(screen.queryByText(/JWT/)).not.toBeInTheDocument();
  });

  it("ofrece reintentar sólo cuando reintentar puede servir", async () => {
    const refetch = jest.fn();
    const { unmount } = render(
      <QueryState
        query={query<string[]>({
          isError: true,
          error: new DbError("network", "sin red"),
          refetch,
        })}
      >
        {() => <div>contenido</div>}
      </QueryState>
    );
    const boton = screen.getByRole("button", { name: /reintentar/i });
    await userEvent.click(boton);
    expect(refetch).toHaveBeenCalled();
    unmount();

    // Insistir con un "no tenés permisos" nunca va a funcionar: no se ofrece.
    render(
      <QueryState
        query={query<string[]>({
          isError: true,
          error: new DbError("permission-denied", "denegado"),
          refetch,
        })}
      >
        {() => <div>contenido</div>}
      </QueryState>
    );
    expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it("sin prop `empty`, una lista vacía la resuelve el propio children", () => {
    render(
      <QueryState query={query({ data: [] as string[] })}>
        {(rows) => <div>{rows.length === 0 ? "tabla con su propio vacío" : "filas"}</div>}
      </QueryState>
    );
    expect(screen.getByText("tabla con su propio vacío")).toBeInTheDocument();
  });

  it("permite definir qué significa vacío para datos que no son listas", () => {
    render(
      <QueryState
        query={query({ data: { total: 0 } })}
        isEmpty={(d) => d.total === 0}
        empty={{ title: "Nada que mostrar", message: "El total es cero" }}
      >
        {() => <div>contenido</div>}
      </QueryState>
    );
    expect(screen.getByText("Nada que mostrar")).toBeInTheDocument();
  });
});
