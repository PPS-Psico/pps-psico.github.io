
import React from 'react';
import Button from './ui/Button';

interface PreAcreditacionCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

const PreAcreditacionCheckModal: React.FC<PreAcreditacionCheckModalProps> = ({
  isOpen,
  onClose,
  onContinue,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[95vw] sm:w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <span className="material-icons !text-2xl">folder_zip</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Documentación Requerida
            </h2>
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Para finalizar el trámite de acreditación, necesitarás adjuntar los siguientes documentos digitalizados:
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 bg-white dark:bg-slate-900">

          <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl items-start">
            <div className="flex-shrink-0 mt-1 text-blue-500"><span className="material-icons">schedule</span></div>
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Planilla de Seguimiento de Horas</h4>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">El archivo Excel completo con tu seguimiento personal.</p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl items-start">
            <div className="flex-shrink-0 mt-1 text-blue-500"><span className="material-icons">event_available</span></div>
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Planillas de Asistencia</h4>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Fotos o PDFs de las planillas de asistencia diarias firmadas.</p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl items-start">
            <div className="flex-shrink-0 mt-1 text-blue-500"><span className="material-icons">description</span></div>
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Informes Finales</h4>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Los informes de cada una de las prácticas realizadas (corregidos y aprobados).</p>
            </div>
          </div>

          <p className="text-xs text-center text-slate-400 font-medium italic pt-2">Asegúrate de tener todo listo antes de continuar.</p>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3 safe-area-bottom">
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button onClick={onContinue} icon="arrow_forward">
            Tengo todo listo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PreAcreditacionCheckModal;
