import React, { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES, FIELD_TRABAJA_ESTUDIANTES } from "../constants";
import { supabase } from "../lib/supabaseClient";
import { Estudiante } from "../types";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";
import { useTheme } from "../contexts/ThemeContext";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog";
import { Icon, type IconName } from "./student/ds";
import ConfirmModal from "./ConfirmModal";
import "./student/home/atlas/atlasHome.css";

// --- COMPONENTES UI INTERNOS (dirección editorial .ed) ---

const SelectionCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  icon?: IconName;
  hideIcon?: boolean;
}> = ({ selected, onClick, title, subtitle, icon, hideIcon }) => (
  <div
    onClick={onClick}
    role="button"
    tabIndex={0}
    aria-pressed={selected}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
    className="relative cursor-pointer rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 transition duration-200 flex items-center gap-3 sm:gap-4 group select-none focus:outline-none focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2"
    style={{
      borderColor: selected ? "var(--accent)" : "var(--line)",
      background: "var(--bg-elevated)",
      boxShadow: selected ? "inset 0 0 0 1px var(--accent)" : "none",
    }}
  >
    {!hideIcon && (
      <div
        className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition duration-200"
        style={{
          background: selected ? "var(--accent)" : "var(--bg-sunken)",
          color: selected ? "var(--on-accent)" : "var(--ink-muted)",
        }}
      >
        <Icon name={selected ? "check" : icon || "chev"} size={20} strokeWidth={2.2} />
      </div>
    )}

    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <h4
        className="text-sm font-bold leading-tight"
        style={{ color: selected ? "var(--accent-text)" : "var(--ink)" }}
      >
        {title}
      </h4>
      {subtitle && (
        <p
          className="hidden sm:block text-xs font-medium mt-0.5 leading-snug"
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

const FileUploadButton: React.FC<{
  onClick: () => void;
  fileName?: string | null;
  label: string;
  hasError?: boolean;
}> = ({ onClick, fileName, label, hasError }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative cursor-pointer border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition duration-200 w-full"
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
  /** Color de acento de la convocatoria (hex). Si no se pasa, queda el verde por defecto. */
  accentColor?: string;
  creditedHours?: number;
  orientation?: string;
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
  accentColor,
  creditedHours = 0,
  orientation = "",
}) => {
  const { resolvedTheme } = useTheme();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | "submit", string>>>({});
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [pendingWorkOff, setPendingWorkOff] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const cvFileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    isOpen,
    onClose,
    canClose: !isSubmitting && !pendingWorkOff,
  });

  const openFilePicker = (inputRef: React.MutableRefObject<HTMLInputElement | null>) => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  };

  const isSingleSchedule = horariosDisponibles.length === 1;
  const showHorariosSelection = horariosDisponibles.length > 1 && !horariosFijos;
  // La columna izquierda (situación laboral + horarios) solo tiene sentido si
  // hay algo que mostrar; si no, el formulario colapsa a una sola columna.
  const hasLeftColumn = reqCertificadoTrabajo || showHorariosSelection;

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
    // Si el usuario intenta destildar "trabaja" y ya tiene un certificado guardado,
    // confirmamos con el modal propio (en vez del window.confirm nativo).
    if (!checked && formData.existingCertificadoTrabajo) {
      setPendingWorkOff(true);
      return;
    }
    setFormData((prev) => ({ ...prev, trabaja: checked }));
  };

  const confirmWorkOff = () => {
    setFormData((prev) => ({
      ...prev,
      trabaja: false,
      existingCertificadoTrabajo: null,
      certificadoTrabajoFile: null,
    }));
    setPendingWorkOff(false);
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
      window.requestAnimationFrame(() => {
        const firstError = formRef.current?.querySelector<HTMLElement>('[data-error="true"]');
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError
          ?.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]")
          ?.focus({ preventScroll: true });
      });
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

  const requestClose = () => {
    if (!isSubmitting && !pendingWorkOff) onClose();
  };

  const inputBase: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--line-strong)",
    color: "var(--ink)",
  };

  // Sobreescribimos las variables de acento del scope .ed con el color de la
  // convocatoria. --tint y --tint-strong se recalculan solos porque referencian
  // var(--accent). --accent-text se deriva mezclando con --ink para mantener
  // contraste legible tanto en claro como en oscuro.
  const accentVars = accentColor
    ? ({
        "--accent": accentColor,
        "--accent-soft": `color-mix(in oklab, ${accentColor} 32%, var(--bg))`,
        "--accent-deep": `color-mix(in oklab, ${accentColor} 78%, black)`,
        "--accent-text": `color-mix(in oklab, ${accentColor} 72%, var(--ink))`,
        "--on-accent": "#ffffff",
      } as React.CSSProperties)
    : undefined;

  return (
    <>
      <div
        className="ed enroll-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
        data-mode={resolvedTheme}
        data-accent="teal"
        style={accentVars}
        onClick={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        {/* Ventana flotante: 95vw mobile · max-w-2xl desktop */}
        <div
          ref={dialogRef}
          className="enroll-dialog relative w-[95vw] max-h-[90dvh] sm:w-full sm:max-w-4xl sm:max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)" }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="enrollment-dialog-title"
          aria-describedby="enrollment-dialog-description"
          aria-busy={isSubmitting}
          tabIndex={-1}
        >
          {/* Header */}
          <div
            className="enroll-head flex-shrink-0 z-10 flex items-center justify-between safe-area-top"
            style={{ borderBottom: "1px solid var(--line)", background: "var(--bg-elevated)" }}
          >
            <div className="min-w-0 pr-4">
              <span
                className="eyebrow inline-flex items-center gap-1.5"
                style={{ color: "var(--accent-text)" }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                />
                Inscripción
              </span>
              <h2
                id="enrollment-dialog-title"
                className="enroll-title truncate"
                style={{
                  marginTop: 4,
                  color: "var(--ink)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: 0,
                }}
              >
                {convocatoriaName}
              </h2>
              <p id="enrollment-dialog-description" className="enroll-head__description">
                Revisá tu situación y disponibilidad antes de confirmar.
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className="p-2 -mr-1 rounded-full transition-colors hover:bg-[var(--bg-sunken)]"
              style={{ color: "var(--ink-muted)" }}
              aria-label="Cerrar"
              data-dialog-autofocus
            >
              <Icon name="x" size={20} />
            </button>
          </div>

          <div className="enroll-meta" aria-label="Resumen de la convocatoria">
            {creditedHours > 0 ? (
              <span>
                <Icon name="clock" size={14} strokeWidth={2.1} />
                {creditedHours} horas acreditables
              </span>
            ) : null}
            {orientation ? (
              <span>
                <Icon name="book" size={14} strokeWidth={2.1} />
                {orientation}
              </span>
            ) : null}
            <span>
              <Icon name="check" size={14} strokeWidth={2.1} />
              {formData.horarios.length > 0
                ? `${formData.horarios.length} ${formData.horarios.length === 1 ? "horario elegido" : "horarios elegidos"}`
                : "Horario pendiente"}
            </span>
          </div>

          {/* Banner Horario Único o Fijo */}
          {(isSingleSchedule || (horariosFijos && horariosDisponibles.length > 0)) && (
            <div
              className="enroll-schedule flex items-start gap-3"
              style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--line)" }}
            >
              <span className="enroll-schedule__icon">
                <Icon name="clock" size={16} color="var(--accent-text)" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="eyebrow" style={{ color: "var(--accent-text)", fontSize: 10 }}>
                  {horariosFijos ? "Horarios (Obligatorios)" : "Horario de la Práctica"}
                </p>
                <p className="enroll-schedule__text" style={{ color: "var(--ink)" }}>
                  {horariosFijos ? horariosDisponibles.join("; ") : horariosDisponibles[0]}
                </p>
              </div>
            </div>
          )}

          {/* Body Scrollable */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="enroll-body flex-1 overflow-y-auto custom-scrollbar pb-safe"
          >
            {errors.submit && (
              <div
                role="alert"
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
              className="enroll-commit flex gap-3 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid color-mix(in oklab, var(--accent) 24%, var(--line))",
              }}
            >
              <span className="enroll-commit__icon" style={{ color: "var(--accent-text)" }}>
                <Icon name="shield" size={18} strokeWidth={2.1} />
              </span>
              <div>
                <h4 className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                  Compromiso responsable
                </h4>
                <p
                  className="text-xs mt-1 leading-relaxed font-medium block sm:hidden"
                  style={{ color: "var(--ink-muted)" }}
                >
                  Confirmá tu disponibilidad antes de inscribirte. Las bajas sin aviso afectan
                  futuras convocatorias.
                </p>
                <p
                  className="text-xs mt-1 leading-relaxed font-medium hidden sm:block"
                  style={{ color: "var(--ink-muted)" }}
                >
                  Al inscribirte, asumís un compromiso con la institución y la facultad. Darse de
                  baja sobre la fecha, ausentarse sin aviso o cualquier otra decisión que demuestre
                  falta de responsabilidad, será tenido en cuenta en futuras convocatorias.
                </p>
              </div>
            </div>

            {/* En escritorio, dos columnas; en mobile se apila en este mismo orden. */}
            <div
              className={
                hasLeftColumn ? "grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-8 items-start" : ""
              }
            >
              {/* ── Columna izquierda (solo si hay contenido) ── */}
              {hasLeftColumn && (
                <div className="space-y-7">
                  {/* Situación Laboral */}
                  {reqCertificadoTrabajo && (
                    <section>
                      <SectionHead icon="bag">Situación Laboral</SectionHead>

                      <div className="enroll-workpanel space-y-4">
                        <div>
                          <label
                            className="block text-sm font-bold mb-3"
                            style={{ color: "var(--ink-soft)" }}
                          >
                            ¿Trabajás actualmente?
                          </label>
                          <div
                            className="enroll-workseg"
                            role="group"
                            aria-label="Situación laboral"
                          >
                            {[
                              { value: true, title: "Sí" },
                              { value: false, title: "No" },
                            ].map((option) => {
                              const active = formData.trabaja === option.value;
                              return (
                                <button
                                  key={String(option.value)}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => handleWorkStatusChange(option.value)}
                                  className="enroll-workseg__btn"
                                  style={{
                                    background: active ? "var(--accent)" : "transparent",
                                    color: active ? "var(--on-accent)" : "var(--ink-soft)",
                                  }}
                                >
                                  {option.title}
                                </button>
                              );
                            })}
                          </div>
                          <div className="enroll-workgrid">
                            {[
                              {
                                value: true,
                                title: "Sí, trabajo",
                                subtitle: "Adjunto certificado",
                              },
                              {
                                value: false,
                                title: "No trabajo",
                                subtitle: "No requiere archivo",
                              },
                            ].map((option) => {
                              const active = formData.trabaja === option.value;
                              return (
                                <button
                                  key={String(option.value)}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => handleWorkStatusChange(option.value)}
                                  className="enroll-workbtn"
                                  style={{
                                    borderColor: active ? "var(--accent)" : "var(--line)",
                                    background: active
                                      ? "color-mix(in oklab, var(--accent) 9%, var(--bg-elevated))"
                                      : "var(--bg-elevated)",
                                    boxShadow: active ? "inset 0 0 0 1px var(--accent)" : "none",
                                  }}
                                >
                                  <span
                                    className="enroll-workbtn__check"
                                    style={{
                                      background: active ? "var(--accent)" : "var(--bg-sunken)",
                                      color: active ? "var(--on-accent)" : "var(--ink-subtle)",
                                      borderColor: active ? "var(--accent)" : "var(--line-strong)",
                                    }}
                                  >
                                    <Icon
                                      name={active ? "check" : "chev"}
                                      size={14}
                                      strokeWidth={2.4}
                                    />
                                  </span>
                                  <span className="min-w-0 text-left">
                                    <span
                                      className="block text-sm font-bold leading-tight"
                                      style={{
                                        color: active ? "var(--accent-text)" : "var(--ink)",
                                      }}
                                    >
                                      {option.title}
                                    </span>
                                    <span
                                      className="enroll-workbtn__sub"
                                      style={{
                                        color: active ? "var(--accent-text)" : "var(--ink-muted)",
                                      }}
                                    >
                                      {option.subtitle}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Revelado suave */}
                        <div
                          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                            formData.trabaja
                              ? "grid-rows-[1fr] opacity-100"
                              : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <div className="overflow-hidden min-h-0">
                            <div className="enroll-cert">
                              <label
                                className="enroll-cert__label label block"
                                style={{ color: "var(--ink-muted)", fontSize: 10 }}
                              >
                                Certificado Laboral
                                {formData.existingCertificadoTrabajo &&
                                !formData.certificadoTrabajoFile
                                  ? ""
                                  : " (Obligatorio)"}
                              </label>

                              {/* Input nativo siempre montado: lo dispara tanto el
                              botón "Actualizar" del chip como el recuadro de subida. */}
                              <input
                                id="cert-file-upload"
                                type="file"
                                ref={certFileInputRef}
                                className="sr-only"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                                onChange={(e) => handleFileChange(e, "certificadoTrabajoFile")}
                              />

                              {formData.existingCertificadoTrabajo &&
                              !formData.certificadoTrabajoFile ? (
                                // Ya hay certificado cargado: mostramos solo el chip
                                // "vigente". El recuadro de subida no aparece hasta que
                                // el estudiante toca "Actualizar".
                                <div
                                  className="enroll-cert-card"
                                  style={{
                                    background: "var(--bg-elevated)",
                                    border:
                                      "1px solid color-mix(in oklab, var(--accent) 34%, var(--line))",
                                  }}
                                >
                                  <a
                                    href={formData.existingCertificadoTrabajo}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group flex items-center gap-2 min-w-0"
                                    style={{ color: "var(--accent-text)", textDecoration: "none" }}
                                  >
                                    <Icon name="check" size={16} strokeWidth={2.4} />
                                    <span className="flex flex-col min-w-0 leading-tight">
                                      <span className="text-xs font-bold">Certificado Vigente</span>
                                      <span className="text-[10px] font-medium opacity-70 group-hover:underline">
                                        Ver documento
                                      </span>
                                    </span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => openFilePicker(certFileInputRef)}
                                    className="enroll-cert-action flex flex-shrink-0 items-center gap-1.5 rounded-lg text-xs font-bold transition hover:-translate-y-0.5"
                                    style={{
                                      background: "var(--accent)",
                                      color: "var(--on-accent)",
                                    }}
                                  >
                                    <Icon name="upload" size={13} strokeWidth={2.2} />
                                    Actualizar
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <FileUploadButton
                                    onClick={() => openFilePicker(certFileInputRef)}
                                    label={
                                      formData.certificadoTrabajoFile
                                        ? "Cambiar Archivo"
                                        : "Subir Certificado"
                                    }
                                    fileName={formData.certificadoTrabajoFile?.name}
                                    hasError={!!errors.trabaja}
                                  />
                                  {formData.existingCertificadoTrabajo &&
                                    formData.certificadoTrabajoFile && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setFormData((prev) => ({
                                            ...prev,
                                            certificadoTrabajoFile: null,
                                          }))
                                        }
                                        className="mt-2 text-xs font-semibold hover:underline"
                                        style={{ color: "var(--ink-muted)" }}
                                      >
                                        Cancelar y mantener el certificado actual
                                      </button>
                                    )}
                                </>
                              )}
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
                              role="checkbox"
                              tabIndex={0}
                              aria-checked={active}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleHorarioToggle(horario);
                                }
                              }}
                              className="cursor-pointer px-5 py-4 rounded-2xl border transition flex items-center justify-between group select-none focus:outline-none focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2"
                              style={{
                                borderColor: active ? "var(--accent)" : "var(--line)",
                                background: "var(--bg-elevated)",
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
              )}
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
                          hideIcon
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
                          hideIcon
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
                                onClick={() =>
                                  setFormData((p) => ({ ...p, finalesAdeudados: opt }))
                                }
                                role="radio"
                                tabIndex={0}
                                aria-checked={active}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setFormData((p) => ({ ...p, finalesAdeudados: opt }));
                                  }
                                }}
                                className="cursor-pointer px-3 py-3 rounded-xl border text-xs font-bold text-center transition duration-200 select-none focus:outline-none focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2"
                                style={{
                                  borderColor: active ? "var(--accent)" : "var(--line)",
                                  background: "var(--bg-elevated)",
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
                          <p
                            className="text-xs font-semibold mt-2 ml-1"
                            style={{ color: "#c0563f" }}
                          >
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
                            hideIcon
                            selected={formData.cursandoElectivas === true}
                            onClick={() => setFormData((p) => ({ ...p, cursandoElectivas: true }))}
                          />
                          <SelectionCard
                            title="No"
                            hideIcon
                            selected={formData.cursandoElectivas === false}
                            onClick={() => setFormData((p) => ({ ...p, cursandoElectivas: false }))}
                          />
                        </div>
                        {errors.cursandoElectivas && (
                          <p
                            className="text-xs font-semibold mt-2 ml-1"
                            style={{ color: "#c0563f" }}
                          >
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
                        className="w-full p-4 rounded-2xl text-sm outline-none resize-none transition placeholder:text-[var(--ink-subtle)] focus:border-[var(--accent)]"
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
                      label={
                        formData.cvFile ? "CV Seleccionado" : "Adjuntar CV (PDF, Imagen o Word)"
                      }
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
            className="enroll-foot flex-shrink-0 flex flex-col sm:flex-row gap-2 sm:gap-3 relative z-20 safe-area-bottom"
            style={{ background: "var(--bg-elevated)", borderTop: "1px solid var(--line)" }}
          >
            {fileUploadProgress > 0 && fileUploadProgress < 100 && (
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ background: "var(--bg-sunken)" }}
                role="progressbar"
                aria-label="Carga de documentación"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={fileUploadProgress}
              >
                <div
                  className="h-full transition-[width] duration-300"
                  style={{ width: `${fileUploadProgress}%`, background: "var(--accent)" }}
                ></div>
              </div>
            )}

            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className="enroll-cancel w-full sm:flex-1 rounded-xl font-bold text-sm transition-colors hover:bg-[var(--bg-sunken)]"
              style={{ color: "var(--ink-soft)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (formRef.current) formRef.current.requestSubmit();
              }}
              disabled={isSubmitting}
              className="enroll-submit w-full sm:flex-[2] rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:translate-y-0 text-sm"
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
                  <span>Registrando inscripción...</span>
                </>
              ) : (
                <>
                  <span>Confirmar inscripción</span>
                  <Icon name="arrow" size={18} strokeWidth={2.4} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={pendingWorkOff}
        title="¿Indicar que no trabajás?"
        message={
          "Al hacerlo se eliminará el certificado laboral que tenías guardado.\n\nEsta acción no se puede deshacer."
        }
        confirmText="Sí, no trabajo"
        cancelText="Volver"
        type="danger"
        onConfirm={confirmWorkOff}
        onClose={() => setPendingWorkOff(false)}
      />
    </>
  );
};
