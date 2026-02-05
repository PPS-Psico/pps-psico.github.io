import React, { Component, ErrorInfo, ReactNode } from "react";
import { ActionButton } from "../ui/admin";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AdminErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });

    // Aquí podrías enviar el error a un servicio de monitoreo
    // Sentry.captureException(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-icons text-4xl text-rose-600 dark:text-rose-400">
                error_outline
              </span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Algo salió mal
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-left overflow-auto">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex justify-center gap-3">
              <ActionButton variant="primary" icon="refresh" onClick={this.handleReset}>
                Intentar de nuevo
              </ActionButton>
              <ActionButton
                variant="secondary"
                icon="home"
                onClick={() => (window.location.href = "/admin")}
              >
                Ir al inicio
              </ActionButton>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;
