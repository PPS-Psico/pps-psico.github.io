import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStudentData } from "../services";
import { db } from "../lib/db";
import { supabase } from "../lib/supabaseClient";
import { mockDb } from "../services/mockDb";
import type { Orientacion } from "../types";
import { useModal } from "../contexts/ModalContext";
import { logger } from "../utils/logger";
import {
  FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
  FIELD_NOTAS_INTERNAS_ESTUDIANTES,
} from "../constants";

export const useStudentData = (legajo: string) => {
  const queryClient = useQueryClient();
  const { showModal } = useModal();

  const {
    data,
    isLoading: isStudentLoading,
    error: studentError,
    refetch: refetchStudent,
  } = useQuery({
    queryKey: ["student", legajo],
    queryFn: async ({ signal }) => {
      let result;
      if (legajo === "99999") {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockStudent = (await mockDb.getAll("estudiantes", { legajo: "99999" }))[0];
        result = { studentDetails: mockStudent, studentId: mockStudent.id };
      } else {
        result = await fetchStudentData(legajo);
      }
      if (signal.aborted) throw new Error("La carga del estudiante fue cancelada.");

      if (!result?.studentId) {
        const {
          data: { user },
          error: sessionError,
        } = await supabase.auth.getUser();
        if (signal.aborted) throw new Error("La carga del estudiante fue cancelada.");
        if (sessionError || !user) {
          logger.warn(
            "[StudentData] Resultado vacío descartado porque la sesión cambió durante la carga"
          );
          throw new Error("La sesión cambió mientras se cargaba el estudiante.");
        }
      }

      // Un resultado vacío no debe destruir un perfil válido persistido. Si el
      // estudiante realmente no existe, se muestra el error sin envenenar el
      // siguiente arranque.
      if (result?.studentId) {
        try {
          sessionStorage.setItem(`pps_cache_student_${legajo}`, JSON.stringify(result));
        } catch {}
      }
      return result;
    },
    initialData: () => {
      try {
        const cached = sessionStorage.getItem(`pps_cache_student_${legajo}`);
        return cached ? JSON.parse(cached) : undefined;
      } catch {
        return undefined;
      }
    },
    // Pintar la última copia conocida de inmediato, pero confirmar siempre el
    // perfil contra Supabase al volver a montar el panel.
    initialDataUpdatedAt: 0,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const studentDetails = data?.studentDetails ?? null;
  const studentId = data?.studentId ?? null;

  // Acá vivía un "saneo" de estado: si el alumno figuraba 'Nuevo (Sin cuenta)'
  // y tenía algún dato de contacto, se le escribía 'Inactivo'. Se eliminó.
  //
  // 'Inactivo' no significa "perfil a medio cargar": `useConvocatorias` lo lee
  // como cuenta deshabilitada y corta la inscripción con "Comunicate con
  // coordinación", un cartel sin salida. El saneo dejaba alumnos en ese estado
  // sin que nadie lo decidiera.
  //
  // Peor: escribía desde un camino de LECTURA y sobre la fila que estuviera
  // cargada, no la propia. Coordinación abriendo /admin/student/:legajo para
  // mirar un panel montaba este mismo hook y desactivaba a ese alumno de paso.
  //
  // Ya no hace falta: desde `harden_student_signup_flow` (14 may 2026) el alta
  // deja al alumno en 'Activo', y `AtlasProfileView` lo reactiva cuando
  // completa DNI + correo + teléfono. Para los pre-cargados sin cuenta sigue
  // estando el botón de coordinación en DataIntegrityTool, con intención
  // explícita detrás.

  const updateOrientation = useMutation({
    mutationFn: async (orientacion: Orientacion | "") => {
      if (!studentId) throw new Error("ID no disponible.");
      return db.estudiantes.update(studentId, {
        [FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]: orientacion || null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["student", legajo] }),
    onError: (error) => showModal("Error", `No se pudo guardar: ${error.message}`),
  });

  const updateInternalNotes = useMutation({
    mutationFn: async (notes: string) => {
      if (!studentId) throw new Error("ID no disponible.");
      return db.estudiantes.update(studentId, {
        [FIELD_NOTAS_INTERNAS_ESTUDIANTES]: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", legajo] });
      showModal("Exito", "Notas guardadas correctamente.");
    },
    onError: (error) => showModal("Error", `Error: ${error.message}`),
  });

  return {
    studentDetails,
    studentId,
    isStudentLoading,
    studentError,
    updateOrientation,
    updateInternalNotes,
    refetchStudent,
  };
};
