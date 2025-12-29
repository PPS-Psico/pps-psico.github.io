
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import CriteriosPanel from '../components/CriteriosPanel';
import PracticasTable from '../components/PracticasTable';
import SolicitudesList from '../components/SolicitudesList';
import EmptyState from '../components/EmptyState';
import Tabs from '../components/Tabs';
import Card from '../components/Card';
import WelcomeBanner from '../components/WelcomeBanner';
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
import PreSolicitudCheckModal from '../components/PreSolicitudCheckModal';
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
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_NOMBRE_INSTITUCIONES,
    FIELD_CONVENIO_NUEVO_INSTITUCIONES
} from '../constants';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../contexts/ModalContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { addBusinessDays, parseToUTCDate, normalizeStringForComparison } from '../utils/formatters';
import FinalizationStatusCard from '../components/FinalizationStatusCard';
import MobileSectionHeader from '../components/MobileSectionHeader';
import ErrorBoundary from '../components/ErrorBoundary';

// Export individual views for Router
export { default as StudentPracticas } from '../components/PracticasTable';
export { default as StudentSolicitudes } from '../components/SolicitudesList';

// --- COMPONENT: Simulation Banner ---
const SimulationBanner: React.FC<{ onExit?: () => void }> = ({ onExit }) => (
    <div className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-4 py-2 flex items-center justify-between shadow-sm sticky top-[60px] md:top-[80px] z-40">
        <div className="flex items-center gap-2">
            <span className="material-icons text-amber-600 dark:text-amber-400 !text-xl animate-pulse">visibility</span>
            <span className="text-xs font-bold uppercase tracking-wide">Modo Simulación: Estás actuando como este estudiante</span>
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
        studentAirtableId, // Retrieved from context
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
                    {/* Use context ID directly */}
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

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, activeTab, onTabChange, showExportButton = false }) => {
  const { isSuperUserMode, isJefeMode, authenticatedUser } = useAuth();
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isFinalizationModalOpen, setIsFinalizationModalOpen] = useState(false);
  const [isPreCheckModalOpen, setIsPreCheckModalOpen] = useState(false);
  const [forceInteractiveMode, setForceInteractiveMode] = useState(false); // New state to override empty view
  const { openSolicitudPPSModal, showModal } = useModal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const currentUser = user || authenticatedUser;
  const isAdminViewing = isSuperUserMode || isJefeMode;

  const {
    studentDetails,
    studentAirtableId, // Use the ID provided by context
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
    refetchAll,
    criterios,
    enrollmentMap,
    completedLanzamientoIds,
    informeTasks,
    finalizacionRequest // New from context
  } = useStudentPanel();

  const [internalActiveTab, setInternalActiveTab] = useState<TabId>(showExportButton ? 'practicas' : 'inicio');
  const currentActiveTab = activeTab ?? internalActiveTab;
  const setCurrentActiveTab = onTabChange ?? setInternalActiveTab;
  
  const selectedOrientacion = (studentDetails?.[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || "") as Orientacion | "";
  const studentNameForPanel = studentDetails?.[FIELD_NOMBRE_ESTUDIANTES] || currentUser?.nombre || 'Estudiante';

  // Fetch institutions for the warning modal directly from DB to ensure completeness
  const { data: activeInstitutionsDB } = useQuery({
      queryKey: ['activeInstitutionsDB', isAdminViewing],
      queryFn: () => db.instituciones.getAll({ fields: [FIELD_NOMBRE_INSTITUCIONES] })
  });

  // Helper to safely get student ID - prioritize context ID
  const getStudentId = () => {
      return studentAirtableId || currentUser?.id || null;
  };

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

  const handleOpenFinalization = useCallback(() => {
      setIsFinalizationModalOpen(true);
  }, []);

  // Compute existing institutions from launches AND direct DB list for the warning modal
  const existingInstitutions = useMemo(() => {
      const namesSet = new Set<string>();
      const excludedTerms = [
          "relevamiento del ejercicio profesional", 
          "jornada universitaria de salud mental"
      ];
      
      // 1. From ALL Launches (Active and Historical)
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

      // 2. From Institutions Table (ALL of them, regardless of year/agreement type)
      // This ensures we catch all previously registered institutions to prevent duplicates.
      if (activeInstitutionsDB) {
          activeInstitutionsDB.forEach(inst => {
              const name = inst[FIELD_NOMBRE_INSTITUCIONES];
              if (name) {
                   const groupName = name.split(' - ')[0].trim();
                   namesSet.add(groupName);
              }
          });
      }

      return Array.from(namesSet)
          .map(name => name.charAt(0).toUpperCase() + name.slice(1))
          .sort((a, b) => a.localeCompare(b));
  }, [allLanzamientos, activeInstitutionsDB]);

  // Create new PPS Request Mutation
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
          queryClient.invalidateQueries({ queryKey: ['solicitudes'] }); // Refresh list
      },
      onError: (err: any) => {
          showModal('Error', `Hubo un problema al enviar la solicitud: ${err.message}`);
      }
  });

  const handleStartSolicitud = useCallback(() => {
      setIsPreCheckModalOpen(true);
  }, []);

  const handleProceedToForm = useCallback(() => {
      setIsPreCheckModalOpen(false);
      openSolicitudPPSModal(async (data) => {
          await createSolicitudMutation.mutateAsync(data);
      });
  }, [openSolicitudPPSModal, createSolicitudMutation]);
  
  // Tab Contents Wrappers with ErrorBoundary
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
            informeTasks={informeTasks}
        />
    </ErrorBoundary>
  ), [solicitudes, handleStartSolicitud, handleOpenFinalization, criterios, informeTasks]);

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

  const studentDataTabs = useMemo(() => {
    const tabs: { id: TabId; label: string; icon: string; content: React.ReactNode; badge?: number }[] = [
      { id: 'inicio', label: 'Inicio', icon: 'home', content: homeContent },
      { id: 'solicitudes', label: `Mis Solicitudes`, icon: 'list_alt', content: solicitudesContent, badge: solicitudes.length > 0 ? solicitudes.length : undefined },
      { id: 'practicas', label: `Mis Prácticas`, icon: 'work_history', content: practicasContent, badge: practicas.length > 0 ? practicas.length : undefined }
    ];

    tabs.push({
        id: 'profile' as TabId,
        label: 'Mi Perfil',
        icon: 'person',
        content: profileContent,
        badge: undefined
    });
    return tabs;

  }, [
      solicitudes.length, practicas.length, showExportButton,
      homeContent, solicitudesContent, practicasContent, profileContent
  ]);
  
  useEffect(() => {
    // Only scroll to top on mobile when switching tabs
    if (window.innerWidth < 768) {
      window.scrollTo(0, 0);
    }
    
    const isCurrentTabValid = studentDataTabs.some(tab => tab.id === currentActiveTab);
    if (!isCurrentTabValid && studentDataTabs.length > 0) {
      setCurrentActiveTab(studentDataTabs[0].id);
    }
  }, [studentDataTabs, currentActiveTab, setCurrentActiveTab]);

  const hasData = useMemo(() => practicas.length > 0 || solicitudes.length > 0 || lanzamientos.length > 0 || informeTasks.length > 0, [practicas, solicitudes, lanzamientos, informeTasks]);
  
  // Logic updated: Allow forceInteractiveMode to override the Empty State
  const showEmptyState = useMemo(() => !isLoading && !hasData && isAdminViewing && !forceInteractiveMode, [isLoading, hasData, isAdminViewing, forceInteractiveMode]);

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
           <button onClick={() => window.print()} className="fixed bottom-6 right-24 z-50 w-14 h-14 bg-slate-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ease-in-out transform hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-slate-400" aria-label="Imprimir reporte">
             <span className="material-icons !text-2xl">print</span>
           </button>
        </div>
      </>
    );
  }
  
  return (
    <>
      {/* Banner de Simulación para Admins */}
      {isAdminViewing && <SimulationBanner />}
      
      {isPreCheckModalOpen && (
          <PreSolicitudCheckModal 
              isOpen={isPreCheckModalOpen}
              onClose={() => setIsPreCheckModalOpen(false)}
              onContinue={handleProceedToForm}
              existingInstitutions={existingInstitutions}
          />
      )}

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
                studentAirtableId={getStudentId()} 
                onClose={() => setIsFinalizationModalOpen(false)}
              />
          </div>
        </div>
      )}

      <div className="print-only">
          <PrintableReport 
              studentDetails={studentDetails} 
              criterios={criterios} 
              practicas={practicas} 
          />
      </div>

      {/* --- VISTA DE ESCRITORIO --- */}
      <div className="hidden md:block no-print space-y-8 animate-fade-in-up">
        <WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />
        
        {finalizacionRequest ? (
            <FinalizationStatusCard 
                status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || 'Pendiente'} 
                requestDate={finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] || finalizacionRequest.createdTime || ''} 
            />
        ) : (
            <ErrorBoundary>
                <CriteriosPanel 
                    criterios={criterios} 
                    selectedOrientacion={selectedOrientacion} 
                    handleOrientacionChange={handleOrientacionChange} 
                    showSaveConfirmation={showSaveConfirmation} 
                    onRequestFinalization={handleOpenFinalization} 
                    informeTasks={informeTasks}
                />
            </ErrorBoundary>
        )}
        
        {/* REMOVED <Card> WRAPPER AROUND Tabs */}
        <Tabs
            tabs={studentDataTabs}
            activeTabId={currentActiveTab}
            onTabChange={(id) => setCurrentActiveTab(id as TabId)}
        />
      </div>

      {/* --- VISTA MÓVIL --- */}
      <div className="md:hidden no-print space-y-8 animate-fade-in-up">
          {currentActiveTab === 'inicio' && (
              <>
                  <WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />
                  {finalizacionRequest && (
                      <FinalizationStatusCard 
                          status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || 'Pendiente'} 
                          requestDate={finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] || finalizacionRequest.createdTime || ''} 
                      />
                  )}
                  {homeContent}
              </>
          )}

          {currentActiveTab === 'solicitudes' && (
              <ErrorBoundary>
                 <MobileSectionHeader title="Mis Solicitudes de PPS" description="Seguimiento del estado de las Prácticas Profesionales Supervisadas que has solicitado." />
                 {solicitudesContent}
              </ErrorBoundary>
          )}
          
          {currentActiveTab === 'practicas' && (
              <ErrorBoundary>
                  <MobileSectionHeader title="Historial de Prácticas" description="Detalle de todas las prácticas que has realizado y sus calificaciones." />
                  {!finalizacionRequest && <CriteriosPanel criterios={criterios} selectedOrientacion={selectedOrientacion} handleOrientacionChange={handleOrientacionChange} showSaveConfirmation={showSaveConfirmation} onRequestFinalization={handleOpenFinalization} informeTasks={informeTasks} />}
                  {practicasContent}
              </ErrorBoundary>
          )}

          {currentActiveTab === 'profile' && (
                <ErrorBoundary>
                  <MobileSectionHeader title="Mi Perfil" description="Administra tus datos personales y de contacto." />
                  {profileContent}
                </ErrorBoundary>
          )}
      </div>
      
      {showExportButton && (
        <>
          <WhatsAppExportButton practicas={practicas} criterios={criterios} selectedOrientacion={selectedOrientacion} studentNameForPanel={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />
            <button
            onClick={() => window.print()}
            className="fixed bottom-6 right-24 z-50 w-14 h-14 bg-slate-700 text-white rounded-full shadow-lg flex items-center justify-center
                        transition-all duration-300 ease-in-out transform hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-slate-400"
            aria-label="Imprimir reporte"
          >
            <span className="material-icons !text-2xl">print</span>
          </button>
        </>
      )}
    </>
  );
};

export default StudentDashboard;
