import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FIELD_ESTADO_PRACTICA,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_INFORME_SUBIDO_CONVOCATORIAS,
  FIELD_NOTA_PRACTICAS,
} from "../constants";
import { useModal } from "../contexts/ModalContext";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import { fetchPracticas } from "../services";
import { mockDb } from "../services/mockDb";
import type { Practica } from "../types";
import { normalizeStringForComparison, parseToUTCDate } from "../utils/formatters";
import { logger } from "../utils/logger";

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

      // --- AUTO-FIX LOGIC (Same for Mock and Prod) ---
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const updates: Promise<unknown>[] = [];

      for (const p of data) {
        const status = normalizeStringForComparison(p[FIELD_ESTADO_PRACTICA]);
        if (status === "en curso" && p[FIELD_FECHA_FIN_PRACTICAS]) {
          const endDate = parseToUTCDate(p[FIELD_FECHA_FIN_PRACTICAS]);
          if (endDate && endDate < now) {
            if (legajo === "99999") {
              await mockDb.update("practicas", p.id, { [FIELD_ESTADO_PRACTICA]: "Finalizada" });
            } else {
              updates.push(db.practicas.update(p.id, { [FIELD_ESTADO_PRACTICA]: "Finalizada" }));
            }
            // Optimistically update local
            p[FIELD_ESTADO_PRACTICA] = "Finalizada";
          }
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
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

  const updateNota = useMutation({
    mutationFn: async ({
      practicaId,
      nota,
      convocatoriaId,
    }: {
      practicaId: string;
      nota: string;
      convocatoriaId?: string;
    }) => {
      if (legajo === "99999") {
        await mockDb.update("practicas", practicaId, { [FIELD_NOTA_PRACTICAS]: nota });
        if (nota === "No Entregado" && convocatoriaId) {
          await mockDb.update("convocatorias", convocatoriaId, {
            [FIELD_INFORME_SUBIDO_CONVOCATORIAS]: false,
          });
        }
        return;
      }

      const valueToSend = nota === "Sin calificar" ? null : nota;
      const promises: Promise<any>[] = [
        db.practicas.update(practicaId, { [FIELD_NOTA_PRACTICAS]: valueToSend }),
      ];

      if (nota === "No Entregado" && convocatoriaId) {
        promises.push(
          db.convocatorias.update(convocatoriaId, { [FIELD_INFORME_SUBIDO_CONVOCATORIAS]: false })
        );
      }
      return Promise.all(promises);
    },
    onSuccess: (_, variables) => {
      if (variables.nota === "No Entregado") {
        showModal(
          "Actualización Exitosa",
          'El estado del informe se ha cambiado a "No Entregado".'
        );
      }
      queryClient.invalidateQueries({ queryKey: ["practicas", legajo] });
      queryClient.invalidateQueries({ queryKey: ["convocatorias", legajo] });
    },
    onError: () => showModal("Error", "No se pudo actualizar la nota."),
  });

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

  const deletePractica = useMutation({
    mutationFn: async (practicaId: string) => {
      if (legajo === "99999") {
        return mockDb.delete("practicas", practicaId);
      }
      return db.practicas.delete(practicaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practicas", legajo] });
      showModal("Práctica Eliminada", "La práctica se ha eliminado correctamente.");
    },
    onError: (err) => showModal("Error", `No se pudo eliminar la práctica: ${err.message}`),
  });

  return {
    practicas,
    isPracticasLoading: isPracticasInitialLoad,
    practicasError: blockingPracticasError,
    updateNota,
    updateFechaFin,
    deletePractica,
    refetchPracticas,
  };
};
