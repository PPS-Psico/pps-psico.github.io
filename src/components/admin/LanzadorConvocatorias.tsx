import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { db } from "../../lib/db";
import type {
  InstitucionFields,
  LanzamientoPPSFields,
  AirtableRecord,
  LanzamientoPPS,
} from "../../types";
import {
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  // FIELD_INFORME_LANZAMIENTOS removed
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_ACTIVIDADES_LANZAMIENTOS,
  FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_PUBLICACION_LANZAMIENTOS,
  FIELD_LOGO_URL_INSTITUCIONES,
  FIELD_LOGO_INVERT_DARK_INSTITUCIONES,
  FIELD_DIRECCION_INSTITUCIONES,
  FIELD_TELEFONO_INSTITUCIONES,
  FIELD_TUTOR_INSTITUCIONES,
  FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS,
  FIELD_REQ_CV_LANZAMIENTOS,
  FIELD_CODIGO_CAMPUS_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_CODIGO_CAMPUS_INSTITUCIONES,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
  FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_INSTITUCION_LINK_PRACTICAS,
} from "../../constants";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../constants/configConstants";
import Card from "../ui/Card";
import Toast from "../ui/Toast";
import { ALL_ORIENTACIONES, Orientacion } from "../../types";
import { normalizeStringForComparison, formatDate } from "../../utils/formatters";
import { uploadInstitutionLogo } from "../../services/dataService";
import SubTabs from "../SubTabs";
import EmptyState from "../EmptyState";
import RecordEditModal from "./RecordEditModal";
import { schema } from "../../lib/dbSchema";
import CollapsibleSection from "../CollapsibleSection";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Button from "../ui/Button";
import Checkbox from "../ui/Checkbox";
import { notificationService } from "../../services/notificationService";

const mockInstitutions = [
  { id: "recInstMock1", [FIELD_NOMBRE_INSTITUCIONES]: "Hospital de Juguete" },
  { id: "recInstMock2", [FIELD_NOMBRE_INSTITUCIONES]: "Escuela de Pruebas" },
  { id: "recInstMock3", [FIELD_NOMBRE_INSTITUCIONES]: "Empresa Ficticia S.A." },
];

