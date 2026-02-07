import React, { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import EmptyState from "../EmptyState";
import type { SolicitudPPS, CriteriosCalculados, FinalizacionPPS, InformeTask } from "../../types";
import FinalizationStatusCard from "./FinalizationStatusCard";
import {
  FIELD_ESTADO_FINALIZACION,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_ESTADO_PPS,
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_ULTIMA_ACTUALIZACION_PPS,
} from "../../constants";
import { normalizeStringForComparison, getStatusVisuals, formatDate } from "../../utils/formatters";
import AcreditacionPreflightModal from "../AcreditacionPreflightModal";

interface SolicitudesListProps {
  solicitudes: SolicitudPPS[];
  onCreateSolicitud?: () => void;
  onRequestFinalization?: () => void;
  criterios?: CriteriosCalculados;
  finalizacionRequest?: FinalizacionPPS | null;
  informeTasks?: InformeTask[];
}

// 3D Tilt Card Component for SolicitudItem
const TiltCard: React.FC<{
  children: React.ReactNode;
  colorScheme: string;
}> = ({ children, colorScheme }) => {
  return (
    <motion.div
      whileHover={{
        y: -2,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative group rounded-2xl p-4 transition-all duration-300"
    >
      {children}
    </motion.div>
  );
};

// Ripple Effect Component
const RippleEffect: React.FC<{ color: string }> = ({ color }) => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  };

  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl" onClick={handleClick}>
      {ripples.map((ripple) => (
        <motion.div
          key={ripple.id}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`absolute rounded-full ${color}`}
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
          }}
        />
      ))}
    </div>
  );
};

