import React, { createContext, ReactNode, useCallback, useContext, useMemo } from "react";
import { FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES } from "../constants";
import { useAuth } from "../contexts/AuthContext";
import { useAppConfig } from "../contexts/ConfigContext";
import { useConvocatorias } from "../hooks/useConvocatorias";
import { useStudentData } from "../hooks/useStudentData";
import { useStudentFinalizacion } from "../hooks/useStudentFinalizacion";
import { useStudentPracticas } from "../hooks/useStudentPracticas";
import { useStudentSolicitudes } from "../hooks/useStudentSolicitudes";
import { useStudentCommitments } from "../hooks/useStudentCommitments";
import { calculateCriterios, initialCriterios } from "../utils/criteriaCalculations";
import { processAndLinkStudentData } from "../utils/dataLinker";

import type {
  CompromisoPPS,
  Convocatoria,
  CriteriosCalculados,
  EstudianteFields,
  FinalizacionPPS,
  InformeTask,
  LanzamientoPPS,
  Orientacion,
  Practica,
  SolicitudPPS,
  SolicitudNuevaPPS,
  SolicitudModificacionPPS,
} from "../types";

interface StudentPanelContextType {
  // Data
  studentDetails: EstudianteFields | null;
  studentId: string | null;
  practicas: Practica[];
  solicitudes: SolicitudPPS[];
  solicitudesNueva: SolicitudNuevaPPS[];
  solicitudesModificacion: SolicitudModificacionPPS[];
  lanzamientos: LanzamientoPPS[];
  allLanzamientos: LanzamientoPPS[];
  enrollmentMap: Map<string, Convocatoria>;
  completedLanzamientoIds: Set<string>;
  completedOrientationsByInstitution: Map<string, Set<string>>;
  informeTasks: InformeTask[];
  criterios: CriteriosCalculados;
  institutionAddressMap: Map<string, string>;
  institutionLogoMap?: Map<string, { url: string; invert: boolean }>;
  finalizacionRequest: FinalizacionPPS | null;
  compromisoMap: Map<string, CompromisoPPS>;

  // Aggregated states
  isLoading: boolean;
  isStudentLoading: boolean;
  isPracticasLoading: boolean;
  isSolicitudesLoading: boolean;
  isConvocatoriasLoading: boolean;
  isFinalizationLoading: boolean;
  isCommitmentsLoading: boolean;
  error: Error | null;

  // Mutations and refetch functions (tipos derivados de los hooks fuente)
  updateOrientation: ReturnType<typeof useStudentData>["updateOrientation"];
  updateInternalNotes: ReturnType<typeof useStudentData>["updateInternalNotes"];
  updateFechaFin: ReturnType<typeof useStudentPracticas>["updateFechaFin"];
  enrollStudent: {
    mutate: (lanzamiento: LanzamientoPPS, completedOrientaciones?: string[]) => void;
    isPending: boolean;
  };
  cancelEnrollment: { mutate: (convocatoriaId: string) => void; isPending: boolean };
  acceptCompromiso: ReturnType<typeof useStudentCommitments>["acceptCompromiso"];
  refetchAll: () => void;
  refetchPracticas: () => void;
  refetchSolicitudesModificacion: () => void;
}

const StudentPanelContext = createContext<StudentPanelContextType | undefined>(undefined);

/**
 * Provides all data related to a specific student panel.
 * This component acts as a single data-fetching orchestrator for the student dashboard.
 */
const emptyContextValue: StudentPanelContextType = {
  studentDetails: null,
  studentId: null,
  practicas: [],
  solicitudes: [],
  solicitudesNueva: [],
  solicitudesModificacion: [],
  lanzamientos: [],
  allLanzamientos: [],
  enrollmentMap: new Map(),
  completedLanzamientoIds: new Set(),
  completedOrientationsByInstitution: new Map(),
  informeTasks: [],
  criterios: initialCriterios,
  institutionAddressMap: new Map(),
  finalizacionRequest: null,
  compromisoMap: new Map(),
  isLoading: false,
  isStudentLoading: false,
  isPracticasLoading: false,
  isSolicitudesLoading: false,
  isConvocatoriasLoading: false,
  isFinalizationLoading: false,
  isCommitmentsLoading: false,
  error: null,
  updateOrientation: { mutate: () => {}, isPending: false } as unknown as ReturnType<
    typeof useStudentData
  >["updateOrientation"],
  updateInternalNotes: { mutate: () => {}, isPending: false } as unknown as ReturnType<
    typeof useStudentData
  >["updateInternalNotes"],
  updateFechaFin: { mutate: () => {}, isPending: false } as unknown as ReturnType<
    typeof useStudentPracticas
  >["updateFechaFin"],
  enrollStudent: { mutate: () => {}, isPending: false },
  cancelEnrollment: { mutate: () => {}, isPending: false },
  acceptCompromiso: { mutate: () => {}, isPending: false } as unknown as ReturnType<
    typeof useStudentCommitments
  >["acceptCompromiso"],
  refetchAll: () => {},
  refetchPracticas: () => {},
  refetchSolicitudesModificacion: () => {},
};

export const StudentPanelProvider: React.FC<{ legajo?: string; children: ReactNode }> = ({
  legajo,
  children,
}) => {
  if (!legajo) {
    return (
      <StudentPanelContext.Provider value={emptyContextValue}>
        {children}
      </StudentPanelContext.Provider>
    );
  }

  return (
    <StudentPanelContextActiveProvider legajo={legajo}>
      {children}
    </StudentPanelContextActiveProvider>
  );
};