const mockLastLanzamiento = {
  id: "recLanzMock1",
  [FIELD_ORIENTACION_LANZAMIENTOS]: "Clinica",
  [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: 120,
  [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 5,
  [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: "Lunes 9 a 13hs; Miércoles 14 a 18hs",
  [FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS]: true,
  [FIELD_REQ_CV_LANZAMIENTOS]: false,
  [FIELD_DIRECCION_LANZAMIENTOS]: "Calle Falsa 123",
  [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: "<div>Test</div>",
  descripcion: "Mock description",
  actividades: ["Act 1"],
  requisitoObligatorio: "",
};

type FormData = {
  [key: string]: string | number | undefined | null | string[] | boolean;
  nombrePPS: string | undefined;
  fechaInicio: string | undefined;
  fechaFin: string | undefined;
  fechaInicioInscripcion: string | undefined;
  fechaFinInscripcion: string | undefined;
  orientacion: string | undefined;
  horasAcreditadas: number | undefined;
  cuposDisponibles: number | undefined;
  estadoConvocatoria: string | undefined;
  reqCertificadoTrabajo: boolean;
  reqCv: boolean;
  direccion: string | undefined;
  descripcion: string;
  requisitoObligatorio: string;
  programarLanzamiento: boolean;
  fechaPublicacion: string;
  mensajeWhatsApp: string;
  actividadesLabel: string;
  horariosFijos: boolean;
};

// INITIAL STATE
const initialState: FormData = {
  nombrePPS: "",
  fechaInicio: "",
  fechaFin: "",
  fechaInicioInscripcion: "",
  fechaFinInscripcion: "",
  orientacion: "",
  horasAcreditadas: 0,
  cuposDisponibles: 1,
  estadoConvocatoria: "Abierta",
  reqCertificadoTrabajo: true,
  reqCv: false,
  direccion: "",
  descripcion: "",
  requisitoObligatorio: "",
  // New Scheduling
  programarLanzamiento: false,
  fechaPublicacion: "",
  mensajeWhatsApp: "",
  actividadesLabel: "Actividades",
  horariosFijos: false,
};

interface LanzadorConvocatoriasProps {
  isTestingMode?: boolean;
  forcedTab?: "new" | "history";
}

const InputWrapper: React.FC<{
  label: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, icon, children, className = "" }) => (
  <div className={`group ${className}`}>
    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
      <span className="material-icons text-slate-300 dark:text-slate-600 group-focus-within:text-blue-500 transition-colors !text-sm">
        {icon}
      </span>
      {label}
    </label>
    {children}
  </div>
);

// --- UNUSED COMPONENTS ---
// TODO: SummaryItem is currently unused. Uncomment if needed:
// const SummaryItem: React.FC<{ icon: string; label: string; value: any }> = ({ icon, label, value }) => (
//     <div className="flex items-start gap-3">
//         <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
//             <span className="material-icons !text-sm text-slate-400">{icon}</span>
//         </div>
//         <div className="flex-1 min-w-0">
//             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
//             <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{value || 'No especificado'}</p>
//         </div>
//     </div>
// );

// --- MODAL PARA NUEVA INSTITUCIÓN ---
const NewInstitutionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  isLoading: boolean;
}> = ({ isOpen, onClose, onConfirm, isLoading }) => {
  const [newData, setNewData] = useState({
    nombre: "",
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

const LAUNCH_TABLE_CONFIG = {
  label: "Lanzamientos",
  schema: schema.lanzamientos,
  fieldConfig: [
    { key: FIELD_NOMBRE_PPS_LANZAMIENTOS, label: "Nombre PPS", type: "text" as const },
    { key: FIELD_FECHA_INICIO_LANZAMIENTOS, label: "Fecha Inicio", type: "date" as const },
    { key: FIELD_FECHA_FIN_LANZAMIENTOS, label: "Fecha Finalización", type: "date" as const },
    {
      key: FIELD_ORIENTACION_LANZAMIENTOS,
      label: "Orientación",
      type: "select" as const,
      options: ["Clinica", "Educacional", "Laboral", "Comunitaria"],
    },
    {
      key: FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
      label: "Estado",
      type: "select" as const,
      options: ["Abierta", "Cerrado", "Oculto"],
    },
    { key: FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS, label: "Etiqueta Lista", type: "text" as const },
  ],
};

import ConvocatoriaCardPremium from "../ConvocatoriaCardPremium";

const LanzadorConvocatorias: React.FC<LanzadorConvocatoriasProps> = ({
  isTestingMode = false,
  forcedTab,
}) => {
  const [internalTab, setInternalTab] = useState("new");
  const activeTab = forcedTab || internalTab;

  const [formData, setFormData] = useState<FormData>(initialState);
  const [schedules, setSchedules] = useState<string[]>([""]);
  const [actividades, setActividades] = useState<string[]>([]);

  // Legacy: We still save it effectively, but we don't focus on it as much in UI.

  // AI Loading State
  const [rawActivityText, setRawActivityText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [instiSearch, setInstiSearch] = useState("");
  const [selectedInstitution, setSelectedInstitution] =
    useState<AirtableRecord<InstitucionFields> | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const queryClient = useQueryClient();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      setToastInfo({ message: "Error al copiar al portapapeles", type: "error" });
    }
  };

  /**
   * Runs the AI logic to extract fields from raw text
   */
  const runAIExtraction = async () => {
    if (!rawActivityText.trim()) return;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setToastInfo({
        message: "⚠️ Configuración de Supabase no detectada",
        type: "error",
      });
      return;
    }

    setIsGenerating(true);
    setToastInfo({ message: "Generando contenido con IA...", type: "success" });

    try {
      const sanitizedText = rawActivityText
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");

      const prompt = `
Actúa como un experto en redacción de convocatorias universitarias y diseño UX.
Objetivo: Generar contenido para una tarjeta visualmente equilibrada y detectar información clave.

Instrucciones de Diseño:
1. La tarjeta tiene dos columnas. Izquierda (Descripción) y Derecha (Lista de Items).
2. Para mantener la ARMONÍA VISUAL, la columna derecha NO debe ser mucho más larga que la izquierda.
3. REGLA DE ORO: Genera MÁXIMO 4 items para la lista de la derecha.
4. Si la info original tiene más de 4 objetivos/actividades, INTEGRA los menos críticos dentro de la "descripcion" narrativa de forma fluida.
5. La "descripcion" debe ser robusta (aprox 300-450 caracteres) para equilibrar el peso visual de la lista.
6. FLEXIBILIDAD: El título de la lista de la derecha ("actividadesLabel") debe ser dinámico. 
   - Si la info se centra en tareas -> "Actividades".
   - Si se centra en lugares/espacios -> "Espacios de Participación".
   - Si se centra en objetivos específicos -> "Objetivos Específicos".
   - Elige el más adecuado según el material.
    7. DETECCIÓN DE HORARIOS: Busca detalladamente información sobre días, horarios y modalidades (presencial/virtual) de cursada.
   - No omitas información si hay múltiples turnos o espacios diferentes.
   - Si hay varios horarios, júntalos en el campo "horario_seleccionado" separados por PUNTO Y COMA (;).
   - Ejemplo formativo: "Turno Mañana: 10:30 a 13:30 hs; Turno Tarde: 14:00 a 17:30 hs; Sábados (Virtual): 10:00 a 12:00 hs".
8. NO REDUNDANCIA: La "descripcion" NO DEBE incluir datos que ya figuran en otros campos de la tarjeta:
   - NO menciones fechas de inicio o fin.
   - NO menciones la cantidad de cupos disponibles.
   - NO menciones la cantidad de horas acreditadas.
   - NO menciones si es presencial o virtual (ya figura en la ubicación).
   - NO menciones frases de marketing como "abre una valiosa convocatoria", "convocatoria breve", "cerrando el 5 de noviembre".
   - NO repitas el nombre de la PPS, la institución o textos del lanzamiento.
   - Si el texto original tiene información de CALIDAD de la PPS (características, tipo de práctica), inclúyela. Si no, genera una descripción concisa del rol del estudiante y el propósito pedagógico sin inventar información.

Información Cruda: ${sanitizedText}

Datos del Contexto:
- Título: ${formData.nombrePPS || "Práctica Profesional"}
- Orientación: ${formData.orientacion || "General"}

Genera un objeto JSON con:
1. "descripcion": Resumen profesional conciso. Si el texto original tiene información de CALIDAD de la PPS (características, tipo de práctica), inclúyela. Si no hay, genera una descripción concisa del rol del estudiante y el propósito pedagógico sin inventar información ni repetir datos del lanzamiento.
2. "actividades": Array de strings. MÁXIMO 4 items. Solo lo más relevante.
3. "actividadesLabel": El título sugerido para la lista (ej: "Actividades", "Espacios", etc).
4. "horario_seleccionado": Un string con todos los horarios detectados separados por PUNTO Y COMA (;). Si no hay, dejar vacío.
5. "requisitoObligatorio": String (o vacío).

Responde SOLO con el JSON válido.
`;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`Error en la edge function: ${response.status}`);
      }

      const data = await response.json();

      let text = "";
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const parts = data.candidates[0].content.parts;
        text = parts.map((p: any) => p.text).join("");
      } else if (data.error) {
        throw new Error(data.error.message || "Error desconocido de Gemini");
      }

      const cleanJson = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      console.log("🔍 [DEBUG] Raw text from Gemini:", cleanJson);

      const parsed = JSON.parse(cleanJson);

      if (parsed) {
        const currentDesc = parsed.descripcion || formData.descripcion;
        const currentActs =
          Array.isArray(parsed.actividades) && parsed.actividades.length > 0
            ? parsed.actividades
            : actividades;

        setFormData((prev) => ({
          ...prev,
          descripcion: currentDesc,
          requisitoObligatorio: parsed.requisitoObligatorio || prev.requisitoObligatorio,
          actividadesLabel: parsed.actividadesLabel || prev.actividadesLabel,
        }));
        setActividades(currentActs);

        if (parsed.horario_seleccionado) {
          const detectedSchedules = parsed.horario_seleccionado
            .split(";")
            .map((s: string) => s.trim())
            .filter(Boolean);
          if (detectedSchedules.length > 0) {
            setSchedules(detectedSchedules);
          }
        }

        setToastInfo({ message: "✨ Contenido y horarios detectados", type: "success" });
      }
    } catch (error: any) {
      console.error("AI Auto-Gen Error", error);
      setToastInfo({ message: `Error IA: ${error.message}`, type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Logic to generate the WhatsApp preview and open the modal,
   * WITHOUT re-running extraction and losing manual edits.
   */
  const handleSmartPreview = () => {
    const inscripInfo =
      formData.fechaInicioInscripcion && formData.fechaFinInscripcion
        ? `Desde *${formatDate(formData.fechaInicioInscripcion)}* hasta el *${formatDate(formData.fechaFinInscripcion)}*`
        : "*A confirmar*";

    // Calculate duration
    let durationText = "A confirmar";
    if (formData.fechaInicio && formData.fechaFin) {
      const s = new Date(formData.fechaInicio);
      const e = new Date(formData.fechaFin);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const diffDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 30) {
          const months = Math.round(diffDays / 30);
          durationText = `${months} ${months === 1 ? "mes" : "meses"} (aprox.)`;
        } else if (diffDays >= 7) {
          const weeks = Math.round(diffDays / 7);
          durationText = `${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
        } else {
          durationText = `${diffDays} ${diffDays === 1 ? "día" : "días"}`;
        }
      }
    }

    const msg = `📢 *¡Nueva Convocatoria PPS: ${formData.nombrePPS || "Práctica Profesional"}!* 📢

✨ *Institución:* ${formData.nombrePPS || "A confirmar"}.
📍 *Lugar:* ${formData.direccion || "A confirmar"}.

🎯 *Objetivo:* ${formData.descripcion || "Describir el objetivo de la práctica."}

*Detalles de la Práctica:*
⏱️ *Acredita:* ${formData.horasAcreditadas || 0} hs totales (${formData.orientacion || "Orientación"}).
⏳ *Duración:* ${durationText}.
👥 *Cupo:* ${formData.cuposDisponibles || 0} estudiantes.
📍 *Modalidad:* ${formData.direccion === "Modalidad Virtual" ? "Virtual" : "Presencial"}.

*Horarios y Dedicación:*
🗓️ *Cursada:* ${schedules.filter(Boolean).join("; ") || "A confirmar"}.

*Fechas Clave:*
‼️ *INSCRIPCIÓN:* ${inscripInfo}. ‼️
🚀 *Inicio de Prácticas:* ${formData.fechaInicio ? formatDate(formData.fechaInicio) : "A confirmar"}.

*Requisito Obligatorio:*
📄 ${formData.reqCv ? "Subir CV actualizado al momento de inscribirse." : formData.requisitoObligatorio || "Sin requisitos adicionales."}

🔗 *Inscripción en Mi Panel.*`;

    setFormData((prev) => ({ ...prev, mensajeWhatsApp: msg }));
    setShowPreviewModal(true);
  };

  // UI States
  const [isNewInstitutionModalOpen, setIsNewInstitutionModalOpen] = useState(false);
  const [editingLaunch, setEditingLaunch] = useState<AirtableRecord<LanzamientoPPSFields> | null>(
    null
  );
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const { data: institutions = [] } = useQuery<AirtableRecord<InstitucionFields>[]>({
    queryKey: ["allInstitutionsForLauncher", isTestingMode],
    queryFn: () => {
      if (isTestingMode) {
        return Promise.resolve(mockInstitutions as unknown as AirtableRecord<InstitucionFields>[]);
      }
      return db.instituciones.getAll({
        fields: [
          FIELD_NOMBRE_INSTITUCIONES,
          FIELD_CODIGO_CAMPUS_INSTITUCIONES,
          FIELD_DIRECCION_INSTITUCIONES,
          FIELD_TELEFONO_INSTITUCIONES,
          FIELD_TUTOR_INSTITUCIONES,
          FIELD_LOGO_URL_INSTITUCIONES,
          FIELD_LOGO_INVERT_DARK_INSTITUCIONES,
        ],
      });
    },
  });

  const { data: lastLanzamiento } = useQuery({
    queryKey: ["lastLanzamiento", selectedInstitution?.id, isTestingMode],
    queryFn: async () => {
      if (!selectedInstitution) return null;
      if (isTestingMode) {
        if (mockInstitutions.some((i) => i.id === selectedInstitution.id)) {
          return mockLastLanzamiento as unknown as AirtableRecord<LanzamientoPPSFields>;
        }
        return null;
      }

      // 1. Try search by Institution ID (Most reliable)
      let records = await db.lanzamientos.get({
        filters: { institucion_id: selectedInstitution.id },
        sort: [{ field: "fecha_inicio", direction: "desc" }],
        maxRecords: 1,
      });

      // 2. Fallback to relaxed name match if not found by ID or if ID-linked record is very old
      if (records.length === 0) {
        records = await db.lanzamientos.get({
          filters: {
            [FIELD_NOMBRE_PPS_LANZAMIENTOS]: `%${selectedInstitution[FIELD_NOMBRE_INSTITUCIONES]}%`,
          },
          sort: [{ field: "fecha_inicio", direction: "desc" }],
          maxRecords: 1,
        });
      }

      return records[0] || null;
    },
    enabled: !!selectedInstitution,
  });

  const { data: launchHistory = [] } = useQuery({
    queryKey: ["launchHistory", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) return [];
      return db.lanzamientos.getAll({
        sort: [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }],
      });
    },
    enabled: true,
  });

  // SORTING AND GROUPING LOGIC FOR HISTORY TAB
  const { visibleHistory, hiddenHistory, scheduledHistory } = useMemo(() => {
    const sorted = [...launchHistory].sort((a, b) => {
      const statusA = normalizeStringForComparison(a[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
      const statusB = normalizeStringForComparison(b[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);

      const isOpenA = statusA === "abierta" || statusA === "abierto";
      const isOpenB = statusB === "abierta" || statusB === "abierto";

      if (isOpenA && !isOpenB) return -1;
      if (!isOpenA && isOpenB) return 1;

      const dateA = new Date(a[FIELD_FECHA_INICIO_LANZAMIENTOS] || 0).getTime();
      const dateB = new Date(b[FIELD_FECHA_INICIO_LANZAMIENTOS] || 0).getTime();

      return dateB - dateA;
    });

    const visible: LanzamientoPPS[] = [];
    const hidden: LanzamientoPPS[] = [];
    const scheduled: LanzamientoPPS[] = [];

    sorted.forEach((launch) => {
      const status = normalizeStringForComparison(launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
      if (status === "programada" || status === "programado") {
        scheduled.push(launch);
      } else if (status === "oculto") {
        hidden.push(launch);
      } else {
        visible.push(launch);
      }
    });

    return { visibleHistory: visible, hiddenHistory: hidden, scheduledHistory: scheduled };
  }, [launchHistory]);

  // MUTATIONS
  const createInstitutionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isTestingMode) {
        return { id: "new-mock", ...data, [FIELD_NOMBRE_INSTITUCIONES]: data.nombre };
      }

      let logoUrl = "";
      if (data.logoFile) {
        try {
          logoUrl = await uploadInstitutionLogo(data.logoFile, data.nombre);
        } catch (error) {
          console.error("Failed to upload logo:", error);
          throw error;
        }
      }

      return db.instituciones.create({
        [FIELD_NOMBRE_INSTITUCIONES]: data.nombre,
        [FIELD_DIRECCION_INSTITUCIONES]: data.direccion,
        [FIELD_TELEFONO_INSTITUCIONES]: data.telefono,
        [FIELD_TUTOR_INSTITUCIONES]: data.tutor,
        [FIELD_LOGO_URL_INSTITUCIONES]: logoUrl || undefined,
        [FIELD_LOGO_INVERT_DARK_INSTITUCIONES]: data.invertLogo,
      } as any);
    },
    onSuccess: (newInst, variables) => {
      setToastInfo({ message: "Institución registrada con éxito.", type: "success" });
      setSelectedInstitution(newInst as any);
      setInstiSearch(newInst[FIELD_NOMBRE_INSTITUCIONES] as string);

      setFormData((prev) => ({
        ...prev,
        nombrePPS: newInst[FIELD_NOMBRE_INSTITUCIONES] as string,
        orientacion: variables.orientacionSugerida,
        direccion: newInst[FIELD_DIRECCION_INSTITUCIONES] as string,
      }));

      setIsNewInstitutionModalOpen(false);
      if (!isTestingMode)
        queryClient.invalidateQueries({ queryKey: ["allInstitutionsForLauncher"] });
    },
    onError: (err: any) => setToastInfo({ message: `Error: ${err.message}`, type: "error" }),
  });

  const createLaunchMutation = useMutation({
    mutationFn: async (newLaunchData: any) => {
      if (isTestingMode) {
        console.log("TEST MODE: Simulating launch creation with data:", newLaunchData);
        return new Promise((resolve) => setTimeout(() => resolve(null), 1000));
      }
      return db.lanzamientos.create(newLaunchData);
    },
    onSuccess: (data: any, variables: any) => {
      setToastInfo({ message: "Convocatoria procesada con éxito.", type: "success" });

      // Trigger Push Notification for new launches (not scheduled ones)
      if (variables[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === "Abierta") {
        notificationService
          .notifyNewLaunch(variables[FIELD_NOMBRE_PPS_LANZAMIENTOS])
          .catch((err) => {
            console.error("[Lanzador] Error triggering push notification:", err);
          });
      }

      setFormData(initialState);
      setSchedules([""]);
      setActividades([]);

      setInstiSearch("");
      setSelectedInstitution(null);

      // Auto-switch to history tab to see the result
      setInternalTab("history");
      setShowPreviewModal(false); // Close correctly upon success

      if (!isTestingMode) {
        queryClient.invalidateQueries({ queryKey: ["allLanzamientos"] });
        queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
        queryClient.invalidateQueries({ queryKey: ["conveniosData"] });
      }
    },
    onError: (error: any) => {
      const msg = error?.error?.message || error?.message || JSON.stringify(error);
      setToastInfo({ message: `Error al lanzar: ${msg}`, type: "error" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => {
      return db.lanzamientos.update(id, updates);
    },
    onSuccess: (_, variables) => {
      const newStatus = variables.updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS];
      setToastInfo({ message: `Estado actualizado a "${newStatus}".`, type: "success" });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    },
    onError: (error: any) => {
      setToastInfo({ message: `Error al actualizar estado: ${error.message}`, type: "error" });
    },
  });

  const deleteLaunchMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isTestingMode) return null;

      console.log("[DELETE] Cleaning up dependencies for launch:", id);

      // CASCADE DELETE MANUALLY:
      // 1. Delete associated registrations (convocatorias)
      const { error: err1 } = await supabase
        .from("convocatorias")
        .delete()
        .eq("lanzamiento_id", id);
      if (err1) console.warn("Error deleting convocatorias:", err1);

      // 2. Delete associated practices (practicas)
      const { error: err2 } = await supabase.from("practicas").delete().eq("lanzamiento_id", id);
      if (err2) console.warn("Error deleting practicas:", err2);

      // 3. Finally delete the launch
      console.log("[DELETE] Removing launch record...");
      return db.lanzamientos.delete(id);
    },
    onSuccess: () => {
      setToastInfo({ message: "Lanzamiento y datos vinculados eliminados.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
      queryClient.invalidateQueries({ queryKey: ["allConvocatorias"] });
      queryClient.invalidateQueries({ queryKey: ["allPracticas"] });
    },
    onError: (error: any) => {
      console.error("Delete failed:", error);
      const msg = error?.message || "Error desconocido";
      setToastInfo({ message: `Error al eliminar: ${msg}`, type: "error" });
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: any }) => {
      return db.lanzamientos.update(id, fields);
    },
    onSuccess: () => {
      setToastInfo({ message: "Lanzamiento actualizado.", type: "success" });
      setEditingLaunch(null);
      queryClient.invalidateQueries({ queryKey: ["launchHistory"] });
    },
    onError: (error: any) => {
      setToastInfo({ message: `Error al guardar cambios: ${error.message}`, type: "error" });
    },
  });

  const filteredInstitutions = useMemo(() => {
    if (!instiSearch) return [];
    const normalizedSearch = normalizeStringForComparison(instiSearch);
    return institutions
      .filter((inst) =>
        normalizeStringForComparison(inst[FIELD_NOMBRE_INSTITUCIONES]).includes(normalizedSearch)
      )
      .slice(0, 7);
  }, [instiSearch, institutions]);

  const handleSelectInstitution = (inst: AirtableRecord<InstitucionFields>) => {
    setSelectedInstitution(inst);
    setInstiSearch(inst[FIELD_NOMBRE_INSTITUCIONES] || "");
    setFormData((prev) => ({
      ...prev,
      nombrePPS: inst[FIELD_NOMBRE_INSTITUCIONES] || "",
      direccion: inst[FIELD_DIRECCION_INSTITUCIONES] || prev.direccion,
    }));

    setIsDropdownOpen(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    let newValue = type === "checkbox" ? checked : value;

    // Validation for date-only inputs (truncate YYYY-MM-DDTHH:MM)
    if (type === "date" && typeof newValue === "string" && newValue.includes("T")) {
      newValue = newValue.split("T")[0];
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue as any,
    }));
  };

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

  // Activities Handlers
  const handleActivityChange = (index: number, value: string) => {
    const newActivities = [...actividades];
    newActivities[index] = value;
    setActividades(newActivities);
  };

  const addActivity = () => setActividades([...actividades, ""]);
  const removeActivity = (index: number) => {
    const newActivities = actividades.filter((_, i) => i !== index);
    setActividades(newActivities);
  };

  const handleLoadLastData = useCallback(() => {
    if (!lastLanzamiento) return;
    const prevSchedulesString = lastLanzamiento[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS];
    let prevSchedulesList = [""];
    if (prevSchedulesString) {
      prevSchedulesList = prevSchedulesString
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      if (prevSchedulesList.length === 0) prevSchedulesList = [""];
    }

    // Handle Activities (Robust parsing)
    const prevActivitiesRaw = lastLanzamiento[FIELD_ACTIVIDADES_LANZAMIENTOS];
    let prevActivitiesList: string[] = [];
    if (Array.isArray(prevActivitiesRaw)) {
      prevActivitiesList = prevActivitiesRaw.map(String);
    } else if (typeof prevActivitiesRaw === "string") {
      try {
        // Try JSON parse first
        const parsed = JSON.parse(prevActivitiesRaw);
        if (Array.isArray(parsed)) prevActivitiesList = parsed;
        else prevActivitiesList = [prevActivitiesRaw];
      } catch (e) {
        // If not JSON, assumes simple string or split by newlines if applicable, but for now treat as single item
        prevActivitiesList = [prevActivitiesRaw];
      }
    }

    setFormData((prev) => ({
      ...prev,
      orientacion: (lastLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] as string) || "",
      horasAcreditadas: (lastLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS] as number) || 0,
      cuposDisponibles: (lastLanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] as number) || 1,
      reqCertificadoTrabajo: lastLanzamiento[FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS] !== false,
      reqCv: !!lastLanzamiento[FIELD_REQ_CV_LANZAMIENTOS],
      direccion: lastLanzamiento[FIELD_DIRECCION_LANZAMIENTOS] || prev.direccion,
      descripcion: (lastLanzamiento[FIELD_DESCRIPCION_LANZAMIENTOS] as string) || "",
      requisitoObligatorio:
        (lastLanzamiento[FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS] as string) || "",
      fechaInicioInscripcion: "",
      fechaFinInscripcion: "",
      mensajeWhatsApp: (lastLanzamiento[FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS] as string) || "",
      actividadesLabel:
        (lastLanzamiento[FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS] as string) || "Actividades",
      horariosFijos: !!lastLanzamiento[FIELD_HORARIOS_FIJOS_LANZAMIENTOS],
    }));
    setSchedules(prevSchedulesList.length ? prevSchedulesList : [""]);
    setActividades(prevActivitiesList.length ? prevActivitiesList : [""]);

    setToastInfo({ message: "Datos anteriores cargados.", type: "success" });
  }, [lastLanzamiento]);

  // Effect to auto-load last data
  useEffect(() => {
    if (lastLanzamiento && selectedInstitution && formData.horasAcreditadas === 0) {
      handleLoadLastData();
    }
  }, [lastLanzamiento, selectedInstitution, handleLoadLastData, formData.horasAcreditadas]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fechaRealInicio =
      formData.programarLanzamiento && formData.fechaPublicacion
        ? formData.fechaPublicacion
        : formData.fechaInicio;

    const horas = Number(formData.horasAcreditadas);
    const hasHours = !isNaN(horas); // Allow 0, but check if it's a number

    if (!formData.nombrePPS || !fechaRealInicio || !formData.orientacion || !hasHours) {
      setToastInfo({
        message: "Por favor, complete los campos requeridos (Nombre, Fecha, Orientación, Horas).",
        type: "error",
      });
      return;
    }

    // Prepare arrays
    const horarioFinal = schedules
      .map((s) => s.trim())
      .filter(Boolean)
      .join("; ");
    const actividadesFinal = actividades.map((a) => a.trim()).filter(Boolean);

    const finalPayload = {
      [FIELD_NOMBRE_PPS_LANZAMIENTOS]: formData.nombrePPS,
      [FIELD_FECHA_INICIO_LANZAMIENTOS]: formData.fechaInicio, // Always launch start date
      [FIELD_FECHA_FIN_LANZAMIENTOS]: formData.fechaFin,
      [FIELD_ORIENTACION_LANZAMIENTOS]: formData.orientacion,
      [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: Number(formData.horasAcreditadas),
      [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: Number(formData.cuposDisponibles),
      [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: horarioFinal,
      [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: formData.programarLanzamiento
        ? "Programada"
        : formData.estadoConvocatoria,
      [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Relanzamiento Confirmado",
      [FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS]: formData.reqCertificadoTrabajo,
      [FIELD_REQ_CV_LANZAMIENTOS]: formData.reqCv,
      [FIELD_DIRECCION_LANZAMIENTOS]: formData.direccion,

      // New Fields
      [FIELD_DESCRIPCION_LANZAMIENTOS]: formData.descripcion,
      [FIELD_ACTIVIDADES_LANZAMIENTOS]: actividadesFinal,
      [FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS]: formData.requisitoObligatorio,
      [FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS]: formData.fechaInicioInscripcion,
      [FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]: formData.fechaFinInscripcion,
      [FIELD_FECHA_PUBLICACION_LANZAMIENTOS]: formData.programarLanzamiento
        ? formData.fechaPublicacion
        : null,
      [FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS]: formData.mensajeWhatsApp,
      [FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS]: formData.actividadesLabel,
      [FIELD_HORARIOS_FIJOS_LANZAMIENTOS]: formData.horariosFijos,
      [FIELD_INSTITUCION_LINK_PRACTICAS]: selectedInstitution?.id || "recInstMock_nuevo",
    };

    createLaunchMutation.mutate(finalPayload);
  };

  const handleStatusAction = (id: string, action: "cerrar" | "abrir" | "ocultar") => {
    const updates: any = {};
    if (action === "cerrar") updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Cerrado";
    else if (action === "abrir") {
      updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Abierta";
      updates[FIELD_ESTADO_GESTION_LANZAMIENTOS] = "Relanzamiento Confirmado";
    } else if (action === "ocultar") updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Oculto";

    updateStatusMutation.mutate({ id, updates });
  };

  const LaunchCountdown: React.FC<{ targetDate: string }> = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
      const calculateTime = () => {
        const now = new Date().getTime();
        const target = new Date(targetDate).getTime();
        const diff = target - now;

        if (diff <= 0) {
          setTimeLeft("Procesando...");
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (parts.length === 0) parts.push("< 1m");

        setTimeLeft(parts.join(" "));
      };

      calculateTime();
      const timer = setInterval(calculateTime, 60000);
      return () => clearInterval(timer);
    }, [targetDate]);

    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
        <span className="material-icons !text-xs animate-pulse">timer</span>
        <span className="text-[10px] font-black tracking-tight">{timeLeft}</span>
      </div>
    );
  };

  const renderLaunchItem = useCallback(
    (launch: LanzamientoPPS) => {
      const statusRaw = normalizeStringForComparison(
        launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]
      );
      const isAbierta = statusRaw === "abierta" || statusRaw === "abierto";
      const isOculta = statusRaw === "oculto";
      const isProgramada = statusRaw === "programada" || statusRaw === "programado";
      const pubDate = launch[FIELD_FECHA_PUBLICACION_LANZAMIENTOS] as string;

      return (
        <div
          key={launch.id}
          className={`bg-white dark:bg-slate-800/50 p-4 rounded-xl border transition-all hover:shadow-md ${isAbierta ? "border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-100 dark:ring-emerald-900/30" : isProgramada ? "border-indigo-300 dark:border-indigo-800 ring-1 ring-indigo-50 dark:ring-indigo-900/20" : isOculta ? "border-slate-200 dark:border-slate-700 opacity-75" : "border-slate-200 dark:border-slate-700"} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}
        >
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h4 className="font-bold text-slate-800 dark:text-slate-100">
                {launch[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
              </h4>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${isAbierta ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isProgramada ? "bg-indigo-50 text-indigo-700 border-indigo-200" : isOculta ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}
                >
                  {launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]}
                </span>
                {isProgramada && pubDate && <LaunchCountdown targetDate={pubDate} />}
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isProgramada
                ? `Publicación: ${formatDate(pubDate)}`
                : `Inicio: ${formatDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS] || "")}`}{" "}
              &bull; Orientación: {launch[FIELD_ORIENTACION_LANZAMIENTOS]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingLaunch(launch)}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Editar"
            >
              <span className="material-icons !text-xl">edit</span>
            </button>
            {isOculta ? (
              <button
                onClick={() => handleStatusAction(launch.id, "cerrar")}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Hacer Visible (Cerrada)"
              >
                <span className="material-icons !text-xl">visibility</span>
              </button>
            ) : isAbierta || isProgramada ? (
              <button
                onClick={() => handleStatusAction(launch.id, "cerrar")}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Cerrar/Cancelar"
              >
                <span className="material-icons !text-xl">
                  {isProgramada ? "event_busy" : "lock"}
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleStatusAction(launch.id, "abrir")}
                className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Reabrir Convocatoria"
              >
                <span className="material-icons !text-xl">lock_open</span>
              </button>
            )}
            {!isOculta && (
              <button
                onClick={() => handleStatusAction(launch.id, "ocultar")}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Ocultar"
              >
                <span className="material-icons !text-xl">visibility_off</span>
              </button>
            )}
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "¿Estás seguro de eliminar este lanzamiento? Esto no se puede deshacer y podría afectar a los estudiantes inscriptos."
                  )
                ) {
                  deleteLaunchMutation.mutate(launch.id);
                }
              }}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Eliminar Registro Permanentemente"
            >
              <span className="material-icons !text-xl">delete_forever</span>
            </button>
          </div>
        </div>
      );
    },
    [handleStatusAction, deleteLaunchMutation]
  );

  return (
    <Card
      title={activeTab === "new" ? "Nuevo Lanzamiento" : "Historial de Lanzamientos"}
      icon={activeTab === "new" ? "rocket_launch" : "history"}
      description={
        activeTab === "new"
          ? "Configura y publica una nueva convocatoria."
          : "Visualiza y administra convocatorias anteriores."
      }
      className="border-blue-200 dark:border-blue-800/30"
    >
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {/* NEW INSTITUTION MODAL */}
      <NewInstitutionModal
        isOpen={isNewInstitutionModalOpen}
        onClose={() => setIsNewInstitutionModalOpen(false)}
        onConfirm={createInstitutionMutation.mutate}
        isLoading={createInstitutionMutation.isPending}
      />

      {!forcedTab && (
        <div className="mt-4">
          <SubTabs
            tabs={[
              { id: "new", label: "Nuevo Lanzamiento", icon: "add_circle" },
              { id: "history", label: "Historial", icon: "history" },
            ]}
            activeTabId={activeTab}
            onTabChange={setInternalTab}
          />
        </div>
      )}

      <div className={activeTab === "new" ? "block" : "hidden"}>
        <form onSubmit={handleSubmit} className="mt-8 space-y-8 animate-fade-in">
          {/* BLOQUE 1: SELECCIÓN DE INSTITUCIÓN */}
          <div className={`relative group ${isDropdownOpen ? "z-50" : "z-30"}`}>
            <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
            </div>

            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-600 rounded-l-md shadow-sm"></div>
            <div className="pl-6 relative z-20">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm font-bold shadow-sm border border-blue-200 dark:border-blue-800">
                  1
                </span>
                Institución
              </h3>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="relative flex-grow w-full">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Buscar Institución
                    </label>
                    <div className="relative">
                      <input
                        id="instiSearch"
                        type="text"
                        value={instiSearch}
                        onChange={(e) => {
                          setInstiSearch(e.target.value);
                          setSelectedInstitution(null);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder="Escribe para buscar..."
                        className="w-full h-11 pl-11 pr-4 text-lg font-medium bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors shadow-sm placeholder:font-normal"
                        autoComplete="off"
                        required
                      />
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-icons text-slate-400 !text-xl">
                        search
                      </span>
                    </div>

                    {isDropdownOpen && filteredInstitutions.length > 0 && (
                      <div className="absolute z-[100] mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 overflow-hidden animate-fade-in-up max-h-60 overflow-y-auto">
                        <ul>
                          {filteredInstitutions.map((inst) => (
                            <li
                              key={inst.id}
                              onClick={() => handleSelectInstitution(inst)}
                              className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors flex items-center gap-3"
                            >
                              <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-300">
                                <span className="material-icons !text-lg">business</span>
                              </div>
                              <div className="flex-1">
                                <span className="block text-slate-700 dark:text-slate-200 font-medium">
                                  {inst[FIELD_NOMBRE_INSTITUCIONES]}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsNewInstitutionModalOpen(true)}
                      className="w-full md:w-auto h-[52px] px-6 bg-white dark:bg-slate-700 border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-icons !text-xl">add</span>
                      Nueva Institución
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: DETALLES BÁSICOS */}
          <div className="relative group z-20">
            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-md shadow-sm"></div>
            <div className="pl-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-sm font-bold shadow-sm border border-indigo-200 dark:border-indigo-800">
                  2
                </span>
                Detalles Básicos
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <InputWrapper label="Nombre PPS (Visible)" icon="badge">
                  <Input
                    value={formData.nombrePPS as string}
                    onChange={handleChange}
                    name="nombrePPS"
                    placeholder="Nombre visible de la convocatoria"
                  />
                </InputWrapper>

                <InputWrapper label="Orientación" icon="school">
                  <Select value={formData.orientacion} onChange={handleChange} name="orientacion">
                    <option value="">Seleccionar...</option>
                    {ALL_ORIENTACIONES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </InputWrapper>

                <InputWrapper label="Dirección / Lugar" icon="location_on">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        value={formData.direccion as string}
                        onChange={handleChange}
                        name="direccion"
                        placeholder="Calle 123, CABA"
                        disabled={formData.direccion === "Modalidad Virtual"}
                      />
                    </div>
                    <div className="flex items-center">
                      <Checkbox
                        label="Online"
                        checked={formData.direccion === "Modalidad Virtual"}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            direccion: e.target.checked ? "Modalidad Virtual" : "",
                          }))
                        }
                        wrapperClassName="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-[46px]"
                      />
                    </div>
                  </div>
                </InputWrapper>

                <InputWrapper label="Fecha Inicio" icon="event_available">
                  <Input
                    type="date"
                    value={formData.fechaInicio as string}
                    onChange={handleChange}
                    name="fechaInicio"
                  />
                </InputWrapper>

                <InputWrapper label="Fecha Fin (Práctica)" icon="event_busy">
                  <Input
                    type="date"
                    value={formData.fechaFin as string}
                    onChange={handleChange}
                    name="fechaFin"
                  />
                </InputWrapper>

                <div className="col-span-1 md:col-span-2 lg:col-span-3 h-px bg-slate-200 dark:bg-slate-700 my-2" />

                <InputWrapper label="Inscripción Desde" icon="app_registration">
                  <Input
                    type="date"
                    value={formData.fechaInicioInscripcion as string}
                    onChange={handleChange}
                    name="fechaInicioInscripcion"
                  />
                </InputWrapper>

                <InputWrapper label="Inscripción Hasta" icon="access_time_filled">
                  <Input
                    type="date"
                    value={formData.fechaFinInscripcion as string}
                    onChange={handleChange}
                    name="fechaFinInscripcion"
                  />
                </InputWrapper>

                {/* Scheduled Launch Feature */}

                <div className="grid grid-cols-2 gap-4">
                  <InputWrapper label="Horas" icon="schedule">
                    <Input
                      type="number"
                      value={formData.horasAcreditadas as number}
                      onChange={handleChange}
                      name="horasAcreditadas"
                    />
                  </InputWrapper>
                  <InputWrapper label="Cupos" icon="group">
                    <Input
                      type="number"
                      value={formData.cuposDisponibles as number}
                      onChange={handleChange}
                      name="cuposDisponibles"
                    />
                  </InputWrapper>
                </div>

                {/* Drive URL Field Removed */}

                <div className="flex flex-col gap-3 pt-2 md:col-span-2 lg:col-span-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="material-icons text-slate-300 !text-sm">verified_user</span>
                    Requisitos
                  </label>
                  <div className="flex flex-wrap items-center gap-6">
                    <Checkbox
                      label="Cert. Trabajo"
                      checked={formData.reqCertificadoTrabajo}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          reqCertificadoTrabajo: e.target.checked,
                        }))
                      }
                    />
                    <Checkbox
                      label="Solicitar CV"
                      checked={formData.reqCv}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, reqCv: e.target.checked }))
                      }
                    />
                  </div>
                </div>

                {/* Scheduled Launch Moved Here */}
                <div className="md:col-span-2 lg:col-span-3 flex flex-col md:flex-row gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 mt-2">
                  <div className="flex-1">
                    <Checkbox
                      label="Programar Lanzamiento Automático (Fecha y Hora)"
                      checked={formData.programarLanzamiento}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, programarLanzamiento: e.target.checked }))
                      }
                    />
                    <p className="text-[10px] text-slate-500 mt-1 pl-7">
                      Si activas esto, la convocatoria se publicará automáticamente en la fecha y
                      hora seleccionada.
                    </p>
                  </div>
                  {formData.programarLanzamiento && (
                    <div className="flex-1 animate-fade-in-up">
                      <Input
                        type="datetime-local"
                        value={formData.fechaPublicacion}
                        onChange={handleChange}
                        name="fechaPublicacion"
                        required={formData.programarLanzamiento}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(formData.mensajeWhatsApp || "")}
                    className={`hover-lift flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                      isCopied
                        ? "bg-blue-500 text-white shadow-blue-500/20"
                        : "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:border-blue-400"
                    }`}
                  >
                    <span className="material-icons !text-lg">
                      {isCopied ? "done_all" : "content_copy"}
                    </span>
                    {isCopied ? "Copiado!" : "Copiar mensaje WhatsApp"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BLOQUE IA: CONTENIDO ENRIQUECIDO */}
          <div className="relative group z-20">
            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 to-purple-600 rounded-l-md shadow-sm"></div>
            <div className="pl-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-sm font-bold shadow-sm border border-purple-200 dark:border-purple-800">
                    3
                  </span>
                  Contenido & Actividades
                </h3>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-6">
                {/* Activity Extractor Input Only */}
                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30">
                  <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-2">
                    Material de Referencia / Programa (Para IA)
                  </label>
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={rawActivityText}
                      onChange={(e) => setRawActivityText(e.target.value)}
                      placeholder="Pega aquí el texto del convenio, programa o descripción cruda. La IA lo usará para generar la tarjeta."
                      rows={3}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-lg focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={runAIExtraction}
                      disabled={isGenerating || !rawActivityText.trim()}
                      className={`h-full px-4 rounded-lg transition-colors flex flex-col items-center justify-center gap-1 border ${
                        isGenerating
                          ? "bg-slate-100 text-slate-400 border-slate-200"
                          : "bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                      }`}
                      title="Generar contenido automáticamente"
                    >
                      <span
                        className={`material-icons !text-xl ${isGenerating ? "animate-spin" : ""}`}
                      >
                        {isGenerating ? "refresh" : "auto_awesome"}
                      </span>
                      <span className="text-[10px] font-bold">
                        {isGenerating ? "Cargando..." : "Generar"}
                      </span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    * Pega el texto y haz click en "Generar". La IA completará la Descripción y
                    Actividades. Luego usa "Previsualizar" para ver la tarjeta final.
                  </p>
                </div>

                <InputWrapper label="Descripción de la Propuesta" icon="description">
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleChange}
                    placeholder="Descripción detallada de la propuesta, objetivos y rol del practicante..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm"
                  />
                </InputWrapper>

                <div>
                  <div className="flex items-center justify-between mb-2 ml-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="material-icons text-slate-300 !text-sm">list_alt</span>
                      Contenido de la Lista
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Título:
                      </span>
                      <input
                        type="text"
                        name="actividadesLabel"
                        value={formData.actividadesLabel}
                        onChange={handleChange}
                        placeholder="Ej: Actividades, Espacios..."
                        className="px-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-purple-500 uppercase tracking-tight"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {actividades.map((act, idx) => (
                      <div key={idx} className="flex gap-2">
                        <div className="w-8 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-500">
                          {idx + 1}
                        </div>
                        <input
                          type="text"
                          value={act}
                          onChange={(e) => handleActivityChange(idx, e.target.value)}
                          placeholder={`Actividad ${idx + 1}`}
                          className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeActivity(idx)}
                          className="p-2 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded-lg transition-colors"
                        >
                          <span className="material-icons !text-lg">delete</span>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addActivity}
                      className="text-sm font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 mt-2 px-2"
                    >
                      <span className="material-icons !text-lg">add</span> Agregar Actividad
                    </button>
                  </div>
                </div>

                <InputWrapper label="Requisito Excluyente (Opcional)" icon="campaign">
                  <Input
                    name="requisitoObligatorio"
                    value={formData.requisitoObligatorio}
                    onChange={handleChange}
                    placeholder="Ej: Solo estudiantes con Psicoanálisis aprobado"
                  />
                </InputWrapper>
              </div>
            </div>
          </div>

          {/* BLOQUE 4: HORARIOS */}
          <div className="relative group z-20">
            <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-md shadow-sm"></div>
            <div className="pl-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 text-sm font-bold shadow-sm border border-emerald-200 dark:border-emerald-800">
                    4
                  </span>
                  Horarios
                </h3>
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                  <Checkbox
                    label="Horarios Fijos (Obligatorios)"
                    checked={formData.horariosFijos}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, horariosFijos: e.target.checked }))
                    }
                    labelClassName="text-xs font-bold text-emerald-700 dark:text-emerald-300"
                  />
                  <span
                    className="material-icons text-emerald-400 !text-sm group-hover:text-emerald-500 cursor-help"
                    title="Si se marca, el estudiante no podrá elegir uno de los horarios, sino que se asume que debe asistir a todos."
                  >
                    info
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                {schedules.map((schedule, idx) => (
                  <div key={idx} className="flex gap-2 mb-3 last:mb-0">
                    <Input
                      value={schedule}
                      onChange={(e) => handleScheduleChange(idx, e.target.value)}
                      placeholder="Ej: Lunes 9 a 12hs - Lic. Pérez"
                    />
                    <button
                      type="button"
                      onClick={() => removeSchedule(idx)}
                      className="p-2 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded-lg transition-colors"
                    >
                      <span className="material-icons !text-lg">delete</span>
                    </button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={addSchedule}
                  type="button"
                  className="mt-2 text-xs"
                >
                  + Agregar Horario
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-700 flex justify-end sticky bottom-6 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-4 rounded-xl">
            <Button
              variant="primary"
              type="submit"
              isLoading={createLaunchMutation.isPending}
              className="h-14 px-8 text-lg shadow-xl shadow-blue-500/20"
            >
              Lanzar Convocatoria
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={handleSmartPreview}
              className="h-14 px-8 text-lg ml-4"
            >
              Previsualizar
            </Button>
          </div>

          {/* PREVIEW MODAL - SIMPLIFIED VERSION */}
          {showPreviewModal && (
            <div
              className="fixed inset-0 z-[1500] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in"
              onClick={() => setShowPreviewModal(false)}
            >
              <div
                className="w-full max-w-5xl max-h-[95vh] overflow-hidden bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl relative flex flex-col border border-slate-200 dark:border-slate-800 animate-scale-in"
                onClick={(e) => e.stopPropagation()}
              >
                {/* HEADER SIMPLE */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <span className="material-icons !text-2xl">visibility</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">
                        Previsualización
                      </h3>
                      <p className="text-xs text-slate-500">
                        Vista previa de la tarjeta y mensaje de WhatsApp
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>

                {/* CONTENT - Vertical Stack: Card then WhatsApp */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10">
                  <div className="flex flex-col gap-12 max-w-4xl mx-auto">
                    {/* BLOQUE 1: TARJETA DE CONVOCATORIA */}
                    <div className="w-full">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-icons !text-xs text-blue-500">credit_card</span>
                        Vista de Estudiante (Tarjeta)
                      </h4>
                      <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-1 border border-slate-200 dark:border-slate-800 shadow-inner">
                        <ConvocatoriaCardPremium
                          id="preview"
                          nombre={formData.nombrePPS || "Sin Nombre"}
                          orientacion={formData.orientacion || "Sin Orientación"}
                          direccion={formData.direccion || "Sin Dirección"}
                          descripcion={formData.descripcion || "Sin descripción..."}
                          actividades={
                            actividades.length ? actividades : ["Actividad 1...", "Actividad 2..."]
                          }
                          actividadesLabel={formData.actividadesLabel}
                          horasAcreditadas={String(formData.horasAcreditadas || 0)}
                          horariosCursada={schedules.join("; ") || "A confirmar"}
                          cupo={String(formData.cuposDisponibles || 0)}
                          requisitoObligatorio={formData.requisitoObligatorio}
                          reqCv={formData.reqCv}
                          horariosFijos={formData.horariosFijos}
                          timeline={{
                            inscripcion:
                              formData.fechaInicioInscripcion && formData.fechaFinInscripcion
                                ? `${formatDate(formData.fechaInicioInscripcion)} - ${formatDate(formData.fechaFinInscripcion)}`
                                : "Abierta/A definir",
                            inicio: formData.fechaInicio
                              ? formatDate(formData.fechaInicio)
                              : "A confirmar",
                            fin: formData.fechaFin ? formatDate(formData.fechaFin) : "A confirmar",
                          }}
                          logoUrl={selectedInstitution?.[FIELD_LOGO_URL_INSTITUCIONES] as string}
                          invertLogo={
                            selectedInstitution?.[FIELD_LOGO_INVERT_DARK_INSTITUCIONES] as boolean
                          }
                          status="abierta"
                        />
                      </div>
                    </div>

                    {/* DIVIDER */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>

                    {/* BLOQUE 2: MENSAJE WHATSAPP */}
                    <div className="w-full flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                          <span className="material-icons !text-xs">chat</span>
                          Posteo de WhatsApp
                        </h4>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.mensajeWhatsApp || "")}
                          className={`hover-lift flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                            isCopied
                              ? "bg-emerald-500 text-white shadow-emerald-500/20"
                              : "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400"
                          }`}
                        >
                          <span className="material-icons !text-lg">
                            {isCopied ? "done_all" : "content_copy"}
                          </span>
                          {isCopied ? "Copiado!" : "Copiar para WhatsApp"}
                        </button>
                      </div>
                      <div className="bg-slate-900 rounded-[24px] overflow-hidden border border-slate-800 shadow-2xl">
                        <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight ml-2">
                            WhatsApp Preview
                          </span>
                        </div>
                        <textarea
                          value={formData.mensajeWhatsApp}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, mensajeWhatsApp: e.target.value }))
                          }
                          className="w-full h-full min-h-[300px] bg-transparent text-emerald-100/90 text-sm leading-relaxed font-mono p-6 focus:ring-0 focus:outline-none resize-none"
                          placeholder="El mensaje de WhatsApp se generará automáticamente..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* FOOTER SIMPLE */}
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center gap-4">
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="material-icons !text-sm">info</span>
                    {formData.programarLanzamiento
                      ? "Se agendará para la fecha seleccionada."
                      : "Se publicará inmediatamente."}
                  </p>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setShowPreviewModal(false)}
                      disabled={createLaunchMutation.isPending}
                      className="!rounded-xl"
                    >
                      Seguir Editando
                    </Button>

                    <Button
                      variant="primary"
                      isLoading={createLaunchMutation.isPending}
                      className={`h-12 px-8 shadow-xl !rounded-xl ${formData.programarLanzamiento ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"}`}
                      onClick={(e) => handleSubmit(e as any)}
                    >
                      <span className="material-icons mr-2 !text-lg">
                        {formData.programarLanzamiento ? "schedule_send" : "rocket_launch"}
                      </span>
                      {formData.programarLanzamiento ? "Programar" : "Lanzar Ahora"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* HISTORY TAB */}
      <div className={activeTab === "history" ? "block" : "hidden"}>
        <div className="mt-8 space-y-8">
          {scheduledHistory.length > 0 && (
            <div className="animate-fade-in">
              <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="material-icons !text-sm">schedule_send</span>
                Lanzamientos Programados
              </h3>
              <div className="space-y-4">{scheduledHistory.map(renderLaunchItem)}</div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="material-icons !text-sm">rocket_launch</span>
              Convocatorias Activas
            </h3>
            <div className="space-y-4">
              {visibleHistory.length === 0 ? (
                <EmptyState
                  icon="history_edu"
                  title="No hay convocatorias activas"
                  message="Crea un nuevo lanzamiento."
                />
              ) : (
                visibleHistory.map(renderLaunchItem)
              )}
            </div>
          </div>

          {hiddenHistory.length > 0 && (
            <CollapsibleSection
              title="Convocatorias Ocultas / Archivadas"
              defaultOpen={false}
              count={hiddenHistory.length}
              icon="visibility_off"
              iconBgColor="bg-slate-100 dark:bg-slate-800"
              iconColor="text-slate-500 dark:text-slate-400"
              borderColor="border-slate-200 dark:border-slate-700"
            >
              <div className="space-y-4 pt-4">{hiddenHistory.map(renderLaunchItem)}</div>
            </CollapsibleSection>
          )}
        </div>
      </div>

      {editingLaunch && (
        <RecordEditModal
          isOpen={!!editingLaunch}
          onClose={() => setEditingLaunch(null)}
          record={editingLaunch}
          tableConfig={LAUNCH_TABLE_CONFIG}
          onSave={(id, fields) => updateDetailsMutation.mutate({ id: id!, fields })}
          isSaving={updateDetailsMutation.isPending}
        />
      )}
    </Card>
  );
};

export default LanzadorConvocatorias;
