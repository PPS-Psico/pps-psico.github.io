import React from 'react';
import Card from './ui/Card';
import EmptyState from './EmptyState';

const InstitutionMetrics: React.FC = () => {
  return (
    <Card title="Métricas por Institución">
      <EmptyState
        icon="apartment"
        title="Próximamente"
        message="Esta sección mostrará métricas detalladas sobre las instituciones, como la cantidad de cupos ofrecidos, el número de convenios activos y el rendimiento de las prácticas por institución."
      />
    </Card>
  );
};

export default InstitutionMetrics;