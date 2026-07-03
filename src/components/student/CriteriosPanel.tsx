import React, { useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import {
  HORAS_OBJETIVO_ORIENTACION,
  HORAS_OBJETIVO_TOTAL,
  ROTACION_OBJETIVO_ORIENTACIONES,
} from "../../constants";
import { haptics } from "../../utils/haptics";
import { RingMeter } from "../ui/RingMeter";
import OrientacionSelector from "../OrientacionSelector";
import type { CriteriosCalculados, Orientacion, InformeTask } from "../../types";
import { CriteriosPanelSkeleton } from "../Skeletons";

interface CriteriosPanelProps {
  criterios: CriteriosCalculados;
  selectedOrientacion: Orientacion | "";
  handleOrientacionChange: (orientacion: Orientacion | "") => void;
  showSaveConfirmation: boolean;
  onRequestFinalization: () => void;
  isLoading?: boolean;
  informeTasks?: InformeTask[];
  /** En mobile la orientación se edita en Perfil; ocultamos el selector acá. */
  showOrientationSelector?: boolean;
}

const CriteriosPanel: React.FC<CriteriosPanelProps> = ({
  criterios,
  selectedOrientacion,
  handleOrientacionChange,
  showSaveConfirmation,
  onRequestFinalization,
  isLoading = false,
  informeTasks = [],
  showOrientationSelector = true,
}) => {
  const hasPendingCorrections = useMemo(
    () =>
      informeTasks.some(
        (t) =>
          t.informeSubido && (t.nota === "Sin calificar" || t.nota === "Entregado (sin corregir)")
      ),
    [informeTasks]
  );

  const todosLosCriteriosCumplidos = useMemo(
    () =>
      criterios.cumpleHorasTotales &&
      criterios.cumpleRotacion &&
      criterios.cumpleHorasOrientacion &&
      !criterios.tienePracticasPendientes &&
      !hasPendingCorrections,
    [criterios, hasPendingCorrections]
  );

  const horasFaltantes = Math.max(0, Math.round(criterios.horasFaltantes250));

  // Celebración: confetti UFLO una sola vez por sesión cuando se cumplen todos
  // los criterios de acreditación. Respeta prefers-reduced-motion (canvas-confetti
  // lo maneja con disableForReducedMotion).
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (!todosLosCriteriosCumplidos || celebratedRef.current) return;
    celebratedRef.current = true;
    try {
      if (window.sessionStorage?.getItem("pps_acreditacion_celebrada") === "1") return;
      window.sessionStorage?.setItem("pps_acreditacion_celebrada", "1");
    } catch {
      /* sessionStorage bloqueado — seguimos y celebramos una vez por montaje */
    }
    confetti({
      particleCount: 90,
      spread: 72,
      startVelocity: 38,
      origin: { y: 0.75 },
      colors: ["#46253D", "#203B73", "#3CB88D", "#20C4A8"],
      scalar: 0.9,
      disableForReducedMotion: true,
    });
    haptics.success();
  }, [todosLosCriteriosCumplidos]);

  if (isLoading) {
    return <CriteriosPanelSkeleton />;
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-8 bg-white dark:bg-[#131829] rounded-3xl border border-slate-200/80 dark:border-slate-800/60 p-5 md:p-8 shadow-sm">
      {/* Background glow effects */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-uflo-teal/5 rounded-full blur-[40px] pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-uflo-navy/5 rounded-full blur-[40px] pointer-events-none" />

      {/* Ring Meter Header */}
      <div className="text-center mb-4">
        <span className="eyebrow text-[11px] tracking-[0.12em] block mb-3 text-slate-400">
          Horas acumuladas
        </span>
        <RingMeter value={criterios.horasTotales} total={HORAS_OBJETIVO_TOTAL} size={172} />
      </div>

      <div className="text-center mb-5">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {horasFaltantes > 0 ? (
            <>
              Te faltan{" "}
              <b className="text-uflo-teal dark:text-[#5EE6B7] font-semibold">
                {horasFaltantes} hs
              </b>{" "}
              para acreditar.
            </>
          ) : (
            <b className="text-uflo-teal dark:text-[#5EE6B7] font-semibold">
              Ya alcanzaste las horas requeridas.
            </b>
          )}
        </span>
      </div>

      {/* Selector de Orientación si no está elegido */}
      {showOrientationSelector && !selectedOrientacion && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Selecciona tu Orientación Principal
          </p>
          <OrientacionSelector
            selectedOrientacion={selectedOrientacion}
            onOrientacionChange={handleOrientacionChange}
            showSaveConfirmation={showSaveConfirmation}
          />
        </div>
      )}

      {/* Inline Stats Grid (hairline separated, no cards) — 2 criterios:
          rotación de áreas y horas en la especialidad. Las horas totales ya
          viven en el ring de arriba; el conteo de prácticas vive en la lista. */}
      <div
        className="inline-stats grid mt-5"
        style={{ gridTemplateColumns: "1fr 1fr", borderBottom: "none", marginBottom: 0 }}
      >
        {/* Rotación */}
        <div className="inline-stat text-center py-4 relative">
          <div className="mono inline-stat__lbl text-[10px] text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1">
            Rotación
          </div>
          <div
            className={
              "inline-stat__val font-display font-extrabold text-2xl md:text-3xl leading-none " +
              (criterios.cumpleRotacion
                ? "text-uflo-teal dark:text-[#5EE6B7]"
                : "text-slate-800 dark:text-slate-200")
            }
          >
            {criterios.orientacionesCursadasCount}
            <span className="text-sm font-medium text-slate-400 dark:text-slate-600">
              /{ROTACION_OBJETIVO_ORIENTACIONES}
            </span>
          </div>
          <div className="mono inline-stat__sub text-[9px] text-slate-400 dark:text-slate-500 tracking-wide uppercase mt-1">
            {criterios.cumpleRotacion ? (
              <span className="text-uflo-teal dark:text-[#5EE6B7]">Completo ✓</span>
            ) : (
              "áreas"
            )}
          </div>
        </div>

        {/* Especialidad — horas en la orientación elegida (objetivo 70) */}
        <div className="inline-stat text-center py-4 relative border-l border-slate-100 dark:border-slate-800/80">
          <div className="mono inline-stat__lbl text-[10px] text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1">
            Orientación
          </div>
          <div
            className={
              "inline-stat__val font-display font-extrabold text-2xl md:text-3xl leading-none " +
              (criterios.cumpleHorasOrientacion
                ? "text-uflo-teal dark:text-[#5EE6B7]"
                : "text-slate-800 dark:text-slate-200")
            }
          >
            {Math.round(criterios.horasOrientacionElegida)}
            <span className="text-sm font-medium text-slate-400 dark:text-slate-600">
              /{HORAS_OBJETIVO_ORIENTACION}
            </span>
          </div>
          <div className="mono inline-stat__sub text-[9px] text-slate-400 dark:text-slate-500 tracking-wide uppercase mt-1">
            {criterios.cumpleHorasOrientacion ? (
              <span className="text-uflo-teal dark:text-[#5EE6B7]">Completo ✓</span>
            ) : (
              selectedOrientacion || "horas"
            )}
          </div>
        </div>
      </div>

      {/* Acreditar — visible cuando se cumplen todos los criterios */}
      {todosLosCriteriosCumplidos && (
        <div className="flex justify-center mt-5 mb-1">
          <button
            onClick={() => {
              haptics.success();
              onRequestFinalization();
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition shadow-sm shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5 leading-none"
          >
            <span className="material-icons text-base">verified</span>
            Acreditar PPS
          </button>
        </div>
      )}

      {/* Mensaje de éxito o selector si la orientación ya existe */}
      {showOrientationSelector && selectedOrientacion && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {todosLosCriteriosCumplidos ? (
            <div className="w-full text-center py-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <span className="material-icons text-base">check_circle</span>
                ¡Todos los criterios de acreditación cumplidos!
              </p>
            </div>
          ) : (
            <div className="text-center w-full">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                <span className="material-icons text-[12px] text-slate-400">info</span>
                Orientación activa:{" "}
                <b className="text-slate-500 dark:text-slate-300 font-semibold">
                  {selectedOrientacion}
                </b>
              </span>
              <div className="mt-2 flex justify-center scale-90 origin-center opacity-70 hover:opacity-100 transition-opacity">
                <OrientacionSelector
                  selectedOrientacion={selectedOrientacion}
                  onOrientacionChange={handleOrientacionChange}
                  showSaveConfirmation={showSaveConfirmation}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(CriteriosPanel);
