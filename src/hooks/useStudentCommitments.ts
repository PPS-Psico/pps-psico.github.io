import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useModal } from "../contexts/ModalContext";
import type { Convocatoria, Estudiante, LanzamientoPPS, CompromisoPPS } from "../types";
import {
  fetchStudentCompromisos,
  sendCompromisoAcceptanceEmail,
  submitCompromisoPPS,
} from "../services";
import { getHorarioEfectivo } from "../utils/scheduleUtils";
import { logger } from "../utils/logger";

export const useStudentCommitments = (
  studentId: string | null,
  legajo: string,
  studentDetails: Estudiante | null,
  allLanzamientos: LanzamientoPPS[],
  myEnrollments: Convocatoria[]
) => {
  const queryClient = useQueryClient();
  const { showModal } = useModal();

  const {
    data: compromisos = [],
    isLoading: isCommitmentsLoading,
    error: commitmentsError,
    refetch: refetchCompromisos,
  } = useQuery({
    queryKey: ["compromisos", legajo, studentId],
    queryFn: async () => {
      if (!studentId || legajo === "99999") return [];
      const data = await fetchStudentCompromisos(studentId);
      try {
        sessionStorage.setItem(`pps_cache_commitments_${legajo}`, JSON.stringify(data));
      } catch (e) {}
      return data;
    },
    initialData: () => {
      try {
        const cached = sessionStorage.getItem(`pps_cache_commitments_${legajo}`);
        return cached ? JSON.parse(cached) : undefined;
      } catch (e) {
        return undefined;
      }
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
  });

  const acceptCompromiso = useMutation({
    mutationFn: async (payload: {
      convocatoriaId: string;
      lanzamientoId: string;
      fullName: string;
      dni: number | null;
      legajo: string;
      signature: string;
    }) => {
      if (!studentId) throw new Error("No se pudo identificar al estudiante.");

      const saved = await submitCompromisoPPS({
        studentId,
        convocatoriaId: payload.convocatoriaId,
        lanzamientoId: payload.lanzamientoId,
        fullName: payload.fullName,
        dni: payload.dni,
        legajo: payload.legajo,
        signature: payload.signature,
      });

      try {
        const launch = allLanzamientos.find((item) => item.id === payload.lanzamientoId);
        const enrollment = myEnrollments.find((item) => item.id === payload.convocatoriaId);

        if (studentDetails?.correo) {
          await sendCompromisoAcceptanceEmail({
            studentEmail: studentDetails.correo,
            studentName: studentDetails.nombre || payload.fullName,
            ppsName: launch?.nombre_pps || enrollment?.nombre_pps || "PPS seleccionada",
            schedule: enrollment ? getHorarioEfectivo(enrollment) : null,
            encuentroInicial: launch?.fecha_encuentro_inicial || null,
            acceptedAt: saved.accepted_at || new Date().toISOString(),
            fullName: payload.fullName,
            dni: payload.dni,
            legajo: payload.legajo,
          });
        }
      } catch (error) {
        logger.warn("[useStudentCommitments] Commitment saved but email failed", error);
      }

      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compromisos", legajo, studentId] });
      showModal(
        "Compromiso registrado",
        "Tu confirmación quedó registrada. Te enviaremos una constancia por correo y podrás seguir el inicio de la PPS desde Mis prácticas."
      );
    },
    onError: (error) => {
      showModal("Error", `No se pudo registrar el compromiso: ${error.message}`);
    },
  });

  const compromisoMap = new Map(
    compromisos.map((item: CompromisoPPS) => [item.convocatoria_id, item])
  );

  return {
    compromisos,
    compromisoMap,
    isCommitmentsLoading,
    commitmentsError,
    acceptCompromiso,
    refetchCompromisos,
  };
};
