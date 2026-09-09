import { queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  fetchInicioBrief,
  fetchInicioSolicitudes,
  fetchInicioInstituciones,
  fetchInicioCorrecciones,
  fetchInicioEgreso,
  fetchInicioDrafts,
  fetchInicioContacts,
} from "./inicioService";

export const inicioKeys = {
  brief: ["inicio_daily_brief"] as const,
  solicitudes: ["inicio_solicitudes_activas"] as const,
  instituciones: ["inicio_instituciones_nombres"] as const,
  correcciones: ["inicio_correcciones_pending"] as const,
  egreso: ["inicio_egreso_metrics"] as const,
  drafts: ["inicio_drafts_preview"] as const,
  contacts: ["inicio_total_chats_pps"] as const,
};

export const inicioQueries = {
  brief: () =>
    queryOptions({
      queryKey: inicioKeys.brief,
      queryFn: fetchInicioBrief,
      staleTime: 5 * 60 * 1000,
    }),
  solicitudes: () =>
    queryOptions({
      queryKey: inicioKeys.solicitudes,
      queryFn: fetchInicioSolicitudes,
      staleTime: 2 * 60 * 1000,
    }),
  instituciones: () =>
    queryOptions({
      queryKey: inicioKeys.instituciones,
      queryFn: fetchInicioInstituciones,
      staleTime: 10 * 60 * 1000,
    }),
  correcciones: () =>
    queryOptions({
      queryKey: inicioKeys.correcciones,
      queryFn: fetchInicioCorrecciones,
      staleTime: 2 * 60 * 1000,
    }),
  egreso: () =>
    queryOptions({
      queryKey: inicioKeys.egreso,
      queryFn: fetchInicioEgreso,
      staleTime: 2 * 60 * 1000,
    }),
  drafts: () =>
    queryOptions({ queryKey: inicioKeys.drafts, queryFn: fetchInicioDrafts, staleTime: 60 * 1000 }),
  contacts: () =>
    queryOptions({
      queryKey: inicioKeys.contacts,
      queryFn: fetchInicioContacts,
      staleTime: 30 * 60 * 1000,
    }),
};

export function invalidateInicioData(client: QueryClient) {
  return Promise.all(
    Object.values(inicioKeys).map((queryKey) => client.invalidateQueries({ queryKey }))
  );
}
