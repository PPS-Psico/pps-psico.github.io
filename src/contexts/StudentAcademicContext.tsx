
import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useStudentContextData } from './StudentDataContext';
import { useStudentPracticas } from '../hooks/useStudentPracticas';
import { useStudentSolicitudes } from '../hooks/useStudentSolicitudes';
import { useConvocatorias } from '../hooks/useConvocatorias';
import { calculateCriterios, initialCriterios } from '../utils/criteriaCalculations';
import { processAndLinkStudentData } from '../utils/dataLinker';
import { FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES } from '../constants';
import { useQuery, UseMutationResult } from '@tanstack/react-query';
import { fetchFinalizacionRequest } from '../services/dataService';
import type { Practica, SolicitudPPS, LanzamientoPPS, Convocatoria, InformeTask, AirtableRecord, CriteriosCalculados, FinalizacionPPS, Orientacion } from '../types';
import { useAppConfig } from './ConfigContext';

interface StudentAcademicContextType {
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
    isAcademicLoading: boolean;
    academicError: Error | null;
    updateNota: UseMutationResult<(AirtableRecord<any> | null)[], Error, { practicaId: string; nota: string; convocatoriaId?: string; }, unknown>;
    enrollStudent: { mutate: (lanzamiento: LanzamientoPPS) => void; isPending: boolean; };
    confirmInforme: UseMutationResult<any, Error, InformeTask, any>;
    refetchAcademic: () => void;
    updateFechaFin: UseMutationResult<any, Error, { practicaId: string; fecha: string; }, unknown>;
}

const StudentAcademicContext = createContext<StudentAcademicContextType | undefined>(undefined);

export const StudentAcademicProvider: React.FC<{ legajo: string; children: ReactNode }> = ({ legajo, children }) => {
    const { isSuperUserMode } = useAuth();
    const { studentDetails, studentAirtableId } = useStudentContextData();
    const config = useAppConfig();

    const { practicas, isPracticasLoading, practicasError, updateNota, updateFechaFin, refetchPracticas } = useStudentPracticas(legajo);
    const { solicitudes, isSolicitudesLoading, solicitudesError, refetchSolicitudes } = useStudentSolicitudes(legajo, studentAirtableId);
    const { 
        lanzamientos, myEnrollments, allLanzamientos, isConvocatoriasLoading, convocatoriasError,
        enrollStudent, confirmInforme, refetchConvocatorias, institutionAddressMap
    } = useConvocatorias(legajo, studentAirtableId, studentDetails, isSuperUserMode);

    const { data: finalizacionRequest = null, isLoading: isFinalizationLoading, refetch: refetchFinalizacion } = useQuery({
        queryKey: ['finalizacionRequest', legajo],
        queryFn: () => fetchFinalizacionRequest(legajo, studentAirtableId),
        enabled: !!studentAirtableId
    });

    const isAcademicLoading = isPracticasLoading || isSolicitudesLoading || isConvocatoriasLoading || isFinalizationLoading;
    const academicError = practicasError || solicitudesError || convocatoriasError;

    const refetchAcademic = () => {
        refetchPracticas();
        refetchSolicitudes();
        refetchConvocatorias();
        refetchFinalizacion();
    };

    const selectedOrientacion = (studentDetails && studentDetails[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] 
        ? studentDetails[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] 
        : "") as Orientacion | "";

    // Use dynamic config from ConfigContext
    const criterios = useMemo(() => 
        (isAcademicLoading ? initialCriterios : calculateCriterios(practicas, selectedOrientacion, config)), 
        [practicas, selectedOrientacion, isAcademicLoading, config]
    );

    const { enrollmentMap, completedLanzamientoIds, informeTasks } = useMemo(() => {
        if (isConvocatoriasLoading || isPracticasLoading) {
            return { enrollmentMap: new Map(), completedLanzamientoIds: new Set(), informeTasks: [] };
        }
        return processAndLinkStudentData({ myEnrollments, allLanzamientos, practicas });
    }, [myEnrollments, allLanzamientos, practicas, isConvocatoriasLoading, isPracticasLoading]);

    const value = {
        practicas,
        solicitudes,
        lanzamientos,
        allLanzamientos,
        institutionAddressMap,
        finalizacionRequest,
        isAcademicLoading,
        academicError,
        updateNota,
        updateFechaFin,
        enrollStudent,
        confirmInforme,
        refetchAcademic,
        criterios,
        enrollmentMap,
        completedLanzamientoIds,
        informeTasks
    };

    return (
        <StudentAcademicContext.Provider value={value as StudentAcademicContextType}>
            {children}
        </StudentAcademicContext.Provider>
    );
};

export const useStudentAcademicData = () => {
    const context = useContext(StudentAcademicContext);
    if (!context) throw new Error('useStudentAcademicData must be used within StudentAcademicProvider');
    return context;
};
