import React, { memo, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StudentPanelProvider, useStudentPanel } from "../StudentPanelContext";

jest.mock("../AuthContext", () => ({
  useAuth: () => ({ isSuperUserMode: false }),
}));

jest.mock("../ConfigContext", () => {
  const config = {};
  return { useAppConfig: () => config };
});

jest.mock("../../utils/criteriaCalculations", () => {
  const criterios = { completo: false };
  return {
    initialCriterios: criterios,
    calculateCriterios: () => criterios,
  };
});

jest.mock("../../utils/dataLinker", () => {
  const emptyMap = new Map();
  const emptySet = new Set();
  const result = {
    enrollmentMap: emptyMap,
    completedLanzamientoIds: emptySet,
    completedOrientationsByInstitution: emptyMap,
    informeTasks: [],
  };
  return { processAndLinkStudentData: () => result };
});

jest.mock("../../hooks/useStudentData", () => {
  const result = {
    studentDetails: null,
    studentId: "student-id",
    isStudentLoading: false,
    studentError: null,
    updateOrientation: { mutate: jest.fn(), isPending: false },
    updateInternalNotes: { mutate: jest.fn(), isPending: false },
    refetchStudent: jest.fn(),
  };
  return { useStudentData: () => result };
});

jest.mock("../../hooks/useStudentPracticas", () => {
  const result = {
    practicas: [],
    isPracticasLoading: false,
    practicasError: null,
    updateFechaFin: { mutate: jest.fn(), isPending: false },
    refetchPracticas: jest.fn(),
  };
  return { useStudentPracticas: () => result };
});

jest.mock("../../hooks/useStudentSolicitudes", () => {
  const result = {
    solicitudes: [],
    isSolicitudesLoading: false,
    solicitudesError: null,
    refetchSolicitudes: jest.fn(),
    solicitudesNueva: [],
    refetchSolicitudesNueva: jest.fn(),
    solicitudesModificacion: [],
    isSolicitudesModificacionLoading: false,
    solicitudesModificacionError: null,
    refetchSolicitudesModificacion: jest.fn(),
  };
  return { useStudentSolicitudes: () => result };
});

jest.mock("../../hooks/useConvocatorias", () => {
  const result = {
    lanzamientos: [],
    myEnrollments: [],
    allLanzamientos: [],
    isConvocatoriasLoading: false,
    convocatoriasError: null,
    enrollStudent: { mutate: jest.fn(), isPending: false },
    cancelEnrollment: { mutate: jest.fn(), isPending: false },
    refetchConvocatorias: jest.fn(),
    institutionAddressMap: new Map(),
    institutionLogoMap: new Map(),
  };
  return { useConvocatorias: () => result };
});

jest.mock("../../hooks/useStudentFinalizacion", () => {
  const result = {
    finalizacionRequest: null,
    isFinalizationLoading: false,
    finalizationError: null,
    refetchFinalizacion: jest.fn(),
  };
  return { useStudentFinalizacion: () => result };
});

jest.mock("../../hooks/useStudentCommitments", () => {
  const result = {
    compromisoMap: new Map(),
    isCommitmentsLoading: false,
    commitmentsError: null,
    acceptCompromiso: { mutate: jest.fn(), isPending: false },
    refetchCompromisos: jest.fn(),
  };
  return { useStudentCommitments: () => result };
});

describe("StudentPanelContext render profile", () => {
  it("does not propagate an unrelated parent update to consumers", () => {
    let consumerRenders = 0;

    const Consumer = memo(() => {
      useStudentPanel();
      consumerRenders += 1;
      return <span>consumer</span>;
    });

    const Harness = () => {
      const [count, setCount] = useState(0);
      return (
        <>
          <button onClick={() => setCount((value) => value + 1)}>parent {count}</button>
          <StudentPanelProvider legajo="12345">
            <Consumer />
          </StudentPanelProvider>
        </>
      );
    };

    render(<Harness />);
    expect(consumerRenders).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "parent 0" }));

    expect(consumerRenders).toBe(1);
  });
});
