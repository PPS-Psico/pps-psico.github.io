import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useInicioData } from "../useInicioData";
import { SolicitudesBand } from "../../components/admin/dashboard/SolicitudesBand";
import { Briefing } from "../../components/admin/dashboard/Briefing";

interface Response {
  data: unknown;
  error: { message: string } | null;
  count?: number;
}
const mockResponses: Record<string, Response> = {};
let mockPendingTable: string | null = null;
const mockFrom = jest.fn((table: string) => {
  const response = (): Promise<Response> =>
    table === mockPendingTable
      ? new Promise(() => {})
      : Promise.resolve(mockResponses[table] ?? { data: [], count: 0, error: null });
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: () => response().then((r) => ({ ...r, data: r.error ? undefined : null })),
    then: (resolve: (value: Response) => unknown, reject: (error: unknown) => unknown) =>
      response().then(resolve, reject),
  };
});

jest.mock("../../lib/supabaseClient", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

let client: QueryClient;
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function DashboardData() {
  const data = useInicioData();
  return (
    <>
      <Briefing
        data={data.briefing}
        totalChats={data.briefing.totalChats}
        state={data.sections.briefing}
        onRetry={() => data.retrySection("briefing")}
      />
      <SolicitudesBand
        metrics={data.solicitudesMetrics.map((m) => ({
          ...m,
          onClick: () => {},
          onRetry: () => data.retrySection(m.id),
        }))}
        onOpenSolicitudes={() => {}}
      />
    </>
  );
}

beforeEach(() => {
  for (const key of Object.keys(mockResponses)) delete mockResponses[key];
  mockPendingTable = null;
  mockFrom.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(() => client.clear());

it("no afirma que no hay acreditaciones ni que falta generar el briefing cuando fallan las consultas", async () => {
  for (const table of ["finalizacion_pps", "agent_suggestions", "whatsapp_contactos"]) {
    mockResponses[table] = { data: null, error: { message: "Sin conexión" } };
  }
  render(<DashboardData />, { wrapper: Wrapper });
  await screen.findByRole("button", { name: "Reintentar egreso · finalizaciones" });
  expect(screen.getByText("No disponible")).toBeInTheDocument();
  expect(screen.queryByText("Nada por acreditar")).not.toBeInTheDocument();
  expect(screen.queryByText(/todavía no generó/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reintentar briefing de hermes" })).toBeInTheDocument();
});

it("una consulta exitosa vacía sí conserva el cero real", async () => {
  const { result } = renderHook(() => useInicioData(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.status.isLoading).toBe(false));
  expect(result.current.solicitudesMetrics.map((m) => m.n)).toEqual([0, 0, 0]);
  expect(result.current.solicitudesMetrics.every((m) => m.state.status === "empty")).toBe(true);
  expect(result.current.solicitudesMetrics[1].sub).toBe("Nada por acreditar");
});

it("conserva el último dato confirmado y su fecha si falla el refetch", async () => {
  mockResponses.finalizacion_pps = { data: [{ id: "f1", estado: "Pendiente" }], error: null };
  const { result } = renderHook(() => useInicioData(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.solicitudesMetrics[1].n).toBe(1));
  const confirmedAt = result.current.solicitudesMetrics[1].state.updatedAt;
  mockResponses.finalizacion_pps = { data: null, error: { message: "Sin conexión" } };
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["inicio_egreso_metrics"] });
  });
  await waitFor(() => expect(result.current.solicitudesMetrics[1].state.status).toBe("stale"));
  expect(result.current.solicitudesMetrics[1].n).toBe(1);
  expect(result.current.solicitudesMetrics[1].state.updatedAt).toBe(confirmedAt);
});

it("permite recuperar sólo la sección que falló", async () => {
  mockResponses.finalizacion_pps = { data: null, error: { message: "Sin conexión" } };
  render(<DashboardData />, { wrapper: Wrapper });
  const retry = await screen.findByRole("button", { name: "Reintentar egreso · finalizaciones" });
  expect(screen.queryByText(/No hay solicitudes esperando/)).not.toBeInTheDocument();
  mockFrom.mockClear();
  mockResponses.finalizacion_pps = { data: [], error: null };
  await userEvent.click(retry);
  await screen.findByText("Nada por acreditar");
  expect(mockFrom.mock.calls.map(([table]) => table)).toEqual(["finalizacion_pps"]);
  expect(screen.queryByText("No disponible")).not.toBeInTheDocument();
});

it("no bloquea las secciones listas mientras Hermes sigue cargando", async () => {
  mockPendingTable = "agent_suggestions";
  const { result } = renderHook(() => useInicioData(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.sections.briefing.status).toBe("loading");
  expect(result.current.solicitudesMetrics[1].n).toBe(0);
});

it("no marca instituciones como sin catalogar si no pudo leer el catálogo", async () => {
  mockResponses.solicitudes_pps = {
    data: [{ id: "s1", nombre_institucion: "Hospital de prueba" }],
    error: null,
  };
  mockResponses.instituciones = { data: null, error: { message: "Sin conexión" } };
  const { result } = renderHook(() => useInicioData(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.status.hasError).toBe(true));
  expect(result.current.solicitudesMetrics[0].n).toBe(1);
  expect(result.current.solicitudesMetrics[0].note).toBeNull();
});
