import React from 'react';
import PageWrapper from '../../components/layout/PageWrapper';
import PracticasTable from '../../components/student/PracticasTable';
import { useStudentPanel } from '../../contexts/StudentPanelContext';

const PracticasView: React.FC = () => {
    const { practicas, updateNota, updateFechaFin } = useStudentPanel();
    return (
        <PageWrapper
            icon="work_history"
            title={<span>Historial de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Practicas</span></span>}
            description="Detalle de todas las practicas realizadas y sus calificaciones."
        >
            <PracticasTable
                practicas={practicas}
                handleNotaChange={(pid, n, cid) => updateNota.mutate({ practicaId: pid, nota: n, convocatoriaId: cid })}
                handleFechaFinChange={(pid, fecha) => {
                    alert('DEBUG: Fix Directo - Intentando guardar');
                    updateFechaFin.mutate({ practicaId: pid, fecha });
                }}
            />
        </PageWrapper>
    );
};

export default PracticasView;
