import { useQuery } from "@tanstack/react-query";
import { fetchSolicitudes, fetchSolicitudesNuevaPPSByStudent } from "../services";
import { mockDb } from "../services/mockDb";
import { FIELD_LEGAJO_PPS, FIELD_ESTADO_PPS } from "../constants";
import type { SolicitudPPS, SolicitudNuevaPPS } from "../types";

export const useStudentSolicitudes = (legajo: string, studentId: string | null) => {
  const {
    data: solicitudes = [],
    isLoading: isSolicitudesLoading,
    error: solicitudesError,
    refetch: refetchSolicitudes,
  } = useQuery({
    queryKey: ["solicitudes", legajo],
    queryFn: async () => {
      let data;
      if (legajo === "99999") {
        const recs: SolicitudPPS[] = await mockDb.getAll("solicitudes_pps", {
          [FIELD_LEGAJO_PPS]: "st_999",
        });
        data = recs.filter((r) => r[FIELD_ESTADO_PPS] !== "Archivado");
      } else {
        data = await fetchSolicitudes(legajo, studentId);
      }
      try {
        sessionStorage.setItem(`pps_cache_solicitudes_${legajo}`, JSON.stringify(data));
      } catch (e) {}
      return data;
    },
    initialData: () => {
      try {
        const cached = sessionStorage.getItem(`pps_cache_solicitudes_${legajo}`);
        return cached ? JSON.parse(cached) : undefined;
      } catch (e) {
        return undefined;
      }
    },
    enabled: !!legajo,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  const {
    data: solicitudesNueva = [],
    isLoading: isSolicitudesNuevaLoading,
    error: solicitudesNuevaError,
    refetch: refetchSolicitudesNueva,
  } = useQuery<SolicitudNuevaPPS[]>({
    queryKey: ["solicitudes_nueva_pps_student", studentId],
    queryFn: async () => {
      if (legajo === "99999") return [];
      if (!studentId) return [];
      return (await fetchSolicitudesNuevaPPSByStudent(studentId)) as unknown as SolicitudNuevaPPS[];
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  return {
    solicitudes,
    isSolicitudesLoading,
    solicitudesError,
    refetchSolicitudes,
    solicitudesNueva,
    isSolicitudesNuevaLoading,
    solicitudesNuevaError,
    refetchSolicitudesNueva,
  };
};
