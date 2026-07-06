import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import PreSolicitudCheckModal from "../components/PreSolicitudCheckModal";
import AtlasTopbar from "../components/student/home/atlas/AtlasTopbar";
import CriteriosPanel from "../components/student/CriteriosPanel";
import DashboardLoadingSkeleton from "../components/student/DashboardLoadingSkeleton";
import FinalizacionForm from "../components/student/FinalizacionForm";
import HomeView from "../components/student/HomeView";
import PrintableReport from "../components/student/PrintableReport";
import PracticasTable from "../components/student/PracticasTable";
import SolicitudModificacionModal from "../components/student/SolicitudModificacionModal";
import SolicitudNuevaPPSModal from "../components/student/SolicitudNuevaPPSModal";
import SolicitudesList from "../components/student/SolicitudesList";
import AtlasSolicitudesView from "./student/AtlasSolicitudesView";
import AtlasProfileView from "./student/AtlasProfileView";
import AtlasPracticasView from "./student/AtlasPracticasView";
import Auth from "../components/Auth";
import CampusEntryLoader from "../components/CampusEntryLoader";
import { isEmbedded } from "../utils/isEmbedded";
// Aula (contenido estático pesado en JSX): lazy para sacarlo del bundle inicial.
const StudentAulaView = React.lazy(() => import("./student/StudentAulaView"));
const EntregasMobileView = React.lazy(() => import("./student/EntregasMobileView"));
import WelcomeBanner from "../components/student/WelcomeBanner";
import WhatsAppExportButton from "../components/student/WhatsAppExportButton";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  FIELD_CORREO_ESTUDIANTES,
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTADO_PPS,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_LEGAJO_PPS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
  FIELD_SOLICITUD_CONTACTO_TUTOR,
  FIELD_SOLICITUD_DESCRIPCION,
  FIELD_SOLICITUD_DIRECCION,
  FIELD_SOLICITUD_EMAIL_ALUMNO,
  FIELD_SOLICITUD_EMAIL_INSTITUCION,
  FIELD_SOLICITUD_LEGAJO_ALUMNO,
  FIELD_SOLICITUD_LOCALIDAD,
  FIELD_SOLICITUD_NOMBRE_ALUMNO,
  FIELD_SOLICITUD_REFERENTE,
  FIELD_SOLICITUD_TELEFONO_INSTITUCION,
  FIELD_SOLICITUD_TIENE_CONVENIO,
  FIELD_SOLICITUD_TIENE_TUTOR,
  FIELD_SOLICITUD_TIPO_PRACTICA,
  FIELD_ULTIMA_ACTUALIZACION_PPS,
} from "../constants";
import type { AuthUser } from "../contexts/AuthContext";
import { useAuth } from "../contexts/AuthContext";
import { useModal } from "../contexts/ModalContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useStudentPanel } from "../contexts/StudentPanelContext";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../lib/db";
import type { Orientacion, Practica, TabId } from "../types";
// import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import FinalizationStatusCard from "../components/student/FinalizationStatusCard";
import FinalizacionReadOnlyView from "../components/student/FinalizacionReadOnlyView";
// import MobileSectionHeader from '../components/layout/MobileSectionHeader'; // Unused
import ErrorBoundary from "../components/ErrorBoundary";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";
import { useIsMobile } from "../hooks/useIsMobile";

// Export individual views for Router
export { default as StudentPracticas } from "../components/student/PracticasTable";
export { default as StudentSolicitudes } from "../components/student/SolicitudesList";

// --- COMPONENT: Simulation Banner ---
const SimulationBanner: React.FC<{ onExit?: () => void }> = ({ onExit }) => (
  <div className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-4 py-2 flex items-center justify-between shadow-sm sticky top-[60px] md:top-[80px] z-40">
    <div className="flex items-center gap-2">
      <span className="material-icons text-amber-600 dark:text-amber-400 !text-xl animate-pulse">
        visibility
      </span>
      <span className="text-xs font-bold uppercase tracking-wide">
        Modo Simulación: Estás actuando como este estudiante
      </span>
    </div>
    {onExit && (
      <button
        onClick={onExit}
        className="text-xs font-bold underline hover:text-amber-700 dark:hover:text-amber-300"
      >
        Salir
      </button>
    )}
  </div>
);

