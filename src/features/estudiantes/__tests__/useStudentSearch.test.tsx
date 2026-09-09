import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useStudentSearch } from "../useStudentSearch";
import { StudentReplacementSearch } from "../StudentReplacementSearch";
import { searchStudents } from "../studentSearchService";

jest.mock("../studentSearchService", () => ({
  ...jest.requireActual("../studentSearchService"),
  searchStudents: jest.fn(),
}));
const searchMock = jest.mocked(searchStudents);
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  searchMock
    .mockReset()
    .mockResolvedValue({ students: [{ id: "a", nombre: "Ana", legajo: "1" }], hasNextPage: false });
});
afterEach(() => client.clear());

it("no lee el padrón al montar y agrupa la escritura antes de consultar", async () => {
  const { result } = renderHook(() => useStudentSearch(true, []), { wrapper });
  expect(searchMock).not.toHaveBeenCalled();
  act(() => {
    result.current.setTerm("An");
    result.current.setTerm("Ana");
  });
  await waitFor(() => expect(result.current.students).toHaveLength(1));
  expect(searchMock).toHaveBeenCalledTimes(1);
  expect(searchMock.mock.calls[0].slice(0, 2)).toEqual(["Ana", 1]);
});

it("mantiene la exclusión actual sin refetch y comparte la página al cambiar de convocatoria", async () => {
  const { result, rerender } = renderHook(({ ids }) => useStudentSearch(true, ids), {
    wrapper,
    initialProps: { ids: [] as string[] },
  });
  act(() => result.current.setTerm("Ana"));
  await waitFor(() => expect(result.current.students).toHaveLength(1));
  rerender({ ids: ["a"] });
  expect(result.current.students).toHaveLength(0);
  rerender({ ids: [] });
  expect(result.current.students).toHaveLength(1);
  expect(searchMock).toHaveBeenCalledTimes(1);
});

it("permite avanzar si toda la página ya está postulada y reinicia al cambiar la búsqueda", async () => {
  searchMock.mockResolvedValueOnce({
    students: [{ id: "a", nombre: "Ana", legajo: "1" }],
    hasNextPage: true,
  });
  const { result } = renderHook(() => useStudentSearch(true, ["a"]), { wrapper });
  act(() => result.current.setTerm("Ana"));
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  expect(result.current.students).toHaveLength(0);
  act(() => result.current.next());
  await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
  expect(searchMock.mock.calls[1][1]).toBe(2);
  act(() => result.current.setTerm("Beatriz"));
  expect(result.current.page).toBe(1);
  expect(result.current.students).toHaveLength(0);
});

it("cancela la solicitud al cambiar el término", async () => {
  searchMock.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useStudentSearch(true, []), { wrapper });
  act(() => result.current.setTerm("Ana"));
  await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
  const signal = searchMock.mock.calls[0][2]!;
  act(() => result.current.setTerm("Beatriz"));
  expect(signal.aborted).toBe(true);
});

it("espera al roster confirmado incluso si está vacío", async () => {
  const { result, rerender } = renderHook(({ enabled }) => useStudentSearch(enabled, []), {
    wrapper,
    initialProps: { enabled: false },
  });
  act(() => result.current.setTerm("Ana"));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(searchMock).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.students).toHaveLength(1));
});

it("presenta el fallo y recupera la búsqueda sin afirmar que no hay resultados", async () => {
  searchMock.mockRejectedValueOnce(new Error("Sin conexión"));
  render(<StudentReplacementSearch enrolledIds={[]} onSelect={() => {}} />, { wrapper });
  await userEvent.type(screen.getByRole("searchbox"), "Ana");
  await screen.findByText("No se pudo consultar a los estudiantes.");
  expect(screen.queryByText("No se encontraron estudiantes disponibles.")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar búsqueda" }));
  await screen.findByRole("button", { name: "Seleccionar a Ana" });
});
