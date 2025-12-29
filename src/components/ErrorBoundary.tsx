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
 * Standard React Error Boundary component to catch rendering errors and show a fallback UI.
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
    logger.error("Uncaught error in boundary:", { error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-red-200 dark:border-red-900/50 max-w-lg mx-auto my-8">
            <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full h-16 w-16 flex items-center justify-center mb-4">
              <span className="material-icons !text-4xl">error_outline</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center">Algo salió mal</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm text-center mt-2 mb-6">
              {this.state.error?.message || 'Ocurrió un error inesperado.'}
            </p>
            <div className="flex gap-3">
                <button
                    onClick={this.handleRetry}
                    className="px-5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                    Reintentar
                </button>
                <button
                    onClick={() => window.location.reload()}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-md transition-all"
                >
                    Recargar
                </button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;