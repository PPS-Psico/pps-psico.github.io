import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStudentData } from "../services/dataService";
import { db } from "../lib/db";
import { mockDb } from "../services/mockDb";
import type { Orientacion } from "../types";
import { useModal } from "../contexts/ModalContext";
import {
  FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
  FIELD_NOTAS_INTERNAS_ESTUDIANTES,
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
} from "../constants";

const hasData = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  const str = String(val)
    .replace(/[\[\]"']/g, "")
    .trim();
  return str.length > 2;
};

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
    queryFn: async () => {
      if (legajo === "99999") {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockStudent = (await mockDb.getAll("estudiantes", { legajo: "99999" }))[0];
        return { studentDetails: mockStudent, studentId: mockStudent.id };
      }
      return fetchStudentData(legajo);
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const studentDetails = data?.studentDetails ?? null;
  const studentId = data?.studentId ?? null;

  useEffect(() => {
    if (studentDetails && studentId && legajo !== "99999") {
      const currentStatusInDb = studentDetails[FIELD_ESTADO_ESTUDIANTES];
      const hasContactInfo =
        hasData(studentDetails[FIELD_DNI_ESTUDIANTES]) ||
        hasData(studentDetails[FIELD_CORREO_ESTUDIANTES]) ||
        hasData(studentDetails[FIELD_TELEFONO_ESTUDIANTES]);

      if (currentStatusInDb === "Nuevo (Sin cuenta)" && hasContactInfo) {
        console.log(`Sanando estado para legajo ${legajo}...`);
        db.estudiantes.update(studentId, { [FIELD_ESTADO_ESTUDIANTES]: "Inactivo" }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["metricsData"] });
        });
      }
    }
  }, [studentDetails, studentId, legajo, queryClient]);

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
