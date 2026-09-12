import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CorreccionesTab from "../CorreccionesTab";

jest.mock("../../../../services", () => ({
  fetchAllSolicitudesModificacion: jest.fn(async () => []),
  fetchAllSolicitudesNuevaPPS: jest.fn(async () =>
    ["pendiente", "aprobada", "rechazada", "archivada"].map((estado) => ({
      id: estado,
      estado,
      created_at: "2026-09-12T12:00:00Z",
      estudiante: { nombre: `Persona ${estado}` },
    }))
  ),
}));
jest.mock("../../../../lib/supabaseClient", () => ({ supabase: {} }));

it("abre sólo pendientes y permite consultar cada historial sin mezclar estados", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onUpdateCounts = jest.fn();
  function View() {
    const [filter, setFilter] = React.useState("all");
    return (
      <CorreccionesTab
        filter={filter}
        setFilter={setFilter}
        expandedId={null}
        onToggle={jest.fn()}
        onToast={jest.fn()}
        onReject={jest.fn()}
        onUpdateCounts={onUpdateCounts}
      />
    );
  }
  render(
    <QueryClientProvider client={client}>
      <View />
    </QueryClientProvider>
  );
  expect(await screen.findByText("Persona pendiente")).toBeInTheDocument();
  expect(screen.queryByText("Persona aprobada")).not.toBeInTheDocument();
  expect(screen.queryByText("Persona archivada")).not.toBeInTheDocument();
  expect(onUpdateCounts).toHaveBeenLastCalledWith(1);
  const user = userEvent.setup();
  for (const [label, state] of [
    ["Aprobadas", "aprobada"],
    ["Rechazadas", "rechazada"],
    ["Archivadas", "archivada"],
  ]) {
    await user.click(screen.getByRole("button", { name: new RegExp(label) }));
    expect(screen.getByText(`Persona ${state}`)).toBeInTheDocument();
    expect(screen.queryByText("Persona pendiente")).not.toBeInTheDocument();
  }
  expect(screen.getByText("Archivada", { exact: true })).toBeInTheDocument();
  expect(screen.queryByText("Pendiente", { exact: true })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Pendientes/ }));
  expect(screen.getByText("Persona pendiente")).toBeInTheDocument();
});
