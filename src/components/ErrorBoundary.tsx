import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Standard React Error Boundary component.
 * Fixed: Explicitly extend Component and declare state to ensure type safety.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Initialize state as a class property
  public state: ErrorBoundaryState = {
    hasError: false,
    error: undefined
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component:", error, errorInfo);
  }

  // Use arrow function as a class property to ensure 'this' refers to the component instance
  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  private handleRefresh = () => {
      window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-red-200/60 dark:border-red-900/50 max-w-lg mx-auto my-8 animate-fade-in-up">
            <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full h-16 w-16 flex items-center justify-center mb-4">
              <span className="material-icons !text-4xl">error_outline</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center">Algo salió mal</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm text-center mt-2 mb-6 leading-relaxed">
              {this.state.error?.message || 'Ocurrió un error inesperado al cargar esta sección.'}
            </p>
            <div className="flex gap-3">
                <button
                    onClick={this.handleRetry}
                    className="px-5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                    Reintentar
                </button>
                <button
                    onClick={this.handleRefresh}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-md transition-all"
                >
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