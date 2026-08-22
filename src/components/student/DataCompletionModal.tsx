import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { runQuery } from "../../lib/dbQuery";
import { db } from "../../lib/db";
import {
  FIELD_CORREO_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
} from "../../constants";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Loader from "../Loader";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { logger } from "../../utils/logger";

interface DataCompletionModalProps {
  studentId: string;
  legajo: string;
  onComplete: () => void;
}

const vacio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/**
 * Pide los datos que la inscripción exige y que el alumno todavía no tiene.
 *
 * Antes pedía sólo el DNI, aunque `useConvocatorias` valida además teléfono y
 * correo: quien tenía DNI pero no teléfono pasaba este modal sin fricción y se
 * enteraba recién al intentar inscribirse. Ahora se piden únicamente los campos
 * faltantes, para no volver a preguntar lo que ya está cargado.
 */
const DataCompletionModal: React.FC<DataCompletionModalProps> = ({
  studentId,
  legajo,
  onComplete,
}) => {
  const [faltantes, setFaltantes] = useState<{
    dni: boolean;
    telefono: boolean;
    correo: boolean;
  } | null>(null);
  const [estadoActual, setEstadoActual] = useState<string | null>(null);
  const [form, setForm] = useState({ dni: "", telefono: "", correo: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    (async () => {
      let data: {
        dni: string | null;
        telefono: string | null;
        correo: string | null;
        estado: string | null;
      } | null = null;
      let fetchError: unknown = null;
      try {
        data = await runQuery(
          supabase
            .from("estudiantes")
            .select("dni, telefono, correo, estado")
            .eq("id", studentId)
            .single(),
          { table: "estudiantes", operation: "leerPerfilParaCompletar" }
        );
      } catch (error) {
        fetchError = error;
      }

      if (!activo) return;
      if (fetchError || !data) {
        logger.error("[DataCompletion] No se pudo leer el perfil", fetchError);
        // Sin el perfil no se puede saber qué falta. Se pide el DNI, que es el
        // dato que originalmente disparaba este modal.
        setFaltantes({ dni: true, telefono: false, correo: false });
        return;
      }

      setEstadoActual(data.estado ?? null);
      setFaltantes({
        dni: vacio(data.dni) || Number(data.dni) === 0,
        telefono: vacio(data.telefono),
        correo: vacio(data.correo),
      });
    })();
    return () => {
      activo = false;
    };
  }, [studentId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!faltantes) return;

      const updates: Record<string, unknown> = {};

      if (faltantes.dni) {
        const cleanDni = form.dni.replace(/\D/g, "");
        if (cleanDni.length < 7) {
          setError("Ingresá un DNI válido (al menos 7 dígitos).");
          return;
        }
        updates[FIELD_DNI_ESTUDIANTES] = parseInt(cleanDni, 10);
      }

      if (faltantes.telefono) {
        const tel = form.telefono.trim();
        // Sin exigir formato: sólo que sea un número de teléfono plausible y no
        // el legajo u otro dato pegado por error.
        if (tel.replace(/\D/g, "").length < 8) {
          setError("Ingresá un celular válido, con característica y sin el 15.");
          return;
        }
        updates[FIELD_TELEFONO_ESTUDIANTES] = tel;
      }

      if (faltantes.correo) {
        const mail = form.correo.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
          setError("Ingresá un correo válido.");
          return;
        }
        updates[FIELD_CORREO_ESTUDIANTES] = mail;
      }

      // Con los tres datos completos el alumno queda habilitado. No se toca a
      // quien ya egresó: 'Finalizado' es terminal y reactivarlo lo devolvería
      // al circuito de inscripción.
      if (estadoActual !== "Finalizado") {
        updates[FIELD_ESTADO_ESTUDIANTES] = "Activo";
      }

      setIsLoading(true);
      setError("");
      try {
        // Escritura por `id`: entra en el wrapper tipado, no hace falta ir crudo.
        await db.estudiantes.update(studentId, updates);
        onComplete();
      } catch (err) {
        setError(getErrorMessage(err, "Error al guardar los datos"));
      } finally {
        setIsLoading(false);
      }
    },
    [faltantes, form, estadoActual, studentId, onComplete]
  );

  const pedidos = faltantes
    ? [faltantes.dni && "DNI", faltantes.telefono && "celular", faltantes.correo && "correo"]
        .filter(Boolean)
        .join(", ")
        .replace(/, ([^,]*)$/, " y $1")
    : "";

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 animate-scale-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-icons text-amber-600 !text-3xl">person_add</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Completá tus datos</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            {faltantes
              ? `Para poder inscribirte en las PPS necesitamos tu ${pedidos}.`
              : "Buscando qué datos te faltan…"}
          </p>
        </div>

        {!faltantes ? (
          <Loader />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="dc-legajo"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Número de Legajo
              </label>
              <Input
                id="dc-legajo"
                value={legajo}
                disabled
                className="bg-slate-100 dark:bg-slate-800"
              />
            </div>

            {faltantes.dni && (
              <div>
                <label
                  htmlFor="dc-dni"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Número de DNI <span className="text-red-500">*</span>
                </label>
                <Input
                  id="dc-dni"
                  value={form.dni}
                  onChange={(e) => setForm((p) => ({ ...p, dni: e.target.value }))}
                  placeholder="Ej: 40123456"
                  inputMode="numeric"
                  required
                />
              </div>
            )}

            {faltantes.telefono && (
              <div>
                <label
                  htmlFor="dc-telefono"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Celular <span className="text-red-500">*</span>
                </label>
                <Input
                  id="dc-telefono"
                  value={form.telefono}
                  onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej: 2994567890"
                  inputMode="tel"
                  aria-describedby="dc-telefono-hint"
                  required
                />
                <p
                  id="dc-telefono-hint"
                  className="text-xs text-slate-500 dark:text-slate-400 mt-1"
                >
                  Con característica y sin el 15. Es el contacto que usa coordinación durante la
                  PPS.
                </p>
              </div>
            )}

            {faltantes.correo && (
              <div>
                <label
                  htmlFor="dc-correo"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Correo <span className="text-red-500">*</span>
                </label>
                <Input
                  id="dc-correo"
                  value={form.correo}
                  onChange={(e) => setForm((p) => ({ ...p, correo: e.target.value }))}
                  placeholder="Ej: nombre@mail.com"
                  inputMode="email"
                  required
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <Button type="submit" isLoading={isLoading} className="w-full h-12">
              Guardar y Continuar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DataCompletionModal;
