
import React, { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import Loader from './components/Loader';
import Auth from './components/Auth';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ModalProvider, useModal } from './contexts/ModalContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ConfigProvider } from './contexts/ConfigContext'; // NEW
import ErrorBoundary from './components/ErrorBoundary';
import { PwaInstallProvider } from './contexts/PwaInstallContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useStudentPanel, StudentPanelProvider } from './contexts/StudentPanelContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from './lib/db';
import FinalizacionForm from './components/FinalizacionForm';
import PreSolicitudCheckModal from './components/PreSolicitudCheckModal';
import { NotificationProvider } from './contexts/NotificationContext';
import { 
    FIELD_LEGAJO_PPS,
    FIELD_SOLICITUD_LEGAJO_ALUMNO,
    FIELD_SOLICITUD_NOMBRE_ALUMNO,
    FIELD_SOLICITUD_EMAIL_ALUMNO,
    FIELD_EMPRESA_PPS_SOLICITUD,
    FIELD_SOLICITUD_LOCALIDAD,
    FIELD_SOLICITUD_DIRECCION,
    FIELD_SOLICITUD_EMAIL_INSTITUCION,
    FIELD_SOLICITUD_TELEFONO_INSTITUCION,
    FIELD_SOLICITUD_REFERENTE,
    FIELD_SOLICITUD_TIENE_CONVENIO,
    FIELD_SOLICITUD_TIENE_TUTOR,
    FIELD_SOLICITUD_CONTACTO_TUTOR,
    FIELD_SOLICITUD_TIPO_PRACTICA,
    FIELD_SOLICITUD_TIPO_PRACTICA as FIELD_SOLICITUD_TIPO_PRACTICA_CONST,
    FIELD_SOLICITUD_DESCRIPCION,
    FIELD_ESTADO_PPS,
    FIELD_ULTIMA_ACTUALIZACION_PPS,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_NOMBRE_PPS_LANZAMIENTOS
} from './constants';
import { parseToUTCDate, normalizeStringForComparison } from './utils/formatters';

// Views
const StudentView = lazy(() => import('./views/StudentView'));
import StudentDashboard, { StudentHome } from './views/StudentDashboard';

