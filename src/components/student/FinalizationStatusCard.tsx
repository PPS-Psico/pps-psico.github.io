import React from "react";
import "./home/atlas/atlasHome.css";
import { addBusinessDays, getAcademicRecess, getBusinessDaysCount } from "../../utils/businessDays";
import { formatDate } from "../../utils/formatters";

interface FinalizationStatusCardProps {
  status: string;
  requestDate: string;
  studentName?: string;
}

const normalizeStatus = (value: string) =>
  value
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim() || "";

const FinalizationStatusCard: React.FC<FinalizationStatusCardProps> = ({
  status,
  requestDate,
  studentName,
}) => {
  const startDate = requestDate ? new Date(requestDate) : new Date();
  const targetDate = addBusinessDays(startDate, 14);
  const now = new Date();
  const currentRecess = getAcademicRecess(now);
  const isPaused = currentRecess !== null;
  const isSummerBreak = currentRecess === "summer";
  const pauseReason = isSummerBreak ? "Receso de verano" : "Receso de invierno";
  const pauseDescription = isSummerBreak
    ? "El receso universitario no computa plazos administrativos."
    : "El receso invernal no computa plazos administrativos.";
  const normalizedStatus = normalizeStatus(status);
  const isFinished = normalizedStatus === "cargado" || normalizedStatus === "finalizada";
  const isEnProceso = normalizedStatus === "en proceso";
  const daysDisplay = getBusinessDaysCount(now, targetDate);
  const elapsedBusinessDays = Math.max(0, getBusinessDaysCount(startDate, now));
  let percentage = Math.min(100, Math.max(6, (elapsedBusinessDays / 14) * 100));

  if (isPaused) percentage = Math.min(percentage, 95);
  if (daysDisplay < 0) percentage = 100;

  const firstName = studentName?.split(" ")[0] || "Estudiante";
  const isOverdue = daysDisplay < 0 && !isFinished && !isPaused;

  if (isFinished) {
    return (
      <section
        className="ah-finalization ah-finalization--done"
        aria-labelledby="finalizacion-title"
      >
        <div className="ah-finalization__hero">
          <div className="ah-finalization__seal ah-finalization__seal--done">
            <span className="material-icons" aria-hidden>
              verified
            </span>
          </div>
          <div className="ah-finalization__copy">
            <span className="ah-finalization__kicker">Acreditacion finalizada</span>
            <h1 id="finalizacion-title">
              Todo listo, <em>{firstName}</em>.
            </h1>
            <p>
              Tu acreditacion fue completada y tus horas ya figuran cargadas en el sistema academico
              SAC.
            </p>
          </div>
          <a
            href="https://alumno.uflo.edu.ar"
            target="_blank"
            rel="noopener noreferrer"
            className="ah-finalization__button"
          >
            Verificar en SAC
            <span className="material-icons" aria-hidden>
              open_in_new
            </span>
          </a>
        </div>
        <p className="ah-finalization__fineprint">
          Mi Panel funciona como seguimiento interno. La confirmacion oficial siempre corresponde a
          SAC y a la documentacion validada por la facultad.
        </p>
      </section>
    );
  }

  const currentStepIndex = isEnProceso ? 1 : 0;
  const title = isEnProceso ? (
    <>
      Todo marcha bien, <em>{firstName}</em>.
    </>
  ) : (
    <>Solicitud recibida.</>
  );
  const bannerText = isEnProceso
    ? "Tus documentos fueron validados correctamente y el expediente ya esta en el circuito de acreditacion interna."
    : "Coordinacion esta revisando tu solicitud y validando la documentacion presentada.";
  const bannerStatus = isEnProceso ? "En proceso" : "Solicitud enviada";
  const steps = [
    {
      title: "Validacion documental",
      desc: "Revision de firmas, planillas y datos cargados.",
      icon: "inventory_2",
    },
    {
      title: "Circuito administrativo",
      desc: "Control interno con las areas correspondientes.",
      icon: "settings_suggest",
    },
    { title: "Acreditacion final", desc: "Carga definitiva en SAC.", icon: "school" },
  ];

  return (
    <section className="ah-finalization" aria-labelledby="finalizacion-title">
      <div className="ah-finalization__hero">
        <div className="ah-finalization__seal">
          <span className="material-icons" aria-hidden>
            fact_check
          </span>
        </div>
        <div className="ah-finalization__copy">
          <span className="ah-finalization__kicker">{bannerStatus}</span>
          <h1 id="finalizacion-title">{title}</h1>
          <p>{bannerText}</p>
        </div>
        <div className="ah-finalization__date">
          <span>Enviado</span>
          <strong>{formatDate(startDate.toISOString())}</strong>
        </div>
      </div>

      <div className="ah-finalization__grid">
        <div className="ah-finalization__panel ah-finalization__panel--steps">
          <div className="ah-finalization__panelhead">
            <span className="material-icons" aria-hidden>
              timeline
            </span>
            <div>
              <h2>Etapas del proceso</h2>
              <p>Seguimiento interno hasta la carga final.</p>
            </div>
          </div>

          <ol className="ah-finalization__steps">
            {steps.map((step, idx) => {
              const isCompleted = idx < currentStepIndex;
              const isActive = idx === currentStepIndex;

              return (
                <li
                  key={step.title}
                  className={
                    "ah-finalization__step" +
                    (isCompleted ? " is-complete" : "") +
                    (isActive ? " is-active" : "")
                  }
                >
                  <span className="ah-finalization__stepicon">
                    <span className="material-icons" aria-hidden>
                      {isCompleted ? "check" : step.icon}
                    </span>
                  </span>
                  <div>
                    <div className="ah-finalization__steptop">
                      <h3>{step.title}</h3>
                      {isActive ? <span>En curso</span> : null}
                      {isCompleted ? <span>Listo</span> : null}
                    </div>
                    <p>{step.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="ah-finalization__rail">
          <div className="ah-finalization__panel ah-finalization__clock">
            <span className="ah-finalization__label">Tiempo estimado</span>
            {isPaused ? (
              <div className="ah-finalization__pause">
                <span className="material-icons" aria-hidden>
                  {isSummerBreak ? "beach_access" : "ac_unit"}
                </span>
                <div>
                  <strong>{pauseReason}</strong>
                  <p>{pauseDescription}</p>
                </div>
              </div>
            ) : null}
            <div className={"ah-finalization__days" + (isOverdue ? " is-overdue" : "")}>
              <strong>{isPaused ? "~" : Math.max(0, daysDisplay)}</strong>
              <span>{isPaused ? "En pausa" : "dias habiles"}</span>
            </div>
            <div className="ah-finalization__meter" aria-hidden>
              <i
                className={isPaused ? "is-paused" : isOverdue ? "is-overdue" : ""}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="ah-finalization__dates">
              <span>
                <small>Enviado</small>
                {formatDate(startDate.toISOString())}
              </span>
              <span>
                <small>Estimado</small>
                {formatDate(targetDate.toISOString())}
              </span>
            </div>
          </div>

          <div className="ah-finalization__panel ah-finalization__support">
            <span className="ah-finalization__label">Soporte</span>
            <p>Si el plazo vencio y todavia no ves tus horas, escribi a coordinacion.</p>
            {isOverdue ? (
              <a
                href={`mailto:blas.rivera@uflouniversidad.edu.ar?subject=Consulta Acreditacion - ${firstName}`}
                className="ah-finalization__button ah-finalization__button--full"
              >
                Contactar coordinacion
                <span className="material-icons" aria-hidden>
                  mail
                </span>
              </a>
            ) : (
              <span className="ah-finalization__locked">
                <span className="material-icons" aria-hidden>
                  lock_clock
                </span>
                Consulta habilitada al vencer el plazo
              </span>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default FinalizationStatusCard;
