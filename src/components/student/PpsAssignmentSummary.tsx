import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FIELD_DIRECCION_CONVOCATORIAS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_DNI_ESTUDIANTES,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ES_ONLINE_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORARIO_ASIGNADO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOMBRE_PPS_CONVOCATORIAS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
} from "../../constants";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";
import { getEffectivePracticeStatus, isPracticeActive } from "../../logic/studentRules";
import type { Convocatoria, EstudianteFields, LanzamientoPPS, Practica } from "../../types";
import { cleanDbValue, formatDate } from "../../utils/formatters";
import { getLocationModalityLabel, hasPhysicalAddress } from "../../utils/locationUtils";
import "./home/atlas/atlasHome.css";

export interface PpsAssignmentSummaryData {
  practiceId: string;
  studentName: string;
  dni: string;
  legajo: string;
  ppsName: string;
  institutionName: string;
  orientation: string;
  period: string;
  assignedSchedule: string;
  modality: string;
  address: string | null;
  generatedAt: string;
}

interface BuildPpsAssignmentSummaryParams {
  practice: Practica;
  student: EstudianteFields | null;
  enrollment?: Convocatoria | null;
  launch?: LanzamientoPPS | null;
  generatedAt?: Date;
}

const safeDate = (value: string | null | undefined): string =>
  value ? formatDate(value) : "A confirmar";

const formatGeneratedAt = (value: Date): string =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);

export function buildPpsAssignmentSummary({
  practice,
  student,
  enrollment,
  launch,
  generatedAt = new Date(),
}: BuildPpsAssignmentSummaryParams): PpsAssignmentSummaryData | null {
  if (!isPracticeActive(getEffectivePracticeStatus(practice))) return null;

  const institutionName =
    cleanDbValue(practice[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) || "Institución no informada";
  const ppsName =
    cleanDbValue(enrollment?.[FIELD_NOMBRE_PPS_CONVOCATORIAS]) ||
    cleanDbValue(launch?.[FIELD_NOMBRE_PPS_LANZAMIENTOS]) ||
    institutionName;
  const address =
    cleanDbValue(enrollment?.[FIELD_DIRECCION_CONVOCATORIAS]) ||
    cleanDbValue(launch?.[FIELD_DIRECCION_LANZAMIENTOS]);
  const modalityFromAddress = getLocationModalityLabel(address);
  const modality = practice[FIELD_ES_ONLINE_PRACTICAS]
    ? "Online"
    : modalityFromAddress === "Pres."
      ? "Presencial"
      : modalityFromAddress === "—"
        ? "No informada"
        : modalityFromAddress;
  const period = `${safeDate(practice[FIELD_FECHA_INICIO_PRACTICAS])} — ${safeDate(
    practice[FIELD_FECHA_FIN_PRACTICAS]
  )}`;

  return {
    practiceId: practice.id,
    studentName: cleanDbValue(student?.[FIELD_NOMBRE_ESTUDIANTES]) || "Estudiante",
    dni: cleanDbValue(student?.[FIELD_DNI_ESTUDIANTES]) || "No informado",
    legajo: cleanDbValue(student?.[FIELD_LEGAJO_ESTUDIANTES]) || "No informado",
    ppsName,
    institutionName,
    orientation: cleanDbValue(practice[FIELD_ESPECIALIDAD_PRACTICAS]) || "No informada",
    period,
    assignedSchedule:
      cleanDbValue(enrollment?.[FIELD_HORARIO_ASIGNADO_CONVOCATORIAS]) ||
      "Sin horario asignado registrado",
    modality,
    address: hasPhysicalAddress(address) ? address : null,
    generatedAt: formatGeneratedAt(generatedAt),
  };
}

interface SummaryFieldsProps {
  data: PpsAssignmentSummaryData;
  compact?: boolean;
}

const SummaryFields: React.FC<SummaryFieldsProps> = ({ data, compact = false }) => (
  <dl className={compact ? "pps-summary-fields is-compact" : "pps-summary-fields"}>
    <div className="pps-summary-field pps-summary-field--wide">
      <dt>PPS asignada</dt>
      <dd>{data.ppsName}</dd>
    </div>
    <div className="pps-summary-field">
      <dt>Institución receptora</dt>
      <dd>{data.institutionName}</dd>
    </div>
    <div className="pps-summary-field">
      <dt>Área</dt>
      <dd>{data.orientation}</dd>
    </div>
    <div className="pps-summary-field">
      <dt>Período previsto</dt>
      <dd>{data.period}</dd>
    </div>
    <div className="pps-summary-field">
      <dt>Modalidad</dt>
      <dd>{data.modality}</dd>
    </div>
    <div className="pps-summary-field pps-summary-field--wide">
      <dt>Horario asignado</dt>
      <dd className="pps-summary-schedule">{data.assignedSchedule}</dd>
    </div>
    {data.address ? (
      <div className="pps-summary-field pps-summary-field--wide">
        <dt>Domicilio registrado</dt>
        <dd>{data.address}</dd>
      </div>
    ) : null}
  </dl>
);

interface PpsAssignmentSummaryModalProps {
  isOpen: boolean;
  data: PpsAssignmentSummaryData | null;
  onClose: () => void;
  onPrint: () => void;
}

export const PpsAssignmentSummaryModal: React.FC<PpsAssignmentSummaryModalProps> = ({
  isOpen,
  data,
  onClose,
  onPrint,
}) => {
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ isOpen, onClose });
  const portalTarget = useMemo(() => (typeof document === "undefined" ? null : document.body), []);

  if (!isOpen || !data || !portalTarget) return null;

  return createPortal(
    <div className="ah-root ah-unified no-print">
      <div className="pps-summary-overlay">
        <div
          ref={dialogRef}
          className="pps-summary-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pps-summary-title"
          aria-describedby="pps-summary-description"
          tabIndex={-1}
        >
          <header className="pps-summary-modal__header">
            <div>
              <span className="pps-summary-kicker">PPS en curso · Vista previa</span>
              <h2 id="pps-summary-title">Resumen informativo de asignación</h2>
              <p id="pps-summary-description">
                Revisá los datos que se imprimirán. Este resumen informa una asignación vigente; no
                acredita asistencia.
              </p>
            </div>
            <button
              type="button"
              className="ah-iconbtn"
              onClick={onClose}
              aria-label="Cerrar resumen informativo"
            >
              <span className="material-icons" aria-hidden="true">
                close
              </span>
            </button>
          </header>

          <div className="pps-summary-modal__body">
            <div className="pps-summary-student">
              <div>
                <span>Estudiante</span>
                <strong>{data.studentName}</strong>
              </div>
              <dl>
                <div>
                  <dt>DNI</dt>
                  <dd>{data.dni}</dd>
                </div>
                <div>
                  <dt>Legajo</dt>
                  <dd>{data.legajo}</dd>
                </div>
              </dl>
            </div>

            <SummaryFields data={data} compact />
          </div>

          <footer className="pps-summary-modal__footer">
            <span>Emitido desde Mi Panel · {data.generatedAt}</span>
            <div>
              <button type="button" className="ah-btn ah-btn--secondary" onClick={onClose}>
                Volver
              </button>
              <button
                type="button"
                className="ah-btn ah-btn--primary"
                onClick={onPrint}
                data-dialog-autofocus
              >
                <span className="material-icons" aria-hidden="true">
                  print
                </span>
                Imprimir resumen
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    portalTarget
  );
};

