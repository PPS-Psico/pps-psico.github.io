import React, { useState } from 'react';
import SubTabs from '../components/SubTabs';
import AdminSearch from '../components/AdminSearch';
import SeguroGenerator from '../components/SeguroGenerator';
import NuevosConvenios from '../components/NuevosConvenios';
import ExecutiveReportGenerator from '../components/ExecutiveReportGenerator';
import PenalizationManager from '../components/PenalizationManager';
import { useModal } from '../contexts/ModalContext';
import type { AirtableRecord, EstudianteFields } from '../types';

interface HerramientasViewProps {
  onStudentSelect: (student: AirtableRecord<EstudianteFields>) => void;
}

const HerramientasView: React.FC<HerramientasViewProps> = ({ onStudentSelect }) => {
  const [activeHerramientasTabId, setActiveHerramientasTabId] = useState('penalizaciones');
  const { showModal } = useModal();

  const herramientasSubTabs = [
    { id: 'penalizaciones', label: 'Penalizaciones', icon: 'gavel' },
    { id: 'search', label: 'Buscar Alumno', icon: 'person_search' },
    { id: 'insurance', label: 'Seguros', icon: 'shield' },
    { id: 'convenios', label: 'Convenios Nuevos', icon: 'handshake' },
    { id: 'executive-report', label: 'Reporte Ejecutivo', icon: 'summarize' },
  ];

  return (
    <>
      <SubTabs tabs={herramientasSubTabs} activeTabId={activeHerramientasTabId} onTabChange={setActiveHerramientasTabId} />
      <div className="mt-6">
        {activeHerramientasTabId === 'penalizaciones' && <PenalizationManager />}
        {activeHerramientasTabId === 'search' && <div className="p-4"><AdminSearch onStudentSelect={onStudentSelect} /></div>}
        {activeHerramientasTabId === 'insurance' && <SeguroGenerator showModal={showModal} />}
        {activeHerramientasTabId === 'convenios' && <NuevosConvenios />}
        {activeHerramientasTabId === 'executive-report' && <ExecutiveReportGenerator />}
      </div>
    </>
  );
};

export default HerramientasView;