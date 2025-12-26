
import React, { createContext, useContext, ReactNode } from 'react';
import { useStudentData } from '../hooks/useStudentData';
import type { UseMutationResult } from '@tanstack/react-query';
import type { EstudianteFields, Orientacion, Estudiante } from '../types';

interface StudentDataContextType {
    studentDetails: Estudiante | null;
    studentAirtableId: string | null;
    isStudentLoading: boolean;
    studentError: Error | null;
    updateOrientation: UseMutationResult<any, Error, Orientacion | "", unknown>;
    updateInternalNotes: UseMutationResult<any, Error, string, unknown>;
    refetchStudent: () => void;
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);

export const StudentDataProvider: React.FC<{ legajo: string; children: ReactNode }> = ({ legajo, children }) => {
    const data = useStudentData(legajo);
    
    return (
        <StudentDataContext.Provider value={data}>
            {children}
        </StudentDataContext.Provider>
    );
};

export const useStudentContextData = () => {
    const context = useContext(StudentDataContext);
    if (!context) throw new Error('useStudentContextData must be used within StudentDataProvider');
    return context;
};
