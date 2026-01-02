
import React, { useState, useCallback, useMemo } from 'react';
import AdminSearch from '../components/AdminSearch';
import ConvocatoriaManager from '../components/ConvocatoriaManager';
import { useAuth, type AuthUser } from '../contexts/AuthContext';
import StudentDashboard from './StudentDashboard';
import Tabs from '../components/Tabs';
import { MetricsDashboard } from '../components/MetricsDashboard';
import TimelineView from '../components/TimelineView';
import SubTabs from '../components/SubTabs';
import type { AirtableRecord, EstudianteFields } from '../types';
import WelcomeBannerAdmin from '../components/WelcomeBannerAdmin';
import { StudentPanelProvider } from '../contexts/StudentPanelContext';
import { FIELD_LEGAJO_ESTUDIANTES, FIELD_NOMBRE_ESTUDIANTES } from '../constants';
import AppModals from '../components/AppModals';

interface StudentTabInfo {
    id: string; // legajo
    legajo: string;
    nombre: string;
}

const DirectivoView: React.FC = () => {
    const { authenticatedUser } = useAuth();
    const [studentTabs, setStudentTabs] = useState<StudentTabInfo[]>([]);
    
    const jefeOrientations = authenticatedUser?.orientaciones || [];
    const initialTabId = 'metrics';
    const [activeTabId, setActiveTabId] = useState(initialTabId);
    const [activeMetricsTabId, setActiveMetricsTabId] = useState('dashboard');

    const openStudentPanel = useCallback((student: AirtableRecord<EstudianteFields>) => {
        if (!student) return;

        // Ensure safe access
        const legajo = student[FIELD_LEGAJO_ESTUDIANTES];
        const nombre = student[FIELD_NOMBRE_ESTUDIANTES];

        if (!legajo || !nombre) {
            alert('El registro del estudiante no tiene legajo o nombre completo.');
            return;
        }
        
        if (studentTabs.some(s => s.legajo === String(legajo))) {
            setActiveTabId(String(legajo));
            return;
        }
        
        const newStudentTab: StudentTabInfo = {
            id: String(legajo),
            legajo: String(legajo),
            nombre: String(nombre),
        };
        setStudentTabs(prev => [...prev, newStudentTab]);
        setActiveTabId(String(legajo));
    }, [studentTabs]);
    
    const handleCloseTab = useCallback((tabId: string) => {
        setStudentTabs(prev => prev.filter(s => s.id !== tabId));
        if (activeTabId === tabId) {
            setActiveTabId(initialTabId);
        }
    }, [activeTabId, initialTabId]);

    const allTabs = useMemo(() => {
        const metricsSubTabs = [
            { id: 'dashboard', label: 'Dashboard', icon: 'bar_chart' },
            { id: 'timeline', label: 'Línea de Tiempo', icon: 'timeline' },
        ];

        const mainTabs = [
            {
                id: 'metrics',
                label: 'Métricas',
                icon: 'analytics',
                content: (
                    <>
                        <SubTabs tabs={metricsSubTabs} activeTabId={activeMetricsTabId} onTabChange={setActiveMetricsTabId} />
                        <div className="mt-6">
                            {activeMetricsTabId === 'dashboard' && <MetricsDashboard onStudentSelect={(student) => openStudentPanel({ id: 'metrics-selection', createdTime: '', [FIELD_LEGAJO_ESTUDIANTES]: student.legajo, [FIELD_NOMBRE_ESTUDIANTES]: student.nombre } as unknown as AirtableRecord<EstudianteFields>)} />}
                            {activeMetricsTabId === 'timeline' && <TimelineView />}
                        </div>
                    </>
                ),
            },
            ...(jefeOrientations.length > 0 ? [{
                id: 'manager-jefe',
                label: 'Gestión PPS',
                icon: 'tune',
                content: <ConvocatoriaManager forcedOrientations={jefeOrientations} />,
            }] : []),
            {
                id: 'search',
                label: 'Buscar Alumno',
                icon: 'person_search',
                content: <div className="p-4"><AdminSearch onStudentSelect={openStudentPanel} /></div>,
            }
        ];

        const dynamicStudentTabs = studentTabs.map(student => ({
            id: student.id,
            label: student.nombre,
            icon: 'school',
            content: (
                <StudentPanelProvider legajo={student.legajo}>
                    <StudentDashboard key={student.legajo} user={student as AuthUser} showExportButton />
                </StudentPanelProvider>
            ),
            isClosable: true,
        }));

        return [...mainTabs, ...dynamicStudentTabs];

    }, [studentTabs, jefeOrientations, openStudentPanel, activeMetricsTabId]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            <WelcomeBannerAdmin name={authenticatedUser?.nombre || 'Directivo'} />
            
            <Tabs
                tabs={allTabs}
                activeTabId={activeTabId}
                onTabChange={setActiveTabId}
                onTabClose={handleCloseTab}
            />
            
            <AppModals />
        </div>
    );
};

export default DirectivoView;
