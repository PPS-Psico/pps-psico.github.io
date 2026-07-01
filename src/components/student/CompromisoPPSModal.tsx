import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  COMPROMISO_PPS_BLOCKS,
  COMPROMISO_PPS_CHECK_COMPROMISO,
  COMPROMISO_PPS_CHECK_LECTURA,
  COMPROMISO_PPS_DECLARACION,
  COMPROMISO_PPS_INTRO,
  COMPROMISO_PPS_SUBTITLE,
  COMPROMISO_PPS_TITLE,
} from "../../constants/commitmentConstants";
import type { Convocatoria, Estudiante, LanzamientoPPS } from "../../types";
import "./home/atlas/atlasHome.css";

interface CompromisoPPSModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Estudiante | null;
  lanzamiento: LanzamientoPPS | null;
  enrollment: Convocatoria | null;
  onSubmit: (payload: {
    fullName: string;
    dni: number | null;
    legajo: string;
    signature: string;
    convocatoriaId: string;
    lanzamientoId: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

interface WizardStep {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  intro?: string;
  clauses: readonly { label: string; text: string }[];
}

const CompromisoPPSModal: React.FC<CompromisoPPSModalProps> = ({
  isOpen,
  onClose,
  student,
  lanzamiento,
  enrollment,
  onSubmit,
  isSubmitting = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [legajo, setLegajo] = useState("");
  const [signature, setSignature] = useState("");
  const [acceptedRead, setAcceptedRead] = useState(false);
  const [acceptedCommitment, setAcceptedCommitment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setFullName(student?.nombre || "");
      setDni(student?.dni ? String(student.dni) : "");
      setLegajo(student?.legajo || "");
      setSignature(student?.nombre || "");
      setAcceptedRead(false);
      setAcceptedCommitment(false);
      setCurrentStep(0);
      setError(null);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, student]);

  const steps = useMemo<WizardStep[]>(
    () => [
      ...COMPROMISO_PPS_BLOCKS.map((block, index) => ({
        id: `step-${index + 1}`,
        eyebrow: `Paso ${index + 1} de ${COMPROMISO_PPS_BLOCKS.length + 1}`,
        title: block.title,
        description:
          index === 0
            ? "Leé con atención las condiciones académicas y éticas que regulan esta PPS."
            : index === 1
              ? "Esta ventana reúne las pautas de conducta profesional y representación institucional."
              : "Esta ventana reúne las pautas operativas y de comunicación responsable durante la PPS.",
        intro: block.intro,
        clauses: block.clauses,
      })),
      {
        id: "step-final",
        eyebrow: `Paso ${COMPROMISO_PPS_BLOCKS.length + 1} de ${COMPROMISO_PPS_BLOCKS.length + 1}`,
        title: "Ratificación final",
        description:
          "En esta última instancia dejás constancia formal de lectura, aceptación y compromiso con las condiciones de la PPS.",
        clauses: [],
      },
    ],
    []
  );

  if (!mounted || !isOpen || !lanzamiento || !enrollment) return null;

  const isLastStep = currentStep === steps.length - 1;
  const activeStep = steps[currentStep];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isLastStep) {
      setError("Tenés que completar la lectura de todas las ventanas antes de firmar.");
      return;
    }

    if (!acceptedRead || !acceptedCommitment) {
      setError("Debés marcar ambas declaraciones para registrar el compromiso.");
      return;
    }

    if (!fullName.trim() || !legajo.trim() || !signature.trim()) {
      setError("Completá todos los datos obligatorios antes de confirmar.");
      return;
    }

    if (student?.legajo && legajo.trim() !== student.legajo.trim()) {
      setError("El legajo ingresado no coincide con tu registro.");
      return;
    }

    if (student?.dni && dni.trim() !== String(student.dni).trim()) {
      setError("El DNI ingresado no coincide con tu registro.");
      return;
    }

    await onSubmit({
      fullName: fullName.trim(),
      dni: dni.trim() ? Number(dni.trim()) : null,
      legajo: legajo.trim(),
      signature: signature.trim(),
      convocatoriaId: enrollment.id,
      lanzamientoId: lanzamiento.id,
    });

    onClose();
  };

  return createPortal(
    <div className="ah-root ah-unified">
      <div className="ah-cmodal-overlay" onClick={onClose}>
        <div className="ah-cmodal" onClick={(event) => event.stopPropagation()}>
          <div className="ah-cmodal__head">
            <div>
              <span className="eyebrow">Confirmación obligatoria previa al inicio</span>
              <h2 className="ah-cmodal__title">{COMPROMISO_PPS_TITLE}</h2>
              <p className="ah-cmodal__sub">{COMPROMISO_PPS_SUBTITLE}</p>
            </div>
            <button type="button" onClick={onClose} className="ah-iconbtn" aria-label="Cerrar">
              <span className="material-icons" style={{ fontSize: 22 }}>
                close
              </span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="ah-cmodal__body">
            <div className="ah-cmodal__steptop">
              <div>
                <span className="eyebrow">{activeStep.eyebrow}</span>
                <h3 className="ah-cmodal__stitle">{activeStep.title}</h3>
                <p className="ah-cmodal__sdesc">
                  {currentStep === 0 ? COMPROMISO_PPS_INTRO : activeStep.description}
                </p>
              </div>
              <div className="ah-stepnum">{currentStep + 1}</div>
            </div>
            <div className="ah-stepbar">
              {steps.map((step, index) => (
                <span key={step.id} className={index <= currentStep ? "on" : ""} />
              ))}
            </div>

            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {!isLastStep ? (
                <>
                  {activeStep.intro ? (
                    <section className="ah-clause ah-clause--soft">
                      <span className="eyebrow">Marco general</span>
                      <p className="ah-clause__txt" style={{ marginTop: 8, color: "var(--fg)" }}>
                        {activeStep.intro}
                      </p>
                    </section>
                  ) : null}
                  {renderClauseSections(activeStep.clauses)}
                </>
              ) : (
                <>
                  <section className="ah-clause ah-clause--soft">
                    <h4
                      style={{
                        margin: "0 0 8px",
                        font: "600 16px/1.3 var(--font-sans)",
                        color: "var(--fg)",
                      }}
                    >
                      Declaración final
                    </h4>
                    <p className="ah-clause__txt" style={{ marginTop: 0 }}>
                      {COMPROMISO_PPS_DECLARACION}
                    </p>
                    <span
                      style={{
                        marginTop: 14,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        borderRadius: 999,
                        background: "var(--primary-500)",
                        color: "var(--fg-on-brand)",
                        padding: "7px 14px",
                        font: "600 11px/1 var(--font-mono)",
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 15 }}>
                        gavel
                      </span>
                      Aceptación digital registrada
                    </span>
                  </section>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label className="ah-input">
                      <span className="material-icons">badge</span>
                      <input
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Nombre y apellido"
                      />
                    </label>
                    <label className="ah-input">
                      <span className="material-icons">fingerprint</span>
                      <input
                        value={dni}
                        onChange={(event) => setDni(event.target.value.replace(/\D/g, ""))}
                        placeholder="DNI"
                        inputMode="numeric"
                      />
                    </label>
                    <label className="ah-input">
                      <span className="material-icons">school</span>
                      <input
                        value={legajo}
                        onChange={(event) => setLegajo(event.target.value)}
                        placeholder="Legajo"
                      />
                    </label>
                    <label className="ah-input">
                      <span className="material-icons">draw</span>
                      <input
                        value={signature}
                        onChange={(event) => setSignature(event.target.value)}
                        placeholder="Escribí tu nombre como firma"
                      />
                    </label>
                  </div>

                  <div
                    className="ah-clause ah-clause--soft"
                    style={{ display: "flex", flexDirection: "column", gap: 12 }}
                  >
                    <label className="ah-check">
                      <input
                        type="checkbox"
                        checked={acceptedRead}
                        onChange={(event) => setAcceptedRead(event.target.checked)}
                      />
                      {COMPROMISO_PPS_CHECK_LECTURA}
                    </label>
                    <label className="ah-check">
                      <input
                        type="checkbox"
                        checked={acceptedCommitment}
                        onChange={(event) => setAcceptedCommitment(event.target.checked)}
                      />
                      {COMPROMISO_PPS_CHECK_COMPROMISO}
                    </label>
                  </div>

                  {error && <div className="ah-err">{error}</div>}

                  <div className="ah-note">
                    La confirmación digital de este documento dejará constancia formal de tu
                    lectura, aceptación y conformidad, con fecha y hora de registro en Mi Panel.
                  </div>
                </>
              )}
            </div>

            <div className="ah-cmodal__foot">
              <button
                type="button"
                className="ah-btn ah-btn--secondary"
                onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                disabled={currentStep === 0}
              >
                Anterior
              </button>
              {!isLastStep ? (
                <button
                  type="button"
                  className="ah-btn ah-btn--primary"
                  onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
                >
                  Continuar
                  <span className="material-icons" style={{ fontSize: 17 }}>
                    arrow_forward
                  </span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="ah-btn ah-btn--primary"
                  disabled={isSubmitting}
                  style={isSubmitting ? { opacity: 0.75 } : undefined}
                >
                  <span className="material-icons" style={{ fontSize: 17 }}>
                    verified_user
                  </span>
                  {isSubmitting ? "Registrando…" : "Confirmar participación y firmar"}
                </button>
              )}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "var(--fg-subtle)",
                  maxWidth: "42ch",
                  textAlign: "right",
                }}
              >
                {isLastStep
                  ? "Revisá tus datos y confirmá las dos declaraciones."
                  : "Leé esta ventana y continuá."}
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

