import React from "react";
import Button from "../../ui/Button";
import ConvocatoriaCardPremium from "../../ConvocatoriaCardPremium";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: any;
  actividades: string[];
  schedules: string[];
  selectedInstitution: any;
  whatsappMessage: string;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  formData,
  actividades,
  schedules,
  selectedInstitution,
  whatsappMessage,
  onConfirm,
  isSubmitting,
}) => {
  if (!isOpen) return null;

  // Build preview data for the card
  const previewData = {
    id: "preview",
    fields: {
      ...formData,
      actividades: actividades.filter(Boolean),
      horario_seleccionado: schedules.filter(Boolean).join("; "),
      institucion: selectedInstitution?.fields || {},
    },
  };

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="material-icons text-blue-600">preview</span>
              Vista Previa de la Convocatoria
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Así se verá la convocatoria para los estudiantes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Card Preview */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <ConvocatoriaCardPremium
              id="preview"
              nombre={formData.nombrePPS || "Nombre de la PPS"}
              orientacion={formData.orientacion || "Clinica"}
              direccion={formData.direccion || "Dirección no especificada"}
              descripcion={formData.descripcion || "Descripción no disponible"}
              actividades={actividades.filter(Boolean)}
              actividadesLabel={formData.actividadesLabel || "Actividades"}
              horasAcreditadas={String(formData.horasAcreditadas || 0)}
              horariosCursada={schedules.filter(Boolean).join("; ")}
              cupo={String(formData.cuposDisponibles || 0)}
              requisitoObligatorio={formData.requisitoObligatorio || ""}
              reqCv={formData.reqCv}
              timeline={{
                inscripcion: `${formData.fechaInicioInscripcion ? new Date(formData.fechaInicioInscripcion).toLocaleDateString("es-AR") : "?"} - ${formData.fechaFinInscripcion ? new Date(formData.fechaFinInscripcion).toLocaleDateString("es-AR") : "?"}`,
                inicio: formData.fechaInscripcion
                  ? new Date(formData.fechaInicio).toLocaleDateString("es-AR")
                  : "Por definir",
                fin: formData.fechaFin
                  ? new Date(formData.fechaFin).toLocaleDateString("es-AR")
                  : "Por definir",
              }}
              status={formData.estadoConvocatoria?.toLowerCase() || "abierta"}
              horariosFijos={formData.horariosFijos}
              fechaEncuentroInicial={formData.fechaEncuentroInicial}
            />
          </div>

          {/* WhatsApp Message Preview */}
          {whatsappMessage && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2 flex items-center gap-2">
                <span className="material-icons !text-sm">whatsapp</span>
                Mensaje para WhatsApp
              </h4>
              <pre className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {whatsappMessage}
              </pre>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900/50 p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Volver a editar
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            isLoading={isSubmitting}
            icon="rocket_launch"
          >
            {formData.programarLanzamiento ? "Programar Lanzamiento" : "Publicar Ahora"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
