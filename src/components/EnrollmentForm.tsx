import React, { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES, FIELD_TRABAJA_ESTUDIANTES } from "../constants";
import { supabase } from "../lib/supabaseClient";
import { Estudiante } from "../types";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";
import { useTheme } from "../contexts/ThemeContext";
import { Icon, type IconName } from "./student/ds";
import "./student/home/atlas/atlasHome.css";

// --- COMPONENTES UI INTERNOS (dirección editorial .ed) ---

const SelectionCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  icon?: IconName;
}> = ({ selected, onClick, title, subtitle, icon }) => (
  <div
    onClick={onClick}
    className="relative cursor-pointer rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 transition-all duration-200 flex items-center gap-3 sm:gap-4 group select-none"
    style={{
      borderColor: selected ? "var(--accent)" : "var(--line)",
      background: selected ? "var(--tint)" : "var(--bg-elevated)",
      boxShadow: selected ? "inset 0 0 0 1px var(--accent)" : "none",
    }}
  >
    <div
      className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-200"
      style={{
        background: selected ? "var(--accent)" : "var(--bg-sunken)",
        color: selected ? "var(--on-accent)" : "var(--ink-muted)",
      }}
    >
      <Icon name={selected ? "check" : icon || "chev"} size={20} strokeWidth={2.2} />
    </div>

    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <h4
        className="text-sm font-bold leading-tight"
        style={{ color: selected ? "var(--accent-text)" : "var(--ink)" }}
      >
        {title}
      </h4>
      {subtitle && (
        <p
          className="hidden sm:block text-xs truncate font-medium mt-0.5"
          style={{ color: selected ? "var(--accent-text)" : "var(--ink-muted)" }}
        >
          {subtitle}
        </p>
      )}
    </div>

    {selected && (
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 animate-scale-in">
        <Icon name="check" size={16} color="var(--accent)" strokeWidth={2.6} />
      </div>
    )}
  </div>
);

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <div
    onClick={() => onChange(!checked)}
    className="flex items-center justify-between cursor-pointer p-4 rounded-2xl border transition-all duration-200"
    style={{
      borderColor: checked ? "var(--accent)" : "var(--line)",
      background: checked ? "var(--tint)" : "var(--bg-elevated)",
    }}
  >
    <span
      className="text-sm font-bold transition-colors"
      style={{ color: checked ? "var(--accent-text)" : "var(--ink-soft)" }}
    >
      {label}
    </span>
    <div
      className="relative w-12 h-7 rounded-full transition-colors duration-300 ease-in-out border-2"
      style={{
        background: checked ? "var(--accent)" : "var(--bg-sunken)",
        borderColor: checked ? "var(--accent)" : "var(--line-strong)",
      }}
    >
      <div
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ background: "#fff", transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </div>
  </div>
);

const FileUploadButton: React.FC<{
  onClick: () => void;
  fileName?: string | null;
  label: string;
  hasError?: boolean;
}> = ({ onClick, fileName, label, hasError }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative cursor-pointer border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition-all duration-200 w-full"
    style={{
      borderColor: hasError ? "#c0563f" : "var(--line-strong)",
      background: hasError ? "rgba(192,86,63,0.08)" : "var(--bg-sunken)",
    }}
  >
    <div
      className="w-10 h-10 rounded-full shadow-sm flex items-center justify-center mb-2 transition-transform duration-200 group-hover:-translate-y-1"
      style={{
        background: "var(--bg-elevated)",
        color: hasError ? "#c0563f" : "var(--accent)",
      }}
    >
      <Icon name={hasError ? "x" : fileName ? "file" : "upload"} size={18} strokeWidth={2} />
    </div>
    <span
      className="text-xs font-bold text-center"
      style={{ color: hasError ? "#c0563f" : "var(--ink-soft)" }}
    >
      {fileName ? "Archivo seleccionado" : label}
    </span>
    <span
      className="text-[10px] mt-1 text-center max-w-[200px] truncate pointer-events-none"
      style={{ color: "var(--ink-subtle)" }}
    >
      {fileName || "PDF o Imagen (JPG, PNG) - Máx 5MB"}
    </span>
  </button>
);

// Encabezado de sección editorial (eyebrow en acento + ícono fino)
const SectionHead: React.FC<{ icon: IconName; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <h3
    className="eyebrow mb-4 flex items-center gap-2"
    style={{ color: "var(--accent-text)", fontSize: 11 }}
  >
    <Icon name={icon} size={14} strokeWidth={2} />
    {children}
  </h3>
);

