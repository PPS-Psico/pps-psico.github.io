import React from "react";
import { LanzamientoPPS } from "../../../types";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_PUBLICACION_LANZAMIENTOS,
  FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
} from "../../../constants";
import { formatDate, normalizeStringForComparison } from "../../../utils/formatters";
import EmptyState from "../../EmptyState";
import Loader from "../../Loader";

interface LaunchHistoryProps {
  launches: LanzamientoPPS[];
  isLoading: boolean;
  onEdit: (launch: LanzamientoPPS) => void;
  onStatusChange: (id: string, action: "cerrar" | "abrir" | "ocultar") => void;
  onDelete: (id: string) => void;
  onCopyWhatsApp: (message: string) => void;
  isCopied: boolean;
}

const LaunchCountdown: React.FC<{ targetDate: string }> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = React.useState<string>("");

  React.useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("Procesando...");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (parts.length === 0) parts.push("< 1m");

      setTimeLeft(parts.join(" "));
    };

    calculateTime();
    const timer = setInterval(calculateTime, 60000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
      <span className="material-icons !text-xs animate-pulse">timer</span>
      <span className="text-[10px] font-black tracking-tight">{timeLeft}</span>
    </div>
  );
};

export const LaunchHistory: React.FC<LaunchHistoryProps> = ({
  launches,
  isLoading,
  onEdit,
  onStatusChange,
  onDelete,
  onCopyWhatsApp,
  isCopied,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader />
      </div>
    );
  }

  if (!launches || launches.length === 0) {
    return (
      <EmptyState
        icon="history"
        title="Sin lanzamientos"
        message="No hay convocatorias previas registradas."
      />
    );
  }

  return (
    <div className="space-y-4">
      {launches.map((launch) => {
        const statusRaw = normalizeStringForComparison(
          launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]
        );
        const isAbierta = statusRaw === "abierta" || statusRaw === "abierto";
        const isOculta = statusRaw === "oculto";
        const isProgramada = statusRaw === "programada" || statusRaw === "programado";
        const pubDate = launch[FIELD_FECHA_PUBLICACION_LANZAMIENTOS] as string;
        const mensajeWhatsApp = launch[FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS] as string;

        return (
          <div
            key={launch.id}
            className={`bg-white dark:bg-slate-800/50 p-4 rounded-xl border transition-all hover:shadow-md ${
              isAbierta
                ? "border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-100 dark:ring-emerald-900/30"
                : isProgramada
                  ? "border-indigo-300 dark:border-indigo-800 ring-1 ring-indigo-50 dark:ring-indigo-900/20"
                  : isOculta
                    ? "border-slate-200 dark:border-slate-700 opacity-75"
                    : "border-slate-200 dark:border-slate-700"
            } flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}
          >
            <div className="flex-1">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100">
                  {launch[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                </h4>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                      isAbierta
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isProgramada
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : isOculta
                            ? "bg-slate-100 text-slate-500 border-slate-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]}
                  </span>
                  {isProgramada && pubDate && <LaunchCountdown targetDate={pubDate} />}
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isProgramada
                  ? `Publicación: ${formatDate(pubDate)}`
                  : `Inicio: ${formatDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS] || "")}`}{" "}
                &bull; Orientación: {launch[FIELD_ORIENTACION_LANZAMIENTOS]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(launch)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Editar"
              >
                <span className="material-icons !text-xl">edit</span>
              </button>
              {isOculta ? (
                <button
                  onClick={() => onStatusChange(launch.id, "cerrar")}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Hacer Visible (Cerrada)"
                >
                  <span className="material-icons !text-xl">visibility</span>
                </button>
              ) : isAbierta || isProgramada ? (
                <button
                  onClick={() => onStatusChange(launch.id, "cerrar")}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Cerrar/Cancelar"
                >
                  <span className="material-icons !text-xl">
                    {isProgramada ? "event_busy" : "lock"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => onStatusChange(launch.id, "abrir")}
                  className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="Reabrir Convocatoria"
                >
                  <span className="material-icons !text-xl">lock_open</span>
                </button>
              )}
              {isProgramada && mensajeWhatsApp && (
                <button
                  onClick={() => onCopyWhatsApp(mensajeWhatsApp || "")}
                  className={`hover-lift flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                    isCopied
                      ? "bg-emerald-500 text-white shadow-emerald-500/20"
                      : "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400"
                  }`}
                >
                  <span className="material-icons !text-lg">
                    {isCopied ? "done_all" : "content_copy"}
                  </span>
                  {isCopied ? "Copiado!" : "Copiar mensaje WhatsApp"}
                </button>
              )}
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Estás seguro de eliminar este lanzamiento? Esto no se puede deshacer y podría afectar a los estudiantes inscriptos."
                    )
                  ) {
                    onDelete(launch.id);
                  }
                }}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Eliminar Registro Permanentemente"
              >
                <span className="material-icons !text-xl">delete_forever</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LaunchHistory;