const AdminView = lazy(() => import('./views/AdminView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const LanzadorView = lazy(() => import('./views/admin/LanzadorView'));
const GestionView = lazy(() => import('./views/admin/GestionView'));
const HerramientasView = lazy(() => import('./views/admin/HerramientasView'));
const MetricsView = lazy(() => import('./views/admin/MetricsView'));
const SolicitudesManager = lazy(() => import('./components/SolicitudesManager'));
const JefeView = lazy(() => import('./views/JefeView'));
const DirectivoView = lazy(() => import('./views/DirectivoView'));
const ReporteroView = lazy(() => import('./views/ReporteroView'));
const AdminTestingView = lazy(() => import('./views/AdminTestingView'));

// Internal wrappers using hooks
import PracticasTable from './components/PracticasTable';
import SolicitudesList from './components/SolicitudesList';
import InformesList from './components/InformesList';
import ProfileView from './components/ProfileView';
import Card from './components/Card';
import MobileSectionHeader from './components/MobileSectionHeader';

const PageWrapper: React.FC<{ title: React.ReactNode; icon: string; children: React.ReactNode; description?: string }> = ({ title, icon, children, description }) => {
    return (
        <>
            {/* Vista Móvil: Header separado del contenido */}
            <div className="md:hidden animate-fade-in-up">
                <MobileSectionHeader title={title} description={description} />
                <div className="mt-4">
                    {children}
                </div>
            </div>
            {/* Vista Escritorio: Tarjeta unificada */}
            <div className="hidden md:block animate-fade-in-up">
                <Card title={title} icon={icon} description={description}>
                    {children}
                </Card>
            </div>
        </>
    );
};

// --- WRAPPERS ---

const StudentPracticasWrapper = () => {
    const { practicas, updateNota } = useStudentPanel();
    return (
        <PageWrapper 
            icon="work_history" 
            title={<span>Historial de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Prácticas</span></span>}
            description="Detalle de todas las prácticas realizadas y sus calificaciones."
        >
            <PracticasTable practicas={practicas} handleNotaChange={(pid, n, cid) => updateNota.mutate({ practicaId: pid, nota: n, convocatoriaId: cid })} />
        </PageWrapper>
    );
};

const StudentSolicitudesWrapper = () => {
    const { solicitudes, studentDetails, criterios, allLanzamientos, finalizacionRequest } = useStudentPanel();
    const { openSolicitudPPSModal, showModal } = useModal();
    const { authenticatedUser } = useAuth();
    const queryClient = useQueryClient();
    const [isFinalizationModalOpen, setIsFinalizationModalOpen] = useState(false);
    const [isPreCheckModalOpen, setIsPreCheckModalOpen] = useState(false);

    const getStudentId = () => {
        if (studentDetails && (studentDetails as any).id) return (studentDetails as any).id;
        return authenticatedUser?.id || null;
    };

    const existingInstitutions = useMemo(() => {
        const namesSet = new Set<string>();
        const currentYear = new Date().getFullYear();
        const excludedTerms = [
            "relevamiento del ejercicio profesional", 
            "jornada universitaria de salud mental"
        ];
        
        allLanzamientos.forEach(l => {
            const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            const dateStr = l[FIELD_FECHA_INICIO_LANZAMIENTOS];
            
            if (name && dateStr) {
                const date = parseToUTCDate(dateStr);
                if (date && date.getUTCFullYear() === currentYear) {
                    const lowerName = normalizeStringForComparison(name);
                    
                    if (!excludedTerms.some(term => lowerName.includes(term))) {
                         const groupName = name.split(' - ')[0].trim();
                         namesSet.add(groupName);
                    }
                }
            }
        });

        return Array.from(namesSet)
            .map(name => name.charAt(0).toUpperCase() + name.slice(1))
            .sort((a, b) => a.localeCompare(b));
    }, [allLanzamientos]);

    const createSolicitudMutation = useMutation({
        mutationFn: async (formData: any) => {
            const studentId = getStudentId();
            if (!studentId) throw new Error("Error identificando al estudiante.");

            const newRecord = {
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

    const handleStartSolicitud = useCallback(() => {
        setIsPreCheckModalOpen(true);
    }, []);

    const handleProceedToForm = useCallback(() => {
        setIsPreCheckModalOpen(false);
        openSolicitudPPSModal(async (data) => {
            await createSolicitudMutation.mutateAsync(data);
        });
    }, [openSolicitudPPSModal, createSolicitudMutation]);

    return (
        <>
            <PageWrapper 
                icon="list_alt" 
                title={<span>Mis <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Solicitudes</span></span>}
                description="Seguimiento del estado de las PPS que has solicitado."
            >
                <SolicitudesList 
                    solicitudes={solicitudes} 
                    onCreateSolicitud={handleStartSolicitud}
                    onRequestFinalization={() => setIsFinalizationModalOpen(true)}
                    criterios={criterios}
                    finalizacionRequest={finalizacionRequest}
                />
            </PageWrapper>
            
            <PreSolicitudCheckModal 
                /* FIX: Corrected variable name from isPreCheckOpen to isPreCheckModalOpen to match the defined state */
                isOpen={isPreCheckModalOpen}
                onClose={() => setIsPreCheckModalOpen(false)}
                onContinue={handleProceedToForm}
                existingInstitutions={existingInstitutions}
            />

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
        </>
    );
};

const StudentInformesWrapper = () => {
    const { informeTasks, confirmInforme } = useStudentPanel();
    return (
        <PageWrapper 
            icon="assignment_turned_in" 
            title={<span>Entrega de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Informes</span></span>}
            description="Sube tu informe final al campus y luego confirma la entrega aquí."
        >
            <InformesList tasks={informeTasks} onConfirmar={confirmInforme.mutate} />
        </PageWrapper>
    );
};

const StudentProfileWrapper = () => {
    const { studentDetails, isLoading, updateInternalNotes } = useStudentPanel();
    return (
        <PageWrapper 
            icon="person" 
            title={<span>Mi <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Perfil</span></span>}
            description="Datos personales y académicos."
        >
            <ProfileView studentDetails={studentDetails} isLoading={isLoading} updateInternalNotes={updateInternalNotes} />
        </PageWrapper>
    );
};

const AdminStudentWrapper = () => {
    const { legajo } = useParams();
    if (!legajo) return null;
    return (
        <StudentPanelProvider legajo={legajo}>
            <StudentDashboard key={legajo} user={{ legajo, nombre: 'Estudiante' } as any} showExportButton />
        </StudentPanelProvider>
    );
};


const AppRoutes = () => {
    const { authenticatedUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    return (
        <Routes>
            <Route path="/login" element={!authenticatedUser ? <Auth /> : <Navigate to="/" />} />
            
            <Route path="/" element={<ProtectedRoute>
                {/* Redirect Logic based on Role */}
                {authenticatedUser?.role === 'AdminTester' 
                    ? <Navigate to="/testing" replace />
                    : authenticatedUser?.role === 'SuperUser' 
                        ? <Navigate to="/admin" replace /> 
                        : authenticatedUser?.role === 'Jefe' 
                            ? <Navigate to="/jefe" replace /> 
                            : authenticatedUser?.role === 'Directivo' 
                                ? <Navigate to="/directivo" replace /> 
                                : authenticatedUser?.role === 'Reportero' 
                                    ? <Navigate to="/reportero" replace /> 
                                    : <Navigate to="/student" replace />
                }
            </ProtectedRoute>} />

            <Route path="/student" element={<ProtectedRoute allowedRoles={['Student']}><StudentView /></ProtectedRoute>}>
                <Route index element={<StudentHome />} />
                <Route path="practicas" element={<StudentPracticasWrapper />} />
                <Route path="solicitudes" element={<StudentSolicitudesWrapper />} />
                <Route path="informes" element={<StudentInformesWrapper />} />
                <Route path="perfil" element={<StudentProfileWrapper />} />
            </Route>

            <Route path="/admin" element={<ProtectedRoute allowedRoles={['SuperUser', 'AdminTester']}><AdminView /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="metrics" element={<MetricsView onStudentSelect={(s) => navigate(`/admin/estudiantes/${s.legajo}`)} />} />
                <Route path="lanzador" element={<LanzadorView />} />
                <Route path="gestion" element={<GestionView />} />
                <Route path="solicitudes" element={<SolicitudesManager />} />
                <Route path="herramientas" element={<HerramientasView onStudentSelect={(s) => navigate(`/admin/estudiantes/${s[FIELD_LEGAJO_ESTUDIANTES]}`)} />} />
                <Route path="estudiantes/:legajo" element={<AdminStudentWrapper />} />
            </Route>

            <Route path="/jefe" element={<ProtectedRoute allowedRoles={['Jefe']}><JefeView /></ProtectedRoute>} />
            <Route path="/directivo" element={<ProtectedRoute allowedRoles={['Directivo']}><DirectivoView /></ProtectedRoute>} />
            <Route path="/reportero" element={<ProtectedRoute allowedRoles={['Reportero']}><ReporteroView /></ProtectedRoute>} />
            
            <Route path="/testing" element={<ProtectedRoute allowedRoles={['SuperUser', 'AdminTester']}><AdminTestingView /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

const App: React.FC = () => {
  return (
    <Router>
        <ConfigProvider>
            <NotificationProvider>
                <PwaInstallProvider>
                    <ThemeProvider>
                        <ModalProvider>
                            <ErrorBoundary>
                                <Layout>
                                    <Suspense fallback={<Loader />}>
                                        <AppRoutes />
                                    </Suspense>
                                </Layout>
                            </ErrorBoundary>
                        </ModalProvider>
                    </ThemeProvider>
                </PwaInstallProvider>
            </NotificationProvider>
        </ConfigProvider>
    </Router>
  );
};

export default App;
