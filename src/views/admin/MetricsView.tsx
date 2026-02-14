import React, { useState } from "react";
import SubTabs from "../../components/SubTabs";
import { MetricsDashboard } from "../../components/admin/MetricsDashboard";
import TimelineView from "../../components/TimelineView";
import ErrorBoundary from "../../components/ErrorBoundary";

interface MetricsViewProps {
  onStudentSelect: (student: { legajo: string; nombre: string }) => void;
  isTestingMode?: boolean;
  onModalOpen?: (isOpen: boolean) => void;
}

const MetricsView: React.FC<MetricsViewProps> = ({
  onStudentSelect,
  isTestingMode = false,
  onModalOpen,
}) => {
  const [activeMetricsTabId, setActiveMetricsTabId] = useState("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleModalOpen = (open: boolean) => {
    setIsModalOpen(open);
    onModalOpen?.(open);
  };

  const metricsSubTabs = [
    { id: "dashboard", label: "Dashboard", icon: "bar_chart" },
    { id: "timeline", label: "Línea de Tiempo", icon: "timeline" },
  ];

  return (
    <>
      <div className={isModalOpen ? "hidden" : ""}>
        <SubTabs
          tabs={metricsSubTabs}
          activeTabId={activeMetricsTabId}
          onTabChange={setActiveMetricsTabId}
        />
      </div>
      <div className="mt-6">
        {activeMetricsTabId === "dashboard" && (
          <ErrorBoundary>
            <MetricsDashboard
              onStudentSelect={onStudentSelect}
              isTestingMode={isTestingMode}
              onModalOpen={handleModalOpen}
            />
          </ErrorBoundary>
        )}
        {activeMetricsTabId === "timeline" && (
          <ErrorBoundary>
            <TimelineView isTestingMode={isTestingMode} />
          </ErrorBoundary>
        )}
      </div>
    </>
  );
};

export default MetricsView;
