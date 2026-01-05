
import React, { useState } from 'react';
import SubTabs from '../../components/SubTabs';
import ConvocatoriaManager from '../../components/admin/ConvocatoriaManager';
import CalendarPlanning from '../../components/CalendarPlanning';
import { useGestionConvocatorias } from '../../hooks/useGestionConvocatorias';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';

interface GestionViewProps {
  isTestingMode?: boolean;
}

const GestionView: React.FC<GestionViewProps> = ({ isTestingMode = false }) => {
  const [activeGestionTabId, setActiveGestionTabId] = useState('manager');

  // Reutilizamos el hook aquí para pasar datos al calendario sin refetching
  const { filteredData, loadingState, error } = useGestionConvocatorias({ isTestingMode });

  const gestionSubTabs = [
    { id: 'manager', label: 'Gestión de Relanzamientos', icon: 'rocket_launch' },
    { id: 'calendar', label: 'Calendario 2026', icon: 'calendar_month' },
  ];

  if (loadingState === 'loading' || loadingState === 'initial') return <div className="p-12 flex justify-center"><Loader /></div>;
  if (error) return <EmptyState icon="error" title="Error de carga" message={error} />;

  return (
    <div className="space-y-6">
      {/* Header Card removed as requested */}

      <SubTabs tabs={gestionSubTabs} activeTabId={activeGestionTabId} onTabChange={setActiveGestionTabId} />

      <div className="mt-6 animate-fade-in-up">
        {activeGestionTabId === 'manager' && (
          <ConvocatoriaManager isTestingMode={isTestingMode} />
        )}

        {activeGestionTabId === 'calendar' && (
          <CalendarPlanning
            items={[
              ...filteredData.activasYPorFinalizar,
              ...filteredData.finalizadasParaReactivar,
              ...filteredData.relanzamientosConfirmados,
              ...filteredData.activasIndefinidas
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default GestionView;
