import { useQuery } from "@tanstack/react-query";
import { fetchFinalizacionRequest } from "../services";
import { mockDb } from "../services/mockDb";
import { FinalizacionPPS } from "../types";
import { FIELD_ESTUDIANTE_FINALIZACION } from "../constants";

export const useStudentFinalizacion = (legajo: string, studentId: string | null) => {
  const {
    data: finalizacionRequest = null,
    isLoading: isFinalizationLoading,
    error: finalizationError,
    refetch: refetchFinalizacion,
  } = useQuery({
    queryKey: ["finalizacionRequest", legajo],
    queryFn: async () => {
      let data;
      if (legajo === "99999") {
        const recs = (await mockDb.getAll("finalizacion_pps", {
          [FIELD_ESTUDIANTE_FINALIZACION]: "st_999",
        })) as FinalizacionPPS[];
        data = recs && recs.length ? recs[0] : null;
      } else {
        data = await fetchFinalizacionRequest(legajo, studentId);
      }
      try {
        sessionStorage.setItem(`pps_cache_finalizacion_${legajo}`, JSON.stringify(data));
      } catch (e) {}
      return data;
    },
    initialData: () => {
      try {
        const cached = sessionStorage.getItem(`pps_cache_finalizacion_${legajo}`);
        return cached ? JSON.parse(cached) : undefined;
      } catch (e) {
        return undefined;
      }
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    finalizacionRequest,
    isFinalizationLoading,
    finalizationError,
    refetchFinalizacion,
  };
};
