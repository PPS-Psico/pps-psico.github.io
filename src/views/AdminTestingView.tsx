
import React, { useState } from 'react';
import AdminView from './AdminView';
import StudentDashboard from './StudentDashboard';

import AppModals from '../components/AppModals';

import { AuthUser } from '../contexts/AuthContext';
import { StudentPanelProvider } from '../contexts/StudentPanelContext';
import type { TabId } from '../types';

const AdminTestingView: React.FC = () => {
    const [activeTabId, setActiveTabId] = useState('student');
    const [studentTabId, setStudentTabId] = useState<TabId>('inicio');

    // Usuario simulado para la vista de estudiante
    const testingUser: AuthUser = {
        legajo: '99999',
        nombre: 'Usuario de Prueba',
        role: 'AdminTester'
    };

    const mobileNavTabs = [
        { id: 'inicio' as TabId, label: 'Inicio', icon: 'home', path: '#' },
        { id: 'practicas' as TabId, label: 'Prácticas', icon: 'work_history', path: '#' },
        { id: 'solicitudes' as TabId, label: 'Solicitudes', icon: 'list_alt', path: '#' },
        { id: 'profile' as TabId, label: 'Perfil', icon: 'person', path: '#' },
    ];

    // Interceptar navegación móvil simulada
    const MobileNavSimulated = () => (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 safe-area-bottom">
            <div className="flex justify-around items-center h-[70px] pb-2">
                {mobileNavTabs.map((tab) => {
                    const isActive = tab.id === studentTabId;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setStudentTabId(tab.id)}
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                            className="relative flex flex-col items-center justify-center w-full h-full group focus:outline-none active:bg-transparent"
                        >
                            {isActive && (
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-10 h-1 bg-blue-600 dark:bg-blue-500 rounded-b-lg shadow-sm animate-fade-in z-20"></div>
                            )}

                            <div className={`transition-all duration-300 ease-out transform ${isActive ? '-translate-y-1' : 'group-hover:-translate-y-0.5'}`}>
                                <div className={`p-1.5 rounded-xl transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 dark:text-slate-500'}`}>
                                    <span className={`material-icons !text-2xl ${isActive ? 'filled' : 'outlined'}`}>{tab.icon}</span>
                                </div>
                            </div>

                            <span className={`text-[10px] mt-1 font-bold transition-colors duration-300 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in-up pb-20">
            {/* Header Sticky para cambiar de rol fácilmente */}
            <div className="sticky top-20 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-400">
                        <span className="material-icons">science</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                            Entorno de Simulación
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Datos aislados de producción.
                        </p>
                    </div>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTabId('student')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTabId === 'student'
                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        <span className="material-icons !text-lg">school</span>
                        Vista Alumno
                    </button>
                    <button
                        onClick={() => setActiveTabId('admin')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTabId === 'admin'
                                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        <span className="material-icons !text-lg">admin_panel_settings</span>
                        Vista Admin
                    </button>
                </div>
            </div>

            <div className="mt-4">
                {activeTabId === 'student' ? (
                    <div className="bg-slate-50 dark:bg-black/20 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 ring-4 ring-slate-100 dark:ring-slate-900 pb-24 md:pb-6 relative overflow-hidden">
                        {/* Envolvemos en el Provider con el legajo mock (99999) que activa el modo test en los hooks */}
                        <StudentPanelProvider legajo={testingUser.legajo}>
                            <StudentDashboard
                                user={testingUser}
                                showExportButton={false}
                                activeTab={studentTabId}
                                onTabChange={setStudentTabId}
                            />
                        </StudentPanelProvider>

                        {/* Simulación de Barra Móvil dentro del contenedor */}
                        <MobileNavSimulated />
                    </div>
                ) : (
                    <div className="bg-slate-50 dark:bg-black/20 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 ring-4 ring-slate-100 dark:ring-slate-900">
                        <AdminView isTestingMode={true} />
                    </div>
                )}
            </div>

            {/* Modales globales para que funcionen las interacciones dentro de las simulaciones */}
            <AppModals />
        </div>
    );
};

export default AdminTestingView;