const StudentPanelContextActiveProvider: React.FC<{ legajo: string; children: ReactNode }> = ({
  legajo,
  children,
}) => {
  const { isSuperUserMode } = useAuth();
  const config = useAppConfig();

  // Call all the individual data hooks in one central place.
  const {
    studentDetails,
    studentId,
    isStudentLoading,
    studentError,
    updateOrientation,
    updateInternalNotes,
    refetchStudent,
  } = useStudentData(legajo);
  const { practicas, isPracticasLoading, practicasError, updateFechaFin, refetchPracticas } =
    useStudentPracticas(legajo, studentId);
  const {
    solicitudes,
    isSolicitudesLoading,
    solicitudesError,
    refetchSolicitudes,
    solicitudesNueva,
    solicitudesModificacion,
    isSolicitudesModificacionLoading,
    solicitudesModificacionError,
    refetchSolicitudesModificacion,
  } = useStudentSolicitudes(legajo, studentId);
  const {
    lanzamientos,
    myEnrollments,
    allLanzamientos,
    isConvocatoriasLoading,
    convocatoriasError,
    enrollStudent,
    cancelEnrollment,
    refetchConvocatorias,
    institutionAddressMap,
    institutionLogoMap,
  } = useConvocatorias(legajo, studentId, studentDetails, isSuperUserMode);

  // New Hook for Finalization
  const { finalizacionRequest, isFinalizationLoading, finalizationError, refetchFinalizacion } =
    useStudentFinalizacion(legajo, studentId);
  const {
    compromisoMap,
    isCommitmentsLoading,
    commitmentsError,
    acceptCompromiso,
    refetchCompromisos,
  } = useStudentCommitments(studentId, legajo, studentDetails, allLanzamientos, myEnrollments);

  // Aggregate loading and error states into a single source of truth.
  const isLoading =
    isStudentLoading ||
    isPracticasLoading ||
    isSolicitudesLoading ||
    isSolicitudesModificacionLoading ||
    isConvocatoriasLoading ||
    isFinalizationLoading ||
    isCommitmentsLoading;
  const error =
    studentError ||
    practicasError ||
    solicitudesError ||
    solicitudesModificacionError ||
    convocatoriasError ||
    finalizationError ||
    commitmentsError;

  // Create a memoized function to refetch all data at once.
  const refetchAll = useCallback(() => {
    refetchStudent();
    refetchPracticas();
    refetchSolicitudes();
    refetchSolicitudesModificacion();
    refetchConvocatorias();
    refetchFinalizacion();
    refetchCompromisos();
  }, [
    refetchStudent,
    refetchPracticas,
    refetchSolicitudes,
    refetchSolicitudesModificacion,
    refetchConvocatorias,
    refetchFinalizacion,
    refetchCompromisos,
  ]);

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

  const {
    enrollmentMap,
    completedLanzamientoIds,
    completedOrientationsByInstitution,
    informeTasks,
  } = useMemo(() => {
    if (isConvocatoriasLoading || isPracticasLoading) {
      return {
        enrollmentMap: new Map<string, Convocatoria>(),
        completedLanzamientoIds: new Set<string>(),
        completedOrientationsByInstitution: new Map<string, Set<string>>(),
        informeTasks: [] as InformeTask[],
      };
    }
    return processAndLinkStudentData({ myEnrollments, allLanzamientos, practicas });
  }, [myEnrollments, allLanzamientos, practicas, isConvocatoriasLoading, isPracticasLoading]);

  // Keep consumers isolated from unrelated parent renders. The source hooks
  // already expose stable references while their data is unchanged, so the
  // aggregate context should preserve that stability instead of rebuilding a
  // new value object on every provider render.
  const value = useMemo<StudentPanelContextType>(
    () => ({
      studentDetails,
      studentId,
      practicas,
      solicitudes,
      solicitudesNueva,
      solicitudesModificacion,
      lanzamientos,
      allLanzamientos,
      institutionAddressMap,
      institutionLogoMap,
      finalizacionRequest,
      compromisoMap,
      isLoading,
      isStudentLoading,
      isPracticasLoading,
      isSolicitudesLoading,
      isConvocatoriasLoading,
      isFinalizationLoading,
      isCommitmentsLoading,
      error,
      updateOrientation,
      updateInternalNotes,
      updateFechaFin,
      enrollStudent,
      cancelEnrollment,
      acceptCompromiso,
      refetchAll,
      refetchPracticas,
      refetchSolicitudesModificacion,
      criterios,
      enrollmentMap,
      completedLanzamientoIds,
      completedOrientationsByInstitution,
      informeTasks,
    }),
    [
      studentDetails,
      studentId,
      practicas,
      solicitudes,
      solicitudesNueva,
      solicitudesModificacion,
      lanzamientos,
      allLanzamientos,
      institutionAddressMap,
      institutionLogoMap,
      finalizacionRequest,
      compromisoMap,
      isLoading,
      isStudentLoading,
      isPracticasLoading,
      isSolicitudesLoading,
      isConvocatoriasLoading,
      isFinalizationLoading,
      isCommitmentsLoading,
      error,
      updateOrientation,
      updateInternalNotes,
      updateFechaFin,
      enrollStudent,
      cancelEnrollment,
      acceptCompromiso,
      refetchAll,
      refetchPracticas,
      refetchSolicitudesModificacion,
      criterios,
      enrollmentMap,
      completedLanzamientoIds,
      completedOrientationsByInstitution,
      informeTasks,
    ]
  );

  return <StudentPanelContext.Provider value={value}>{children}</StudentPanelContext.Provider>;
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
