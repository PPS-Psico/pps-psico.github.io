import React from "react";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Checkbox from "../../ui/Checkbox";
import { ALL_ORIENTACIONES } from "../../../types";

interface LaunchFormProps {
  formData: any;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  lastLanzamiento: any;
  handleLoadLastData: () => void;
}

export const LaunchForm: React.FC<LaunchFormProps> = ({
  formData,
  handleChange,
  lastLanzamiento,
  handleLoadLastData,
}) => {
  return (
    <div className="relative">
      <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-md shadow-sm"></div>
      <div className="pl-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-sm font-bold shadow-sm border border-indigo-200 dark:border-indigo-800">
              2
            </span>
            Detalles de la Convocatoria
          </h3>
          {lastLanzamiento && (
            <button
              type="button"
              onClick={handleLoadLastData}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <span className="material-icons !text-sm">history</span>
              Cargar datos anteriores
            </button>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          {/* Nombre PPS */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Nombre PPS (Visible para estudiantes) *
            </label>
            <Input
              name="nombrePPS"
              value={formData.nombrePPS}
              onChange={handleChange}
              placeholder="Ej: PPS en Hospital General de Niños"
              required
            />
          </div>

          {/* Orientación y Horas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Orientación *
              </label>
              <Select
                name="orientacion"
                value={formData.orientacion}
                onChange={handleChange}
                required
              >
                <option value="">Seleccionar...</option>
                {ALL_ORIENTACIONES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Horas Acreditadas *
              </label>
              <Input
                type="number"
                name="horasAcreditadas"
                value={formData.horasAcreditadas}
                onChange={handleChange}
                placeholder="Ej: 120"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Cupos Disponibles
              </label>
              <Input
                type="number"
                name="cuposDisponibles"
                value={formData.cuposDisponibles}
                onChange={handleChange}
                placeholder="Ej: 5"
                min="1"
              />
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="material-icons !text-sm">event</span>
                Período de Prácticas
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Inicio *</label>
                  <Input
                    type="date"
                    name="fechaInicio"
                    value={formData.fechaInicio}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Fin</label>
                  <Input
                    type="date"
                    name="fechaFin"
                    value={formData.fechaFin}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <span className="material-icons !text-sm">groups</span>
                Encuentro Inicial
                {formData.fechaEncuentroInicial && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded-full">
                    Activado
                  </span>
                )}
              </h4>

              <div
                className={`p-4 rounded-lg border transition-all ${
                  formData.fechaEncuentroInicial
                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Fecha</label>
                    <input
                      type="date"
                      name="fechaEncuentroInicial"
                      value={
                        formData.fechaEncuentroInicial
                          ? formData.fechaEncuentroInicial.split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const fecha = e.target.value;
                        const horaActual = formData.fechaEncuentroInicial?.split("T")[1] || "09:00";
                        handleChange({
                          target: {
                            name: "fechaEncuentroInicial",
                            value: fecha ? `${fecha}T${horaActual}` : "",
                          },
                        } as any);
                      }}
                      className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 px-4 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Hora</label>
                    <input
                      type="time"
                      name="horaEncuentroInicial"
                      value={formData.fechaEncuentroInicial?.split("T")[1] || "09:00"}
                      onChange={(e) => {
                        const hora = e.target.value;
                        const fechaActual =
                          formData.fechaEncuentroInicial?.split("T")[0] ||
                          new Date().toISOString().split("T")[0];
                        handleChange({
                          target: {
                            name: "fechaEncuentroInicial",
                            value: `${fechaActual}T${hora}`,
                          },
                        } as any);
                      }}
                      className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 px-4 text-sm text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-3">
                  Selecciona fecha y hora del encuentro obligatorio para todos los inscriptos.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="material-icons !text-sm">app_registration</span>
                Período de Inscripción
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
                  <Input
                    type="date"
                    name="fechaInicioInscripcion"
                    value={formData.fechaInicioInscripcion}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
                  <Input
                    type="date"
                    name="fechaFinInscripcion"
                    value={formData.fechaFinInscripcion}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Dirección / Ubicación
            </label>
            <Input
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Ej: Av. Pueyrredón 123, CABA"
            />
          </div>

          {/* Requisitos */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Requisitos
            </label>
            <div className="flex flex-wrap gap-4">
              <Checkbox
                name="reqCertificadoTrabajo"
                checked={formData.reqCertificadoTrabajo}
                onChange={handleChange}
                label="Requiere certificado de trabajo"
              />
              <Checkbox
                name="reqCv"
                checked={formData.reqCv}
                onChange={handleChange}
                label="Requiere CV actualizado"
              />
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Estado Inicial
            </label>
            <Select
              name="estadoConvocatoria"
              value={formData.estadoConvocatoria}
              onChange={handleChange}
            >
              <option value="Abierta">Abierta (visible inmediatamente)</option>
              <option value="Oculto">Oculto (no visible en catálogo)</option>
            </Select>
          </div>

          {/* Programar lanzamiento */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <Checkbox
              name="programarLanzamiento"
              checked={formData.programarLanzamiento}
              onChange={handleChange}
              label="Programar lanzamiento para fecha futura"
            />

            {formData.programarLanzamiento && (
              <div className="mt-3 ml-7">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Fecha y hora de publicación
                </label>
                <Input
                  type="datetime-local"
                  name="fechaPublicacion"
                  value={formData.fechaPublicacion}
                  onChange={handleChange}
                  required={formData.programarLanzamiento}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchForm;
