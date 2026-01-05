
import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Tabs from '../components/Tabs';
import { MetricsDashboard } from '../components/admin/MetricsDashboard';
import TimelineView from '../components/TimelineView';
import SubTabs from '../components/SubTabs';
import WelcomeBannerAdmin from '../components/WelcomeBannerAdmin';
import Loader from '../components/Loader';

// Carga diferida del generador de reportes para optimizar el rendimiento inicial.
const ExecutiveReportGenerator = lazy(() => import('../components/admin/ExecutiveReportGenerator'));

const ReporteroView: React.FC = () => {
    const { authenticatedUser } = useAuth();
    const [activeMetricsTabId, setActiveMetricsTabId] = useState('dashboard');

    // El rol Reportero ahora siempre usa datos de producción, no de prueba.
    const isTestingMode = false;

    const tabs = useMemo(() => {
        const metricsSubTabs = [
            { id: 'dashboard', label: 'Dashboard', icon: 'bar_chart' },
            { id: 'timeline', label: 'Línea de Tiempo', icon: 'timeline' },
            { id: 'executive-report', label: 'Reporte Ejecutivo', icon: 'summarize' },
        ];

        return [
            {
                id: 'metrics',
                label: 'Métricas y Reportes',
                icon: 'analytics',
                content: (
                    <>
                        <SubTabs tabs={metricsSubTabs} activeTabId={activeMetricsTabId} onTabChange={setActiveMetricsTabId} />
                        <div className="mt-6">
                            <Suspense fallback={<div className="flex justify-center p-8"><Loader /></div>}>
                                {activeMetricsTabId === 'dashboard' && <MetricsDashboard onStudentSelect={() => { }} isTestingMode={isTestingMode} />}
                                {activeMetricsTabId === 'timeline' && <TimelineView isTestingMode={isTestingMode} />}
                                {activeMetricsTabId === 'executive-report' && <ExecutiveReportGenerator isTestingMode={isTestingMode} />}
                            </Suspense>
                        </div>
                    </>
                ),
            },
        ];
    }, [activeMetricsTabId, isTestingMode]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            <WelcomeBannerAdmin name={authenticatedUser?.nombre || 'Reportero'} />
            <Tabs
                tabs={tabs}
                activeTabId={'metrics'}
                onTabChange={() => { }} // Solo hay una pestaña principal, no se necesita acción de cambio.
            />
        </div>
    );
};

export default ReporteroView;