const SolicitudItem: React.FC<{ solicitud: SolicitudPPS; index?: number }> = ({
  solicitud,
  index = 0,
}) => {
  const institucion = solicitud[FIELD_EMPRESA_PPS_SOLICITUD] || "";
  const status = solicitud[FIELD_ESTADO_PPS] || "Pendiente";
  const actualizacion = solicitud[FIELD_ULTIMA_ACTUALIZACION_PPS];
  const visuals = getStatusVisuals(status);

  // Get color scheme for shadows
  const getColorScheme = () => {
    const statusLower = normalizeStringForComparison(status);
    if (statusLower.includes("aprob") || statusLower.includes("complet")) return "emerald";
    if (statusLower.includes("pend")) return "amber";
    if (statusLower.includes("rechaz") || statusLower.includes("cancel")) return "rose";
    return "blue";
  };

  const colorScheme = getColorScheme();

  // Determine ripple color
  const getRippleColor = () => {
    if (colorScheme === "emerald") return "bg-emerald-400/30";
    if (colorScheme === "amber") return "bg-amber-400/30";
    if (colorScheme === "rose") return "bg-rose-400/30";
    return "bg-blue-400/30";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <TiltCard colorScheme={colorScheme}>
        <div className="relative bg-white dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
          <RippleEffect color={getRippleColor()} />

          <div className="relative z-10 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
            <div className="flex items-start gap-4">
              {/* Icon Box with Pulse Animation */}
              <div className="relative">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${visuals.iconContainerClass} bg-opacity-20 dark:bg-opacity-10`}
                >
                  <span
                    className={`material-icons !text-2xl ${visuals.accentBg.replace("bg-", "text-")}`}
                  >
                    {visuals.icon}
                  </span>
                </motion.div>

                {/* Pulse animation for active statuses */}
                {!normalizeStringForComparison(status).includes("final") &&
                  !normalizeStringForComparison(status).includes("complet") && (
                    <motion.div
                      className={`absolute inset-0 rounded-xl ${visuals.accentBg} opacity-20`}
                      animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  )}
              </div>

              <div className="flex-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">
                  {institucion || "Institución sin nombre"}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${visuals.labelClass}`}
                  >
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-current"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                    {status}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-icons !text-[10px]">update</span>
                    {formatDate(actualizacion)}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow indicator */}
            <motion.div
              initial={{ x: -5, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="hidden sm:flex items-center"
            >
              <motion.span
                className="material-icons text-slate-300 dark:text-slate-600"
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                chevron_right
              </motion.span>
            </motion.div>
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
};

const PremiumActionButton: React.FC<{
  icon: string;
  title: string;
  description: string;
  onClick?: () => void;
  colorScheme: "blue" | "teal" | "slate";
  className?: string;
}> = ({ icon, title, description, onClick, colorScheme, className = "" }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const colors = {
    blue: {
      gradient:
        "from-blue-500/[0.03] via-indigo-500/[0.03] to-purple-500/[0.03] dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-purple-500/10",
      border: "border-blue-200 dark:border-blue-800",
      text: "text-blue-900 dark:text-blue-100",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      shadow: "shadow-blue-500/20",
      shimmer: "from-transparent via-white/40 to-transparent",
    },
    teal: {
      gradient:
        "from-teal-500/[0.03] via-emerald-500/[0.03] to-green-500/[0.03] dark:from-teal-500/10 dark:via-emerald-500/10 dark:to-green-500/10",
      border: "border-teal-200 dark:border-teal-800",
      text: "text-teal-900 dark:text-teal-100",
      iconBg: "bg-gradient-to-br from-teal-500 to-emerald-600",
      shadow: "shadow-teal-500/20",
      shimmer: "from-transparent via-white/40 to-transparent",
    },
    slate: {
      gradient:
        "from-slate-300/[0.4] via-slate-400/[0.3] to-slate-500/[0.2] dark:from-slate-500/10 dark:via-slate-600/10 dark:to-slate-700/10",
      border: "border-slate-300 dark:border-slate-700",
      text: "text-slate-700 dark:text-slate-300",
      iconBg: "bg-gradient-to-br from-slate-500 to-slate-600",
      shadow: "shadow-slate-500/20",
      shimmer: "from-transparent via-white/30 to-transparent",
    },
  };

  const theme = colors[colorScheme];

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative w-full flex items-center gap-4 p-5 rounded-2xl 
        bg-gradient-to-r ${theme.gradient}
        border-2 ${theme.border}
        ${theme.text}
        hover:shadow-xl ${theme.shadow} cursor-pointer active:scale-95
        transition-all duration-300 text-left overflow-hidden group touch-manipulation
        ${className}
      `}
    >
      {/* Shimmer effect */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${theme.shimmer} -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out`}
      />

      {/* Icon with gradient background */}
      <motion.div
        whileHover={{ rotate: 10, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className={`relative p-3 rounded-xl ${theme.iconBg} shadow-lg`}
      >
        <span className="material-icons !text-2xl text-white relative z-10">{icon}</span>

        {/* Icon glow */}
        <div className={`absolute inset-0 rounded-xl ${theme.iconBg} blur-lg opacity-50`} />
      </motion.div>

      <div className="relative z-10 flex-1">
        <h4 className="font-bold text-sm">{title}</h4>
        <p className="text-xs opacity-80 mt-0.5">{description}</p>
      </div>

      {/* Animated arrow - Desktop only */}
      <motion.div
        className="hidden md:block relative z-10"
        initial={{ x: 0 }}
        whileHover={{ x: 5 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <motion.span
          className="material-icons text-xl"
          animate={{ x: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          arrow_forward
        </motion.span>
      </motion.div>
    </motion.button>
  );
};

const SolicitudesList: React.FC<SolicitudesListProps> = ({
  solicitudes,
  onCreateSolicitud,
  onRequestFinalization,
  criterios,
  finalizacionRequest,
  informeTasks = [],
}) => {
  const [showPreflightModal, setShowPreflightModal] = useState(false);

  const hasPendingCorrections = useMemo(
    () =>
      informeTasks.some(
        (t) =>
          t.informeSubido && (t.nota === "Sin calificar" || t.nota === "Entregado (sin corregir)")
      ),
    [informeTasks]
  );

  const isAccreditationReady = criterios
    ? criterios.cumpleHorasTotales &&
      criterios.cumpleRotacion &&
      criterios.cumpleHorasOrientacion &&
      !criterios.tienePracticasPendientes &&
      !hasPendingCorrections
    : false;

  const { activeRequests, historyRequests } = useMemo(() => {
    const active: SolicitudPPS[] = [];
    const history: SolicitudPPS[] = [];
    const finishedStatuses = [
      "finalizada",
      "cancelada",
      "rechazada",
      "no se pudo concretar",
      "pps realizada",
      "solicitud invalida",
      "realizada",
    ];
    const hiddenStatuses = ["archivado"];

    solicitudes.forEach((sol) => {
      const status = normalizeStringForComparison(sol[FIELD_ESTADO_PPS]);
      if (hiddenStatuses.includes(status)) return;
      if (finishedStatuses.some((s) => status.includes(s))) {
        history.push(sol);
      } else {
        active.push(sol);
      }
    });
    return { activeRequests: active, historyRequests: history };
  }, [solicitudes]);

  const handleAccreditationClick = () => {
    if (!onRequestFinalization) return;
    setShowPreflightModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      {finalizacionRequest && (
        <FinalizationStatusCard
          status={finalizacionRequest[FIELD_ESTADO_FINALIZACION] || "Pendiente"}
          requestDate={
            finalizacionRequest[FIELD_FECHA_SOLICITUD_FINALIZACION] ||
            finalizacionRequest.created_at ||
            ""
          }
        />
      )}

      {/* Action Buttons */}
      {!finalizacionRequest && (onCreateSolicitud || onRequestFinalization) && (
        <div className="grid grid-cols-1 gap-4 mb-2">
          {onCreateSolicitud && (
            <PremiumActionButton
              icon="add_business"
              title="Nueva Solicitud de PPS"
              description="Inicia un trámite de autogestión"
              onClick={onCreateSolicitud}
              colorScheme="blue"
            />
          )}

          {onRequestFinalization && (
            <div className="md:hidden">
              <PremiumActionButton
                icon={isAccreditationReady ? "verified" : "lock_clock"}
                title="Trámite de Acreditación"
                description={
                  isAccreditationReady
                    ? "Requisitos cumplidos. Iniciar cierre"
                    : "Faltan requisitos. Toca para ver detalles"
                }
                onClick={handleAccreditationClick}
                colorScheme={isAccreditationReady ? "teal" : "slate"}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {criterios && (
        <AcreditacionPreflightModal
          isOpen={showPreflightModal}
          onClose={() => setShowPreflightModal(false)}
          onConfirm={() => {
            if (onRequestFinalization) onRequestFinalization();
            setShowPreflightModal(false);
          }}
          criterios={criterios}
          informeTask={informeTasks[0]}
        />
      )}

      {/* Active List */}
      {activeRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
            Gestiones en Curso ({activeRequests.length})
          </h3>
          <div className="flex flex-col gap-4">
            {activeRequests.map((sol, index) => (
              <SolicitudItem key={sol.id} solicitud={sol} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* History List */}
      {historyRequests.length > 0 && (
        <details className="group pt-4 border-t border-slate-200 dark:border-slate-800">
          <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-2">
            <motion.span
              className="material-icons transition-transform group-open:rotate-90 text-slate-400 !text-lg"
              initial={false}
            >
              history
            </motion.span>
            Ver Historial ({historyRequests.length})
          </summary>
          <div className="mt-3 flex flex-col gap-4 pl-2 border-l-2 border-slate-100 dark:border-slate-800">
            {historyRequests.map((sol, index) => (
              <SolicitudItem key={sol.id} solicitud={sol} index={index} />
            ))}
          </div>
        </details>
      )}

      {/* Empty State */}
      {activeRequests.length === 0 && historyRequests.length === 0 && !finalizacionRequest && (
        <EmptyState
          type="no-solicitudes"
          title="Sin Solicitudes"
          message="No tienes trámites de PPS registrados actualmente."
          className="mt-8"
          size="md"
        />
      )}
    </div>
  );
};

export default React.memo(SolicitudesList);
