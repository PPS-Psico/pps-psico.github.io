import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import "./student/home/atlas/atlasHome.css";
import { cleanWhatsAppNumber } from "../utils/formatters";
import { logger } from "../utils/logger";

interface SolicitudPPSFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
}

// Campo de formulario con etiqueta + error/hint (estilo Atlas).
const FormField: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  full?: boolean;
  children: React.ReactNode;
}> = ({ label, required, error, hint, full, children }) => (
  <div className={"ah-formfield" + (full ? " ah-formfield--full" : "")}>
    <label className="ah-field__lbl">
      {label}
      {required ? <span className="ah-formreq"> *</span> : null}
    </label>
    {children}
    {hint ? <div className="ah-formhint">{hint}</div> : null}
    {error ? <p className="ah-formerr">{error}</p> : null}
  </div>
);

// Definición del esquema de validación
const solicitudSchema = z
  .object({
    nombreInstitucion: z.string().min(3, "El nombre de la institución es requerido"),
    localidad: z.string().min(2, "La localidad es requerida"),
    direccion: z.string().min(5, "La dirección es requerida"),
    emailInstitucion: z.string().min(1, "El email es requerido").email("Email inválido"),
    telefonoInstitucion: z.string().min(5, "El teléfono es requerido"),

    referente: z.string().min(3, "El referente institucional es requerido"),
    tieneConvenio: z.enum(["Sí", "No", "No sé"]),

    nombreTutor: z.string().min(3, "El nombre del Lic. en Psicología es requerido"),

    alcance: z.enum(["Individual", "Grupal"]),
    cantidadEstudiantes: z.string().optional(),

    descripcion: z.string().min(10, "Por favor describe brevemente las actividades"),
  })
  .superRefine((data, ctx) => {
    if (
      data.alcance === "Grupal" &&
      (!data.cantidadEstudiantes || data.cantidadEstudiantes.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cantidadEstudiantes"],
        message: "Por favor indica la cantidad aproximada",
      });
    }
  });

type FormData = z.infer<typeof solicitudSchema>;

const initialData: FormData = {
  nombreInstitucion: "",
  localidad: "",
  direccion: "",
  emailInstitucion: "",
  telefonoInstitucion: "",
  referente: "",
  tieneConvenio: "No sé",
  nombreTutor: "",
  alcance: "Individual",
  cantidadEstudiantes: "",
  descripcion: "",
};

