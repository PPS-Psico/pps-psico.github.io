
import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { StudentDataProvider, useStudentContextData } from './StudentDataContext';
import { StudentAcademicProvider, useStudentAcademicData } from './StudentAcademicContext';

import type { UseMutationResult } from '@tanstack/react-query';
import type {
    Practica, SolicitudPPS, LanzamientoPPS, Convocatoria, InformeTask, AirtableRecord, CriteriosCalculados, FinalizacionPPS, Estudiante, Orientacion
} from '../types';

// Combined interface for backward compatibility
interface StudentPanelContextType {
    // Data (Merged from both contexts)
    studentDetails: Estudiante | null;
    studentAirtableId: string | null;
    practicas: Practica[];
    solicitudes: SolicitudPPS[];
    lanzamientos: LanzamientoPPS[];
    allLanzamientos: LanzamientoPPS[];
    enrollmentMap: Map<string, Convocatoria>;
    completedLanzamientoIds: Set<string>;
    informeTasks: InformeTask[];
    criterios: CriteriosCalculados;
    institutionAddressMap: Map<string, string>;
    finalizacionRequest: FinalizacionPPS | null;

    // States (Merged)
    isLoading: boolean;
    error: Error | null;

    // Mutations and refetch functions (Proxied)
    updateOrientation: UseMutationResult<any, Error, Orientacion | "", unknown>;
    updateInternalNotes: UseMutationResult<any, Error, string, unknown>;
    updateNota: UseMutationResult<(AirtableRecord<any> | null)[], Error, { practicaId: string; nota: string; convocatoriaId?: string; }, unknown>;
    updateFechaFin: UseMutationResult<any, Error, { practicaId: string; fecha: string; }, unknown>;
    enrollStudent: { mutate: (lanzamiento: LanzamientoPPS) => void; isPending: boolean; };
    confirmInforme: UseMutationResult<any, Error, InformeTask, any>;
    refetchAll: () => void;
}

// Inner hook that merges the two contexts into one object
const useCombinedStudentContext = (): StudentPanelContextType => {
    const dataContext = useStudentContextData();
    const academicContext = useStudentAcademicData();

    const refetchAll = useCallback(() => {
        dataContext.refetchStudent();
        academicContext.refetchAcademic();
    }, [dataContext, academicContext]);

    return {
        // Data from DataContext
        studentDetails: dataContext.studentDetails,
        studentAirtableId: dataContext.studentAirtableId,
        updateOrientation: dataContext.updateOrientation,
        updateInternalNotes: dataContext.updateInternalNotes,

        // Data from AcademicContext
        practicas: academicContext.practicas,
        solicitudes: academicContext.solicitudes,
        lanzamientos: academicContext.lanzamientos,
        allLanzamientos: academicContext.allLanzamientos,
        enrollmentMap: academicContext.enrollmentMap,
        completedLanzamientoIds: academicContext.completedLanzamientoIds,
        informeTasks: academicContext.informeTasks,
        criterios: academicContext.criterios,
        institutionAddressMap: academicContext.institutionAddressMap,
        finalizacionRequest: academicContext.finalizacionRequest,
        updateNota: academicContext.updateNota,
        updateFechaFin: academicContext.updateFechaFin,
        enrollStudent: academicContext.enrollStudent,
        confirmInforme: academicContext.confirmInforme,

        // Merged States
        isLoading: dataContext.isStudentLoading || academicContext.isAcademicLoading,
        error: dataContext.studentError || academicContext.academicError,

        // Merged Refetch
        refetchAll
    };
};

/**
 * Provides all data related to a specific student panel.
 * Now acts as a Composed Provider wrapping Data and Academic layers.
 */
export const StudentPanelProvider: React.FC<{ legajo: string; children: ReactNode }> = ({ legajo, children }) => {
    return (
        <StudentDataProvider legajo={legajo}>
            <StudentAcademicProvider legajo={legajo}>
                {children}
            </StudentAcademicProvider>
        </StudentDataProvider>
    );
};

/**
 * Custom hook to consume the unified StudentPanel data.
 * Maintains backward compatibility for existing components.
 */
export const useStudentPanel = (): StudentPanelContextType => {
    // This hook must be used inside the StudentAcademicProvider (which is inside StudentDataProvider)
    // We use the custom composition hook here.
    return useCombinedStudentContext();
};