// --- COMPONENT: StudentHome (For Router Index) ---
export const StudentHome: React.FC = () => {
  const navigate = useNavigate();
  const [isFinalizationModalOpen, setIsFinalizationModalOpen] = useState(false);
  const [showNuevaPPSModal, setShowNuevaPPSModal] = useState(false);

  const {
    studentDetails,
    studentId,
    practicas,
    lanzamientos,
    allLanzamientos,
    institutionAddressMap,
    enrollStudent,
    cancelEnrollment,
    criterios,
    enrollmentMap,
    completedLanzamientoIds,
    completedOrientationsByInstitution,
    informeTasks,
    finalizacionRequest,
    compromisoMap,
    acceptCompromiso,
    deletePractica,
    refetchPracticas,
  } = useStudentPanel();

  const handleOpenFinalization = useCallback(() => {
    setIsFinalizationModalOpen(true);
  }, []);

  // BLOQUEO POR FINALIZACIÓN (Vista Estudiante Nativa)
  // Ya no ocultamos todo: mostramos el estado del trámite + progreso e historial
  // en modo solo lectura (es lo que el alumno quiere mirar mientras espera).
  if (finalizacionRequest) {
    return (
      <FinalizacionReadOnlyView
        status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || "Pendiente"}
        requestDate={
          finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] ||
          finalizacionRequest.created_at ||
          ""
        }
        studentName={studentDetails?.[FIELD_NOMBRE_ESTUDIANTES] || undefined}
        criterios={criterios}
        selectedOrientacion={
          (studentDetails?.[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || "") as Orientacion | ""
        }
        practicas={practicas}
        informeTasks={informeTasks}
      />
    );
  }

  return (
    <ErrorBoundary>
      <FinalizacionForm
        isOpen={isFinalizationModalOpen}
        studentId={studentId}
        onClose={() => setIsFinalizationModalOpen(false)}
        practicas={practicas}
        criterios={criterios}
        onAddPPS={() => setShowNuevaPPSModal(true)}
        onDeletePractica={async (id) => {
          await deletePractica.mutateAsync(id);
        }}
        isDeletingPractica={deletePractica.isPending}
      />
      <SolicitudNuevaPPSModal
        isOpen={showNuevaPPSModal}
        onClose={() => setShowNuevaPPSModal(false)}
        studentId={studentId}
        onSuccess={() => refetchPracticas()}
      />
      <HomeView
        myEnrollments={enrollmentMap ? Array.from(enrollmentMap.values()) : []}
        allLanzamientos={allLanzamientos}
        informeTasks={informeTasks}
        lanzamientos={lanzamientos}
        onNavigate={(id) => navigate(`/student/${id === "inicio" ? "" : id}`)}
        student={studentDetails}
        onInscribir={enrollStudent.mutate}
        onCancelarInscripcion={cancelEnrollment.mutate}
        isCancelandoInscripcion={cancelEnrollment.isPending}
        institutionAddressMap={institutionAddressMap}
        enrollmentMap={enrollmentMap}
        compromisoMap={compromisoMap}
        completedLanzamientoIds={completedLanzamientoIds}
        completedOrientationsByInstitution={completedOrientationsByInstitution}
        criterios={criterios}
        onOpenFinalization={handleOpenFinalization}
        onAcceptCompromiso={async (payload) => {
          await acceptCompromiso.mutateAsync(payload);
        }}
        isSubmittingCompromiso={acceptCompromiso.isPending}
      />
    </ErrorBoundary>
  );
};

// --- COMPONENT: StudentDashboard (Standalone Widget / Admin View) ---
interface StudentDashboardProps {
  user?: AuthUser;
  activeTab?: TabId;
  onTabChange?: (tabId: TabId) => void;
  showExportButton?: boolean;
}

