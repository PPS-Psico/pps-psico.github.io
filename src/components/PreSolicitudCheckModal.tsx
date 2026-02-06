import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { normalizeStringForComparison } from "../utils/formatters";

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
  const [searchTerm, setSearchTerm] = useState("");

  const filteredInstitutions = useMemo(() => {
    // Return all if no search term, otherwise filter
    if (!searchTerm) return existingInstitutions;

    const lowerSearch = normalizeStringForComparison(searchTerm);
    return existingInstitutions.filter((inst) =>
      normalizeStringForComparison(inst).includes(lowerSearch)
    );
  }, [existingInstitutions, searchTerm]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <span className="material-icons !text-2xl">warning_amber</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Requisitos Previos
            </h2>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Antes de iniciar una solicitud de autogestión, por favor verifica lo siguiente:
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4 sm:space-y-6 bg-white dark:bg-slate-900">
          {/* Requisito 1: Psicólogo */}
          <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl items-start">
            <span className="material-icons text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
              psychology
            </span>
            <div>
              <h3 className="font-bold text-blue-900 dark:text-blue-100 text-sm">
                Supervisión Profesional
              </h3>
              <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                Es requisito indispensable que la institución cuente con un{" "}
                <strong>Licenciado/a en Psicología</strong> en planta que pueda ejercer el rol de
                tutor/a y supervisar tu práctica.
              </p>
            </div>
          </div>

          {/* Requisito 2: Espacios Nuevos */}
          <div className="space-y-2 sm:space-y-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                <span className="material-icons text-emerald-500 !text-lg">new_releases</span>
                Solo para Nuevos Espacios
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                El objetivo de este trámite es la apertura de convenios en instituciones donde{" "}
                <strong>no tenemos oferta actual</strong>. Por favor, verifica que la institución
                que propones <strong>NO</strong> esté en el siguiente listado.
              </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col h-64 sm:h-72 md:h-80">
              <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <Input
                  placeholder="Buscar institución..."
                  icon="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div className="overflow-y-auto p-2 bg-slate-50/30 dark:bg-slate-900/30 custom-scrollbar flex-1">
                {filteredInstitutions && filteredInstitutions.length > 0 ? (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredInstitutions.map((inst, idx) => (
                      <li
                        key={idx}
                        className="text-xs px-2 sm:px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-2"
                        title={inst}
                      >
                        <span className="material-icons !text-sm text-slate-400 shrink-0">
                          apartment
                        </span>
                        <span className="truncate font-medium">{inst}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-xs sm:text-sm text-slate-500 py-6 sm:py-10 italic font-medium">
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
        <div className="flex-shrink-0 p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 safe-area-bottom">
          <Button
            variant="secondary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContinue();
            }}
            icon="arrow_forward"
            className="w-full sm:w-auto"
          >
            Comprendido, Continuar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PreSolicitudCheckModal;
