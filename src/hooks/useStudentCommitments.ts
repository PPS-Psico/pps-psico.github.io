import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useModal } from "../contexts/ModalContext";
import type { Convocatoria, Estudiante, LanzamientoPPS } from "../types";
import {
  fetchStudentCompromisos,
  sendCompromisoAcceptanceEmailV3,
  submitCompromisoPPS,
} from "../services";
import { getHorarioEfectivo } from "../utils/scheduleUtils";

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
      return fetchStudentCompromisos(studentId);
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
          await sendCompromisoAcceptanceEmailV3({
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
        console.warn("[useStudentCommitments] Commitment saved but email failed", error);
      }

      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compromisos", legajo, studentId] });
      showModal(
        "Compromiso registrado",
        "Tu confirmación quedó registrada en Mi Panel. También te enviaremos una constancia por correo."
      );
    },
    onError: (error) => {
      showModal("Error", `No se pudo registrar el compromiso: ${error.message}`);
    },
  });

  const compromisoMap = new Map(compromisos.map((item) => [item.convocatoria_id, item]));

  return {
    compromisos,
    compromisoMap,
    isCommitmentsLoading,
    commitmentsError,
    acceptCompromiso,
    refetchCompromisos,
  };
};