export const PrintablePpsAssignmentSummary: React.FC<{ data: PpsAssignmentSummaryData }> = ({
  data,
}) => (
  <article className="pps-summary-print">
    <header className="pps-summary-print__header">
      <div>
        <span className="pps-summary-print__brand">Mi Panel Académico</span>
        <span className="pps-summary-print__school">Licenciatura en Psicología · UFLO</span>
      </div>
      <span className="pps-summary-print__status">Documento informativo</span>
    </header>

    <div className="pps-summary-print__title">
      <p>PPS en curso</p>
      <h1>Resumen informativo de asignación</h1>
      <span>No acredita asistencia</span>
    </div>

    <p className="pps-summary-print__intro">
      Según los datos registrados en Mi Panel al {data.generatedAt},{" "}
      <strong>{data.studentName}</strong>, DNI <strong>{data.dni}</strong>, legajo{" "}
      <strong>{data.legajo}</strong>, posee una asignación vigente a la siguiente Práctica
      Profesional Supervisada.
    </p>

    <SummaryFields data={data} />

    <section className="pps-summary-print__scope">
      <h2>Alcance de este documento</h2>
      <p>
        Este resumen refleja exclusivamente la asignación administrativa y el cronograma registrados
        a la fecha de emisión. No certifica la asistencia efectiva del estudiante, su regularidad,
        la cantidad de horas realizadas, la aprobación ni la finalización de la práctica. Los días y
        horarios informados pueden modificarse por indicación de la institución receptora o de la
        coordinación.
      </p>
      <strong>
        No constituye un certificado académico ni una constancia oficial de asistencia emitida por
        UFLO Universidad.
      </strong>
    </section>

    <footer className="pps-summary-print__footer">
      <span>Documento generado automáticamente desde Mi Panel Académico.</span>
      <span>No requiere firma.</span>
    </footer>
  </article>
);

export const getPracticeEnrollment = (
  practice: Practica,
  enrollmentMap: Map<string, Convocatoria>
): Convocatoria | null => {
  const launchId = cleanDbValue(practice[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]);
  return launchId ? enrollmentMap.get(launchId) || null : null;
};

export const getPracticeLaunch = (
  practice: Practica,
  launches: LanzamientoPPS[]
): LanzamientoPPS | null => {
  const launchId = cleanDbValue(practice[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]);
  return launchId ? launches.find((launch) => launch.id === launchId) || null : null;
};

export const canShowPpsAssignmentSummary = (practice: Practica): boolean =>
  isPracticeActive(getEffectivePracticeStatus(practice)) &&
  isPracticeActive(practice[FIELD_ESTADO_PRACTICA]);
