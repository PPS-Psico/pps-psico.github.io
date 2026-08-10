import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FIELD_ESTADO_PRACTICA,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
} from "../constants";
import { useModal } from "../contexts/ModalContext";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import { fetchPracticas } from "../services";
import { mockDb } from "../services/mockDb";
import type { Practica } from "../types";
import { logger } from "../utils/logger";
import { getEffectivePracticeStatus } from "../logic/studentRules";

export const useStudentPracticas = (legajo: string, studentId: string | null) => {
  const queryClient = useQueryClient();
  const { showModal } = useModal();
  const cacheKey = studentId ? `pps_cache_practicas_${legajo}_${studentId}` : null;

  const readCachedPracticas = (): Practica[] | undefined => {
    if (!cacheKey) return undefined;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (!cached) return undefined;
      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed)) return undefined;
      logger.info(`[Practicas] Caché local encontrada: ${parsed.length} registro(s)`);
      return parsed as Practica[];
    } catch (error) {
      logger.warn("[Practicas] No se pudo leer la caché local", error);
      return undefined;
    }
  };

  const assertRequestActive = (signal: AbortSignal) => {
    if (signal.aborted) throw new Error("La carga de prácticas fue cancelada.");
  };

  const {
    data: practicas = [],
    isLoading: isPracticasLoading,
    isFetching: isPracticasFetching,
    error: practicasError,
    refetch: refetchPracticas,
  } = useQuery({
    queryKey: ["practicas", legajo, studentId],
    queryFn: async ({ signal }) => {
      let data: Practica[] = [];
      const cachedBeforeFetch = readCachedPracticas();

      logger.info(
        `[Practicas] Iniciando carga (legajo=${legajo}, studentId=${studentId ?? "pendiente"})`
      );

      if (legajo === "99999") {
        // Testing Mode
        await new Promise((resolve) => setTimeout(resolve, 600));
        data = await mockDb.getAll("practicas", { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: "st_999" });
      } else if (studentId) {
        data = await fetchPracticas(studentId, signal);
      } else {
        throw new Error("No se puede consultar prácticas sin studentId.");
      }

      assertRequestActive(signal);

      // Una lista vacía puede ser legítima, pero si había prácticas conocidas
      // verificamos antes que la sesión siga siendo válida. Así una limpieza o
      // cambio de sesión concurrente no destruye la última copia correcta.
      if (data.length === 0 && cachedBeforeFetch && cachedBeforeFetch.length > 0) {
        const {
          data: { user },
          error: sessionError,
        } = await supabase.auth.getUser();
        assertRequestActive(signal);

        if (sessionError || !user) {
          logger.warn(
            "[Practicas] Respuesta vacía descartada porque la sesión cambió durante la carga"
          );
          throw new Error("La sesión cambió mientras se cargaban las prácticas.");
        }
      }

      // --- Cierre por calendario (solo presentación) ---
      // El cierre real lo hace el servidor: `public.close_finished_practicas()`,
      // agendada a diario (migración 20260804120000). NO se intenta escribirlo
      // desde acá: el trigger `trg_check_practica_updates` revierte `estado`
      // para toda sesión donde `is_admin()` sea false —o sea, la del alumno—
      // devolviendo 200 sin guardar nada. Ese UPDATE mudo fue exactamente el
      // bug que dejó 360 prácticas terminadas marcadas "En curso".
      //
      // Lo que sí corresponde acá es tapar la ventana entre el fin de la PPS y
      // la próxima corrida del cron, para que el alumno no vea "En curso" una
      // práctica que ya terminó ayer.
      const cerradasPorCalendario: Practica[] = [];
      for (const p of data) {
        const efectivo = getEffectivePracticeStatus(p);
        if (efectivo === p[FIELD_ESTADO_PRACTICA]) continue;
        p[FIELD_ESTADO_PRACTICA] = efectivo as Practica[typeof FIELD_ESTADO_PRACTICA];
        cerradasPorCalendario.push(p);
      }

      // En modo testing no hay trigger ni cron, así que el mock sí se persiste.
      if (legajo === "99999" && cerradasPorCalendario.length > 0) {
        await Promise.all(
          cerradasPorCalendario.map((p) =>
            mockDb.update("practicas", p.id, { [FIELD_ESTADO_PRACTICA]: "Finalizada" })
          )
        );
      }

      if (cacheKey) {
        assertRequestActive(signal);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
          logger.info(`[Practicas] Caché actualizada: ${data.length} registro(s)`);
        } catch (error) {
          logger.warn("[Practicas] No se pudo actualizar la caché local", error);
        }
      }

      return data;
    },
    initialData: readCachedPracticas,
    // La caché sirve para pintar el último valor conocido, pero siempre nace
    // vencida para que entrar al panel dispare una consulta real a Supabase.
    initialDataUpdatedAt: 0,
    enabled: legajo === "99999" || !!studentId,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  // Si hay un valor anterior válido, un error de revalidación no debe convertir
  // las horas en cero ni bloquear el panel. Sin datos previos, sí es un error.
  const blockingPracticasError = practicas.length === 0 ? practicasError : null;
  const isPracticasInitialLoad =
    isPracticasLoading || (isPracticasFetching && practicas.length === 0);

  const updateFechaFin = useMutation({
    mutationFn: async ({ practicaId, fecha }: { practicaId: string; fecha: string }) => {
      if (legajo === "99999") {
        return mockDb.update("practicas", practicaId, { [FIELD_FECHA_FIN_PRACTICAS]: fecha });
      }
      return db.practicas.update(practicaId, { [FIELD_FECHA_FIN_PRACTICAS]: fecha });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practicas", legajo] });
      showModal("Fecha Actualizada", "La fecha de finalización se ha modificado correctamente.");
    },
    onError: (err) => showModal("Error", `No se pudo actualizar la fecha: ${err.message}`),
  });

  return {
    practicas,
    isPracticasLoading: isPracticasInitialLoad,
    practicasError: blockingPracticasError,
    updateFechaFin,
    refetchPracticas,
  };
};
