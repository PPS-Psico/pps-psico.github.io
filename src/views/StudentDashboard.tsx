
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import CriteriosPanel from '../components/CriteriosPanel';
import PracticasTable from '../components/PracticasTable';
import SolicitudesList from '../components/SolicitudesList';
import EmptyState from '../components/EmptyState';
import Tabs from '../components/Tabs';
import Card from '../components/Card';
import WelcomeBanner from '../components/WelcomeBanner';
import InformesList from '../components/InformesList';
import WhatsAppExportButton from '../components/WhatsAppExportButton';
import { useAuth } from '../contexts/AuthContext';
import type { AuthUser } from '../contexts/AuthContext';
import type { TabId, Orientacion, SolicitudPPSFields } from '../types';
import DashboardLoadingSkeleton from '../components/DashboardLoadingSkeleton';
import ErrorState from '../components/ErrorState';
import ProfileView from '../components/ProfileView';
import HomeView from '../components/HomeView';
import PrintableReport from '../components/PrintableReport';
import { useStudentPanel } from '../contexts/StudentPanelContext';
import FinalizacionForm from '../components/FinalizacionForm';
import { 
    FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES, 
    FIELD_NOMBRE_ESTUDIANTES, 
    FIELD_LEGAJO_PPS,
    FIELD_ESTADO_PPS,
    FIELD_ULTIMA_ACTUALIZACION_PPS,
    FIELD_EMPRESA_PPS_SOLICITUD,
    FIELD_SOLICITUD_LEGAJO_ALUMNO,
    FIELD_SOLICITUD_NOMBRE_ALUMNO,
    FIELD_SOLICITUD_EMAIL_ALUMNO,
    FIELD_SOLICITUD_LOCALIDAD,
    FIELD_SOLICITUD_DIRECCION,
    FIELD_SOLICITUD_REFERENTE,
    FIELD_SOLICITUD_TIENE_CONVENIO,
    FIELD_SOLICITUD_TIENE_TUTOR,
    FIELD_SOLICITUD_CONTACTO_TUTOR,
    FIELD_SOLICITUD_TIPO_PRACTICA,
    FIELD_SOLICITUD_DESCRIPCION,
    FIELD_SOLICITUD_EMAIL_INSTITUCION,
    FIELD_SOLICITUD_TELEFONO_INSTITUCION,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_FECHA_SOLICITUD_FINALIZACION,
    FIELD_ESTADO_FINALIZACION,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
} from '../constants';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../contexts/ModalContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { normalizeStringForComparison } from '../utils/formatters';
import FinalizationStatusCard from '../components/FinalizationStatusCard';
import MobileSectionHeader from '../components/MobileSectionHeader';
import MobileCriteriaCard from '../components/MobileCriteriaCard';
import ErrorBoundary from '../components/ErrorBoundary';
import PreSolicitudCheckModal from '../components/PreSolicitudCheckModal';

// --- COMPONENT: Simulation Banner ---
const SimulationBanner: React.FC<{ onExit?: () => void }> = ({ onExit }) => (
    <div className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-4 py-2 flex items-center justify-between shadow-sm sticky top-[60px] md:top-[80px] z-40">
        <div className="flex items-center gap-2">
            <span className="material-icons text-amber-600 dark:text-amber-400 !text-xl animate-pulse">visibility</span>
            <span className="text-xs font-bold uppercase tracking-wide">Modo Simulación</span>
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
    
    const {
        studentDetails,
        studentAirtableId,
        lanzamientos,
        allLanzamientos,
        institutionAddressMap,
        enrollStudent,
        criterios,
        enrollmentMap,
        completedLanzamientoIds,
        informeTasks
    } = useStudentPanel();

    const handleOpenFinalization = useCallback(() => {
        setIsFinalizationModalOpen(true);
    }, []);

    return (
        <ErrorBoundary>
             {isFinalizationModalOpen && (
                <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
                    <button 
                        onClick={() => setIsFinalizationModalOpen(false)}
                        className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-slate-700/80 rounded-full hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-50 dark:text-slate-300 transition-colors shadow-sm backdrop-blur-sm"
                    >
                        <span className="material-icons">close</span>
                    </button>
                    <FinalizacionForm 
                        studentAirtableId={studentAirtableId} 
                        onClose={() => setIsFinalizationModalOpen(false)}
                    />
                </div>
                </div>
            )}
            <HomeView 
                myEnrollments={enrollmentMap ? Array.from(enrollmentMap.values()) : []} 
                allLanzamientos={allLanzamientos} 
                informeTasks={informeTasks} 
                lanzamientos={lanzamientos} 
                onNavigate={(id) => navigate(`/student/${id === 'inicio' ? '' : id}`)}
                student={studentDetails}
                onInscribir={enrollStudent.mutate}
                institutionAddressMap={institutionAddressMap}
                enrollmentMap={enrollmentMap}
                completedLanzamientoIds={completedLanzamientoIds}
                criterios={criterios}
                onOpenFinalization={handleOpenFinalization}
            />
        </ErrorBoundary>
    );
};