const renderClauseSections = (clauses: readonly { label: string; text: string }[]) => {
  const sections: React.ReactNode[] = [];

  for (let index = 0; index < clauses.length; index += 1) {
    const clause = clauses[index];
    const nextClause = clauses[index + 1];
    const nextNextClause = clauses[index + 2];

    const isDoubleEvaluationBlock =
      clause.label === "Doble Instancia de Evaluación" &&
      nextClause?.label === "Aval Institucional" &&
      nextNextClause?.label === "Evaluación de la Coordinación";

    if (isDoubleEvaluationBlock) {
      sections.push(
        <section key={clause.label} className="ah-clause">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <span className="ah-clause__n">{index + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ah-clause__lbl">{clause.label}</div>
              <p className="ah-clause__txt">
                {renderHighlightedClauseText(clause.label, clause.text)}
              </p>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {[nextClause, nextNextClause].map((nestedClause, nestedIndex) => (
                  <div key={nestedClause.label} className="ah-clause ah-clause--soft">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span
                        className="ah-clause__n"
                        style={{ width: 26, height: 26, fontSize: 12 }}
                      >
                        {nestedIndex + 1}
                      </span>
                      <div>
                        <div className="ah-clause__lbl" style={{ fontSize: 14 }}>
                          {nestedClause.label}
                        </div>
                        <p className="ah-clause__txt">
                          {renderHighlightedClauseText(nestedClause.label, nestedClause.text)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      );
      index += 2;
      continue;
    }

    sections.push(
      <section key={clause.label} className="ah-clause">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span className="ah-clause__n">{index + 1}</span>
          <div>
            <div className="ah-clause__lbl">{clause.label}</div>
            <p className="ah-clause__txt">
              {renderHighlightedClauseText(clause.label, clause.text)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return sections;
};

const renderHighlightedClauseText = (label: string, text: string) => {
  const highlights = getHighlightPhrases(label);

  if (highlights.length === 0) return text;

  const segments: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const match = findFirstHighlight(remaining, highlights);

    if (!match) {
      segments.push(<React.Fragment key={`text-${key++}`}>{remaining}</React.Fragment>);
      break;
    }

    if (match.index > 0) {
      segments.push(
        <React.Fragment key={`text-${key++}`}>{remaining.slice(0, match.index)}</React.Fragment>
      );
    }

    segments.push(
      <span key={`highlight-${key++}`} className="ah-hl">
        {match.phrase}
      </span>
    );

    remaining = remaining.slice(match.index + match.phrase.length);
  }

  return segments;
};

const getHighlightPhrases = (label: string) => {
  if (label.includes("Asistencia")) {
    return ["80%", "se desaprueba automáticamente"];
  }

  if (label.includes("Inasistencia")) {
    return ["sin aviso previo", "desaprobación inmediata"];
  }

  if (label.includes("Doble Instancia")) {
    return ["dos evaluaciones"];
  }

  if (label.includes("Aval Institucional")) {
    return ["requisito necesario pero no suficiente", "La Facultad no cuestiona"];
  }

  if (label.includes("Evaluación de la Coordinación")) {
    return ["ajuste ético", "cumplimiento normativo"];
  }

  if (label.includes("Seguimiento")) {
    return ["dar de baja", "en cualquier momento"];
  }

  if (label.includes("Representación")) {
    return ["representante de la Universidad", "estándares de responsabilidad"];
  }

  if (label.includes("Confidencialidad")) {
    return ["secreto profesional", "información clínica o institucional"];
  }

  if (label.includes("Actitud")) {
    return ["Se evalúa la iniciativa", "afectarán la calificación final"];
  }

  if (label.includes("Comunicación Permanente")) {
    return ["debe ser inmediato", "referentes del centro de práctica"];
  }

  if (label.includes("Documentación")) {
    return ["horas estén firmadas", "plazo máximo de 30 días corridos"];
  }

  if (label.includes("Coordinador")) {
    return ["canal abierto permanente", "responsabilidad evaluable"];
  }

  return [];
};

const findFirstHighlight = (text: string, phrases: string[]) => {
  let bestMatch: { index: number; phrase: string } | null = null;

  for (const phrase of phrases) {
    const index = text.indexOf(phrase);
    if (index === -1) continue;
    if (!bestMatch || index < bestMatch.index) {
      bestMatch = { index, phrase };
    }
  }

  return bestMatch;
};

export default CompromisoPPSModal;
