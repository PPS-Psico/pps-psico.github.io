import React, { useMemo, useCallback } from "react";
import type { LanzamientoPPS } from "../types";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
} from "../constants";
import {
  getEspecialidadClasses,
  getStatusVisuals,
  normalizeStringForComparison,
  cleanInstitutionName,
} from "../utils/formatters";
import { useModal } from "../contexts/ModalContext";

interface ConvocatoriaCardProps {
  lanzamiento: LanzamientoPPS;
  onInscribir: (lanzamiento: LanzamientoPPS) => void;
  onVerSeleccionados: (lanzamiento: LanzamientoPPS) => void;
  enrollmentStatus: string | null;
  isVerSeleccionadosLoading: boolean;
  isCompleted: boolean;
  userGender?: "Varon" | "Mujer" | "Otro";
  direccion?: string;
}

type StatusInfo = {
  text: string;
  icon: string;
  style: string;
  hover: string;
};

type ConvocatoriaState = "abierta" | "cerrada" | "unknown";
type EnrollmentState = "seleccionado" | "inscripto" | "no_seleccionado" | "none";

const ConvocatoriaCard: React.FC<ConvocatoriaCardProps> = ({
  lanzamiento,
  onInscribir,
  onVerSeleccionados,
  enrollmentStatus,
  isVerSeleccionadosLoading,
  isCompleted,
  userGender,
  direccion,
}) => {
  const { isSubmittingEnrollment, selectedLanzamientoForEnrollment } = useModal();
  const isEnrolling =
    isSubmittingEnrollment && selectedLanzamientoForEnrollment?.id === lanzamiento.id;

  const {
    [FIELD_NOMBRE_PPS_LANZAMIENTOS]: rawNombre,
    [FIELD_ORIENTACION_LANZAMIENTOS]: orientacion,
    [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: estadoConvocatoria,
  } = lanzamiento;

  // CLEAN NAME
  const nombre = cleanInstitutionName(rawNombre);

  // Calculate if new (created in last 7 days)
  const isNew = useMemo(() => {
    // FIX: Property 'createdTime' does not exist on type 'LanzamientoPPS'. Using 'created_at'.
    if (!lanzamiento.created_at) return false;
    const created = new Date(lanzamiento.created_at);
    const diffTime = Math.abs(Date.now() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
    // FIX: Use 'created_at' in the dependency array.
  }, [lanzamiento.created_at]);

  const convocatoriaState = useMemo((): ConvocatoriaState => {
    const normalized = normalizeStringForComparison(estadoConvocatoria);
    if (normalized === "abierta" || normalized === "abierto") return "abierta";
    if (normalized === "cerrado") return "cerrada";
    return "unknown";
  }, [estadoConvocatoria]);

  const enrollmentState = useMemo((): EnrollmentState => {
    if (!enrollmentStatus) return "none";
    const normalized = normalizeStringForComparison(enrollmentStatus);

    if (normalized.includes("no seleccionado")) return "no_seleccionado";
    if (normalized.includes("seleccionado")) return "seleccionado";
    if (normalized.includes("inscripto")) {
      if (convocatoriaState === "cerrada") {
        return "no_seleccionado";
      }
      return "inscripto";
    }
    return "none";
  }, [enrollmentStatus, convocatoriaState]);

  const visualStyles = useMemo(() => getEspecialidadClasses(orientacion), [orientacion]);
  const convocatoriaStatusVisuals = useMemo(
    () => getStatusVisuals(estadoConvocatoria),
    [estadoConvocatoria]
  );

  const getGenderedText = useCallback(
    (masculino: string, femenino: string): string => {
      return userGender === "Mujer" ? femenino : masculino;
    },
    [userGender]
  );

  const statusInfo = useMemo((): StatusInfo => {
    if (enrollmentState !== "none") {
      const statusMap: Record<Exclude<EnrollmentState, "none">, StatusInfo> = {
        seleccionado: {
          text: getGenderedText("Seleccionado", "Seleccionada"),
          icon: "verified",
          // Emerald Premium
          style:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500 dark:text-white dark:border-transparent shadow-sm dark:shadow-emerald-500/20",
          hover: "hover:bg-emerald-100 dark:hover:bg-emerald-600 hover:border-emerald-300",
        },
        inscripto: {
          text: "Inscripción Enviada",
          icon: "mark_email_read",
          // Indigo Professional
          style:
            "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800 shadow-none",
          hover: "hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:border-indigo-300",
        },
        no_seleccionado: {
          text: `No ${getGenderedText("seleccionado", "seleccionada")}`,
          icon: "cancel",
          // Rose Premium
          style:
            "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800",
          hover: "hover:bg-rose-100 dark:hover:bg-rose-900/60 hover:border-rose-300",
        },
      };
      return statusMap[enrollmentState];
    }

    // Si está cerrada (Ver Resultados / Ver Convocados)
    if (convocatoriaState === "cerrada") {
      return {
        text: "Ver Convocados",
        icon: "groups",
        // White/Indigo Premium theme (Replaced grey/faded violet)
        style:
          "bg-white text-indigo-600 border-indigo-200 dark:bg-slate-900 dark:text-indigo-400 dark:border-indigo-800 shadow-sm",
        hover:
          "hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:border-indigo-300 dark:hover:border-indigo-700",
      };
    }

    return {
      text: "Ver Seleccionados",
      icon: convocatoriaStatusVisuals.icon,
      style:
        "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
      hover: "",
    };
  }, [
    enrollmentState,
    estadoConvocatoria,
    convocatoriaStatusVisuals,
    getGenderedText,
    convocatoriaState,
  ]);

  const LoadingSpinner: React.FC<{ variant?: "light" | "dark" }> = ({ variant = "light" }) => (
    <div
      className={`border-2 rounded-full w-4 h-4 animate-spin ${
        variant === "light"
          ? "border-white/50 border-t-white"
          : "border-current/50 border-t-current"
      }`}
    />
  );

  // --- BOTONES UNIFICADOS ---
  // Dimensiones idénticas para todos los botones: h-12 (48px) y min-width aumentado a 240px para consistencia visual
  const baseButtonClasses =
    "w-full sm:w-auto h-12 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 shadow-sm border select-none min-w-[240px]";

  const InscribirButton: React.FC = () => (
    <button
      onClick={() => onInscribir(lanzamiento)}
      disabled={isEnrolling}
      className={`${baseButtonClasses} border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:scale-95 active:translate-y-0`}
    >
      {isEnrolling ? (
        <LoadingSpinner variant="light" />
      ) : (
        <span className="material-icons !text-lg">rocket_launch</span>
      )}
      <span>POSTULARME</span>
    </button>
  );

  const CompletedButton: React.FC = () => (
    <button
      disabled
      className={`${baseButtonClasses} bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed`}
    >
      <span className="material-icons !text-lg">history</span>
      <span>Ya Cursada</span>
    </button>
  );

  // Botón dinámico para estados (Info/Resultados)
  const InfoButton: React.FC<{ isClickable: boolean }> = ({ isClickable }) => (
    <button
      onClick={() => isClickable && onVerSeleccionados(lanzamiento)}
      disabled={isVerSeleccionadosLoading}
      className={`${baseButtonClasses} ${statusInfo.style} ${isClickable ? `${statusInfo.hover} active:scale-95 active:translate-y-0` : "cursor-default opacity-90"}`}
    >
      {isVerSeleccionadosLoading ? (
        <LoadingSpinner variant="dark" />
      ) : (
        <span className="material-icons !text-lg">{statusInfo.icon}</span>
      )}
      <span>{statusInfo.text}</span>
      {isClickable && !isVerSeleccionadosLoading && (
        <span className="material-icons !text-lg opacity-60 ml-1">arrow_forward</span>
      )}
    </button>
  );

  const ActionButton: React.FC = () => {
    if (isCompleted) return <CompletedButton />;

    // Casos donde el botón lleva a "Ver Convocados" (Lista)
    const canViewList =
      convocatoriaState === "cerrada" ||
      enrollmentState === "seleccionado" ||
      enrollmentState === "no_seleccionado";

    if (canViewList) {
      return <InfoButton isClickable={true} />;
    }

    // Casos solo informativos (Inscripto en convocatoria abierta)
    if (enrollmentState === "inscripto") {
      return <InfoButton isClickable={false} />;
    }

    // Si está abierta y no inscripto -> Postularse
    if (convocatoriaState === "abierta") return <InscribirButton />;

    // Fallback
    return <InfoButton isClickable={false} />;
  };

  return (
    <div className="relative group glass-panel rounded-2xl shadow-sm glass-card-hover overflow-hidden">
      {/* Background Glow Effect */}
      <div
        className={`absolute -right-20 -top-20 w-64 h-64 rounded-full bg-gradient-to-br ${visualStyles.gradient} opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 blur-3xl transition-opacity duration-700 pointer-events-none`}
      />

      {/* Integrated Side Bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${visualStyles.gradient}`}
      ></div>

      <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between p-6 pl-8">
        <div className="flex-1 min-w-0 w-full">
          {/* Title - Fixed to wrap and use smaller font on mobile */}
          <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-tight tracking-tight mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300 break-words hyphens-auto">
            {nombre || "Convocatoria sin nombre"}
          </h3>

          <div className="flex items-center gap-2 mt-1">
            {/* Especialidad Tag (Mini) */}
            <span
              className={`inline-flex items-center text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500`}
            >
              {orientacion}
            </span>
            {direccion && (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 border-l border-slate-300 dark:border-slate-700 pl-2">
                <span className="material-icons !text-[12px]">location_on</span>
                <span className="truncate max-w-[150px]">{direccion}</span>
              </span>
            )}
            {/* New Badge */}
            {isNew && convocatoriaState === "abierta" && enrollmentState === "none" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white shadow-sm animate-pulse">
                NUEVO
              </span>
            )}
          </div>
        </div>

        {/* Action Button Area */}
        <div className="w-full md:w-auto flex-shrink-0 pt-2 md:pt-0 flex items-center justify-start md:justify-end">
          <ActionButton />
        </div>
      </div>
    </div>
  );
};

export default ConvocatoriaCard;
