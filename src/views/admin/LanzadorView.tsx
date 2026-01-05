
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SubTabs from '../../components/SubTabs';
import LanzadorConvocatorias from '../../components/admin/LanzadorConvocatorias';
import SeleccionadorConvocatorias from '../../components/admin/SeleccionadorConvocatorias';
import SeguroGenerator from '../../components/admin/SeguroGenerator';
import { useModal } from '../../contexts/ModalContext';

interface LanzadorViewProps {
  isTestingMode?: boolean;
}

const LanzadorView: React.FC<LanzadorViewProps> = ({ isTestingMode = false }) => {
  const [searchParams] = useSearchParams();
  const [activeTabId, setActiveTabId] = useState('nuevo');
  const [preSelectedLanzamientoId, setPreSelectedLanzamientoId] = useState<string | null>(null);
  const { showModal } = useModal();

  const tabs = [
    { id: 'nuevo', label: 'Nuevo Lanzamiento', icon: 'add_circle' },
    { id: 'seleccionador', label: 'Seleccionador', icon: 'how_to_reg' },
    { id: 'seguro', label: 'Seguro', icon: 'shield' },
    { id: 'historial', label: 'Historial', icon: 'history' },
  ];

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.some(t => t.id === tab)) {
      setActiveTabId(tab);
    }
  }, [searchParams]);

  const handleNavigateToInsurance = (lanzamientoId: string) => {
    setPreSelectedLanzamientoId(lanzamientoId);
    setActiveTabId('seguro');
  };

  return (
    <>
      <SubTabs tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
      <div className="mt-6">
        {activeTabId === 'nuevo' && <LanzadorConvocatorias forcedTab="new" isTestingMode={isTestingMode} />}
        {activeTabId === 'seleccionador' && (
          <SeleccionadorConvocatorias
            isTestingMode={isTestingMode}
            onNavigateToInsurance={handleNavigateToInsurance}
            preSelectedLaunchId={searchParams.get('launchId')}
          />
        )}
        {activeTabId === 'seguro' && <SeguroGenerator showModal={showModal} isTestingMode={isTestingMode} preSelectedLanzamientoId={preSelectedLanzamientoId} />}
        {activeTabId === 'historial' && <LanzadorConvocatorias forcedTab="history" isTestingMode={isTestingMode} />}
      </div>
    </>
  );
};

export default LanzadorView;
