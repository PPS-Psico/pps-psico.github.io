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
import Button from "../ui/Button";
import Checkbox from "../ui/Checkbox";
import Input from "../ui/Input";

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
    <div
      className="fixed inset-0 z-[1200] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="mx-auto my-8 w-full max-w-4xl rounded-[28px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 py-5 md:px-8 md:py-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                Confirmación obligatoria previa al inicio
              </p>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                {COMPROMISO_PPS_TITLE}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {COMPROMISO_PPS_SUBTITLE}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons !text-2xl">close</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8">
          <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
            <div className="px-5 py-4 md:px-6 md:py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                    {activeStep.eyebrow}
                  </p>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                    {activeStep.title}
                  </h3>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300 max-w-2xl">
                    {currentStep === 0 ? COMPROMISO_PPS_INTRO : activeStep.description}
                  </p>
                </div>
                <div className="hidden md:flex items-center justify-center rounded-full w-14 h-14 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-black text-lg">
                  {currentStep + 1}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      index <= currentStep
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                        : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="p-5 md:p-6 min-h-[460px] flex flex-col">
              {!isLastStep ? (
                <div className="space-y-4 flex-1">
                  {activeStep.intro ? (
                    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                        Marco general
                      </p>
                      <p className="mt-3 text-[15px] leading-8 text-slate-700 dark:text-slate-200 font-medium">
                        {activeStep.intro}
                      </p>
                    </section>
                  ) : null}

                  {renderClauseSections(activeStep.clauses)}
                </div>
              ) : (
                <div className="space-y-5 flex-1">
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-5">
                    <h4 className="text-base font-black text-slate-900 dark:text-white mb-2">
                      Declaración final
                    </h4>
                    <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                      {COMPROMISO_PPS_DECLARACION}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em]">
                      <span className="material-icons !text-base">gavel</span>
                      Aceptación digital registrada
                    </div>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      id="compromiso-fullname"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Nombre y apellido"
                      icon="badge"
                    />

                    <Input
                      id="compromiso-dni"
                      value={dni}
                      onChange={(event) => setDni(event.target.value.replace(/\D/g, ""))}
                      placeholder="DNI"
                      icon="fingerprint"
                    />

                    <Input
                      id="compromiso-legajo"
                      value={legajo}
                      onChange={(event) => setLegajo(event.target.value)}
                      placeholder="Legajo"
                      icon="school"
                    />

                    <Input
                      id="compromiso-firma"
                      value={signature}
                      onChange={(event) => setSignature(event.target.value)}
                      placeholder="Escribí tu nombre completo como firma"
                      icon="draw"
                    />
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/80 dark:bg-slate-900/60">
                    <Checkbox
                      id="compromiso-lectura"
                      checked={acceptedRead}
                      onChange={(event) => setAcceptedRead(event.target.checked)}
                      label={COMPROMISO_PPS_CHECK_LECTURA}
                    />
                    <Checkbox
                      id="compromiso-compromiso"
                      checked={acceptedCommitment}
                      onChange={(event) => setAcceptedCommitment(event.target.checked)}
                      label={COMPROMISO_PPS_CHECK_COMPROMISO}
                    />
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                      {error}
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 text-xs leading-6 text-slate-500 dark:text-slate-400">
                    La confirmación digital de este documento dejará constancia formal de tu
                    lectura, aceptación y conformidad, con fecha y hora de registro en Mi Panel.
                  </div>
                </div>
              )}

              <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
                <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {isLastStep
                    ? "Antes de firmar, revisá tus datos y confirmá las dos declaraciones."
                    : "Leé esta ventana y continuá para revisar la siguiente parte del compromiso."}
                </p>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                      disabled={currentStep === 0}
                    >
                      Anterior
                    </Button>
                    {!isLastStep ? (
                      <Button
                        type="button"
                        icon="arrow_forward"
                        onClick={() =>
                          setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
                        }
                      >
                        Continuar
                      </Button>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button type="submit" icon="verified_user" isLoading={isSubmitting}>
                          Confirmar participación y firmar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const getClauseTone = (_label: string) =>
  "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60";

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
        <section
          key={clause.label}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-5"
        >
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
              {index + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100">
                {clause.label}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-200">
                {renderHighlightedClauseText(clause.label, clause.text)}
              </p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[nextClause, nextNextClause].map((nestedClause, nestedIndex) => (
                  <div
                    key={nestedClause.label}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/40 text-xs font-black text-blue-700 dark:text-blue-300">
                        {nestedIndex + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {nestedClause.label}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
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
      <section
        key={clause.label}
        className={`rounded-2xl border p-5 ${getClauseTone(clause.label)}`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${getClauseIndexTone(
              clause.label
            )}`}
          >
            {index + 1}
          </div>
          <div>
            <p className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100">
              {clause.label}
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {renderHighlightedClauseText(clause.label, clause.text)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return sections;
};

const getClauseIndexTone = (_label: string) =>
  "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300";

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
      <span key={`highlight-${key++}`} className="font-bold text-blue-700 dark:text-blue-300">
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
