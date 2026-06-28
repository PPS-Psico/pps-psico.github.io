import React from "react";
import { Icon, getAreaColor } from "../ds";
import type { LanzamientoPPS, Convocatoria } from "../../../types";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
} from "../../../constants";
import { formatDate, normalizeStringForComparison } from "../../../utils/formatters";
import { haptics } from "../../../utils/haptics";

interface StudentConvCardProps {
  lanzamiento: LanzamientoPPS;
  enrollment?: Convocatoria | null;
  onInscribirse?: () => void;
  onCancelarInscripcion?: () => void;
  onVerConvocados?: () => void;
  onOpen?: () => void;
  isCompleted?: boolean;
  /** Si la inscripción está abierta. Si es false, se ofrece "Ver convocados". */
  isOpen?: boolean;
  /** El estudiante quedó seleccionado y debe firmar el consentimiento.
      La tarjeta evoluciona a estado "consentimiento" (CTA Firmar). */
  needsConsent?: boolean;
  /** Acción de firma del compromiso digital. */
  onFirmarConsentimiento?: () => void;
  /** Fecha límite de firma, formato corto ("2 jul"). Opcional. */
  consentDeadline?: string;
}

/**
 * Tarjeta de convocatoria — dirección editorial (Gamma · ConvCard).
 * Uniforme para todas: dot de área + nombre display + ventana + meta + CTA.
 * Consume las clases `.cc` (ver index.css, scope `.ed`).
 */
export const StudentConvCard: React.FC<StudentConvCardProps> = ({
  lanzamiento,
  enrollment,
  onInscribirse,
  onCancelarInscripcion,
  onVerConvocados,
  onOpen,
  isOpen = true,
  needsConsent = false,
  onFirmarConsentimiento,
  consentDeadline,
}) => {
  const area = lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] || "Clínica";
  const color = getAreaColor(area);
  const name = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Convocatoria";
  const shortName = name.split(" - ")[0].trim() || name;

  // Fecha compacta y editorial: "4 jun" en vez de "04/06/2026".
  // Se formatea sobre la salida de formatDate (dd/mm/yyyy) para evitar
  // corrimientos de zona horaria al reparsear ISO.
  const MESES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const fmtShort = (raw?: unknown) => {
    if (!raw) return "";
    const f = formatDate(raw as string);
    const m = /^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/.exec(f);
    if (!m) return f;
    return `${parseInt(m[1], 10)} ${MESES[parseInt(m[2], 10) - 1] ?? ""}`.trim();
  };
  const hasInscripcionFechas = !!(
    lanzamiento[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS] &&
    lanzamiento[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]
  );
  const start = fmtShort(
    hasInscripcionFechas
      ? lanzamiento[FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS]
      : lanzamiento[FIELD_FECHA_INICIO_LANZAMIENTOS]
  );
  const end = fmtShort(
    hasInscripcionFechas
      ? lanzamiento[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]
      : lanzamiento[FIELD_FECHA_FIN_LANZAMIENTOS]
  );

  // Meta editorial (mayúsculas): "80 HS · 2 CUPOS"
  const horas = lanzamiento.horas_acreditadas;
  const cupos = lanzamiento.cupos_disponibles;
  const metaParts: string[] = [];
  if (horas) metaParts.push(`${horas} HS`);
  if (cupos) metaParts.push(`${cupos} ${cupos === 1 ? "CUPO" : "CUPOS"}`);
  const meta = metaParts.join(" · ");

  const enrollmentStatus = enrollment
    ? normalizeStringForComparison(enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
    : null;
  const isEnrolled = !!enrollment;
  const isSelected =
    enrollmentStatus === "seleccionado" ||
    enrollmentStatus === "adjudicado" ||
    enrollmentStatus === "en curso";

  return (
    <div
      className={"cc" + (needsConsent ? " cc--consent" : "")}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      style={onOpen ? { cursor: "pointer" } : undefined}
    >
      <div className="cc__top">
        <span className="cc__area" style={{ color }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: color,
              display: "inline-block",
            }}
          />
          {area}
        </span>
        <span
          className="cc__status"
          style={
            isSelected || needsConsent
              ? { color: "var(--accent, #3CB88D)", fontWeight: 600 }
              : undefined
          }
        >
          {needsConsent
            ? "Seleccionado/a"
            : isSelected
              ? "Seleccionado"
              : isEnrolled && !isOpen
                ? "Inscripto"
                : isOpen
                  ? "Abierta"
                  : "Cerrada"}
        </span>
      </div>

      <div className="cc__name">{shortName}</div>

      {start && end ? (
        <div className="cc__when">
          <Icon name="cal" size={12} color="var(--ink-subtle)" />
          <span>
            {start}
            <span className="cc__arrow">→</span>
            {end}
          </span>
        </div>
      ) : null}

      {needsConsent ? (
        <>
          <div className="cc__consent">
            <span className="material-icons" aria-hidden>
              draw
            </span>
            <span>
              Firmá el compromiso digital para confirmar tu lugar
              {consentDeadline ? (
                <>
                  {" "}
                  · <b>hasta el {consentDeadline}</b>
                </>
              ) : (
                "."
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptics.success();
              onFirmarConsentimiento?.();
            }}
            className="cc__cta cc__cta--block"
            style={{ background: color }}
          >
            Firmar consentimiento
            <Icon name="arrow" size={15} strokeWidth={2.4} />
          </button>
        </>
      ) : (
        <div className="cc__foot">
          <span className="mono cc__meta">{meta || area}</span>
          {isOpen ? (
            isEnrolled ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelarInscripcion?.();
                }}
                className="cc__cta"
                style={{ background: "var(--bg-sunken)", color: "var(--ink-soft)" }}
              >
                {isSelected ? "Inscripto" : "Cancelar"}
                <Icon name="arrow" size={15} strokeWidth={2.4} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  haptics.tap();
                  (onInscribirse ?? onOpen)?.();
                }}
                className="cc__cta"
                style={{ background: color }}
              >
                Inscribirme
                <Icon name="arrow" size={15} strokeWidth={2.4} />
              </button>
            )
          ) : (
            // Cerrada: cualquiera (inscripto, seleccionado o externo) puede ver la
            // lista de convocados. La firma del consentimiento vive en el banner del Home.
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVerConvocados?.();
              }}
              className="cc__cta"
              style={{
                background: "transparent",
                color: "var(--ink-soft)",
                border: "1px solid var(--line-strong)",
                boxShadow: "none",
              }}
            >
              Ver convocados
              <Icon name="arrow" size={15} strokeWidth={2.4} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentConvCard;
