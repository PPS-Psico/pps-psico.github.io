import React from 'react';
import PageWrapper from '../../components/PageWrapper';
import InformesList from '../../components/InformesList';
import { useStudentPanel } from '../../contexts/StudentPanelContext';

const InformesView: React.FC = () => {
    const { informeTasks, confirmInforme } = useStudentPanel();
    return (
        <PageWrapper
            icon="assignment_turned_in"
            title={<span>Entrega de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Informes</span></span>}
            description="Sube tu informe final al campus y luego confirma la entrega aqui."
        >
            <InformesList tasks={informeTasks} onConfirmar={confirmInforme.mutate} />
        </PageWrapper>
    );
};

export default InformesView;
