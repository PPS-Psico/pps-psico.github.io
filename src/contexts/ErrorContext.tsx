import React, { createContext, useContext, useState, useCallback } from 'react';

export interface AppError extends Error {
  context?: string;
  code?: string;
  details?: any;
  timestamp: Date;
}

interface ErrorContextType {
  error: AppError | null;
  showError: (error: Error | string, context?: string, details?: any) => void;
  showSuccess: (message: string) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = useState<AppError | null>(null);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const createError = useCallback((err: Error | string, context?: string, details?: any): AppError => {
    const timestamp = new Date();
    
    if (typeof err === 'string') {
      return new Error(err) as AppError;
    }
    
    const errorObj = err as AppError;
    errorObj.context = context;
    errorObj.details = details;
    errorObj.timestamp = timestamp;
    
    return errorObj;
  }, []);

  const showError = useCallback((err: Error | string, context = '', details?: any) => {
    const errorObj = createError(err, context, details);
    
    // Log a consola con contexto y stack
    console.error(
      `[Error${context ? ` in ${context}` : ''}]:`,
      {
        message: errorObj.message,
        context,
        details,
        timestamp: errorObj.timestamp,
        stack: errorObj.stack
      }
    );
    
    // Mostrar toast al usuario
    setToastInfo({
      message: errorObj.message || 'Ocurrió un error inesperado',
      type: 'error'
    });
    
    setError(errorObj);
    
    // Auto-limpiar después de 5 segundos
    setTimeout(() => {
      setError(null);
      setToastInfo(null);
    }, 5000);
  }, [createError]);

  const showSuccess = useCallback((message: string) => {
    console.log(`[Success]: ${message}`);
    
    setToastInfo({
      message,
      type: 'success'
    });
    
    setError(null);
    
    // Auto-limpiar después de 3 segundos
    setTimeout(() => {
      setToastInfo(null);
    }, 3000);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setToastInfo(null);
  }, []);

  return (
    <ErrorContext.Provider value={{ error, showError, showSuccess, clearError }}>
      {children}
      {toastInfo && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${
            toastInfo.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <span className="material-icons">
                {toastInfo.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span className="font-medium">{toastInfo.message}</span>
              <button
                onClick={clearError}
                className="hover:opacity-80"
              >
                <span className="material-icons !text-lg">close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) throw new Error('useError must be used within ErrorProvider');
  return context;
};