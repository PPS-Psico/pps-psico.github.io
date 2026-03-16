import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FIELD_DNI_ESTUDIANTES, FIELD_ESTADO_ESTUDIANTES } from "../../constants";
import Button from "../ui/Button";
import Input from "../ui/Input";

interface DataCompletionModalProps {
  studentId: string;
  legajo: string;
  onComplete: () => void;
}

const DataCompletionModal: React.FC<DataCompletionModalProps> = ({
  studentId,
  legajo,
  onComplete,
}) => {
  const [dni, setDni] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanDni = dni.replace(/\D/g, "");
    if (!cleanDni || cleanDni.length < 7) {
      setError("Por favor ingresa un DNI válido");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("estudiantes")
        .update({
          [FIELD_DNI_ESTUDIANTES]: parseInt(cleanDni, 10),
          [FIELD_ESTADO_ESTUDIANTES]: "Activo",
        })
        .eq("id", studentId);

      if (updateError) throw updateError;

      onComplete();
    } catch (err: any) {
      setError(err.message || "Error al guardar los datos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 animate-scale-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-icons text-amber-600 !text-3xl">person_add</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Completá tus datos</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Para poder inscribirte en las PPS, necesitamos que completes tu DNI.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Número de Legajo
            </label>
            <Input value={legajo} disabled className="bg-slate-100 dark:bg-slate-800" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Número de DNI <span className="text-red-500">*</span>
            </label>
            <Input
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 40123456"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full h-12">
            Guardar y Continuar
          </Button>
        </form>
      </div>
    </div>
  );
};

export default DataCompletionModal;
