
import React from 'react';
import Card from './Card';
import Toggle from './Toggle';
import { useAdminPreferences } from '../contexts/AdminPreferencesContext';

const PersonalizationPanel: React.FC = () => {
    const { preferences, toggleModule, resetPreferences } = useAdminPreferences();

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-2xl p-6 text-white shadow-lg mb-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <span className="material-icons !text-3xl">tune</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Personalización del Panel</h2>
                        <p className="text-violet-100 font-medium mt-1 text-sm max-w-xl">
                            Activa o desactiva herramientas según tu flujo de trabajo. Estos cambios solo afectan a tu navegador y no modifican la experiencia de otros administradores.
                        </p>
                    </div>
                </div>
            </div>

            <Card title="Configuración de Módulos" icon="dashboard_customize">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    
                    {/* Dashboard & Principal */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Experiencia Principal</h4>
                        
                        <Toggle 
                            label="Análisis IA (Smart Briefing)" 
                            description="Muestra el resumen inteligente y alertas en el Dashboard."
                            icon="auto_awesome"
                            checked={preferences.showAiInsights} 
                            onChange={() => toggleModule('showAiInsights')} 
                        />
                        
                        <Toggle 
                            label="Pestaña de Gestión 2026" 
                            description="Habilita la planificación futura y gestión de relanzamientos."
                            icon="rocket_launch"
                            checked={preferences.showManagementTab} 
                            onChange={() => toggleModule('showManagementTab')} 
                        />
                         <Toggle 
                            label="Historial de Lanzamientos" 
                            description="Muestra la pestaña de historial en la vista de Lanzador."
                            icon="history"
                            checked={preferences.showLaunchHistory} 
                            onChange={() => toggleModule('showLaunchHistory')} 
                        />
                    </div>

                    {/* Herramientas Específicas */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Herramientas Avanzadas</h4>

                        <Toggle 
                            label="Gestor de Penalizaciones" 
                            description="Sistema para aplicar y visualizar sanciones a alumnos."
                            icon="gavel"
                            checked={preferences.showPenalizations} 
                            onChange={() => toggleModule('showPenalizations')} 
                        />
                        
                        <Toggle 
                            label="Automatización de Emails" 
                            description="Editor de plantillas y configuración de envíos automáticos."
                            icon="mark_email_read"
                            checked={preferences.showAutomation} 
                            onChange={() => toggleModule('showAutomation')} 
                        />

                        <Toggle 
                            label="Integridad de Datos" 
                            description="Herramienta técnica para detectar duplicados y errores."
                            icon="health_and_safety"
                            checked={preferences.showIntegrity} 
                            onChange={() => toggleModule('showIntegrity')} 
                        />
                        
                        <Toggle 
                            label="Nuevos Convenios" 
                            description="Panel para confirmar convenios institucionales nuevos."
                            icon="handshake"
                            checked={preferences.showNewAgreements} 
                            onChange={() => toggleModule('showNewAgreements')} 
                        />

                         <Toggle 
                            label="Generador de Reportes" 
                            description="Herramienta para balances anuales y comparativos."
                            icon="summarize"
                            checked={preferences.showReports} 
                            onChange={() => toggleModule('showReports')} 
                        />
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button 
                        onClick={resetPreferences}
                        className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors flex items-center gap-2"
                    >
                        <span className="material-icons !text-lg">restart_alt</span>
                        Restaurar Valores por Defecto
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default PersonalizationPanel;
