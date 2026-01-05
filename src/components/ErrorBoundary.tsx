import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface ErrorBoundaryProps {
  children?: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Componente ErrorBoundary estándar de React para capturar errores de renderizado.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: undefined
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("ErrorBoundary caught an error:", { error, errorInfo });

    const msg = error.message || '';

    // Estrategia de recarga para errores de carga de chunks (módulos dinámicos)
    if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
      if (!sessionStorage.getItem('retry-chunk-load')) {
        sessionStorage.setItem('retry-chunk-load', 'true');
        window.location.reload();
      } else {
        sessionStorage.removeItem('retry-chunk-load');
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || '';
      const isChunkError = msg.includes('Failed to fetch') || msg.includes('Importing a module');
      const isDomError = msg.includes('removeChild') || msg.includes('Node');

      let title = 'Algo salió mal';
      let description = this.state.error?.message || 'Ocurrió un error inesperado al procesar tu solicitud.';
      let icon = 'error_outline';

      if (isChunkError) {
        title = 'Actualización Disponible';
        description = 'Se ha detectado una nueva versión de la aplicación. Por favor, recarga la página para obtener las últimas mejoras.';
        icon = 'system_update';
      } else if (isDomError) {
        title = 'Error de Interfaz';
        description = 'La traducción automática o una extensión del navegador interfirió con la aplicación. Por favor, desactiva el traductor para este sitio y recarga.';
        icon = 'translate';
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-red-200 dark:border-red-900/50 max-w-lg mx-auto my-8 mt-20">
          <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <span className="material-icons !text-4xl">
              {icon}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center">
            {title}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm text-center mt-2 mb-6 leading-relaxed">
            {description}
          </p>
          <div className="flex gap-3">
            {!isChunkError && !isDomError && (
              <button
                onClick={this.handleRetry}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
              >
                Reintentar
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all text-sm flex items-center gap-2"
            >
              <span className="material-icons !text-lg">refresh</span>
              Recargar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;