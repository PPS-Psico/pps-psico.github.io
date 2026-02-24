import React from "react";
import Button from "../../ui/Button";
import Checkbox from "../../ui/Checkbox";
import Input from "../../ui/Input";
import Select from "../../ui/Select";

interface SchedulesSectionProps {
  schedules: { time: string; orientacion: string }[];
  setSchedules: (scheds: { time: string; orientacion: string }[]) => void;
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
  const handleScheduleValueChange = (
    index: number,
    field: "time" | "orientacion",
    value: string
  ) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    setSchedules(newSchedules);
  };

  const addSchedule = () => setSchedules([...schedules, { time: "", orientacion: "" }]);
  const removeSchedule = (index: number) => {
    const newSchedules = schedules.filter((_, i) => i !== index);
    setSchedules(newSchedules.length ? newSchedules : [{ time: "", orientacion: "" }]);
  };

  const selectedOrientations = formData.orientacion || [];

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
              Configura los horarios y asígnales una orientación específica si es necesario.
            </p>

            <div className="space-y-4">
              {schedules.map((schedule, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row items-start md:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative group"
                >
                  <div className="flex-1 w-full">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Horario
                    </label>
                    <Input
                      type="text"
                      value={schedule.time}
                      onChange={(e) => handleScheduleValueChange(index, "time", e.target.value)}
                      placeholder="Ej: Lunes 9:00 a 13:00hs"
                      className="w-full"
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Orientación vinculada
                    </label>
                    <Select
                      value={schedule.orientacion}
                      onChange={(e) =>
                        handleScheduleValueChange(index, "orientacion", e.target.value)
                      }
                      className="w-full"
                    >
                      <option value="">Cualquiera / General</option>
                      {selectedOrientations.map((o: string) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex items-center pt-5">
                    {schedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSchedule(index)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Eliminar horario"
                      >
                        <span className="material-icons !text-xl">delete</span>
                      </button>
                    )}
                  </div>
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
