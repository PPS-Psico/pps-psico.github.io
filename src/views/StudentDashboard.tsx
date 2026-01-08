import React, { useState, useMemo, useCallback } from 'react';
import CriteriosPanel from '../components/student/CriteriosPanel';
import PracticasTable from '../components/student/PracticasTable';
import SolicitudesList from '../components/student/SolicitudesList';
import EmptyState from '../components/EmptyState';
import Tabs from '../components/Tabs';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import WelcomeBanner from '../components/student/WelcomeBanner';
import WhatsAppExportButton from '../components/student/WhatsAppExportButton';
import { useAuth } from '../contexts/AuthContext';
import type { AuthUser } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { TabId, Orientacion } from '../types';
import DashboardLoadingSkeleton from '../components/student/DashboardLoadingSkeleton';
import ErrorState from '../components/ErrorState';
import ProfileView from '../components/student/ProfileView';
import HomeView from '../components/student/HomeView';
import PrintableReport from '../components/student/PrintableReport';
import { useStudentPanel } from '../contexts/StudentPanelContext';
import FinalizacionForm from '../components/student/FinalizacionForm';
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
    FIELD_NOMBRE_PPS_LANZAMIENTOS
} from '../constants';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../contexts/ModalContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
// import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import FinalizationStatusCard from '../components/student/FinalizationStatusCard';
// import MobileSectionHeader from '../components/layout/MobileSectionHeader'; // Unused
import ErrorBoundary from '../components/ErrorBoundary';

// Export individual views for Router
export { default as StudentPracticas } from '../components/student/PracticasTable';
export { default as StudentSolicitudes } from '../components/student/SolicitudesList';

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
        studentAirtableId,
        lanzamientos,
        allLanzamientos,
        institutionAddressMap,
        enrollStudent,
        criterios,
        enrollmentMap,
        completedLanzamientoIds,
        informeTasks,
        finalizacionRequest
    } = useStudentPanel();

    const handleOpenFinalization = useCallback(() => {
        setIsFinalizationModalOpen(true);
    }, []);

    // BLOQUEO POR FINALIZACIÓN (Vista Estudiante Nativa)
    if (finalizacionRequest) {
        return (
            <div className="py-2 sm:py-6 animate-fade-in w-full max-w-7xl mx-auto">
                <FinalizationStatusCard
                    status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || 'Pendiente'}
                    requestDate={finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] || finalizacionRequest.created_at || ''}
                    studentName={studentDetails?.[FIELD_NOMBRE_ESTUDIANTES] || undefined}
                />
            </div>
        );
    }

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

