import React from "react";
import { AirtableRecord, InstitucionFields } from "../../../types";
import { FIELD_NOMBRE_INSTITUCIONES, FIELD_DIRECCION_INSTITUCIONES } from "../../../constants";

interface InstitutionSelectorProps {
  instiSearch: string;
  setInstiSearch: (value: string) => void;
  selectedInstitution: AirtableRecord<InstitucionFields> | null;
  setSelectedInstitution: (inst: AirtableRecord<InstitucionFields> | null) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  filteredInstitutions: AirtableRecord<InstitucionFields>[];
  institutions: AirtableRecord<InstitucionFields>[];
  isLoadingInstitutions: boolean;
  onCreateNew: () => void;
  formData: any;
  setFormData: (data: any) => void;
}

export const InstitutionSelector: React.FC<InstitutionSelectorProps> = ({
  instiSearch,
  setInstiSearch,
  selectedInstitution,
  setSelectedInstitution,
  isDropdownOpen,
  setIsDropdownOpen,
  filteredInstitutions,
  institutions,
  isLoadingInstitutions,
  onCreateNew,
  formData,
  setFormData,
}) => {
  const handleSelectInstitution = (inst: AirtableRecord<InstitucionFields>) => {
    setSelectedInstitution(inst);
    setInstiSearch(inst[FIELD_NOMBRE_INSTITUCIONES] || "");
    setFormData((prev: any) => ({
      ...prev,
      nombrePPS: inst[FIELD_NOMBRE_INSTITUCIONES] || "",
      direccion: inst[FIELD_DIRECCION_INSTITUCIONES] || prev.direccion,
    }));
    setIsDropdownOpen(false);
  };

  return (
    <div className={`relative group ${isDropdownOpen ? "z-50" : "z-30"}`}>
      <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
      </div>

      <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-600 rounded-l-md shadow-sm"></div>
      <div className="pl-6 relative z-20">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm font-bold shadow-sm border border-blue-200 dark:border-blue-800">
            1
          </span>
          Institución
        </h3>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="relative flex-grow w-full">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Buscar Institución
              </label>
              <div className="relative">
                <input
                  id="instiSearch"
                  type="text"
                  value={instiSearch}
                  onChange={(e) => {
                    setInstiSearch(e.target.value);
                    setSelectedInstitution(null);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Escribe para buscar..."
                  className="w-full h-11 pl-11 pr-4 text-lg font-medium bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors shadow-sm placeholder:font-normal"
                  autoComplete="off"
                  required
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-icons text-slate-400 !text-xl">
                  search
                </span>
              </div>

              {/* Dropdown Results */}
              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  ></div>
                  <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-64 overflow-y-auto">
                    {isLoadingInstitutions ? (
                      <div className="p-4 text-center text-slate-500">
                        <span className="material-icons animate-spin">refresh</span>
                        <p className="text-sm mt-2">Cargando instituciones...</p>
                      </div>
                    ) : instiSearch && filteredInstitutions.length === 0 ? (
                      <div className="p-4">
                        <p className="text-sm text-slate-500 mb-3">
                          No se encontraron instituciones.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            onCreateNew();
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <span className="material-icons !text-sm">add_business</span>
                          Crear "{instiSearch}" como nueva institución
                        </button>
                      </div>
                    ) : (
                      <>
                        {filteredInstitutions.map((inst) => (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => handleSelectInstitution(inst)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                          >
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {inst[FIELD_NOMBRE_INSTITUCIONES]}
                            </div>
                          </button>
                        ))}
                        {filteredInstitutions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsDropdownOpen(false);
                              onCreateNew();
                            }}
                            className="w-full text-left px-4 py-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border-t border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2"
                          >
                            <span className="material-icons !text-sm">add</span>
                            Crear nueva institución...
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onCreateNew}
              className="flex-shrink-0 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 font-medium h-11"
            >
              <span className="material-icons !text-lg">add_business</span>
              <span className="hidden md:inline">Nueva</span>
            </button>
          </div>

          {selectedInstitution && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <span className="material-icons text-blue-600 dark:text-blue-400">
                  check_circle
                </span>
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedInstitution[FIELD_NOMBRE_INSTITUCIONES]}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Institución seleccionada
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstitutionSelector;
