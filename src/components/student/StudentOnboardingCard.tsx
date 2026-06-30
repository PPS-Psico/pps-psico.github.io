import React from "react";
import {
  HORAS_OBJETIVO_TOTAL,
  HORAS_OBJETIVO_ORIENTACION,
  ROTACION_OBJETIVO_ORIENTACIONES,
} from "../../constants";

interface StudentOnboardingCardProps {
  studentName?: string;
  /** Navega a una pestaña del panel del estudiante (ej. "solicitudes", "profile"). */
  onNavigate?: (tab: string) => void;
}

interface Step {
  icon: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: "explore",
    title: "Elegí tu orientación",
    body: "Definí tu orientación principal en tu perfil. Es la especialidad en la que necesitás sumar horas.",
  },
  {
    icon: "campaign",
    title: "Inscribite a una convocatoria",
    body: "Cuando se abra una PPS, vas a verla en Inicio. Inscribite antes de que cierre el cupo.",
  },
  {
    icon: "handshake",
    title: "¿Conseguiste un lugar por tu cuenta?",
    body: "Si tenés una institución propia, mandá una solicitud y coordinación gestiona el convenio.",
  },
  {
    icon: "verified",
    title: "Acreditá tu PPS",
    body: `Necesitás ${HORAS_OBJETIVO_TOTAL} h totales, ${HORAS_OBJETIVO_ORIENTACION} h en tu orientación y rotar por ${ROTACION_OBJETIVO_ORIENTACIONES} áreas.`,
  },
];

/**
 * Mini-recorrido para alumnos nuevos (sin prácticas, solicitudes ni convocatorias).
 * Reemplaza el EmptyState seco para reducir consultas a coordinación: explica en
 * 4 pasos cómo funcionan las PPS y qué hacer primero.
 */
const StudentOnboardingCard: React.FC<StudentOnboardingCardProps> = ({
  studentName,
  onNavigate,
}) => {
  const firstName = studentName?.split(" ")[0];

  return (
    <section
      aria-label="Cómo funcionan las prácticas profesionales"
      className="rounded-3xl border border-student-line bg-student-bg-elevated p-6 sm:p-8"
    >
      <span className="eyebrow">Primeros pasos</span>
      <h2
        className="display mt-2 mb-1"
        style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: "-0.03em" }}
      >
        {firstName ? `Bienvenido/a, ${firstName}.` : "Bienvenido/a a tus PPS."}
      </h2>
      <p className="text-sm text-student-ink-muted mb-6 max-w-prose">
        Todavía no tenés actividad registrada. Así es como vas a transitar tus Prácticas
        Profesionales Supervisadas:
      </p>

      <ol className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-2xl border border-student-hairline bg-student-bg p-4"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-uflo-teal/10 text-uflo-teal"
              aria-hidden="true"
            >
              <span className="material-icons text-[20px]">{step.icon}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-student-ink leading-tight">
                <span className="text-student-ink-subtle mr-1">{i + 1}.</span>
                {step.title}
              </h3>
              <p className="text-[12.5px] text-student-ink-muted mt-1 leading-relaxed">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigate?.("solicitudes")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-uflo-teal px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
        >
          <span className="material-icons text-base" aria-hidden="true">
            add
          </span>
          Solicitar una PPS
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.("profile")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-student-line px-4 py-2 text-sm font-semibold text-student-ink transition hover:bg-student-bg active:scale-95"
        >
          <span className="material-icons text-base" aria-hidden="true">
            person
          </span>
          Completar mi perfil
        </button>
      </div>

      <p className="mt-5 text-[12px] text-student-ink-subtle">
        Mantené el ojo en el grupo de WhatsApp para enterarte de nuevas convocatorias.
      </p>
    </section>
  );
};

export default StudentOnboardingCard;