/**
 * Forma del payload del formulario de solicitud de PPS que consume la mutación.
 * Todos opcionales (el form puede no traer todos los campos); reemplaza el `any`
 * previo para tener seguridad de tipos al construir el registro.
 */
interface SolicitudFormInput {
  nombreInstitucion?: string;
  localidad?: string;
  direccion?: string;
  emailInstitucion?: string;
  telefonoInstitucion?: string;
  referente?: string;
  tieneConvenio?: string;
  tieneTutor?: string;
  contactoTutor?: string;
  tipoPractica?: string;
  descripcion?: string;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  activeTab,
  onTabChange,
  showExportButton = false,
}) => {
  const { isSuperUserMode, isJefeMode, authenticatedUser, isAuthLoading } = useAuth();
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isFinalizationModalOpen, setIsFinalizationModalOpen] = useState(false);
  const [isPreCheckModalOpen, setIsPreCheckModalOpen] = useState(false);
  const [forceInteractiveMode, setForceInteractiveMode] = useState(false);

  // Estado para modales de corrección de prácticas
  const [showModificacionModal, setShowModificacionModal] = useState(false);
  const [showNuevaPPSModal, setShowNuevaPPSModal] = useState(false);
  const [selectedPractica, setSelectedPractica] = useState<Practica | null>(null);
  const { openSolicitudPPSModal } = useModal();
  const { showToast } = useNotifications();
  const queryClient = useQueryClient();

  const currentUser = user || authenticatedUser;
  const isAdminViewing = isSuperUserMode || isJefeMode;

  const {
    studentDetails,
    studentId,
    practicas,
    solicitudes,
    solicitudesNueva,
    lanzamientos,
    allLanzamientos,
    institutionAddressMap,
    institutionLogoMap,
    isLoading,
    isStudentLoading,
    isPracticasLoading,
    error,
    updateOrientation,
    updateInternalNotes,
    updateNota,
    updateFechaFin,
    deletePractica,
    enrollStudent,
    cancelEnrollment,
    refetchAll,
    criterios,
    enrollmentMap,
    completedLanzamientoIds,
    completedOrientationsByInstitution,
    informeTasks,
    finalizacionRequest,
    compromisoMap,
    acceptCompromiso,
  } = useStudentPanel();

  const [internalActiveTab, setInternalActiveTab] = useState<TabId>(
    showExportButton ? "practicas" : "inicio"
  );
  const currentActiveTab = activeTab ?? internalActiveTab;
  const setCurrentActiveTab = onTabChange ?? setInternalActiveTab;

  const selectedOrientacion = (studentDetails?.[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || "") as
    | Orientacion
    | "";
  const studentNameForPanel =
    studentDetails?.[FIELD_NOMBRE_ESTUDIANTES] || currentUser?.nombre || "Estudiante";

  const { data: activeInstitutionsDB } = useQuery({
    queryKey: ["activeInstitutionsDB"],
    queryFn: () => db.instituciones.getAll({ fields: ["nombre"] }),
  });

  const getStudentId = () => studentId || currentUser?.id || null;

  const handleOrientacionChange = useCallback(
    (orientacion: Orientacion | "") => {
      updateOrientation.mutate(orientacion, {
        onSuccess: () => {
          setShowSaveConfirmation(true);
          setTimeout(() => setShowSaveConfirmation(false), 2000);
        },
      });
    },
    [updateOrientation]
  );

  const handleNotaChange = useCallback(
    (practicaId: string, nota: string, convocatoriaId?: string) => {
      updateNota.mutate({ practicaId, nota, convocatoriaId });
    },
    [updateNota]
  );
  const handleFechaFinChange = useCallback(
    (practicaId: string, fecha: string) => {
      updateFechaFin.mutate({ practicaId, fecha });
    },
    [updateFechaFin]
  );
  const handleRequestModificacion = useCallback((practica: Practica) => {
    logger.info("[DEBUG] StudentDashboard - Solicitar modificación para:", practica);
    setSelectedPractica(practica);
    setShowModificacionModal(true);
  }, []);

  const handleRequestNuevaPPS = useCallback(() => {
    logger.info("[DEBUG] StudentDashboard - Solicitar nueva PPS");
    setShowNuevaPPSModal(true);
  }, []);

  const handleRefetchPracticas = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["practicas"] });
    queryClient.invalidateQueries({ queryKey: ["solicitudes_nueva_pps_student"] });
  }, [queryClient]);

  const handleOpenFinalization = useCallback(() => {
    setIsFinalizationModalOpen(true);
  }, []);

  const existingInstitutions = useMemo(() => {
    const namesSet = new Set<string>();
    allLanzamientos.forEach((l) => {
      const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];
      if (name) namesSet.add(name.split(" - ")[0].trim());
    });
    if (activeInstitutionsDB) {
      activeInstitutionsDB.forEach((inst) => {
        if (inst.nombre) namesSet.add(inst.nombre.split(" - ")[0].trim());
      });
    }
    return Array.from(namesSet).sort((a, b) => a.localeCompare(b));
  }, [allLanzamientos, activeInstitutionsDB]);

  const createSolicitudMutation = useMutation({
    mutationFn: async (formData: SolicitudFormInput) => {
      const studentId = getStudentId();
      if (!studentId) throw new Error("Error identificando al estudiante.");
      const newRecord: Record<string, unknown> = {
        [FIELD_LEGAJO_PPS]: studentId,
        [FIELD_SOLICITUD_LEGAJO_ALUMNO]: studentDetails?.[FIELD_LEGAJO_ESTUDIANTES],
        [FIELD_SOLICITUD_NOMBRE_ALUMNO]: studentDetails?.[FIELD_NOMBRE_ESTUDIANTES],
        [FIELD_SOLICITUD_EMAIL_ALUMNO]: studentDetails?.[FIELD_CORREO_ESTUDIANTES],
        [FIELD_EMPRESA_PPS_SOLICITUD]: formData.nombreInstitucion,
        [FIELD_SOLICITUD_LOCALIDAD]: formData.localidad,
        [FIELD_SOLICITUD_DIRECCION]: formData.direccion,
        [FIELD_SOLICITUD_EMAIL_INSTITUCION]: formData.emailInstitucion,
        [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: formData.telefonoInstitucion,
        [FIELD_SOLICITUD_REFERENTE]: formData.referente,
        [FIELD_SOLICITUD_TIENE_CONVENIO]: formData.tieneConvenio,
        [FIELD_SOLICITUD_TIENE_TUTOR]: formData.tieneTutor,
        [FIELD_SOLICITUD_CONTACTO_TUTOR]: formData.contactoTutor,
        [FIELD_SOLICITUD_TIPO_PRACTICA]: formData.tipoPractica,
        [FIELD_SOLICITUD_DESCRIPCION]: formData.descripcion,
        [FIELD_ESTADO_PPS]: "Pendiente",
        [FIELD_ULTIMA_ACTUALIZACION_PPS]: new Date().toISOString().split("T")[0],
      };
      await db.solicitudes.create(newRecord);
    },
    onSuccess: () => {
      showToast("Tu solicitud de PPS ha sido registrada.", "success");
      queryClient.invalidateQueries({ queryKey: ["solicitudes"] });
    },
    onError: (err: unknown) => showToast(`Error: ${getErrorMessage(err)} `, "error"),
  });

  const handleStartSolicitud = useCallback(() => setIsPreCheckModalOpen(true), []);

  const handleProceedToForm = useCallback(() => {
    setIsPreCheckModalOpen(false);
    openSolicitudPPSModal(async (data) => {
      await createSolicitudMutation.mutateAsync(data);
    });
  }, [openSolicitudPPSModal, createSolicitudMutation]);

  const homeContent = useMemo(
    () => (
      <ErrorBoundary>
        <HomeView
          myEnrollments={enrollmentMap ? Array.from(enrollmentMap.values()) : []}
          allLanzamientos={allLanzamientos}
          informeTasks={informeTasks}
          lanzamientos={lanzamientos}
          onNavigate={(id) => setCurrentActiveTab(id)}
          student={studentDetails}
          onInscribir={enrollStudent.mutate}
          onCancelarInscripcion={cancelEnrollment.mutate}
          isCancelandoInscripcion={cancelEnrollment.isPending}
          institutionAddressMap={institutionAddressMap}
          institutionLogoMap={institutionLogoMap}
          enrollmentMap={enrollmentMap}
          compromisoMap={compromisoMap}
          completedLanzamientoIds={completedLanzamientoIds}
          completedOrientationsByInstitution={completedOrientationsByInstitution}
          criterios={criterios}
          onOpenFinalization={handleOpenFinalization}
          onAcceptCompromiso={
            !isAdminViewing
              ? async (payload) => {
                  await acceptCompromiso.mutateAsync(payload);
                }
              : undefined
          }
          isSubmittingCompromiso={!isAdminViewing ? acceptCompromiso.isPending : false}
        />
      </ErrorBoundary>
    ),
    [
      enrollmentMap,
      allLanzamientos,
      informeTasks,
      lanzamientos,
      studentDetails,
      enrollStudent.mutate,
      cancelEnrollment.mutate,
      cancelEnrollment.isPending,
      institutionAddressMap,
      institutionLogoMap,
      compromisoMap,
      completedLanzamientoIds,
      completedOrientationsByInstitution,
      criterios,
      handleOpenFinalization,
      acceptCompromiso,
      isAdminViewing,
      setCurrentActiveTab,
    ]
  );

  const solicitudesContent = useMemo(
    () => (
      <ErrorBoundary>
        <SolicitudesList
          solicitudes={solicitudes}
          onCreateSolicitud={handleStartSolicitud}
          onRequestFinalization={handleOpenFinalization}
          criterios={criterios}
          informeTasks={informeTasks}
        />
      </ErrorBoundary>
    ),
    [solicitudes, handleStartSolicitud, handleOpenFinalization, criterios, informeTasks]
  );

  // Versión Atlas (escritorio) de Solicitudes.
  const atlasSolicitudesContent = useMemo(
    () => (
      <ErrorBoundary>
        <AtlasSolicitudesView
          solicitudes={solicitudes}
          onCreateSolicitud={handleStartSolicitud}
          onRequestFinalization={handleOpenFinalization}
          criterios={criterios}
          informeTasks={informeTasks}
          finalizacionRequest={finalizacionRequest}
        />
      </ErrorBoundary>
    ),
    [
      solicitudes,
      handleStartSolicitud,
      handleOpenFinalization,
      criterios,
      informeTasks,
      finalizacionRequest,
    ]
  );

  // Versión mobile (editorial) de Solicitudes.
  const mobileSolicitudesContent = atlasSolicitudesContent;

  // Versión mobile de Prácticas: aro grande de horas + lista táctil.
  // No es la vista de escritorio responsiva; es una superficie propia para celular.
  const practicasContent = useMemo(
    () => (
      <ErrorBoundary>
        <PracticasTable
          practicas={practicas}
          handleNotaChange={handleNotaChange}
          handleFechaFinChange={handleFechaFinChange}
          isLoading={isPracticasLoading}
          onRequestModificacion={handleRequestModificacion}
          onRequestNuevaPPS={handleRequestNuevaPPS}
        />
      </ErrorBoundary>
    ),
    [
      practicas,
      handleNotaChange,
      handleFechaFinChange,
      isPracticasLoading,
      handleRequestModificacion,
      handleRequestNuevaPPS,
    ]
  );

  // Versión Atlas (escritorio) de Prácticas — layout 2 columnas.
  const atlasPracticasContent = useMemo(
    () => (
      <ErrorBoundary>
        <AtlasPracticasView
          criterios={criterios}
          selectedOrientacion={selectedOrientacion}
          handleOrientacionChange={handleOrientacionChange}
          onRequestFinalization={handleOpenFinalization}
          informeTasks={informeTasks}
          practicas={practicas}
          handleNotaChange={handleNotaChange}
          onRequestModificacion={handleRequestModificacion}
          onRequestNuevaPPS={handleRequestNuevaPPS}
        />
      </ErrorBoundary>
    ),
    [
      criterios,
      selectedOrientacion,
      handleOrientacionChange,
      handleOpenFinalization,
      informeTasks,
      practicas,
      handleNotaChange,
      handleRequestModificacion,
      handleRequestNuevaPPS,
    ]
  );

  // Versión Atlas (escritorio) de Perfil.
  const atlasProfileContent = useMemo(
    () => (
      <ErrorBoundary>
        <AtlasProfileView studentDetails={studentDetails} isLoading={isLoading} />
      </ErrorBoundary>
    ),
    [studentDetails, isLoading]
  );

  const studentDataTabs = useMemo(
    () => [
      {
        id: "inicio" as TabId,
        label: "Inicio",
        icon: "home",
        /* Inicio = home personalizado: saludo, próximo paso, convocatorias
           abiertas y resultados. La guía vive en su pestaña. */
        content: homeContent,
      },
      {
        id: "entregas" as TabId,
        label: "Entregas",
        icon: "upload",
        /* Mobile: vista propia pensada para el celular; desktop: sección campus. */
        content: (
          <ErrorBoundary>
            <React.Suspense fallback={null}>
              {isMobile ? <EntregasMobileView /> : <StudentAulaView section="entregas" />}
            </React.Suspense>
          </ErrorBoundary>
        ),
      },
      {
        id: "practicas" as TabId,
        label: `Mis Prácticas`,
        icon: "work_history",
        content: isMobile ? (
          <div className="ed" data-mode={resolvedTheme} data-accent="teal">
            {!finalizacionRequest && (
              <CriteriosPanel
                criterios={criterios}
                selectedOrientacion={selectedOrientacion}
                handleOrientacionChange={handleOrientacionChange}
                showSaveConfirmation={showSaveConfirmation}
                onRequestFinalization={handleOpenFinalization}
                informeTasks={informeTasks}
                showOrientationSelector={false}
              />
            )}
            {practicasContent}
          </div>
        ) : (
          atlasPracticasContent
        ),
      },
      {
        id: "solicitudes" as TabId,
        label: `Mis Solicitudes`,
        icon: "list_alt",
        content: isMobile ? mobileSolicitudesContent : atlasSolicitudesContent,
      },
      {
        id: "guia" as TabId,
        label: "Guía 2026",
        icon: "book",
        content: (
          <ErrorBoundary>
            <React.Suspense fallback={null}>
              <StudentAulaView section="guia" />
            </React.Suspense>
          </ErrorBoundary>
        ),
      },
      {
        id: "descargas" as TabId,
        label: "Descargas",
        icon: "download",
        content: (
          <ErrorBoundary>
            <React.Suspense fallback={null}>
              <StudentAulaView section="descargas" />
            </React.Suspense>
          </ErrorBoundary>
        ),
      },
      {
        id: "preguntas" as TabId,
        label: "Preguntas",
        icon: "help",
        content: (
          <ErrorBoundary>
            <React.Suspense fallback={null}>
              <StudentAulaView section="preguntas" />
            </React.Suspense>
          </ErrorBoundary>
        ),
      },
      {
        id: "profile" as TabId,
        label: "Mi Perfil",
        icon: "person",
        content: atlasProfileContent,
      },
    ],
    [
      homeContent,
      isMobile,
      resolvedTheme,
      finalizacionRequest,
      criterios,
      selectedOrientacion,
      handleOrientacionChange,
      showSaveConfirmation,
      handleOpenFinalization,
      informeTasks,
      practicasContent,
      atlasPracticasContent,
      mobileSolicitudesContent,
      atlasSolicitudesContent,
      atlasProfileContent,
      setCurrentActiveTab,
    ]
  );

  const renderTabContent = (tabId: TabId, isMobileLayout: boolean) => {
    /* Secciones con datos del alumno piden sesión; Guía, Descargas y
       Preguntas son material de consulta público. */
    const isLocked = ["inicio", "entregas", "practicas", "solicitudes", "profile"].includes(tabId);
    if (isLocked && !currentUser) {
      /* Mientras se resuelve la sesión (restauración + posible auto-login desde
         el campus) mostramos el MISMO loader branded que usa <Auth> en su estado
         "checking", para que se vea un solo spinner continuo y el login no
         parpadee antes de que el panel monte. */
      if (isAuthLoading) {
        return (
          <div className={isMobileLayout ? "px-1 pt-2" : undefined}>
            <CampusEntryLoader inline resolvedTheme={resolvedTheme} />
          </div>
        );
      }
      /* Sin sesión: el login embebido (marca + formulario, mismo diseño que
         la pantalla de login completa) reemplaza al contenido de la sección. */
      return (
        <div className={isMobileLayout ? "px-1 pt-2" : undefined}>
          <Auth inline />
        </div>
      );
    }

    const tab = studentDataTabs.find((t) => t.id === tabId);
    return tab ? tab.content : null;
  };

  const showEmptyState = useMemo(
    () =>
      !isLoading &&
      practicas.length === 0 &&
      solicitudes.length === 0 &&
      lanzamientos.length === 0 &&
      informeTasks.length === 0 &&
      isAdminViewing &&
      !forceInteractiveMode,
    [
      isLoading,
      practicas.length,
      solicitudes.length,
      lanzamientos.length,
      informeTasks.length,
      isAdminViewing,
      forceInteractiveMode,
    ]
  );

  // Wait until all student data (including convocatorias) has loaded to prevent layout shift.
  if (isLoading) return <DashboardLoadingSkeleton />;
  if (error) return <ErrorState error={error.message} onRetry={() => refetchAll()} />;

  // CASO DE BLOQUEO POR FINALIZACIÓN (Solo si NO es un Admin mirando)
  // Solo lectura: estado del trámite + progreso + historial. El admin que simula
  // sigue viendo el panel completo (más abajo) para poder gestionar.
  if (finalizacionRequest && !isAdminViewing) {
    return (
      <FinalizacionReadOnlyView
        status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || "Pendiente"}
        requestDate={
          finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] ||
          finalizacionRequest.created_at ||
          ""
        }
        studentName={studentNameForPanel}
        criterios={criterios}
        selectedOrientacion={selectedOrientacion}
        practicas={practicas}
        informeTasks={informeTasks}
      />
    );
  }

  if (showEmptyState) {
    return (
      <>
        {isAdminViewing && <SimulationBanner />}
        <div className="print-only">
          <PrintableReport
            studentDetails={studentDetails}
            criterios={criterios}
            practicas={practicas}
          />
        </div>
        <div className="no-print space-y-8 animate-fade-in-up mt-6">
          <WelcomeBanner
            studentName={studentNameForPanel}
            studentDetails={studentDetails}
            isLoading={false}
          />
          <CriteriosPanel
            criterios={criterios}
            selectedOrientacion={selectedOrientacion}
            handleOrientacionChange={handleOrientacionChange}
            showSaveConfirmation={showSaveConfirmation}
            onRequestFinalization={handleOpenFinalization}
            informeTasks={informeTasks}
          />
          <Card className="border-slate-300/50 bg-slate-50/30">
            <EmptyState
              icon="search_off"
              title="Sin Resultados"
              message="No se encontró información para este estudiante."
              action={
                <Button
                  onClick={() => setForceInteractiveMode(true)}
                  icon="input"
                  variant="secondary"
                >
                  Gestionar / Inscribir
                </Button>
              }
            />
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      {isAdminViewing && <SimulationBanner />}
      {isPreCheckModalOpen && (
        <PreSolicitudCheckModal
          isOpen={isPreCheckModalOpen}
          onClose={() => setIsPreCheckModalOpen(false)}
          onContinue={handleProceedToForm}
          existingInstitutions={existingInstitutions}
        />
      )}
      <FinalizacionForm
        isOpen={isFinalizationModalOpen}
        studentId={getStudentId()}
        onClose={() => setIsFinalizationModalOpen(false)}
        practicas={practicas}
        criterios={criterios}
        solicitudes={solicitudesNueva}
        onAddPPS={() => setShowNuevaPPSModal(true)}
        onDeletePractica={async (id) => {
          await deletePractica.mutateAsync(id);
        }}
        isDeletingPractica={deletePractica.isPending}
      />
      <div className="print-only">
        <PrintableReport
          studentDetails={studentDetails}
          criterios={criterios}
          practicas={practicas}
        />
      </div>
      {/* Montamos solo el árbol del viewport actual (desktop ↔ mobile) para no
          renderizar el contenido del tab por duplicado en el DOM. */}
      {!isMobile && (
        <div className="no-print">
          <AtlasTopbar
            activeTab={currentActiveTab}
            onTabChange={(id) => setCurrentActiveTab(id as TabId)}
          />
          <div className="space-y-8 mt-6 animate-fade-in-up">
            {/* Las secciones del campus y las vistas Atlas traen su propio
                encabezado de página. El banner solo acompaña vistas legacy
                y nunca sin sesión (saludaría a un "Estudiante" anónimo). */}
            {!!currentUser &&
              ![
                "inicio",
                "aula",
                "solicitudes",
                "profile",
                "practicas",
                "entregas",
                "guia",
                "descargas",
                "preguntas",
              ].includes(currentActiveTab) && (
                <WelcomeBanner
                  studentName={studentNameForPanel}
                  studentDetails={studentDetails}
                  isLoading={isLoading}
                />
              )}
            {finalizacionRequest && (
              <FinalizationStatusCard
                status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || "Pendiente"}
                requestDate={
                  finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] ||
                  finalizacionRequest.created_at ||
                  ""
                }
              />
            )}
            {renderTabContent(currentActiveTab, false)}
          </div>
        </div>
      )}
      {isMobile && (
        <div className="no-print space-y-6 animate-fade-in-up mt-4">
          {isEmbedded() && !finalizacionRequest && (
            <div
              className="ed w-full sticky top-0 z-30"
              data-mode={resolvedTheme}
              data-accent="teal"
            >
              <div
                className="flex gap-2 overflow-x-auto py-2.5 px-4 scrollbar-none backdrop-blur-md"
                style={{
                  background: "color-mix(in oklab, var(--bg-elevated) 85%, transparent)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                {studentDataTabs.map((tab) => {
                  const on = tab.id === currentActiveTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCurrentActiveTab(tab.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 flex items-center gap-1.5"
                      style={{
                        background: on ? "var(--accent)" : "var(--bg-sunken)",
                        color: on ? "var(--on-accent)" : "var(--ink-soft)",
                        border: on ? "none" : "1px solid var(--line)",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {finalizacionRequest && currentUser && (
            <FinalizationStatusCard
              status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || "Pendiente"}
              requestDate={
                finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] ||
                finalizacionRequest.created_at ||
                ""
              }
            />
          )}
          {renderTabContent(currentActiveTab, true)}
        </div>
      )}
      {showExportButton && (
        <WhatsAppExportButton
          practicas={practicas}
          criterios={criterios}
          selectedOrientacion={selectedOrientacion}
          studentNameForPanel={studentNameForPanel}
          studentDetails={studentDetails}
          isLoading={isLoading}
        />
      )}

      {/* Modales de corrección de prácticas */}
      <SolicitudModificacionModal
        isOpen={showModificacionModal}
        onClose={() => {
          setShowModificacionModal(false);
          setSelectedPractica(null);
        }}
        practica={selectedPractica}
        studentId={studentDetails?.id || null}
        onSuccess={handleRefetchPracticas}
      />

      <SolicitudNuevaPPSModal
        isOpen={showNuevaPPSModal}
        onClose={() => setShowNuevaPPSModal(false)}
        studentId={getStudentId()}
        onSuccess={handleRefetchPracticas}
      />
    </>
  );
};

export default StudentDashboard;
