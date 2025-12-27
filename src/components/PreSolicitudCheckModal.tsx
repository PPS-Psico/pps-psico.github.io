
import React, { useState, useMemo } from 'react';
import Input from './Input';
import Button from './Button';
import { normalizeStringForComparison } from '../utils/formatters';

interface PreSolicitudCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  existingInstitutions: string[];
}

const PreSolicitudCheckModal: React.FC<PreSolicitudCheckModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  existingInstitutions,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInstitutions = useMemo(() => {
    // Return all if no search term, otherwise filter
    if (!searchTerm) return existingInstitutions;
    
    const lowerSearch = normalizeStringForComparison(searchTerm);
    return existingInstitutions.filter((inst) =>
      normalizeStringForComparison(inst).includes(lowerSearch)
    );
  }, [existingInstitutions, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[95vw] max-h-[85dvh] sm:w-full sm:max-w-2xl sm:max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <span className="material-icons !text-2xl">warning_amber</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Requisitos Previos
            </h2>
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Antes de iniciar una solicitud de autogestión, por favor verifica lo siguiente:
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 bg-white dark:bg-slate-900">
          
          {/* Requisito 1: Psicólogo */}
          <div className="flex gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl items-start">
            <span className="material-icons text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">psychology</span>
            <div>
              <h3 className="font-bold text-blue-900 dark:text-blue-100 text-sm">Supervisión Profesional</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                Es requisito indispensable que la institución cuente con un <strong>Licenciado/a en Psicología</strong> en planta que pueda ejercer el rol de tutor/a y supervisar tu práctica.
              </p>
            </div>
          </div>

          {/* Requisito 2: Espacios Nuevos */}
          <div className="space-y-3">
            <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                    <span className="material-icons text-emerald-500 !text-lg">new_releases</span>
                    Solo para Nuevos Espacios
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    El objetivo de este trámite es la apertura de convenios en instituciones donde <strong>no tenemos oferta actual</strong>. 
                    Por favor, verifica que la institución que propones <strong>NO</strong> esté en el siguiente listado.
                </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col h-96">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <Input 
                        placeholder="Buscar institución en el listado actual..." 
                        icon="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white dark:bg-slate-900"
                    />
                </div>
                <div className="overflow-y-auto p-2 bg-slate-50/30 dark:bg-slate-900/30 custom-scrollbar flex-grow">
                    {filteredInstitutions && filteredInstitutions.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {filteredInstitutions.map((inst, idx) => (
                                <li key={idx} className="text-xs px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-2 truncate" title={inst}>
                                    <span className="material-icons !text-sm text-slate-400 shrink-0">apartment</span>
                                    <span className="truncate font-medium">{inst}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-sm text-slate-500 py-10 italic font-medium">
                            {existingInstitutions.length === 0 
                                ? "Cargando lista de instituciones..." 
                                : "No se encontraron instituciones con ese nombre en el listado actual."}
                        </p>
                    )}
                </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3 safe-area-bottom">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onContinue} icon="arrow_forward">
            Comprendido, Continuar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PreSolicitudCheckModal;