interface EnrollmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => void;
  convocatoriaName: string;
  isSubmitting: boolean;
  horariosDisponibles?: string[];
  permiteCertificado?: boolean;
  studentProfile: Estudiante | null;
  reqCertificadoTrabajo?: boolean;
  reqCv?: boolean;
  horariosFijos?: boolean;
}

type FormData = {
  terminoDeCursar: boolean | null;
  cursandoElectivas: boolean | null;
  finalesAdeudados: string;
  otraSituacionAcademica: string;
  horarios: string[];
  certificadoLink?: string;
  trabaja: boolean;
  certificadoTrabajoFile?: File | null;
  existingCertificadoTrabajo?: string | null;
  cvFile?: File | null;
};

const initialFormData: FormData = {
  terminoDeCursar: null,
  cursandoElectivas: null,
  finalesAdeudados: "",
  otraSituacionAcademica: "",
  horarios: [],
  certificadoLink: "",
  trabaja: false,
  certificadoTrabajoFile: null,
  existingCertificadoTrabajo: null,
  cvFile: null,
};

export const EnrollmentForm: React.FC<EnrollmentFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  convocatoriaName,
  isSubmitting,
  horariosDisponibles = [],
  permiteCertificado = false,
  studentProfile,
  reqCertificadoTrabajo = true,
  reqCv = false,
  horariosFijos = false,
}) => {
  const { resolvedTheme } = useTheme();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | "submit", string>>>({});
  const [fileUploadProgress, setFileUploadProgress] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const cvFileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = (inputRef: React.MutableRefObject<HTMLInputElement | null>) => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  };

  const isSingleSchedule = horariosDisponibles.length === 1;
  const showHorariosSelection = horariosDisponibles.length > 1 && !horariosFijos;

  useEffect(() => {
    if (isOpen) {
      const initialHorarios = horariosFijos
        ? [...horariosDisponibles]
        : isSingleSchedule
          ? [horariosDisponibles[0]]
          : [];
      const works = studentProfile?.[FIELD_TRABAJA_ESTUDIANTES] || false;
      const cert = studentProfile?.[FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES] || null;

      setFormData({
        ...initialFormData,
        horarios: initialHorarios,
        trabaja: works,
        existingCertificadoTrabajo: cert,
      });
      setErrors({});
      setFileUploadProgress(0);
    }
  }, [isOpen, horariosDisponibles, isSingleSchedule, studentProfile, horariosFijos]);

  const finalSchema = useMemo(() => {
    return z
      .object({
        terminoDeCursar: z.boolean().nullable(),
        cursandoElectivas: z.boolean().nullable(),
        finalesAdeudados: z.string(),
        otraSituacionAcademica: z.string(),
        horarios: z.array(z.string()),
        certificadoLink: z.string().optional(),
        trabaja: z.boolean(),
        certificadoTrabajoFile: z.any().optional(),
        existingCertificadoTrabajo: z.string().nullable().optional(),
        cvFile: z.any().optional(),
      })
      .superRefine((data, ctx) => {
        if (data.terminoDeCursar === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["terminoDeCursar"],
            message: "Selecciona tu situación académica.",
          });
        } else if (data.terminoDeCursar === true) {
          if (data.finalesAdeudados === "") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["finalesAdeudados"],
              message: "Indica los finales adeudados.",
            });
          }
        } else if (data.terminoDeCursar === false) {
          if (data.cursandoElectivas === null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["cursandoElectivas"],
              message: "Indica si cursas electivas.",
            });
          }
        }

        if (showHorariosSelection && data.horarios.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["horarios"],
            message: "Selecciona al menos un horario.",
          });
        }

        if (data.trabaja && reqCertificadoTrabajo) {
          if (!data.certificadoTrabajoFile && !data.existingCertificadoTrabajo) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["trabaja"],
              message: "Es obligatorio adjuntar el certificado laboral.",
            });
          }
        }

        if (reqCv && !data.cvFile) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cvFile"],
            message: "El CV es obligatorio.",
          });
        }
      });
  }, [showHorariosSelection, reqCertificadoTrabajo, reqCv]);

  const handleHorarioToggle = (horario: string) => {
    setFormData((prev) => {
      const exists = prev.horarios.includes(horario);
      return {
        ...prev,
        horarios: exists ? prev.horarios.filter((h) => h !== horario) : [...prev.horarios, horario],
      };
    });
  };

  const handleWorkStatusChange = (checked: boolean) => {
    // Si el usuario intenta destildar "trabaja" y ya tiene un certificado guardado
    if (!checked && formData.existingCertificadoTrabajo) {
      const confirmDelete = window.confirm(
        "⚠️ ¿Estás seguro de indicar que NO trabajas?\n\nAl hacerlo, se eliminará el certificado laboral que tenías guardado. Esta acción no se puede deshacer."
      );

      if (confirmDelete) {
        setFormData((prev) => ({
          ...prev,
          trabaja: false,
          existingCertificadoTrabajo: null,
          certificadoTrabajoFile: null,
        }));
      }
    } else {
      // Comportamiento normal
      setFormData((prev) => ({ ...prev, trabaja: checked }));
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: "certificadoTrabajoFile" | "cvFile"
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Aumentamos a 15MB considerando fotos de alta resolución
      if (file.size > 15 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, submit: "El archivo supera los 15MB permitidos." }));
        return;
      }
      setFormData((prev) => ({ ...prev, [fieldName]: file }));

      if (fieldName === "certificadoTrabajoFile")
        setErrors((prev) => ({ ...prev, trabaja: undefined }));
      if (fieldName === "cvFile") setErrors((prev) => ({ ...prev, cvFile: undefined }));
    }
  };

  // Helper to upload files to Supabase
  const uploadFile = async (file: File, folder: string): Promise<string> => {
    if (!studentProfile?.id)
      throw new Error("No hay un perfil de estudiante válido (ID faltando).");

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
    const fileName = `${studentProfile.id}/${folder}_${Date.now()}.${fileExt}`;

    logger.info(`[Upload] Iniciando subida de ${file.name} (${file.type}) a ${folder}...`);

    const { error: uploadError } = await supabase.storage
      .from("documentos_estudiantes")
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type, // Forzamos el content type para que Supabase lo maneje correctamente
      });

    if (uploadError) {
      logger.error("[Upload] Error en Supabase:", uploadError);
      throw new Error(`Error de subida: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from("documentos_estudiantes").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = finalSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const newErrors: Partial<Record<keyof FormData, string>> = {};
      for (const key in fieldErrors) {
        newErrors[key as keyof FormData] = (fieldErrors as Record<string, string[] | undefined>)[
          key
        ]?.[0];
      }
      setErrors(newErrors);

      const firstError = document.querySelector('[data-error="true"]');
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    try {
      let certificadoUrl: string | null = formData.trabaja
        ? (formData.existingCertificadoTrabajo ?? null)
        : null;
      let cvUrl: string | null = null;

      if ((formData.trabaja && formData.certificadoTrabajoFile) || formData.cvFile) {
        setFileUploadProgress(10);
        const interval = setInterval(() => setFileUploadProgress((p) => Math.min(p + 20, 90)), 300);

        if (formData.trabaja && formData.certificadoTrabajoFile) {
          certificadoUrl = await uploadFile(formData.certificadoTrabajoFile, "certificado_trabajo");
        }
        if (formData.cvFile) {
          cvUrl = await uploadFile(formData.cvFile, "cv");
        }

        clearInterval(interval);
        setFileUploadProgress(100);
      }

      await onSubmit({ ...result.data, certificadoTrabajoUrl: certificadoUrl, cvUrl: cvUrl });
    } catch (error) {
      setErrors({ submit: getErrorMessage(error, "Error al enviar.") });
    }
  };

  if (!isOpen) return null;

  const inputBase: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--line-strong)",
    color: "var(--ink)",
  };

  return (
    <div
      className="ed fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
      data-mode={resolvedTheme}
      data-accent="teal"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Ventana flotante: 95vw mobile · max-w-2xl desktop */}
      <div
        className="relative w-[95vw] max-h-[90dvh] sm:w-full sm:max-w-4xl sm:max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 animate-scale-in"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-5 py-4 sm:px-7 sm:py-5 z-10 flex items-center justify-between safe-area-top"
          style={{ borderBottom: "1px solid var(--line)", background: "var(--bg-elevated)" }}
        >
          <div className="min-w-0 pr-4">
            <span className="eyebrow" style={{ color: "var(--accent-text)" }}>
              Inscripción
            </span>
            <h2
              className="truncate"
              style={{
                fontSize: 27,
                marginTop: 4,
                color: "var(--ink)",
                fontFamily: '"Instrument Serif", ui-serif, Georgia, serif',
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
              }}
            >
              {convocatoriaName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 rounded-full transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: "var(--ink-muted)" }}
            aria-label="Cerrar"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Banner Horario Único o Fijo */}
        {(isSingleSchedule || (horariosFijos && horariosDisponibles.length > 0)) && (
          <div
            className="px-5 sm:px-7 py-3 flex items-center gap-3"
            style={{ background: "var(--tint)", borderBottom: "1px solid var(--line)" }}
          >
            <Icon name="clock" size={18} color="var(--accent-text)" />
            <div>
              <p className="eyebrow" style={{ color: "var(--accent-text)", fontSize: 10 }}>
                {horariosFijos ? "Horarios (Obligatorios)" : "Horario de la Práctica"}
              </p>
              <p className="text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>
                {horariosFijos ? horariosDisponibles.join("; ") : horariosDisponibles[0]}
              </p>
            </div>
          </div>
        )}

        {/* Body Scrollable */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-7 sm:space-y-8 custom-scrollbar pb-safe"
        >
          {errors.submit && (
            <div
              className="p-4 rounded-xl text-sm font-semibold flex items-start gap-2"
              style={{
                background: "rgba(192,86,63,0.10)",
                border: "1px solid rgba(192,86,63,0.35)",
                color: "#c0563f",
              }}
            >
              <Icon name="x" size={18} />
              <span>{errors.submit}</span>
            </div>
          )}

          {/* Disclaimer — compromiso */}
          <div
            className="flex gap-4 p-4 sm:p-5 rounded-2xl"
            style={{
              background: "color-mix(in oklab, var(--area-laboral) 9%, var(--bg-elevated))",
              border: "1px solid color-mix(in oklab, var(--area-laboral) 26%, transparent)",
            }}
          >
            <span style={{ color: "var(--area-laboral)", flexShrink: 0, marginTop: 2 }}>
              <Icon name="shield" size={22} />
            </span>
            <div>
              <h4 className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                Compromiso y Responsabilidad
              </h4>
              <p
                className="text-xs mt-1 leading-relaxed font-medium block sm:hidden"
                style={{ color: "var(--ink-muted)" }}
              >
                Al inscribirte asumes un compromiso. La falta de responsabilidad afectará futuras
                convocatorias.
              </p>
              <p
                className="text-xs mt-1 leading-relaxed font-medium hidden sm:block"
                style={{ color: "var(--ink-muted)" }}
              >
                Al inscribirte, asumes un compromiso con la institución y la facultad. Darse de baja
                sobre la fecha, ausentarse sin aviso o cualquier otra decisión que demuestre falta
                de responsabilidad, será tenido en cuenta en futuras convocatorias.
              </p>
            </div>
          </div>

          {/* En escritorio, dos columnas; en mobile se apila en este mismo orden. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-8 items-start">
            {/* ── Columna izquierda ── */}
            <div className="space-y-7">
              {/* Situación Laboral */}
              {reqCertificadoTrabajo && (
                <section>
                  <SectionHead icon="bag">Situación Laboral</SectionHead>

                  <div className="space-y-4">
                    <ToggleSwitch
                      label="¿Trabajas actualmente?"
                      checked={formData.trabaja}
                      onChange={handleWorkStatusChange}
                    />

                    {/* Revelado suave */}
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                        formData.trabaja
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden min-h-0">
                        <div
                          className="p-4 rounded-2xl"
                          style={{
                            background: "var(--bg-sunken)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <label
                            className="label mb-3 block"
                            style={{ color: "var(--ink-muted)", fontSize: 10 }}
                          >
                            Certificado Laboral (Obligatorio)
                          </label>

                          {formData.existingCertificadoTrabajo &&
                            !formData.certificadoTrabajoFile && (
                              <div
                                className="flex items-center justify-between px-4 py-3 rounded-xl mb-3"
                                style={{
                                  background: "var(--tint)",
                                  border: "1px solid var(--accent-soft)",
                                }}
                              >
                                <div
                                  className="flex items-center gap-2 text-xs font-bold"
                                  style={{ color: "var(--accent-text)" }}
                                >
                                  <Icon name="check" size={16} strokeWidth={2.4} />
                                  <span>Certificado Vigente</span>
                                </div>
                                <a
                                  href={formData.existingCertificadoTrabajo}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-bold hover:underline"
                                  style={{ color: "var(--accent-text)" }}
                                >
                                  Ver archivo
                                </a>
                              </div>
                            )}

                          <input
                            id="cert-file-upload"
                            type="file"
                            ref={certFileInputRef}
                            className="sr-only"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                            onChange={(e) => handleFileChange(e, "certificadoTrabajoFile")}
                          />

                          <FileUploadButton
                            onClick={() => openFilePicker(certFileInputRef)}
                            label={
                              formData.certificadoTrabajoFile
                                ? "Cambiar Archivo"
                                : formData.existingCertificadoTrabajo
                                  ? "Actualizar Certificado"
                                  : "Subir Certificado"
                            }
                            fileName={formData.certificadoTrabajoFile?.name}
                            hasError={!!errors.trabaja}
                          />
                          {errors.trabaja && (
                            <p
                              className="text-xs font-semibold mt-2 flex items-center gap-1"
                              style={{ color: "#c0563f" }}
                            >
                              <Icon name="x" size={12} /> {errors.trabaja}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Selección Horarios */}
              {showHorariosSelection && (
                <section data-error={!!errors.horarios}>
                  <SectionHead icon="clock">Disponibilidad Horaria</SectionHead>
                  <div className="grid grid-cols-1 gap-3">
                    {horariosDisponibles.map((horario) => {
                      const active = formData.horarios.includes(horario);
                      return (
                        <div
                          key={horario}
                          onClick={() => handleHorarioToggle(horario)}
                          className="cursor-pointer px-5 py-4 rounded-2xl border transition-all flex items-center justify-between group select-none"
                          style={{
                            borderColor: active ? "var(--accent)" : "var(--line)",
                            background: active ? "var(--tint)" : "var(--bg-elevated)",
                            boxShadow: active ? "inset 0 0 0 1px var(--accent)" : "none",
                          }}
                        >
                          <span
                            className="text-sm font-bold"
                            style={{ color: active ? "var(--accent-text)" : "var(--ink-soft)" }}
                          >
                            {horario}
                          </span>
                          {active && (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center animate-scale-in"
                              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                            >
                              <Icon name="check" size={14} strokeWidth={2.6} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {errors.horarios && (
                    <p className="text-xs font-semibold mt-2 ml-1" style={{ color: "#c0563f" }}>
                      {errors.horarios}
                    </p>
                  )}
                </section>
              )}
            </div>
            {/* ── Columna derecha ── */}
            <div className="space-y-7">
              {/* Situación Académica */}
              <section>
                <SectionHead icon="book">Estado Académico</SectionHead>

                <div className="space-y-6">
                  <div data-error={!!errors.terminoDeCursar}>
                    <label
                      className="block text-sm font-bold mb-3"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      ¿Terminaste de cursar?
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectionCard
                        title="Sí"
                        subtitle="Solo debo finales o TIF"
                        icon="book"
                        selected={formData.terminoDeCursar === true}
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            terminoDeCursar: true,
                            cursandoElectivas: null,
                          }))
                        }
                      />
                      <SelectionCard
                        title="No"
                        subtitle="Aún curso materias"
                        icon="book"
                        selected={formData.terminoDeCursar === false}
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            terminoDeCursar: false,
                            finalesAdeudados: "",
                          }))
                        }
                      />
                    </div>
                    {errors.terminoDeCursar && (
                      <p className="text-xs font-semibold mt-2 ml-1" style={{ color: "#c0563f" }}>
                        {errors.terminoDeCursar}
                      </p>
                    )}
                  </div>

                  {formData.terminoDeCursar === true && (
                    <div className="animate-fade-in" data-error={!!errors.finalesAdeudados}>
                      <label
                        className="block text-sm font-bold mb-3"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        Finales Adeudados
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          "Solo TIF/PPS",
                          "1 Final",
                          "2 Finales",
                          "3 Finales",
                          "4 Finales",
                          "5+",
                        ].map((opt) => {
                          const active = formData.finalesAdeudados === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => setFormData((p) => ({ ...p, finalesAdeudados: opt }))}
                              className="cursor-pointer px-3 py-3 rounded-xl border text-xs font-bold text-center transition-all duration-200 select-none"
                              style={{
                                borderColor: active ? "var(--accent)" : "var(--line)",
                                background: active ? "var(--tint)" : "var(--bg-elevated)",
                                color: active ? "var(--accent-text)" : "var(--ink-muted)",
                                boxShadow: active ? "inset 0 0 0 1px var(--accent)" : "none",
                              }}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                      {errors.finalesAdeudados && (
                        <p className="text-xs font-semibold mt-2 ml-1" style={{ color: "#c0563f" }}>
                          {errors.finalesAdeudados}
                        </p>
                      )}
                    </div>
                  )}

                  {formData.terminoDeCursar === false && (
                    <div className="animate-fade-in" data-error={!!errors.cursandoElectivas}>
                      <label
                        className="block text-sm font-bold mb-3"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        ¿Cursas Electivas?
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <SelectionCard
                          title="Sí"
                          selected={formData.cursandoElectivas === true}
                          onClick={() => setFormData((p) => ({ ...p, cursandoElectivas: true }))}
                        />
                        <SelectionCard
                          title="No"
                          selected={formData.cursandoElectivas === false}
                          onClick={() => setFormData((p) => ({ ...p, cursandoElectivas: false }))}
                        />
                      </div>
                      {errors.cursandoElectivas && (
                        <p className="text-xs font-semibold mt-2 ml-1" style={{ color: "#c0563f" }}>
                          {errors.cursandoElectivas}
                        </p>
                      )}
                    </div>
                  )}

                  <div data-error={!!errors.otraSituacionAcademica}>
                    <label
                      className="block text-sm font-bold mb-2"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      Comentarios (Opcional)
                    </label>
                    <textarea
                      value={formData.otraSituacionAcademica}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, otraSituacionAcademica: e.target.value }))
                      }
                      className="w-full p-4 rounded-2xl text-sm outline-none resize-none transition-all placeholder:text-[var(--ink-subtle)] focus:border-[var(--accent)]"
                      style={inputBase}
                      placeholder="Ej: Estoy cursando el TIF..."
                      rows={2}
                    />
                    {errors.otraSituacionAcademica && (
                      <p className="text-xs font-semibold mt-2 ml-1" style={{ color: "#c0563f" }}>
                        {errors.otraSituacionAcademica}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {reqCv && (
                <section data-error={!!errors.cvFile}>
                  <SectionHead icon="file">Curriculum Vitae</SectionHead>

                  <input
                    id="cv-file-upload"
                    type="file"
                    ref={cvFileInputRef}
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx"
                    onChange={(e) => handleFileChange(e, "cvFile")}
                  />
                  <FileUploadButton
                    onClick={() => openFilePicker(cvFileInputRef)}
                    label={formData.cvFile ? "CV Seleccionado" : "Adjuntar CV (PDF, Imagen o Word)"}
                    fileName={formData.cvFile?.name}
                    hasError={!!errors.cvFile}
                  />
                  {errors.cvFile && (
                    <p
                      className="text-xs font-semibold mt-2 flex items-center gap-1"
                      style={{ color: "#c0563f" }}
                    >
                      <Icon name="x" size={12} /> {errors.cvFile}
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>

          <div className="h-6 sm:h-0"></div>
        </form>

        {/* Footer */}
        <div
          className="flex-shrink-0 p-4 sm:p-6 flex flex-col sm:flex-row gap-3 relative z-20 safe-area-bottom"
          style={{ background: "var(--bg-elevated)", borderTop: "1px solid var(--line)" }}
        >
          {fileUploadProgress > 0 && fileUploadProgress < 100 && (
            <div
              className="absolute top-0 left-0 w-full h-1"
              style={{ background: "var(--bg-sunken)" }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${fileUploadProgress}%`, background: "var(--accent)" }}
              ></div>
            </div>
          )}

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:flex-1 py-3.5 rounded-xl font-bold text-sm transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: "var(--ink-soft)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (formRef.current) formRef.current.requestSubmit();
            }}
            disabled={isSubmitting}
            className="w-full sm:flex-[2] py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:translate-y-0 text-sm"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {isSubmitting ? (
              <>
                <div
                  className="w-5 h-5 rounded-full animate-spin"
                  style={{
                    border: "2px solid color-mix(in oklab, var(--on-accent) 30%, transparent)",
                    borderTopColor: "var(--on-accent)",
                  }}
                />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <span>Confirmar Inscripción</span>
                <Icon name="arrow" size={18} strokeWidth={2.4} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
