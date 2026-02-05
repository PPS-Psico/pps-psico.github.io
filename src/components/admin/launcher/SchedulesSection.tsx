import React from "react";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Checkbox from "../../ui/Checkbox";

interface SchedulesSectionProps {
  schedules: string[];
  setSchedules: (scheds: string[]) => void;
  formData: any;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
}

export const SchedulesSection: React.FC<SchedulesSectionProps> = ({
  schedules,
  setSchedules,
  formData,
  handleChange,
}) => {
  const handleScheduleChange = (index: number, value: string) => {
    const newSchedules = [...schedules];
    newSchedules[index] = value;
    setSchedules(newSchedules);
  };

  const addSchedule = () => setSchedules([...schedules, ""]);
  const removeSchedule = (index: number) => {
    const newSchedules = schedules.filter((_, i) => i !== index);
    setSchedules(newSchedules.length ? newSchedules : [""]);
  };

  return (
    <div className="relative">
      <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-600 rounded-l-md shadow-sm"></div>
      <div className="pl-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 text-sm font-bold shadow-sm border border-amber-200 dark:border-amber-800">
            4
          </span>
          Horarios
        </h3>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          {/* Horarios fijos checkbox */}
          <Checkbox
            name="horariosFijos"
            checked={formData.horariosFijos}
            onChange={handleChange}
            label="Esta convocatoria tiene horarios fijos predefinidos (los estudiantes no podrán proponer sus propios horarios)"
          />

          {/* Schedules list */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Horarios de Cursada
            </label>
            <p className="text-xs text-slate-500">
              Ej: Lunes 9:00 a 13:00hs; Miércoles 14:00 a 18:00hs. Si hay múltiples opciones,
              agrégalas todas.
            </p>

            <div className="space-y-2">
              {schedules.map((schedule, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={schedule}
                    onChange={(e) => handleScheduleChange(index, e.target.value)}
                    placeholder={`Horario ${index + 1}`}
                    className="flex-1"
                  />
                  {schedules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSchedule(index)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <span className="material-icons !text-lg">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <Button type="button" onClick={addSchedule} variant="secondary" size="sm" icon="add">
              Agregar otro horario
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulesSection;
