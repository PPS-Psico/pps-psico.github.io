import React from 'react';
import Card from './ui/Card';
import EmptyState from './EmptyState';

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => (
  <div className="mt-8 animate-fade-in-up">
    <Card className="border-red-200 bg-red-50/50">
      <EmptyState
        icon="error"
        title="Error al Cargar Datos"
        message={error}
        action={onRetry ? (
          <button
            onClick={onRetry}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-red-300"
          >
            Reintentar
          </button>
        ) : undefined}
      />
    </Card>
  </div>
);

export default ErrorState;
