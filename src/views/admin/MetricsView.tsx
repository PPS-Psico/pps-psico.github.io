
import React, { useState } from 'react';
import SubTabs from '../../components/SubTabs';
import { MetricsDashboard } from '../../components/admin/MetricsDashboard';
import TimelineView from '../../components/TimelineView';
import ErrorBoundary from '../../components/ErrorBoundary';

interface MetricsViewProps {
  onStudentSelect: (student: { legajo: string, nombre: string }) => void;
  isTestingMode?: boolean;
}

const MetricsView: React.FC<MetricsViewProps> = ({ onStudentSelect, isTestingMode = false }) => {
  const [activeMetricsTabId, setActiveMetricsTabId] = useState('dashboard');

  const metricsSubTabs = [
      { id: 'dashboard', label: 'Dashboard', icon: 'bar_chart' },
      { id: 'timeline', label: 'Línea de Tiempo', icon: 'timeline' },
  ];

  return (
    <>
      <SubTabs tabs={metricsSubTabs} activeTabId={activeMetricsTabId} onTabChange={setActiveMetricsTabId} />
      <div className="mt-6">
          {activeMetricsTabId === 'dashboard' && (
            <ErrorBoundary>
              <MetricsDashboard onStudentSelect={onStudentSelect} isTestingMode={isTestingMode} />
            </ErrorBoundary>
          )}
          {activeMetricsTabId === 'timeline' && (
            <ErrorBoundary>
              <TimelineView isTestingMode={isTestingMode} />
            </ErrorBoundary>
          )}
      </div>
    </>
  );
};

export default MetricsView;
