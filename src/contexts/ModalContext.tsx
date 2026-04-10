import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { LanzamientoPPS, GroupedSeleccionados, Estudiante } from "../types";

type OnSubmitEnrollment = (formData: any) => Promise<void>;
type OnSubmitSolicitudPPS = (formData: any) => Promise<void>;

interface ModalContextType {
  // Generic Modal
  modalInfo: { title: string; message: string } | null;
  showModal: (title: string, message: string) => void;
  closeModal: () => void;

  // Enrollment Form Modal
  isEnrollmentFormOpen: boolean;
  selectedLanzamientoForEnrollment: LanzamientoPPS | null;
  studentProfileForEnrollment: Estudiante | null;
  completedOrientacionesForEnrollment: string[];
  openEnrollmentForm: (
    lanzamiento: LanzamientoPPS,
    studentProfile: Estudiante | null,
    onSubmit: OnSubmitEnrollment,
    completedOrientaciones?: string[]
  ) => void;
  closeEnrollmentForm: () => void;
  onSubmitEnrollment: OnSubmitEnrollment | null;
  isSubmittingEnrollment: boolean;
  setIsSubmittingEnrollment: (isSubmitting: boolean) => void;

  // Seleccionados Modal
  isSeleccionadosModalOpen: boolean;
  seleccionadosData: GroupedSeleccionados | null;
  convocatoriaForModal: string;
  openSeleccionadosModal: (data: GroupedSeleccionados | null, title: string) => void;
  closeSeleccionadosModal: () => void;

  // Solicitud PPS Modal (Autogestión)
  isSolicitudPPSModalOpen: boolean;
  openSolicitudPPSModal: (onSubmit: OnSubmitSolicitudPPS) => void;
  closeSolicitudPPSModal: () => void;
  onSubmitSolicitudPPS: OnSubmitSolicitudPPS | null;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalInfo, setModalInfo] = useState<{ title: string; message: string } | null>(null);

  const [isEnrollmentFormOpen, setIsEnrollmentFormOpen] = useState(false);
  const [selectedLanzamientoForEnrollment, setSelectedLanzamientoForEnrollment] =
    useState<LanzamientoPPS | null>(null);
  const [studentProfileForEnrollment, setStudentProfileForEnrollment] = useState<Estudiante | null>(
    null
  );
  const [onSubmitEnrollment, setOnSubmitEnrollment] = useState<OnSubmitEnrollment | null>(null);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [completedOrientacionesForEnrollment, setCompletedOrientacionesForEnrollment] = useState<
    string[]
  >([]);

  const [isSeleccionadosModalOpen, setIsSeleccionadosModalOpen] = useState(false);
  const [seleccionadosData, setSeleccionadosData] = useState<GroupedSeleccionados | null>(null);
  const [convocatoriaForModal, setConvocatoriaForModal] = useState("");

  const [isSolicitudPPSModalOpen, setIsSolicitudPPSModalOpen] = useState(false);
  const [onSubmitSolicitudPPS, setOnSubmitSolicitudPPS] = useState<OnSubmitSolicitudPPS | null>(
    null
  );

  const showModal = useCallback((title: string, message: string) => {
    setModalInfo({ title, message });
  }, []);

  const closeModal = useCallback(() => {
    setModalInfo(null);
  }, []);

  const openEnrollmentForm = useCallback(
    (
      lanzamiento: LanzamientoPPS,
      studentProfile: Estudiante | null,
      onSubmit: OnSubmitEnrollment,
      completedOrientaciones: string[] = []
    ) => {
      setSelectedLanzamientoForEnrollment(lanzamiento);
      setStudentProfileForEnrollment(studentProfile);
      setOnSubmitEnrollment(() => onSubmit);
      setCompletedOrientacionesForEnrollment(completedOrientaciones);
      setIsEnrollmentFormOpen(true);
    },
    []
  );

  const closeEnrollmentForm = useCallback(() => {
    setIsEnrollmentFormOpen(false);
    setSelectedLanzamientoForEnrollment(null);
    setStudentProfileForEnrollment(null);
    setOnSubmitEnrollment(null);
  }, []);

  const openSeleccionadosModal = useCallback((data: GroupedSeleccionados | null, title: string) => {
    setSeleccionadosData(data);
    setConvocatoriaForModal(title);
    setIsSeleccionadosModalOpen(true);
  }, []);

  const closeSeleccionadosModal = useCallback(() => {
    setIsSeleccionadosModalOpen(false);
    setSeleccionadosData(null);
    setConvocatoriaForModal("");
  }, []);

  const openSolicitudPPSModal = useCallback((onSubmit: OnSubmitSolicitudPPS) => {
    setOnSubmitSolicitudPPS(() => onSubmit);
    setIsSolicitudPPSModalOpen(true);
  }, []);

  const closeSolicitudPPSModal = useCallback(() => {
    setIsSolicitudPPSModalOpen(false);
    setOnSubmitSolicitudPPS(null);
  }, []);

  const value: ModalContextType = {
    modalInfo,
    showModal,
    closeModal,
    isEnrollmentFormOpen,
    selectedLanzamientoForEnrollment,
    studentProfileForEnrollment,
    completedOrientacionesForEnrollment,
    openEnrollmentForm,
    closeEnrollmentForm,
    onSubmitEnrollment,
    isSubmittingEnrollment,
    setIsSubmittingEnrollment,
    isSeleccionadosModalOpen,
    seleccionadosData,
    convocatoriaForModal,
    openSeleccionadosModal,
    closeSeleccionadosModal,
    isSolicitudPPSModalOpen,
    openSolicitudPPSModal,
    closeSolicitudPPSModal,
    onSubmitSolicitudPPS,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};