// --- COMPONENT: StudentDashboard (Standalone Widget) ---
interface StudentDashboardProps {
  user?: AuthUser;
  activeTab?: TabId;
  onTabChange?: (tabId: TabId) => void;
  showExportButton?: boolean;
}

// DEFINICIÓN DE TIPOS PARA LA ARQUITECTURA DE VISTAS
// Ahora soporta "mobilePreContent" para inyectar tarjetas específicas antes del contenido principal
interface ViewConfiguration {
    id: TabId;
    label: string;
    icon: string;
    content: React.ReactNode;
    desktopConfig: {
        showInTabs: boolean; 
    };
    mobileConfig: {
        header: React.ReactNode | null; // El título de la sección
        preContent?: React.ReactNode;   // Contenido extra antes del principal (ej: tarjetas de resumen)
    };
    badge?: number;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, activeTab, onTabChange, showExportButton = false }) => {
  const { isSuperUserMode, isJefeMode, authenticatedUser } = useAuth();
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isFinalizationModalOpen, setIsFinalizationModalOpen] = useState(false);
  const [isPreCheckModalOpen, setIsPreCheckModalOpen] = useState(false);
  const [forceInteractiveMode, setForceInteractiveMode] = useState(false);
  
  const { openSolicitudPPSModal, showModal } = useModal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const currentUser = user || authenticatedUser;
  const isAdminViewing = isSuperUserMode || isJefeMode;

  const {
    studentDetails,
    studentAirtableId,
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
    enrollStudent,
    confirmInforme,
    refetchAll,
    criterios,
    enrollmentMap,
    completedLanzamientoIds,
    informeTasks,
    finalizacionRequest
  } = useStudentPanel();

  const [internalActiveTab, setInternalActiveTab] = useState<TabId>(showExportButton ? 'practicas' : 'inicio');
  const currentActiveTab = activeTab ?? internalActiveTab;
  const setCurrentActiveTab = onTabChange ?? setInternalActiveTab;
  
  const selectedOrientacion = (studentDetails?.[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || "") as Orientacion | "";
  const studentNameForPanel = studentDetails?.[FIELD_NOMBRE_ESTUDIANTES] || currentUser?.nombre || 'Estudiante';

  // --- LISTA DE INSTITUCIONES (Full) ---
  const existingInstitutions = useMemo(() => {
        const namesSet = new Set<string>();
        const excludedTerms = [
            "relevamiento del ejercicio profesional", 
            "jornada universitaria de salud mental"
        ];
        
        allLanzamientos.forEach(l => {
            const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (name) {
                const lowerName = normalizeStringForComparison(name);
                if (!excludedTerms.some(term => lowerName.includes(term))) {
                        const groupName = name.split(' - ')[0].trim();
                        namesSet.add(groupName);
                }
            }
        });

        return Array.from(namesSet)
            .map(name => name.charAt(0).toUpperCase() + name.slice(1))
            .sort((a, b) => a.localeCompare(b));
  }, [allLanzamientos]);

  const getStudentId = () => studentAirtableId || currentUser?.id || null;

  const handleOrientacionChange = useCallback((orientacion: Orientacion | "") => {
    updateOrientation.mutate(orientacion, {
      onSuccess: () => {
        setShowSaveConfirmation(true);
        setTimeout(() => setShowSaveConfirmation(false), 2000);
      }
    });
  }, [updateOrientation]);

  const handleNotaChange = useCallback((practicaId: string, nota: string, convocatoriaId?: string) => {
    updateNota.mutate({ practicaId, nota, convocatoriaId });
  }, [updateNota]);

  const handleOpenFinalization = useCallback(() => setIsFinalizationModalOpen(true), []);

  const createSolicitudMutation = useMutation({
      mutationFn: async (formData: any) => {
          const studentId = getStudentId();
          if (!studentId) throw new Error("Error identificando al estudiante.");

          const newRecord: Partial<SolicitudPPSFields> = {
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
              [FIELD_ESTADO_PPS]: 'Pendiente',
              [FIELD_ULTIMA_ACTUALIZACION_PPS]: new Date().toISOString().split('T')[0]
          };
          await db.solicitudes.create(newRecord as any);
      },
      onSuccess: () => {
          showModal('Solicitud Enviada', 'Tu solicitud de PPS ha sido registrada. Te notificaremos cuando haya novedades.');
          queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      },
      onError: (err: any) => {
          showModal('Error', `Hubo un problema al enviar la solicitud: ${err.message}`);
      }
  });

  const handleStartSolicitud = useCallback(() => setIsPreCheckModalOpen(true), []);

  const handleProceedToForm = useCallback(() => {
      setIsPreCheckModalOpen(false);
      openSolicitudPPSModal(async (data) => {
          await createSolicitudMutation.mutateAsync(data);
      });
  }, [openSolicitudPPSModal, createSolicitudMutation]);
  
  // --- CONTENIDO MEMORIZADO ---
  
  const homeContent = useMemo(() => (
    <ErrorBoundary>
        <HomeView 
            myEnrollments={enrollmentMap ? Array.from(enrollmentMap.values()) : []} 
            allLanzamientos={allLanzamientos} 
            informeTasks={informeTasks} 
            lanzamientos={lanzamientos} 
            onNavigate={(id) => setCurrentActiveTab(id)}
            student={studentDetails}
            onInscribir={enrollStudent.mutate}
            institutionAddressMap={institutionAddressMap}
            enrollmentMap={enrollmentMap}
            completedLanzamientoIds={completedLanzamientoIds}
            criterios={criterios}
            onOpenFinalization={handleOpenFinalization}
        />
    </ErrorBoundary>
  ), [enrollmentMap, allLanzamientos, informeTasks, lanzamientos, studentDetails, enrollStudent.mutate, institutionAddressMap, completedLanzamientoIds, criterios, handleOpenFinalization]);
  
  const solicitudesContent = useMemo(() => (
    <ErrorBoundary>
        <SolicitudesList 
            solicitudes={solicitudes} 
            onCreateSolicitud={handleStartSolicitud} 
            onRequestFinalization={handleOpenFinalization} 
            criterios={criterios} 
        />
    </ErrorBoundary>
  ), [solicitudes, handleStartSolicitud, handleOpenFinalization, criterios]);

  const practicasContent = useMemo(() => (
    <ErrorBoundary>
        <PracticasTable practicas={practicas} handleNotaChange={handleNotaChange} />
    </ErrorBoundary>
  ), [practicas, handleNotaChange]);

  const profileContent = useMemo(() => (
    <ErrorBoundary>
        <ProfileView studentDetails={studentDetails} isLoading={isLoading} updateInternalNotes={updateInternalNotes} />
    </ErrorBoundary>
  ), [studentDetails, isLoading, updateInternalNotes]);

  const informesContent = useMemo(() => (
    <ErrorBoundary>
        <InformesList tasks={informeTasks} onConfirmar={confirmInforme.mutate} />
    </ErrorBoundary>
  ), [informeTasks, confirmInforme]);

  // --- CONFIGURACIÓN MAESTRA DE VISTAS ---
  const VIEWS_CONFIG: ViewConfiguration[] = useMemo(() => [
      {
          id: 'inicio',
          label: 'Inicio',
          icon: 'home',
          content: homeContent,
          desktopConfig: { showInTabs: true },
          mobileConfig: { 
              header: <WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />,
              preContent: null
          }
      },
      {
          id: 'solicitudes',
          label: 'Mis Solicitudes',
          icon: 'list_alt',
          content: solicitudesContent,
          badge: solicitudes.length > 0 ? solicitudes.length : undefined,
          desktopConfig: { showInTabs: true },
          mobileConfig: { 
              header: <MobileSectionHeader title="Mis Solicitudes" description="Estado de tus trámites de PPS." />,
              preContent: null
          }
      },
      {
          id: 'practicas',
          label: 'Mis Prácticas',
          icon: 'work_history',
          content: practicasContent,
          badge: practicas.length > 0 ? practicas.length : undefined,
          desktopConfig: { showInTabs: true },
          mobileConfig: { 
              header: <MobileSectionHeader title="Historial de Prácticas" description="Registro de prácticas realizadas." />,
              preContent: <MobileCriteriaCard criterios={criterios} selectedOrientacion={selectedOrientacion} />
          }
      },
      {
          id: 'informes',
          label: 'Informes',
          icon: 'assignment_turned_in',
          content: informesContent,
          badge: informeTasks.length > 0 ? informeTasks.length : undefined,
          desktopConfig: { showInTabs: false }, // OCULTO EN PC EXPLÍCITAMENTE
          mobileConfig: { 
              header: <MobileSectionHeader title="Entrega de Informes" description="Sube y confirma tus informes finales." />,
              preContent: null
          }
      },
      {
          id: 'profile',
          label: 'Mi Perfil',
          icon: 'person',
          content: profileContent, // No extra wrapper here!
          desktopConfig: { showInTabs: true },
          mobileConfig: { 
              header: <MobileSectionHeader title="Mi Perfil" description="Mantén actualizados tus datos de contacto para recibir notificaciones." />,
              preContent: null
          }
      }
  ], [
      homeContent, solicitudesContent, practicasContent, informesContent, profileContent,
      solicitudes.length, practicas.length, informeTasks.length,
      criterios, selectedOrientacion, studentNameForPanel, studentDetails, isLoading
  ]);

  // Tab filtering for Desktop (Strict logic)
  const desktopTabs = useMemo(() => 
      VIEWS_CONFIG.filter(v => v.desktopConfig.showInTabs).map(v => ({
          id: v.id,
          label: v.label,
          icon: v.icon,
          content: v.content,
          badge: v.badge
      }))
  , [VIEWS_CONFIG]);

  useEffect(() => {
    // Si la pestaña activa no está en la configuración global, volver a inicio
    const isValid = VIEWS_CONFIG.some(v => v.id === currentActiveTab);
    if (!isValid) setCurrentActiveTab('inicio');
    
    // Safety check for PC: if we are on 'informes' but resize to PC, switch tab because 'informes' is hidden on PC
    const isMobile = window.innerWidth < 768;
    const viewDef = VIEWS_CONFIG.find(v => v.id === currentActiveTab);
    if (!isMobile && viewDef && !viewDef.desktopConfig.showInTabs) {
        setCurrentActiveTab('inicio');
    }
  }, [VIEWS_CONFIG, currentActiveTab, setCurrentActiveTab]);

  const hasData = useMemo(() => practicas.length > 0 || solicitudes.length > 0 || lanzamientos.length > 0 || informeTasks.length > 0, [practicas, solicitudes, lanzamientos, informeTasks]);
  const showEmptyState = useMemo(() => !isLoading && !hasData && isAdminViewing && !forceInteractiveMode, [isLoading, hasData, isAdminViewing, forceInteractiveMode]);

  // -- RENDER --
  
  if (isLoading) return <DashboardLoadingSkeleton />;
  if (error) return <ErrorState error={error.message} onRetry={() => refetchAll()} />;

  if (showEmptyState) {
    return (
      <>
        {isAdminViewing && <SimulationBanner />}
        <div className="print-only">
          <PrintableReport studentDetails={studentDetails} criterios={criterios} practicas={practicas} />
        </div>
        <div className="no-print">
          <div className="space-y-8 animate-fade-in-up">
            <WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={false} />
            <CriteriosPanel criterios={criterios} selectedOrientacion={selectedOrientacion} handleOrientacionChange={handleOrientacionChange} showSaveConfirmation={showSaveConfirmation} onRequestFinalization={handleOpenFinalization} />
            <Card className="border-slate-300/50 bg-slate-50/30">
              <EmptyState 
                  icon="search_off" 
                  title="Sin Resultados" 
                  message="No se encontró información de prácticas o solicitudes para este estudiante." 
                  action={
                    <div className="flex gap-3 justify-center mt-4">
                        <button onClick={refetchAll} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm">
                            Actualizar Datos
                        </button>
                        <button 
                            onClick={() => setForceInteractiveMode(true)} 
                            className="px-6 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm flex items-center gap-2"
                        >
                            <span className="material-icons !text-base">input</span>
                            Gestionar / Inscribir
                        </button>
                    </div>
                  } 
              />
            </Card>
          </div>
           <WhatsAppExportButton practicas={practicas} criterios={criterios} selectedOrientacion={selectedOrientacion} studentNameForPanel={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />
        </div>
      </>
    );
  }

  // --- RENDERIZADO MAESTRO ---
  
  const activeViewConfig = VIEWS_CONFIG.find(v => v.id === currentActiveTab);

  return (
    <>
      {isAdminViewing && <SimulationBanner />}
      
      {isFinalizationModalOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
              <button onClick={() => setIsFinalizationModalOpen(false)} className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-slate-700/80 rounded-full hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-50 dark:text-slate-300 transition-colors shadow-sm backdrop-blur-sm">
                  <span className="material-icons">close</span>
              </button>
              <FinalizacionForm studentAirtableId={getStudentId()} onClose={() => setIsFinalizationModalOpen(false)} />
          </div>
        </div>
      )}

      <PreSolicitudCheckModal 
          isOpen={isPreCheckModalOpen}
          onClose={() => setIsPreCheckModalOpen(false)}
          onContinue={handleProceedToForm}
          existingInstitutions={existingInstitutions}
      />

      <div className="print-only">
          <PrintableReport studentDetails={studentDetails} criterios={criterios} practicas={practicas} />
      </div>

      <div className="no-print space-y-6 md:space-y-8 animate-fade-in-up">
        
        {/* ESTADO GLOBAL DE ACREDITACIÓN (Bloqueo) */}
        {finalizacionRequest ? (
             <div className="space-y-6">
                 <div className="md:hidden"><WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} /></div>
                 
                 <FinalizationStatusCard 
                    status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || 'Pendiente'} 
                    requestDate={finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] || finalizacionRequest.createdTime || ''} 
                    studentName={studentNameForPanel}
                />
                <div className="flex justify-center">
                    <p className="text-slate-500 italic text-sm">Tu panel está bloqueado mientras se procesa la acreditación.</p>
                </div>
            </div>
        ) : (
            <>
                {/* --- VISTA ESCRITORIO --- */}
                <div className="hidden md:block space-y-6">
                     <WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />
                     
                     <ErrorBoundary>
                        <CriteriosPanel 
                            criterios={criterios} 
                            selectedOrientacion={selectedOrientacion} 
                            handleOrientacionChange={handleOrientacionChange} 
                            showSaveConfirmation={showSaveConfirmation} 
                            onRequestFinalization={handleOpenFinalization} 
                        />
                     </ErrorBoundary>
                     
                     <Tabs
                        tabs={desktopTabs}
                        activeTabId={currentActiveTab}
                        onTabChange={(id) => setCurrentActiveTab(id as TabId)}
                     />
                </div>

                {/* --- VISTA MÓVIL --- */}
                <div className="md:hidden">
                    {/* Renderizamos dinámicamente según la configuración maestra */}
                    {activeViewConfig && (
                        <ErrorBoundary>
                             {/* 1. Header de Sección (Título) */}
                             {activeViewConfig.mobileConfig.header}

                             {/* 2. Pre-Content */}
                             {activeViewConfig.mobileConfig.preContent}
                             
                             {/* 3. Contenido Principal */}
                             {/* REMOVED Card wrapper here to avoid double border for profile */}
                             {activeViewConfig.content}
                        </ErrorBoundary>
                    )}
                </div>
            </>
        )}
      </div>
      
      {showExportButton && (
        <>
          <WhatsAppExportButton practicas={practicas} criterios={criterios} selectedOrientacion={selectedOrientacion} studentNameForPanel={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />
           <button onClick={() => window.print()} className="fixed bottom-6 right-24 z-50 w-14 h-14 bg-slate-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-slate-400" aria-label="Imprimir reporte">
             <span className="material-icons !text-2xl">print</span>
           </button>
        </>
      )}
    </>
  );
};

export default StudentDashboard;
