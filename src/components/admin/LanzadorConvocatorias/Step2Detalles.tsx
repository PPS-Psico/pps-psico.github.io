import React from 'react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Checkbox from '../../ui/Checkbox';
import { ALL_ORIENTACIONES } from '../../../types';

interface Step2DetallesProps {
  formData: any;
  onChange: (field: string, value: any) => void;
}

export const Step2Detalles: React.FC<Step2DetallesProps> = ({
  formData,
  onChange
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="material-icons text-blue-600 dark:text-blue-400 text-lg">badge</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">2. Detalles Básicos</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Información de la convocatoria</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
            Nombre PPS (Visible)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Nombre visible de la convocatoria
          </p>
          <Input
            type="text"
            value={formData.nombrePPS || ''}
            onChange={(e) => onChange('nombrePPS', e.target.value)}
            placeholder="Nombre de la práctica"
            icon="school"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
            Orientación
          </label>
          <Select
            value={formData.orientacion || ''}
            onChange={(e) => onChange('orientacion', e.target.value)}
            options={ALL_ORIENTACIONES.map(orient => ({
              value: orient,
              label: orient
            }))}
            placeholder="Seleccionar..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
              Fecha Inicio
            </label>
            <Input
              type="date"
              value={formData.fechaInicio || ''}
              onChange={(e) => onChange('fechaInicio', e.target.value)}
              icon="event_available"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
              Fecha Fin (Práctica)
            </label>
            <Input
              type="date"
              value={formData.fechaFin || ''}
              onChange={(e) => onChange('fechaFin', e.target.value)}
              icon="event_busy"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
              Inscripción Desde
            </label>
            <Input
              type="date"
              value={formData.fechaInicioInscripcion || ''}
              onChange={(e) => onChange('fechaInicioInscripcion', e.target.value)}
              icon="app_registration"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
              Inscripción Hasta
            </label>
            <Input
              type="date"
              value={formData.fechaFinInscripcion || ''}
              onChange={(e) => onChange('fechaFinInscripcion', e.target.value)}
              icon="access_time_filled"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
              Horas
            </label>
            <Input
              type="number"
              value={formData.horasAcreditadas || ''}
              onChange={(e) => onChange('horasAcreditadas', parseInt(e.target.value) || 0)}
              placeholder="0"
              icon="schedule"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
              Cupos
            </label>
            <Input
              type="number"
              value={formData.cuposDisponibles || ''}
              onChange={(e) => onChange('cuposDisponibles', parseInt(e.target.value) || 1)}
              placeholder="1"
              icon="group"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
            Requisito Excluyente (Opcional)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Ej: Solo estudiantes con Psicoanálisis aprobado
          </p>
          <Input
            type="text"
            value={formData.requisitoObligatorio || ''}
            onChange={(e) => onChange('requisitoObligatorio', e.target.value)}
            placeholder="Requisito opcional..."
            icon="campaign"
          />
        </div>

        <div>
          <Checkbox
            checked={formData.programarLanzamiento || false}
            onChange={(checked) => onChange('programarLanzamiento', checked)}
            label="Si activas esto, la convocatoria se publicará automáticamente en la fecha y hora seleccionada."
          />
        </div>

        {formData.programarLanzamiento && (
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
              Fecha de Publicación
            </label>
            <Input
              type="datetime-local"
              value={formData.fechaPublicacion || ''}
              onChange={(e) => onChange('fechaPublicacion', e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Step2Detalles;