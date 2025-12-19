
import React, { useState, lazy, Suspense } from 'react';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminPreferences } from '../contexts/AdminPreferencesContext'; // Importar contexto
import WelcomeBannerAdmin from '../components/WelcomeBannerAdmin';
import Loader from '../components/Loader';
import AppModals from '../components/AppModals';
import { StudentPanelProvider } from '../contexts/StudentPanelContext';

// Components for Testing Mode (Imported directly to avoid Router outlet issues in test mode)
const AdminDashboard = lazy(() => import('../components/AdminDashboard'));
const LanzadorView = lazy(() => import('./admin/LanzadorView'));
const GestionView = lazy(() => import('./admin/GestionView'));
const SolicitudesManager = lazy(() => import('../components/SolicitudesManager'));
const HerramientasView = lazy(() => import('./admin/HerramientasView'));
const MetricsView = lazy(() => import('./admin/MetricsView'));

// Lazy load heavy components (kept for normal routing)
const StudentDashboard = lazy(() => import('./StudentDashboard'));

interface AdminViewProps {
    isTestingMode?: boolean;
}

const AdminView: React.FC<AdminViewProps> = ({ isTestingMode = false }) => {
    const { authenticatedUser } = useAuth();
    const { preferences } = useAdminPreferences(); // Consumir preferencias
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    
    // State for local tabs in testing mode (Bypasses React Router)
    const [localTab, setLocalTab] = useState('dashboard');

    // Construcción dinámica de pestañas basada en preferencias
    const tabs = [
        { id: 'dashboard', label: 'Inicio', icon: 'dashboard', path: '/admin/dashboard' },
        { id: 'lanzador', label: 'Lanzador', icon: 'rocket_launch', path: '/admin/lanzador' },
    ];

    if (preferences.showManagementTab) {
        tabs.push({ id: 'gestion', label: 'Gestión', icon: 'tune', path: '/admin/gestion' });
    }

    tabs.push(
        { id: 'solicitudes', label: 'Solicitudes', icon: 'list_alt', path: '/admin/solicitudes' },
        { id: 'metrics', label: 'Métricas', icon: 'analytics', path: '/admin/metrics' },
        { id: 'herramientas', label: 'Herramientas', icon: 'construction', path: '/admin/herramientas' },
    );

    const isActive = (tabId: string, path: string) => {
        if (isTestingMode) return localTab === tabId;
        return location.pathname.startsWith(path);
    }

    const handleTabClick = (tabId: string, path: string) => {
        if (isTestingMode) {
            setLocalTab(tabId);
        } else {
            navigate(path);
        }
    }

    // Function to mimic navigation to a student detail in testing mode
    const handleTestStudentSelect = (student: any) => {
        alert(`Navegación simulada al perfil de: ${student.nombre} (${student.legajo})`);
    };

    const renderContent = () => {
        // PROD MODE: Use Router Outlet
        if (!isTestingMode) {
            return (
                <React.Suspense fallback={<div className="flex justify-center p-8"><Loader /></div>}>
                    <Outlet />
                </React.Suspense>
            );
        }

        // TESTING MODE: Render components conditionally based on local state
        return (
            <React.Suspense fallback={<div className="flex justify-center p-8"><Loader /></div>}>
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 min-h-[600px]">
                    {localTab === 'dashboard' && <AdminDashboard isTestingMode={true} />}
                    {localTab === 'lanzador' && <LanzadorView isTestingMode={true} />}
                    {localTab === 'gestion' && (preferences.showManagementTab ? <GestionView isTestingMode={true} /> : <div className="p-8 text-center text-slate-500">Módulo desactivado</div>)}
                    {localTab === 'solicitudes' && <SolicitudesManager isTestingMode={true} />}
                    {localTab === 'metrics' && <MetricsView onStudentSelect={handleTestStudentSelect} isTestingMode={true} />}
                    {localTab === 'herramientas' && <HerramientasView onStudentSelect={handleTestStudentSelect} isTestingMode={true} />}
                </div>
            </React.Suspense>
        );
    }

    return (
        <div className="space-y-6">
            {!isTestingMode && <WelcomeBannerAdmin name={authenticatedUser?.nombre || 'Administrador'} />}
            
            {/* Contenedor de Navegación */}
            <div className="border-b border-slate-200 dark:border-white/10 relative">
                <nav className="-mb-px flex space-x-6 overflow-x-auto custom-scrollbar pb-1" aria-label="Tabs">
                    {tabs.map(tab => {
                        const active = isActive(tab.id, tab.path);
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab.id, tab.path)}
                                className={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-all duration-300 outline-none
                                    ${active 
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-white/20'}
                                `}
                            >
                                <span className={`material-icons !text-lg transition-transform duration-300 ${active ? 'scale-110' : ''}`}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        );
                    })}
                    {/* Dynamic Tab for Student Profile (Only in normal mode) */}
                    {!isTestingMode && location.pathname.includes('/estudiantes/') && (
                         <button
                            className="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400 animate-fade-in"
                         >
                            <span className="material-icons !text-lg">school</span>
                            Alumno {params.legajo}
                            <span 
                                className="material-icons !text-sm ml-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer" 
                                onClick={(e) => { e.stopPropagation(); navigate('/admin/herramientas'); }}
                            >close</span>
                         </button>
                    )}
                </nav>
            </div>

            <div className="pt-2">
                {renderContent()}
            </div>
            
            <AppModals />
        </div>
    );
};

export default AdminView;
