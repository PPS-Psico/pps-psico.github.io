
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Definición de qué módulos se pueden apagar/prender
export interface AdminModuleConfig {
    showAiInsights: boolean;      // Barra IA en Dashboard
    showManagementTab: boolean;   // Pestaña Gestión/Planificación 2026
    showLaunchHistory: boolean;   // Historial en Lanzador
    showPenalizations: boolean;   // Herramienta Penalizaciones
    showAutomation: boolean;      // Herramienta Automatización
    showIntegrity: boolean;       // Herramienta Integridad
    showNewAgreements: boolean;   // Herramienta Nuevos Convenios
    showReports: boolean;         // Herramienta Reportes
}

const DEFAULT_PREFERENCES: AdminModuleConfig = {
    showAiInsights: true,
    showManagementTab: true,
    showLaunchHistory: true,
    showPenalizations: true,
    showAutomation: true,
    showIntegrity: true,
    showNewAgreements: true,
    showReports: true,
};

interface AdminPreferencesContextType {
    preferences: AdminModuleConfig;
    toggleModule: (key: keyof AdminModuleConfig) => void;
    resetPreferences: () => void;
}

const AdminPreferencesContext = createContext<AdminPreferencesContextType | undefined>(undefined);

const STORAGE_KEY = 'admin_module_preferences_v1';

export const AdminPreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [preferences, setPreferences] = useState<AdminModuleConfig>(DEFAULT_PREFERENCES);

    // Cargar al inicio
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
            } catch (e) {
                console.warn("Error parsing admin preferences", e);
            }
        }
    }, []);

    // Guardar al cambiar
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }, [preferences]);

    const toggleModule = (key: keyof AdminModuleConfig) => {
        setPreferences(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const resetPreferences = () => {
        setPreferences(DEFAULT_PREFERENCES);
    };

    return (
        <AdminPreferencesContext.Provider value={{ preferences, toggleModule, resetPreferences }}>
            {children}
        </AdminPreferencesContext.Provider>
    );
};

export const useAdminPreferences = () => {
    const context = useContext(AdminPreferencesContext);
    if (!context) {
        throw new Error('useAdminPreferences must be used within an AdminPreferencesProvider');
    }
    return context;
};
