import React from 'react';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import AIContentGenerator from './AIContentGenerator';
import { useError } from '../../../contexts/ErrorContext';

interface Step3ActividadesProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  actividades: string[];
  setActividades: (actividades: string[]) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
}

export const Step3Actividades: React.FC<Step3ActividadesProps> = ({
  formData,
  onChange,
  actividades,
  setActividades,
  isGenerating,
  setIsGenerating
}) => {
  const { showError } = useError();

  const handleAIGenerated = (descripcion: string, newActividades: string[]) => {
    onChange('descripcion', descripcion);
    setActividades(newActividades);
  };

  const handleAIError = (error: string) => {
    showError(error, 'AI Content Generation');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="material-icons text-blue-600 dark:text-blue-400 text-lg">description</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">3. Contenido & Actividades</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Descripción y lista de actividades</p>
        </div>
      </div>

      <AIContentGenerator
        rawText={formData.rawActivityText || ''}
        onRawTextChange={(text) => onChange('rawActivityText', text)}
        onGenerated={handleAIGenerated}
        onError={handleAIError}
        isGenerating={isGenerating}
        onStartGenerate={() => setIsGenerating(true)}
      />

      <div>
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
          Descripción de la Propuesta
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Descripción detallada de la propuesta, objetivos y rol del practicante...
        </p>
        <textarea
          value={formData.descripcion || ''}
          onChange={(e) => onChange('descripcion', e.target.value)}
          rows={6}
          placeholder="Describe las actividades principales..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            {formData.actividadesLabel || 'Actividades'}
          </label>
          <Button
            onClick={() => setActividades([...actividades, ''])}
            icon="add"
            variant="secondary"
            size="sm"
          >
            Agregar
          </Button>
        </div>

        <div className="space-y-3">
          {actividades.map((actividad, index) => (
            <div key={index} className="flex items-start gap-2">
              <Input
                type="text"
                value={actividad}
                onChange={(e) => {
                  const newActivities = [...actividades];
                  newActivities[index] = e.target.value;
                  setActividades(newActivities);
                }}
                placeholder={`Título: ${index + 1}`}
                className="flex-1"
              />
              {actividades.length > 1 && (
                <button
                  onClick={() => {
                    const newActivities = actividades.filter((_, i) => i !== index);
                    setActividades(newActivities);
                  }}
                  className="p-2 text-red-500 hover:text-red-700 transition-colors"
                >
                  <span className="material-icons !text-sm">delete</span>
                </button>
              )}
            </div>
          ))}
          {actividades.length === 0 && (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
              No hay actividades agregadas. Usa la IA o agrégalas manualmente.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step3Actividades;