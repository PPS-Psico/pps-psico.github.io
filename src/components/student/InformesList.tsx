import React from 'react';
import type { InformeTask } from '../../types';
import InformeCard from '../InformeCard';
import EmptyState from '../EmptyState';

interface InformesListProps {
  tasks: InformeTask[];
  onConfirmar: (task: InformeTask) => void;
}

const InformesList: React.FC<InformesListProps> = ({ tasks, onConfirmar }) => {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon="task_alt"
        title="Sin informes pendientes"
        message="No tienes informes para subir o que estén en corrección en este momento."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {tasks.map(task => (
        <InformeCard key={task.convocatoriaId} task={task} onConfirmar={onConfirmar} />
      ))}
    </div>
  );
};

export default React.memo(InformesList);
