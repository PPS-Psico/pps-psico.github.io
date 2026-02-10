import React, { createContext, useContext, ReactNode, useMemo, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useStudentData } from "../hooks/useStudentData";
import { useStudentPracticas } from "../hooks/useStudentPracticas";
import { useStudentSolicitudes } from "../hooks/useStudentSolicitudes";
import { useConvocatorias } from "../hooks/useConvocatorias";
import { calculateCriterios, initialCriterios } from "../utils/criteriaCalculations";
import { processAndLinkStudentData } from "../utils/dataLinker";
import { FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES } from "../constants";
import { useAppConfig } from "../contexts/ConfigContext";

import type { UseMutationResult } from "@tanstack/react-query";
import type {
  EstudianteFields,
  Practica,
  SolicitudPPS,
  LanzamientoPPS,
  Convocatoria,
  Orientacion,
  InformeTask,
  AirtableRecord,
  CriteriosCalculados,
} from "../types";

interface StudentPanelContextType {
  // Data
  studentDetails: EstudianteFields | null;
  practicas: Practica[];
  solicitudes: SolicitudPPS[];
  lanzamientos: LanzamientoPPS[];
  allLanzamientos: LanzamientoPPS[];
  enrollmentMap: Map<string, Convocatoria>;
  completedLanzamientoIds: Set<string>;
  informeTasks: InformeTask[];
  criterios: CriteriosCalculados;
  institutionAddressMap: Map<string, string>;

  // Aggregated states
  isLoading: boolean;
  error: Error | null;

  // Mutations and refetch functions
  updateOrientation: UseMutationResult<any, Error, Orientacion | "", unknown>;
  updateInternalNotes: UseMutationResult<any, Error, string, unknown>;
  updateNota: UseMutationResult<
    (AirtableRecord<any> | null)[],
    Error,
    { practicaId: string; nota: string; convocatoriaId?: string },
    unknown
  >;
  updateFechaFin: UseMutationResult<any, Error, { practicaId: string; fecha: string }, unknown>;
  enrollStudent: { mutate: (lanzamiento: LanzamientoPPS) => void; isPending: boolean };
  confirmInforme: UseMutationResult<any, Error, InformeTask, any>;
  refetchAll: () => void;
  refetchPracticas: () => void;
}

const StudentPanelContext = createContext<StudentPanelContextType | undefined>(undefined);

/**
 * Provides all data related to a specific student panel.
 * This component acts as a single data-fetching orchestrator for the student dashboard.
 */
export const StudentPanelProvider: React.FC<{ legajo: string; children: ReactNode }> = ({
  legajo,
  children,
}) => {
  const { isSuperUserMode } = useAuth();
  const config = useAppConfig();

  // Call all the individual data hooks in one central place.
  const {
    studentDetails,
    studentAirtableId,
    isStudentLoading,
    studentError,
    updateOrientation,
    updateInternalNotes,
    refetchStudent,
  } = useStudentData(legajo);
  const {
    practicas,
    isPracticasLoading,
    practicasError,
    updateNota,
    updateFechaFin,
    refetchPracticas,
  } = useStudentPracticas(legajo);
  const { solicitudes, isSolicitudesLoading, solicitudesError, refetchSolicitudes } =
    useStudentSolicitudes(legajo, studentAirtableId);
  const {
    lanzamientos,
    myEnrollments,
    allLanzamientos,
    isConvocatoriasLoading,
    convocatoriasError,
    enrollStudent,
    confirmInforme,
    refetchConvocatorias,
    institutionAddressMap,
    // FIX: Pass the `studentDetails` object to the `useConvocatorias` hook as the third argument.
  } = useConvocatorias(legajo, studentAirtableId, studentDetails, isSuperUserMode);

  // Aggregate loading and error states into a single source of truth.
  const isLoading =
    isStudentLoading || isPracticasLoading || isSolicitudesLoading || isConvocatoriasLoading;
  const error = studentError || practicasError || solicitudesError || convocatoriasError;

  // Create a memoized function to refetch all data at once.
  const refetchAll = useCallback(() => {
    refetchStudent();
    refetchPracticas();
    refetchSolicitudes();
    refetchConvocatorias();
  }, [refetchStudent, refetchPracticas, refetchSolicitudes, refetchConvocatorias]);

  // Safely access the orientation field
  const selectedOrientacion = (
    studentDetails && studentDetails[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]
      ? studentDetails[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]
      : ""
  ) as Orientacion | "";

  const criterios = useMemo(
    () =>
      isLoading ? initialCriterios : calculateCriterios(practicas, selectedOrientacion, config),
    [practicas, selectedOrientacion, isLoading, config]
  );

  const { enrollmentMap, completedLanzamientoIds, informeTasks } = useMemo(() => {
    if (isConvocatoriasLoading || isPracticasLoading) {
      return {
        enrollmentMap: new Map<string, Convocatoria>(),
        completedLanzamientoIds: new Set<string>(),
        informeTasks: [] as InformeTask[],
      };
    }
    return processAndLinkStudentData({ myEnrollments, allLanzamientos, practicas });
  }, [myEnrollments, allLanzamientos, practicas, isConvocatoriasLoading, isPracticasLoading]);

  const value = {
    studentDetails,
    practicas,
    solicitudes,
    lanzamientos,
    allLanzamientos,
    institutionAddressMap,
    isLoading,
    error,
    updateOrientation,
    updateInternalNotes,
    updateNota,
    updateFechaFin,
    enrollStudent,
    confirmInforme,
    refetchAll,
    refetchPracticas,
    criterios,
    enrollmentMap,
    completedLanzamientoIds,
    informeTasks,
  };

  return (
    <StudentPanelContext.Provider value={value as StudentPanelContextType}>
      {children}
    </StudentPanelContext.Provider>
  );
};

/**
 * Custom hook to consume the StudentPanelContext.
 * Components within the StudentPanelProvider tree can use this to access all student data.
 */
export const useStudentPanel = (): StudentPanelContextType => {
  const context = useContext(StudentPanelContext);
  if (!context) {
    throw new Error("useStudentPanel must be used within a StudentPanelProvider");
  }
  return context;
};
