import { useQuery } from "@tanstack/react-query";
import { fetchFinalizacionRequest } from "../services";
import { FinalizacionPPS } from "../types";

export const useStudentFinalizacion = (legajo: string, studentId: string | null) => {
  const {
    data: finalizacionRequest = null,
    isLoading: isFinalizationLoading,
    error: finalizationError,
    refetch: refetchFinalizacion,
  } = useQuery({
    queryKey: ["finalizacionRequest", legajo],
    queryFn: () => fetchFinalizacionRequest(legajo, studentId),
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
