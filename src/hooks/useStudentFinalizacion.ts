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
      // Modo testing (alumno de prueba): leemos del mockDb en vez de Supabase,
      // alineado con useStudentSolicitudes. Evita un 400 por consultar la tabla
      // real con el id mock "st_999" (no es un UUID válido).
      if (legajo === "99999") {
        const recs = (await mockDb.getAll("finalizacion_pps", {
          [FIELD_ESTUDIANTE_FINALIZACION]: "st_999",
        })) as FinalizacionPPS[];
        return recs && recs.length ? recs[0] : null;
      }
      return fetchFinalizacionRequest(legajo, studentId);
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
