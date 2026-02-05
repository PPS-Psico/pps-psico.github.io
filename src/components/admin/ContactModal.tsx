import React, { useState } from "react";
import type { LanzamientoPPS, InstitucionFields } from "../../types";
import { FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS } from "../../constants";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  pps: LanzamientoPPS;
  institution?: { id: string; phone?: string };
  onMarkContacted: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  pps,
  institution,
  onMarkContacted,
}) => {
  const [customMessage, setCustomMessage] = useState("");
  const [sent, setSent] = useState(false);

  const getGroupName = (name: string | undefined): string => {
    if (!name) return "Institución";
    return name.split(/ [-–] /)[0].trim();
  };

  const institutionName = getGroupName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
  const institutionPhone = institution?.phone || "";

  const defaultMessage = `Hola ${institutionName},

Espero que estén muy bien.

Te escribo desde la Coordinación de Prácticas Profesionales de la Licenciatura en Psicología de UFLO.

Queríamos consultarte si estarían interesados en volver a recibir alumnos en prácticas durante el año 2026. Sabemos que el año pasado tuvieron estudiantes y nos gustaría saber si desean continuar con esta colaboración.

Quedamos a la espera de su respuesta.

Saludos cordiales,

Blas
Coordinador de Prácticas Profesionales Supervisadas
Licenciatura en Psicología
UFLO`;

  const handleSend = (e: React.MouseEvent) => {
    e.preventDefault();
    setSent(true);

    const message = customMessage.trim() || defaultMessage;

    if (institutionPhone) {
      const cleanPhone = institutionPhone.replace(/[^0-9]/g, "");
      const waMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${cleanPhone}?text=${waMessage}`, "_blank", "noopener,noreferrer");
    }

    // Marcar como contactada después de enviar
    setTimeout(() => {
      onMarkContacted();
      handleClose();
    }, 500);
  };

  const handleClose = () => {
    setSent(false);
    setCustomMessage("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-icons text-green-600 dark:text-green-400">chat</span>
                Contactar por WhatsApp
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{institutionName}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Mensaje */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Mensaje de WhatsApp
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-4 text-sm focus:ring-2 focus:ring-green-500 outline-none leading-relaxed resize-none"
              placeholder="Escribe tu mensaje personalizado o deja vacío para usar el mensaje predeterminado..."
            />
            {customMessage === "" && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-800 dark:text-green-300 mb-1">
                  <strong>Mensaje predeterminado:</strong>
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 whitespace-pre-wrap">
                  {defaultMessage}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!institutionPhone || sent}
            className={`flex items-center gap-2 py-2 px-6 rounded-lg text-sm font-bold shadow-sm transition-all transform active:scale-95 ${
              sent
                ? "bg-emerald-500 text-white cursor-default"
                : !institutionPhone
                  ? "bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white hover:shadow-md"
            }`}
          >
            {sent ? (
              <>
                <span className="material-icons !text-base">check</span>
                <span>Enviado</span>
              </>
            ) : (
              <>
                <span className="material-icons !text-base">chat</span>
                <span>Enviar por WhatsApp</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
