import React, { createContext, useContext, ReactNode } from "react";
import { useStudentData } from "../hooks/useStudentData";
import type { Estudiante } from "../types";

interface StudentDataContextType {
  studentDetails: Estudiante | null;
  studentId: string | null;
  isStudentLoading: boolean;
  studentError: Error | null;
  updateOrientation: ReturnType<typeof useStudentData>["updateOrientation"];
  updateInternalNotes: ReturnType<typeof useStudentData>["updateInternalNotes"];
  refetchStudent: () => void;
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);

export const StudentDataProvider: React.FC<{ legajo: string; children: ReactNode }> = ({
  legajo,
  children,
}) => {
  const data = useStudentData(legajo);

  return <StudentDataContext.Provider value={data}>{children}</StudentDataContext.Provider>;
};

export const useStudentContextData = () => {
  const context = useContext(StudentDataContext);
  if (!context) throw new Error("useStudentContextData must be used within StudentDataProvider");
  return context;
};