// --- COMPONENT: StudentDashboard (Standalone Widget / Admin View) ---
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
    const [forceInteractiveMode, setForceInteractiveMode] = useState(false);
    const { openSolicitudPPSModal } = useModal();
    const { showToast } = useNotifications();
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
        isStudentLoading,
        isPracticasLoading,
        error,
        updateOrientation,
        updateInternalNotes,
        updateNota,
        updateFechaFin,
        enrollStudent,
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

    const { data: activeInstitutionsDB } = useQuery({
        queryKey: ['activeInstitutionsDB'],
        queryFn: () => db.instituciones.getAll({ fields: ['nombre'] })
    });

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

    const handleOpenFinalization = useCallback(() => {
        setIsFinalizationModalOpen(true);
    }, []);

    const existingInstitutions = useMemo(() => {
        const namesSet = new Set<string>();
        allLanzamientos.forEach(l => {
            const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (name) namesSet.add(name.split(' - ')[0].trim());
        });
        if (activeInstitutionsDB) {
            activeInstitutionsDB.forEach(inst => {
                if (inst.nombre) namesSet.add(inst.nombre.split(' - ')[0].trim());
            });
        }
        return Array.from(namesSet).sort((a, b) => a.localeCompare(b));
    }, [allLanzamientos, activeInstitutionsDB]);

    const createSolicitudMutation = useMutation({
        mutationFn: async (formData: any) => {
            const studentId = getStudentId();
            if (!studentId) throw new Error("Error identificando al estudiante.");
            const newRecord: any = {
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
            await db.solicitudes.create(newRecord);
        },
        onSuccess: () => {
            showToast('Tu solicitud de PPS ha sido registrada.', 'success');
            queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
        },
        onError: (err: any) => showToast(`Error: ${err.message} `, 'error')
    });

    const handleStartSolicitud = useCallback(() => setIsPreCheckModalOpen(true), []);

    const handleProceedToForm = useCallback(() => {
        setIsPreCheckModalOpen(false);
        openSolicitudPPSModal(async (data) => {
            await createSolicitudMutation.mutateAsync(data);
        });
    }, [openSolicitudPPSModal, createSolicitudMutation]);

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
    ), [enrollmentMap, allLanzamientos, informeTasks, lanzamientos, studentDetails, enrollStudent.mutate, institutionAddressMap, completedLanzamientoIds, criterios, handleOpenFinalization, setCurrentActiveTab]);



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

    const handleFechaFinChange = useCallback((practicaId: string, fecha: string) => {
        updateFechaFin.mutate({ practicaId, fecha });
    }, [updateFechaFin]);

    const practicasContent = useMemo(() => (
        <ErrorBoundary>
            <PracticasTable
                practicas={practicas}
                handleNotaChange={handleNotaChange}
                handleFechaFinChange={handleFechaFinChange}
                isLoading={isPracticasLoading}
            />
        </ErrorBoundary>
    ), [practicas, handleNotaChange, handleFechaFinChange]);

    const profileContent = useMemo(() => (
        <ErrorBoundary>
            <ProfileView studentDetails={studentDetails} isLoading={isLoading} updateInternalNotes={updateInternalNotes} />
        </ErrorBoundary>
    ), [studentDetails, isLoading, updateInternalNotes]);

    const studentDataTabs = useMemo(() => [
        { id: 'inicio' as TabId, label: 'Inicio', icon: 'home', content: homeContent },
        { id: 'solicitudes' as TabId, label: `Mis Solicitudes`, icon: 'list_alt', content: solicitudesContent, badge: solicitudes.length > 0 ? solicitudes.length : undefined },
        { id: 'practicas' as TabId, label: `Mis Prácticas`, icon: 'work_history', content: practicasContent, badge: practicas.length > 0 ? practicas.length : undefined },
        { id: 'profile' as TabId, label: 'Mi Perfil', icon: 'person', content: profileContent }
    ], [homeContent, solicitudesContent, practicasContent, profileContent, solicitudes.length, practicas.length]);

    const showEmptyState = useMemo(() => !isLoading && practicas.length === 0 && solicitudes.length === 0 && lanzamientos.length === 0 && informeTasks.length === 0 && isAdminViewing && !forceInteractiveMode, [isLoading, practicas.length, solicitudes.length, lanzamientos.length, informeTasks.length, isAdminViewing, forceInteractiveMode]);

    // Only block completely if CORE student data is missing.
    // If practicals/requests are loading, we show partial skeletons inside tabs.
    if (isStudentLoading) return <DashboardLoadingSkeleton />;
    if (error) return <ErrorState error={error.message} onRetry={() => refetchAll()} />;

    // CASO DE BLOQUEO POR FINALIZACIÓN (Solo si NO es un Admin mirando)
    if (finalizacionRequest && !isAdminViewing) {
        return (
            <div className="py-2 sm:py-6 animate-fade-in w-full max-w-7xl mx-auto">
                <FinalizationStatusCard
                    status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || 'Pendiente'}
                    requestDate={finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] || finalizacionRequest.created_at || ''}
                    studentName={studentNameForPanel}
                />
            </div>
        );
    }

    if (showEmptyState) {
        return (
            <>
                {isAdminViewing && <SimulationBanner />}
                <div className="print-only"><PrintableReport studentDetails={studentDetails} criterios={criterios} practicas={practicas} /></div>
                <div className="no-print space-y-8 animate-fade-in-up mt-6">
                    <WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={false} />
                    <CriteriosPanel criterios={criterios} selectedOrientacion={selectedOrientacion} handleOrientacionChange={handleOrientacionChange} showSaveConfirmation={showSaveConfirmation} onRequestFinalization={handleOpenFinalization} informeTasks={informeTasks} />
                    <Card className="border-slate-300/50 bg-slate-50/30">
                        <EmptyState icon="search_off" title="Sin Resultados" message="No se encontró información para este estudiante." action={<Button onClick={() => setForceInteractiveMode(true)} icon="input" variant="secondary">Gestionar / Inscribir</Button>} />
                    </Card>
                </div>
            </>
        );
    }

    return (
        <>
            {isAdminViewing && <SimulationBanner />}
            {isPreCheckModalOpen && <PreSolicitudCheckModal isOpen={isPreCheckModalOpen} onClose={() => setIsPreCheckModalOpen(false)} onContinue={handleProceedToForm} existingInstitutions={existingInstitutions} />}
            {isFinalizationModalOpen && (
                <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
                        <button onClick={() => setIsFinalizationModalOpen(false)} className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-slate-700/80 rounded-full text-slate-50 shadow-sm backdrop-blur-sm"><span className="material-icons">close</span></button>
                        <FinalizacionForm studentAirtableId={getStudentId()} onClose={() => setIsFinalizationModalOpen(false)} />
                    </div>
                </div>
            )}
            <div className="print-only"><PrintableReport studentDetails={studentDetails} criterios={criterios} practicas={practicas} /></div>
            <div className="hidden md:block no-print space-y-8 animate-fade-in-up mt-6">
                <WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />
                {finalizacionRequest && (
                    <FinalizationStatusCard status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || 'Pendiente'} requestDate={finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] || finalizacionRequest.created_at || ''} />
                )}
                {!finalizacionRequest && (
                    <CriteriosPanel criterios={criterios} selectedOrientacion={selectedOrientacion} handleOrientacionChange={handleOrientacionChange} showSaveConfirmation={showSaveConfirmation} onRequestFinalization={handleOpenFinalization} informeTasks={informeTasks} />
                )}
                <Tabs tabs={studentDataTabs} activeTabId={currentActiveTab} onTabChange={(id) => setCurrentActiveTab(id as TabId)} />
            </div>
            <div className="md:hidden no-print space-y-8 animate-fade-in-up mt-4">
                {currentActiveTab === 'inicio' && (
                    <>
                        <WelcomeBanner studentName={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />
                        {finalizacionRequest && <FinalizationStatusCard status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || 'Pendiente'} requestDate={finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] || finalizacionRequest.created_at || ''} />}
                        {homeContent}
                    </>
                )}
                {currentActiveTab === 'solicitudes' && <>{solicitudesContent}</>}
                {currentActiveTab === 'practicas' && <>{!finalizacionRequest && <CriteriosPanel criterios={criterios} selectedOrientacion={selectedOrientacion} handleOrientacionChange={handleOrientacionChange} showSaveConfirmation={showSaveConfirmation} onRequestFinalization={handleOpenFinalization} informeTasks={informeTasks} />}{practicasContent}</>}
                {currentActiveTab === 'profile' && <Card>{profileContent}</Card>}
            </div>
            {showExportButton && <WhatsAppExportButton practicas={practicas} criterios={criterios} selectedOrientacion={selectedOrientacion} studentNameForPanel={studentNameForPanel} studentDetails={studentDetails} isLoading={isLoading} />}
        </>
    );
};

export default StudentDashboard;
