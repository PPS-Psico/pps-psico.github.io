/**
 * LaunchHistoryList — Historial de lanzamientos en el sistema Paper & Ink.
 * Reemplaza el antiguo renderLaunchItem + listas embebidas (Tailwind) de
 * LanzadorConvocatorias. Es presentacional: las acciones llegan por props.
 */
import React, { useEffect, useState } from "react";
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_PUBLICACION_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
} from "../../../constants";
import type { LanzamientoPPS } from "../../../types";
import { formatDate, normalizeStringForComparison } from "../../../utils/formatters";

/** Cuenta regresiva para lanzamientos programados. */
const LaunchCountdown: React.FC<{ targetDate: string }> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) return setTimeLeft("Procesando…");
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      setTimeLeft(parts.length ? parts.join(" ") : "< 1m");
    };
    calc();
    const timer = setInterval(calc, 60000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <span
      className="mono"
      style={{
        fontSize: 10.5,
        padding: "2px 7px",
        borderRadius: 5,
        background: "var(--accent-soft)",
        color: "var(--accent)",
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span className="material-icons" style={{ fontSize: 12 }}>
        timer
      </span>
      {timeLeft}
    </span>
  );
};

interface LaunchRowProps {
  launch: LanzamientoPPS;
  copiedLaunchId: string | null;
  onEdit: (launch: LanzamientoPPS) => void;
  onViewInscriptos: (id: string) => void;
  onStatusAction: (id: string, action: "cerrar" | "abrir" | "ocultar") => void;
  onCopyWhatsApp: (launch: LanzamientoPPS) => void;
  onDelete: (id: string) => void;
}

const LaunchRow: React.FC<LaunchRowProps> = ({
  launch,
  copiedLaunchId,
  onEdit,
  onViewInscriptos,
  onStatusAction,
  onCopyWhatsApp,
  onDelete,
}) => {
  const statusRaw = normalizeStringForComparison(launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
  const isAbierta = statusRaw === "abierta" || statusRaw === "abierto";
  const isOculta = statusRaw === "oculto";
  const isProgramada = statusRaw === "programada" || statusRaw === "programado";
  const pubDate = launch[FIELD_FECHA_PUBLICACION_LANZAMIENTOS] as string;

  const dataState = isAbierta ? "abierta" : isProgramada ? "seleccionada" : "archivada";
  const stateLabel = (launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] as string) || "—";

  const iconBtn = (icon: string, title: string, onClick: () => void) => (
    <button type="button" className="btn btn-ghost btn-sm" title={title} onClick={onClick}>
      <span className="material-icons" style={{ fontSize: 18 }}>
        {icon}
      </span>
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        border: "1px solid var(--rule-2)",
        borderRadius: 10,
        background: "var(--paper)",
        flexWrap: "wrap",
        opacity: isOculta ? 0.7 : 1,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Sin nombre"}
          </span>
          <span className="chip-status" data-state={dataState}>
            <span className={`dot dot-state-${dataState}`} />
            {stateLabel}
          </span>
          {isProgramada && pubDate && <LaunchCountdown targetDate={pubDate} />}
        </div>
        <div className="meta">
          {isProgramada
            ? `Publicación: ${formatDate(pubDate)}`
            : `Inicio: ${formatDate((launch[FIELD_FECHA_INICIO_LANZAMIENTOS] as string) || "")}`}
          {" · "}
          {(launch[FIELD_ORIENTACION_LANZAMIENTOS] as string) || "Sin orientación"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        {iconBtn("edit", "Editar", () => onEdit(launch))}
        {iconBtn("group", "Ver inscriptos", () => onViewInscriptos(launch.id))}
        {isOculta
          ? iconBtn("visibility", "Hacer visible", () => onStatusAction(launch.id, "cerrar"))
          : isAbierta || isProgramada
            ? iconBtn(isProgramada ? "event_busy" : "lock", "Cerrar/cancelar", () =>
                onStatusAction(launch.id, "cerrar")
              )
            : iconBtn("lock_open", "Reabrir", () => onStatusAction(launch.id, "abrir"))}
        {(isAbierta || isProgramada) && (
          <button type="button" className="btn btn-sm" onClick={() => onCopyWhatsApp(launch)}>
            <span className="material-icons" style={{ fontSize: 14 }}>
              {copiedLaunchId === launch.id ? "done_all" : "content_copy"}
            </span>
            {copiedLaunchId === launch.id ? "Copiado" : "WhatsApp"}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title="Eliminar"
          onClick={() => onDelete(launch.id)}
          style={{ color: "var(--crit)" }}
        >
          <span className="material-icons" style={{ fontSize: 18 }}>
            delete_forever
          </span>
        </button>
      </div>
    </div>
  );
};

interface LaunchHistoryListProps {
  scheduled: LanzamientoPPS[];
  visible: LanzamientoPPS[];
  hidden: LanzamientoPPS[];
  copiedLaunchId: string | null;
  onEdit: (launch: LanzamientoPPS) => void;
  onViewInscriptos: (id: string) => void;
  onStatusAction: (id: string, action: "cerrar" | "abrir" | "ocultar") => void;
  onCopyWhatsApp: (launch: LanzamientoPPS) => void;
  onDelete: (id: string) => void;
}

const SectionTitle: React.FC<{ icon: string; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <div
    className="label"
    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}
  >
    <span className="material-icons" style={{ fontSize: 15 }}>
      {icon}
    </span>
    {children}
  </div>
);

export const LaunchHistoryList: React.FC<LaunchHistoryListProps> = ({
  scheduled,
  visible,
  hidden,
  copiedLaunchId,
  ...handlers
}) => {
  const [showHidden, setShowHidden] = useState(false);

  const renderRow = (launch: LanzamientoPPS) => (
    <LaunchRow key={launch.id} launch={launch} copiedLaunchId={copiedLaunchId} {...handlers} />
  );

  return (
    <div
      style={{ maxWidth: 880, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}
    >
      {scheduled.length > 0 && (
        <div>
          <SectionTitle icon="schedule_send">Lanzamientos programados</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scheduled.map(renderRow)}
          </div>
        </div>
      )}

      <div>
        <SectionTitle icon="rocket_launch">Convocatorias activas</SectionTitle>
        {visible.length === 0 ? (
          <div className="lf-info-box" style={{ textAlign: "center", padding: "32px 16px" }}>
            <span className="material-icons" style={{ fontSize: 32, color: "var(--ink-4)" }}>
              history_edu
            </span>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>
              No hay convocatorias activas
            </div>
            <div className="meta" style={{ marginTop: 2 }}>
              Creá un nuevo lanzamiento.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visible.map(renderRow)}
          </div>
        )}
      </div>

      {hidden.length > 0 && (
        <div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowHidden((s) => !s)}
            style={{ marginBottom: 12 }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>
              {showHidden ? "expand_less" : "expand_more"}
            </span>
            Ocultas / archivadas ({hidden.length})
          </button>
          {showHidden && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {hidden.map(renderRow)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LaunchHistoryList;
