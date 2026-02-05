import React, { useState } from "react";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import Checkbox from "../../ui/Checkbox";
import { ALL_ORIENTACIONES, Orientacion } from "../../../types";

interface NewInstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  isLoading: boolean;
  initialName?: string;
}

export const NewInstitutionModal: React.FC<NewInstitutionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  initialName = "",
}) => {
  const [newData, setNewData] = useState({
    nombre: initialName,
    direccion: "",
    telefono: "",
    tutor: "",
    orientacionSugerida: "" as Orientacion | "",
    logoFile: null as File | null,
    invertLogo: false,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(newData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewData({ ...newData, logoFile: e.target.files[0] });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-icons text-blue-600">add_business</span>
            Registrar Nueva Institución
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Esta institución se guardará como "Convenio Nuevo".
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
              Nombre Institución *
            </label>
            <Input
              value={newData.nombre}
              onChange={(e) => setNewData({ ...newData, nombre: e.target.value })}
              placeholder="Ej: Fundación Crecer"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                Dirección
              </label>
              <Input
                value={newData.direccion}
                onChange={(e) => setNewData({ ...newData, direccion: e.target.value })}
                placeholder="Calle y Altura"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                Teléfono
              </label>
              <Input
                value={newData.telefono}
                onChange={(e) => setNewData({ ...newData, telefono: e.target.value })}
                placeholder="Cod. Área + Nro"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
              Tutor (Lic. en Psicología)
            </label>
            <Input
              value={newData.tutor}
              onChange={(e) => setNewData({ ...newData, tutor: e.target.value })}
              placeholder="Nombre y Apellido"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Orientación Sugerida
            </label>
            <Select
              value={newData.orientacionSugerida}
              onChange={(e) =>
                setNewData({ ...newData, orientacionSugerida: e.target.value as any })
              }
            >
              <option value="">Seleccionar para pre-llenar...</option>
              {ALL_ORIENTACIONES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Logo Institucional (Opcional)
            </label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span className="material-icons !text-lg">upload_file</span>
                {newData.logoFile ? "Cambiar Logo" : "Subir Logo"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
              {newData.logoFile && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[150px]">
                  {newData.logoFile.name}
                </span>
              )}
            </div>

            <div className="mt-3">
              <Checkbox
                label="Invertir colores en Modo Oscuro (para logos muy oscuros)"
                checked={newData.invertLogo}
                onChange={(e) => setNewData({ ...newData, invertLogo: e.target.checked })}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isLoading}
              disabled={!newData.nombre}
            >
              Guardar Institución
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewInstitutionModal;
