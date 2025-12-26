
import React, { useState, lazy, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminPreferences } from '../contexts/AdminPreferencesContext';
import Loader from '../components/Loader';
import AppModals from '../components/AppModals';
import UnifiedTabs, { TabItem } from '../components/UnifiedTabs';
import { useTheme } from '../contexts/ThemeContext';

// Components for Testing Mode
const AdminDashboard = lazy(() => import('../components/AdminDashboard'));
const LanzadorView = lazy(() => import('./admin/LanzadorView'));
const GestionView = lazy(() => import('./admin/GestionView'));
const SolicitudesManager = lazy(() => import('../components/SolicitudesManager'));
const HerramientasView = lazy(() => import('./admin/HerramientasView'));
const MetricsView = lazy(() => import('./admin/MetricsView'));

interface AdminViewProps {
    isTestingMode?: boolean;
}

const AdminView: React.FC<AdminViewProps> = ({ isTestingMode = false }) => {
    const { authenticatedUser, logout } = useAuth();
    const { preferences } = useAdminPreferences();
    const { resolvedTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    
    const [localTab, setLocalTab] = useState('dashboard');
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Determine current active tab ID logic
    let currentTabId = isTestingMode ? localTab : '';
    if (!isTestingMode) {
        if (location.pathname.includes('/estudiantes/')) {
            currentTabId = 'student-profile';
        } else if (location.pathname.includes('/admin/lanzador')) {
            currentTabId = 'lanzador';
        } else if (location.pathname.includes('/admin/gestion')) {
            currentTabId = 'gestion';
        } else if (location.pathname.includes('/admin/solicitudes')) {
            currentTabId = 'solicitudes';
        } else if (location.pathname.includes('/admin/metrics')) {
            currentTabId = 'metrics';
        } else if (location.pathname.includes('/admin/herramientas')) {
            currentTabId = 'herramientas';
        } else {
            currentTabId = 'dashboard';
        }
    }

    // Build tabs list dynamically
    const navItems = useMemo<TabItem[]>(() => {
        const baseTabs: TabItem[] = [
            { id: 'dashboard', label: 'Inicio', icon: 'dashboard', path: '/admin/dashboard' },
            { id: 'lanzador', label: 'Lanzador', icon: 'rocket_launch', path: '/admin/lanzador' },
        ];

        if (preferences.showManagementTab) {
            baseTabs.push({ id: 'gestion', label: 'Gestión', icon: 'tune', path: '/admin/gestion' });
        }

        baseTabs.push(
            { id: 'solicitudes', label: 'Solicitudes', icon: 'list_alt', path: '/admin/solicitudes' },
            { id: 'metrics', label: 'Métricas', icon: 'analytics', path: '/admin/metrics' },
            { id: 'herramientas', label: 'Herramientas', icon: 'construction', path: '/admin/herramientas' },
        );

        // Dynamic Student Tab
        if (!isTestingMode && currentTabId === 'student-profile') {
            baseTabs.push({
                id: 'student-profile',
                label: `Alumno ${params.legajo}`,
                icon: 'school',
                path: location.pathname 
            });
        }

        return baseTabs;
    }, [preferences.showManagementTab, isTestingMode, currentTabId, params.legajo, location.pathname]);


    const handleTabChange = (tabId: string, path?: string) => {
        if (isTestingMode) {
            setLocalTab(tabId);
        } else if (path) {
            navigate(path);
        }
    }

    const handleCloseStudentTab = (_id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigate('/admin/herramientas');
    };

    const handleTestStudentSelect = (student: any) => {
        alert('Navegación simulada al perfil de: ' + student.nombre + ' (' + student.legajo + ')');
    };

    const renderContent = () => {
        if (!isTestingMode) {
            return (
                <React.Suspense fallback={<div className="flex justify-center p-20"><Loader /></div>}>
                    <Outlet />
                </React.Suspense>
            );
        }

        // Mock routing for testing mode
        return (
            <React.Suspense fallback={<div className="flex justify-center p-20"><Loader /></div>}>
                <div className="bg-white dark:bg-[#0B1120] rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 p-8 min-h-[600px] animate-fade-in-up">
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
        <div className="min-h-screen bg-white dark:bg-[#020617]">
            {/* --- UNIFIED HEADER --- */}
            <header className={`sticky top-0 z-40 transition-all duration-300 border-b ${scrolled ? 'bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 shadow-sm py-2' : 'bg-transparent border-transparent py-4'}`}>
                <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        
                        {/* Logo Area */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                             <div className="md:hidden">
                                 {/* Only Show simplified logo on mobile header if needed */}
                             </div>
                        </div>

                        {/* Centered Navigation */}
                        <div className="flex-1 flex justify-center w-full md:w-auto overflow-x-auto no-scrollbar">
                            <UnifiedTabs 
                                tabs={navItems}
                                activeTabId={currentTabId}
                                onTabChange={handleTabChange}
                                onTabClose={currentTabId === 'student-profile' ? handleCloseStudentTab : undefined}
                                layoutIdPrefix="admin-main-nav"
                            />
                        </div>

                        {/* Right Area (User/Actions) - REDESIGNED */}
                        {!isTestingMode && (
                           <div className="hidden md:flex items-center">
                               <div className="flex items-center gap-3 pl-4 pr-2 py-1.5 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-full backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 group">
                                   <div className="text-right hidden lg:block">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                                            {authenticatedUser?.role || 'Admin'}
                                        </p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">
                                            {authenticatedUser?.nombre?.split(' ')[0]}
                                        </p>
                                   </div>
                                   <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md border border-white/10 group-hover:scale-105 transition-transform">
                                       <span className="text-xs font-bold">{authenticatedUser?.nombre?.charAt(0)}</span>
                                   </div>
                                   <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                   <button 
                                        onClick={logout}
                                        className="w-8 h-8 rounded-full bg-transparent hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center"
                                        title="Cerrar Sesión"
                                    >
                                        <span className="material-icons !text-base">logout</span>
                                    </button>
                               </div>
                           </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* WelcomeBannerAdmin removed - now integrated into SmartBriefing */}
                {renderContent()}
            </main>
            
            <AppModals />
        </div>
    );
};

export default AdminView;
