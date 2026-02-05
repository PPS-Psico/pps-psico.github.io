import React from "react";
import Button from "../../ui/Button";
import Input from "../../ui/Input";

interface ActivitiesSectionProps {
  actividades: string[];
  setActividades: (acts: string[]) => void;
  formData: any;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  rawActivityText: string;
  setRawActivityText: (text: string) => void;
  isGenerating: boolean;
  runAIExtraction: () => void;
}

export const ActivitiesSection: React.FC<ActivitiesSectionProps> = ({
  actividades,
  setActividades,
  formData,
  handleChange,
  rawActivityText,
  setRawActivityText,
  isGenerating,
  runAIExtraction,
}) => {
  const handleActivityChange = (index: number, value: string) => {
    const newActivities = [...actividades];
    newActivities[index] = value;
    setActividades(newActivities);
  };

  const addActivity = () => setActividades([...actividades, ""]);
  const removeActivity = (index: number) => {
    const newActivities = actividades.filter((_, i) => i !== index);
    setActividades(newActivities);
  };

  return (
    <div className="relative">
      <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-md shadow-sm"></div>
      <div className="pl-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 text-sm font-bold shadow-sm border border-emerald-200 dark:border-emerald-800">
            3
          </span>
          Contenido y Actividades
        </h3>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          {/* AI Generator */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <span className="material-icons !text-sm">auto_awesome</span>
              Generar con IA
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
              Pega aquí el texto de la propuesta o información sobre las actividades y la IA
              extraerá automáticamente la descripción, actividades y horarios.
            </p>
            <textarea
              value={rawActivityText}
              onChange={(e) => setRawActivityText(e.target.value)}
              placeholder="Pega aquí el texto con la información de la PPS..."
              rows={4}
              className="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <Button
              type="button"
              onClick={runAIExtraction}
              isLoading={isGenerating}
              disabled={!rawActivityText.trim() || isGenerating}
              icon="auto_awesome"
            >
              {isGenerating ? "Generando..." : "Generar contenido con IA"}
            </Button>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Descripción de la Propuesta
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              placeholder="Describe la propuesta, objetivos y rol del practicante..."
              rows={6}
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Label for activities */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Título de la Lista de Items
            </label>
            <Input
              name="actividadesLabel"
              value={formData.actividadesLabel}
              onChange={handleChange}
              placeholder="Ej: Actividades, Espacios de Participación, Objetivos..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Este título aparecerá en la tarjeta de la convocatoria (ej: "Actividades a
              desarrollar")
            </p>
          </div>

          {/* Activities list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {formData.actividadesLabel || "Actividades"}
              </label>
              <Button type="button" onClick={addActivity} variant="secondary" size="sm" icon="add">
                Agregar
              </Button>
            </div>

            <div className="space-y-3">
              {actividades.map((actividad, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={actividad}
                    onChange={(e) => handleActivityChange(index, e.target.value)}
                    placeholder={`${formData.actividadesLabel || "Actividad"} ${index + 1}`}
                    className="flex-1"
                  />
                  {actividades.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeActivity(index)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <span className="material-icons !text-lg">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Requisito obligatorio */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Requisito Excluyente (Opcional)
            </label>
            <textarea
              name="requisitoObligatorio"
              value={formData.requisitoObligatorio}
              onChange={handleChange}
              placeholder="Ej: Solo para estudiantes que hayan aprobado Psicoanálisis. Si no hay requisitos especiales, dejar vacío."
              rows={2}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivitiesSection;
