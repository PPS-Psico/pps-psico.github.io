import React from 'react';
import Input from '../../ui/Input';
import Button from '../../ui/Button';

interface Step4HorariosProps {
  schedules: string[];
  setSchedules: (schedules: string[]) => void;
  horariosFijos: boolean;
  onChange: (field: string, value: any) => void;
}

export const Step4Horarios: React.FC<Step4HorariosProps> = ({
  schedules,
  setSchedules,
  horariosFijos,
  onChange
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="material-icons text-blue-600 dark:text-blue-400 text-lg">schedule</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">4. Horarios</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configura los horarios de la práctica</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
          Tipo de Horarios
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="horarioTipo"
              checked={!horariosFijos}
              onChange={() => onChange('horariosFijos', false)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">Los estudiantes seleccionan sus horarios</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="horarioTipo"
              checked={horariosFijos}
              onChange={() => onChange('horariosFijos', true)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">Horarios fijos predefinidos</span>
          </label>
        </div>
      </div>

      {horariosFijos && (
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
            Horarios Disponibles
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Ej: Lunes 9 a 13hs; Miércoles 14 a 18hs
          </p>

          <div className="space-y-3">
            {schedules.map((schedule, index) => (
              <div key={index} className="flex items-start gap-2">
                <Input
                  type="text"
                  value={schedule}
                  onChange={(e) => {
                    const newSchedules = [...schedules];
                    newSchedules[index] = e.target.value;
                    setSchedules(newSchedules);
                  }}
                  placeholder={`Horario ${index + 1}`}
                  icon="schedule"
                  className="flex-1"
                />
                {schedules.length > 1 && (
                  <button
                    onClick={() => {
                      const newSchedules = schedules.filter((_, i) => i !== index);
                      setSchedules(newSchedules);
                    }}
                    className="p-2 text-red-500 hover:text-red-700 transition-colors mt-2"
                  >
                    <span className="material-icons !text-sm">delete</span>
                  </button>
                )}
              </div>
            ))}

            <Button
              onClick={() => setSchedules([...schedules, ''])}
              icon="add"
              variant="secondary"
              className="w-full"
            >
              + Agregar Horario
            </Button>

            {schedules.length === 0 && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                No hay horarios agregados. Agrega al menos uno.
              </div>
            )}
          </div>
        </div>
      )}

      {!horariosFijos && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <span className="material-icons text-blue-600 dark:text-blue-400">info</span>
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Modo Flexible
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Los estudiantes podrán seleccionar sus horarios disponibles desde un calendario.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4Horarios;