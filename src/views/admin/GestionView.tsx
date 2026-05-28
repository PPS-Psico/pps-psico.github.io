import React, { lazy, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SubTabs from "../../components/SubTabs";
import AdminActionCenter from "../../components/admin/AdminActionCenter";
import ConvocatoriaManager from "../../components/admin/ConvocatoriaManager";
import CalendarPlanning from "../../components/CalendarPlanning";
import { useGestionConvocatorias } from "../../hooks/useGestionConvocatorias";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";

const RecordatoriosView = lazy(() => import("./RecordatoriosView"));

interface GestionViewProps {
  isTestingMode?: boolean;
}

const GestionView: React.FC<GestionViewProps> = ({ isTestingMode = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeGestionTabId, setActiveGestionTabId] = useState(
    ["agenda", "calendar"].includes(searchParams.get("view") || "")
      ? searchParams.get("view")!
      : "manager"
  );

  // Reutilizamos el hook aquí para pasar datos al calendario sin refetching
  const { filteredData, institutionsMap, loadingState, error } = useGestionConvocatorias({
    isTestingMode,
  });

  const gestionSubTabs = [
    { id: "manager", label: "Gestión de Relanzamientos", icon: "rocket_launch" },
    { id: "agenda", label: "Agenda y Recordatorios", icon: "notifications_active" },
    { id: "calendar", label: "Calendario 2026", icon: "calendar_month" },
  ];

  useEffect(() => {
    const view = searchParams.get("view");
    setActiveGestionTabId(["agenda", "calendar"].includes(view || "") ? view! : "manager");
  }, [searchParams]);

  const handleGestionTabChange = (tabId: string) => {
    setActiveGestionTabId(tabId);
    const nextParams = new URLSearchParams(searchParams);
    if (tabId === "agenda" || tabId === "calendar") {
      nextParams.set("view", tabId);
    } else {
      nextParams.delete("view");
    }
    setSearchParams(nextParams);
  };

  if (loadingState === "loading" || loadingState === "initial")
    return (
      <div className="p-12 flex justify-center">
        <Loader />
      </div>
    );
  if (error) return <EmptyState icon="error" title="Error de carga" message={error} />;

  return (
    <div className="space-y-6">
      {/* Header Card removed as requested */}

      <AdminActionCenter filteredData={filteredData} institutionsMap={institutionsMap} compact />

      <SubTabs
        tabs={gestionSubTabs}
        activeTabId={activeGestionTabId}
        onTabChange={handleGestionTabChange}
      />

      <div className="mt-6 animate-fade-in-up">
        {activeGestionTabId === "manager" && <ConvocatoriaManager isTestingMode={isTestingMode} />}

        {activeGestionTabId === "agenda" && (
          <React.Suspense fallback={<Loader />}>
            <RecordatoriosView isTestingMode={isTestingMode} embedded />
          </React.Suspense>
        )}

        {activeGestionTabId === "calendar" && (
          <CalendarPlanning
            items={[
              ...(filteredData.activasYPorFinalizar || []),
              ...(filteredData.porContactar || []),
              ...(filteredData.contactadasEsperandoRespuesta || []),
              ...(filteredData.respondidasPendienteDecision || []),
              ...(filteredData.relanzamientosConfirmados || []),
              ...(filteredData.activasIndefinidas || []),
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default GestionView;