const SolicitudPPSForm: React.FC<SolicitudPPSFormProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formData.telefonoInstitucion) {
      const { isValid, hint } = cleanWhatsAppNumber(formData.telefonoInstitucion);
      setPhoneWarning(isValid ? null : hint || "Formato inválido");
    } else {
      setPhoneWarning(null);
    }
  }, [formData.telefonoInstitucion]);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setErrors({});
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = solicitudSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) fieldErrors[issue.path[0]] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Transform data for backend compatibility
      // We map the new fields to existing DB fields to avoid schema migration
      const submissionData = {
        ...result.data,
        // Map 'nombreTutor' to the existing 'contactoTutor' field
        contactoTutor: result.data.nombreTutor,
        // Map 'alcance' + 'cantidad' to the existing 'tipoPractica' field
        tipoPractica:
          result.data.alcance === "Individual"
            ? "Individual"
            : `Grupal (${result.data.cantidadEstudiantes} estudiantes)`,
        // Set hardcoded 'Sí' for 'tieneTutor' since it's now a prerequisite
        tieneTutor: "Sí",
      };

      await onSubmit(submissionData);
      onClose();
    } catch (error) {
      logger.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className="ah-root" data-accent="teal">
      <div className="ah-cmodal-overlay" onClick={handleBackdropClick}>
        <div
          ref={modalRef}
          onClick={(e) => e.stopPropagation()}
          className="ah-cmodal ah-cmodal--form"
        >
          {/* Header */}
          <div className="ah-cmodal__head">
            <div>
              <span className="eyebrow">Autogestión</span>
              <h2 className="ah-cmodal__title">Solicitar una nueva PPS</h2>
              <p className="ah-cmodal__sub">Proponé una institución para gestionar tu práctica.</p>
            </div>
            <button
              type="button"
              className="ah-iconbtn"
              aria-label="Cerrar"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
            >
              <span className="material-icons" aria-hidden>
                close
              </span>
            </button>
          </div>

          {/* Body */}
          <div className="ah-cmodal__body">
            <form onSubmit={handleSubmit} className="ah-form">
              {/* Sección 1: institución */}
              <section className="ah-formsec">
                <span className="eyebrow ah-formsec__head">Datos de la institución</span>
                <div className="ah-formgrid">
                  <FormField
                    label="Nombre de la institución"
                    required
                    error={errors.nombreInstitucion}
                    full
                  >
                    <input
                      className="ah-textinput"
                      name="nombreInstitucion"
                      value={formData.nombreInstitucion}
                      onChange={handleChange}
                      placeholder="Ej: Hospital Zonal…"
                    />
                  </FormField>
                  <FormField label="Localidad" required error={errors.localidad}>
                    <input
                      className="ah-textinput"
                      name="localidad"
                      value={formData.localidad}
                      onChange={handleChange}
                      placeholder="Ej: Cipolletti"
                    />
                  </FormField>
                  <FormField label="Dirección completa" required error={errors.direccion}>
                    <input
                      className="ah-textinput"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleChange}
                      placeholder="Calle y altura"
                    />
                  </FormField>
                  <FormField label="Email de contacto" required error={errors.emailInstitucion}>
                    <input
                      className="ah-textinput"
                      name="emailInstitucion"
                      type="email"
                      value={formData.emailInstitucion}
                      onChange={handleChange}
                      placeholder="contacto@institucion.com"
                    />
                  </FormField>
                  <FormField
                    label="Teléfono"
                    required
                    error={errors.telefonoInstitucion}
                    hint={
                      phoneWarning ? (
                        <span className="ah-formhint ah-formhint--warn">
                          <span className="material-icons" aria-hidden>
                            warning
                          </span>
                          {phoneWarning} — formato WhatsApp: país + área + número (ej:
                          542991234567).
                        </span>
                      ) : undefined
                    }
                  >
                    <input
                      className="ah-textinput"
                      name="telefonoInstitucion"
                      type="tel"
                      value={formData.telefonoInstitucion}
                      onChange={handleChange}
                      placeholder="Ej: 2991234567"
                    />
                  </FormField>
                </div>
              </section>

              {/* Sección 2: referentes y convenio */}
              <section className="ah-formsec">
                <span className="eyebrow ah-formsec__head">Referentes y convenio</span>
                <div className="ah-formgrid">
                  <FormField
                    label="Referente institucional (director/coord.)"
                    required
                    error={errors.referente}
                  >
                    <input
                      className="ah-textinput"
                      name="referente"
                      value={formData.referente}
                      onChange={handleChange}
                      placeholder="Autoridad de la institución"
                    />
                  </FormField>
                  <FormField label="¿Tiene convenio con UFLO?">
                    <select
                      className="ah-selectctrl"
                      name="tieneConvenio"
                      value={formData.tieneConvenio}
                      onChange={handleChange}
                    >
                      <option value="No sé">No lo sé</option>
                      <option value="Sí">Sí, tiene convenio vigente</option>
                      <option value="No">No, hay que gestionarlo</option>
                    </select>
                  </FormField>
                  <FormField
                    label="Nombre del Lic. en Psicología (tutor)"
                    required
                    error={errors.nombreTutor}
                    hint="Debe ser un psicólogo/a graduado que trabaje en la institución."
                    full
                  >
                    <input
                      className="ah-textinput"
                      name="nombreTutor"
                      value={formData.nombreTutor}
                      onChange={handleChange}
                      placeholder="Nombre del profesional que supervisará"
                    />
                  </FormField>
                </div>
              </section>

              {/* Sección 3: sobre la práctica */}
              <section className="ah-formsec">
                <span className="eyebrow ah-formsec__head">Sobre la práctica</span>
                <div className="ah-formgrid">
                  <FormField label="Alcance de la práctica">
                    <select
                      className="ah-selectctrl"
                      name="alcance"
                      value={formData.alcance}
                      onChange={handleChange}
                    >
                      <option value="Individual">Solo para mí</option>
                      <option value="Grupal">Para varios estudiantes</option>
                    </select>
                  </FormField>
                  {formData.alcance === "Grupal" ? (
                    <FormField
                      label="Cantidad aprox. de estudiantes"
                      required
                      error={errors.cantidadEstudiantes}
                    >
                      <input
                        className="ah-textinput"
                        name="cantidadEstudiantes"
                        value={formData.cantidadEstudiantes}
                        onChange={handleChange}
                        placeholder="Ej: 3 o 4"
                      />
                    </FormField>
                  ) : null}
                  <FormField
                    label="Descripción de actividades"
                    required
                    error={errors.descripcion}
                    full
                  >
                    <textarea
                      className="ah-textarea"
                      name="descripcion"
                      value={formData.descripcion}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Describí brevemente qué actividades se realizarían (ej: observación, admisión, talleres)…"
                    />
                  </FormField>
                </div>
              </section>

              {/* Footer */}
              <div className="ah-cmodal__foot" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="ah-btn ah-btn--secondary"
                  disabled={isSubmitting}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="ah-btn ah-btn--primary" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando…" : "Enviar solicitud"}
                  <span className="material-icons" style={{ fontSize: 17 }} aria-hidden>
                    send
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SolicitudPPSForm;
