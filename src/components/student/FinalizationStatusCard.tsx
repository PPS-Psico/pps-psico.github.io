import React from "react";
import { addBusinessDays, getBusinessDaysCount } from "../../utils/businessDays";
import { formatDate } from "../../utils/formatters";

interface FinalizationStatusCardProps {
  status: string;
  requestDate: string;
  studentName?: string;
}

const FinalizationStatusCard: React.FC<FinalizationStatusCardProps> = ({
  status,
  requestDate,
  studentName,
}) => {
  const startDate = new Date(requestDate);
  // 1. Calculamos la fecha meta real usando el utilitario de días hábiles (salta fines de semana, feriados, enero y receso invernal)
  const targetDate = addBusinessDays(startDate, 14);

  const now = new Date();
  const currentMonth = now.getMonth();
  const dayOfMonth = now.getDate();

  const isJanuary = currentMonth === 0;
  const isWinterBreak =
    (currentMonth === 6 && dayOfMonth >= 21) || (currentMonth === 7 && dayOfMonth <= 1);

  // Estado de Pausa Visual
  const isPaused = isJanuary || isWinterBreak;
  const pauseReason = isJanuary ? "Receso de Verano" : "Receso de Invierno";
  const pauseDescription = isJanuary
    ? "Enero no computa plazos administrativos."
    : "El receso invernal no computa plazos administrativos.";

  // Normalización de estado
  const normalizeString = (str: string) =>
    str
      ?.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim() || "";
  const normalizedStatus = normalizeString(status);
  const isFinished = normalizedStatus === "cargado" || normalizedStatus === "finalizada";
  const isEnProceso = normalizedStatus === "en proceso";

  // 2. Calculamos los días restantes usando el utilitario unificado
  const daysDisplay = getBusinessDaysCount(now, targetDate);

  const totalDuration = targetDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();

  // Barra de progreso visual (basada en tiempo real para fluidez, topeada si está en receso)
  let percentage = Math.min(100, Math.max(5, (elapsed / totalDuration) * 100));

  // Si estamos en receso, congelamos la barra visualmente al 95% o donde haya quedado, para indicar "espera"
  if (isPaused) percentage = Math.min(percentage, 95);

  // Si ya pasó la fecha, lleno total
  if (daysDisplay < 0) percentage = 100;

  const firstName = studentName?.split(" ")[0] || "Estudiante";
  const isOverdue = daysDisplay < 0 && !isFinished && !isPaused;

  const gradientName = (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
      {firstName}
    </span>
  );

  // --- VISTA DE ÉXITO (YA CARGADO) ---
  if (isFinished) {
    return (
      <div className="w-full animate-fade-in-up mb-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800 p-10 sm:p-16 shadow-2xl shadow-emerald-100/50 dark:shadow-none text-center backdrop-blur-xl">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-emerald-100/40 dark:bg-emerald-900/10 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-teal-100/40 dark:bg-teal-900/10 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center gap-8">
            <div className="h-24 w-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-lg animate-bounce-slow text-emerald-500 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
              <span className="material-icons !text-5xl">verified</span>
            </div>

            <div className="space-y-4 max-w-3xl">
              <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-slate-900 dark:text-white drop-shadow-sm leading-tight">
                ¡Todo listo, {gradientName}!
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                Tu acreditación ha sido completada exitosamente. <br className="hidden sm:block" />
                Tus horas de PPS ya se encuentran cargadas en el sistema académico SAC.
              </p>
            </div>

            <div className="mt-6">
              <a
                href="https://alumno.uflo.edu.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all duration-300"
              >
                <span>Verificar en SAC</span>
                <span className="material-icons !text-2xl group-hover:translate-x-1 transition-transform">
                  open_in_new
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- CONFIGURACIÓN DE ESTADOS PENDIENTES ---
  let renderTitle = () => (
    <span className="text-slate-900 dark:text-white">¡Solicitud Recibida!</span>
  );
  let bannerText =
    "Estamos evaluando tu solicitud y validando la documentación presentada. Este proceso es manual y requiere revisión por parte de coordinación.";
  let bannerStatus = "Solicitud Enviada";
  let bannerColorClass =
    "text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800";
  let currentStepIndex = 0;

  if (isEnProceso) {
    renderTitle = () => <>Todo marcha bien, {gradientName}.</>;
    bannerText =
      "Tus documentos fueron validados correctamente y el expediente se encuentra en el circuito de acreditación interna.";
    bannerStatus = "En Proceso";
    bannerColorClass =
      "text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800";
    currentStepIndex = 1;
  }

  const steps = [
    {
      title: "Validación Documental",
      desc: "Revisión de firmas y planillas.",
      icon: "inventory_2",
    },
    {
      title: "Circuito Administrativo",
      desc: "Aprobación final por áreas UFLO.",
      icon: "settings_suggest",
    },
    { title: "Acreditación Final", desc: "Carga definitiva en sistema SAC.", icon: "school" },
  ];

  return (
    <div className="w-full animate-fade-in-up pb-12 space-y-8">
      {/* HERO BANNER */}
      <div className="relative overflow-hidden glass-panel rounded-[3rem] shadow-xl p-8 sm:p-14 mb-8">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-blue-100/30 to-transparent dark:from-blue-900/20 rounded-full blur-[120px] -mr-60 -mt-60 pointer-events-none"></div>
        <div className="relative z-10">
          <div
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6 border shadow-sm ${bannerColorClass}`}
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-current"></span>
            </span>
            {bannerStatus}
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6 tracking-tighter">
            {renderTitle()}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg sm:text-xl leading-relaxed max-w-4xl font-medium">
            {bannerText}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* TIMELINE (IZQUIERDA - ANCHO) - OCULTO EN MOBILE */}
        <div className="hidden lg:flex lg:col-span-8">
          <div className="w-full bg-white/80 dark:bg-[#0F172A]/80 rounded-[3rem] border border-slate-200/80 dark:border-slate-800 p-10 sm:p-12 backdrop-blur-xl h-full flex flex-col shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-20"></div>

            <div className="flex items-center gap-4 mb-8 flex-shrink-0">
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 shadow-sm">
                <span className="material-icons !text-3xl">timeline</span>
              </div>
              <h3 className="font-black text-slate-800 dark:text-white text-2xl tracking-tight">
                Etapas del Proceso
              </h3>
            </div>

            {/* Contenedor flexible para distribuir el espacio verticalmente */}
            <div className="flex-grow flex flex-col justify-between pl-4 py-4 relative">
              {/* Línea de fondo */}
              <div className="absolute left-[30px] top-8 bottom-8 w-1 bg-slate-100 dark:bg-slate-800 -z-10 rounded-full"></div>
              {/* Barra de progreso animada */}
              <div
                className="absolute left-[30px] top-8 w-1 bg-gradient-to-b from-emerald-400 to-blue-500 -z-10 rounded-full transition-all duration-1000"
                style={{ height: `${(currentStepIndex / (steps.length - 1)) * 85}%` }}
              ></div>

              {steps.map((step, idx) => {
                const isCompleted = idx < currentStepIndex;
                const isActive = idx === currentStepIndex;
                const isPending = idx > currentStepIndex;

                return (
                  <div
                    key={idx}
                    className={`relative flex items-center gap-8 ${isPending ? "opacity-50 grayscale" : "opacity-100"}`}
                  >
                    <div
                      className={`flex-shrink-0 w-16 h-16 rounded-full border-[6px] flex items-center justify-center z-10 transition-all duration-500
                                            ${
                                              isCompleted
                                                ? "bg-emerald-500 border-white dark:border-slate-900 text-white shadow-xl shadow-emerald-500/30"
                                                : isActive
                                                  ? "bg-white dark:bg-slate-900 border-blue-500 text-blue-600 shadow-2xl ring-4 ring-blue-100 dark:ring-blue-900/30 scale-110"
                                                  : "bg-slate-100 dark:bg-slate-800 border-white dark:border-slate-900 text-slate-400"
                                            }
                                        `}
                    >
                      <span
                        className={`material-icons !text-2xl ${isActive ? "animate-pulse" : ""}`}
                      >
                        {isCompleted ? "check" : step.icon}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4
                          className={`text-xl font-black tracking-tight ${isActive ? "text-blue-700 dark:text-blue-400" : isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}
                        >
                          {step.title}
                        </h4>
                        {isCompleted && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-black uppercase tracking-widest">
                            OK
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-black uppercase tracking-widest animate-pulse">
                            EN CURSO
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-base font-medium leading-relaxed max-w-md">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SIDEBAR STATUS (DERECHA) */}
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          {/* Tarjeta de Tiempos */}
          <div className="glass-panel rounded-[3rem] shadow-xl overflow-hidden flex flex-col p-10">
            <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest mb-6">
              Tiempo de Resolución
            </h3>

            {isPaused && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-2xl flex items-start gap-3">
                <span className="material-icons text-amber-500 mt-0.5 !text-xl">
                  {isJanuary ? "beach_access" : "ac_unit"}
                </span>
                <div>
                  <p className="text-[10px] font-black text-amber-800 dark:text-amber-200 uppercase mb-1">
                    {pauseReason}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-tight">
                    {pauseDescription}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center justify-center mb-8">
              <span
                className={`text-8xl font-black tracking-tighter leading-none ${daysDisplay < 0 && !isFinished && !isPaused ? "text-rose-500" : isPaused ? "text-amber-500" : "text-slate-900 dark:text-white"}`}
              >
                {isPaused ? "~" : Math.max(0, daysDisplay)}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-3">
                {isPaused ? "En Pausa" : "Días Hábiles"}
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-8 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isPaused ? "bg-amber-400 striped-bar" : daysDisplay < 0 && !isFinished && !isPaused ? "bg-rose-500" : "bg-blue-600"}`}
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-center">
              <div className="flex-1 border-r border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Enviado</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
                  {formatDate(startDate.toISOString())}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Estimado</p>
                <p
                  className={`text-sm font-bold font-mono ${daysDisplay < 0 && !isFinished && !isPaused ? "text-rose-500" : "text-slate-700 dark:text-slate-300"}`}
                >
                  {formatDate(targetDate.toISOString())}
                </p>
              </div>
            </div>
          </div>

          {/* Tarjeta de Soporte - Adaptada a Modo Claro y Oscuro */}
          <div className="glass-panel rounded-[3rem] p-10 shadow-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

            <h3 className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-4">
              Soporte y Consultas
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed font-medium">
              Si el plazo de resolución ya venció y no visualizas tus horas, contacta a
              coordinación.
            </p>

            <a
              href={
                daysDisplay < 0 && !isFinished && !isPaused
                  ? `mailto:blas.rivera@uflouniversidad.edu.ar?subject=Consulta Acreditación - ${firstName}`
                  : undefined
              }
              className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all ${daysDisplay < 0 && !isFinished && !isPaused ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600 cursor-not-allowed"}`}
            >
              <span className="material-icons">
                {daysDisplay < 0 && !isFinished && !isPaused ? "mail" : "lock_clock"}
              </span>
              <span>
                {daysDisplay < 0 && !isFinished && !isPaused
                  ? "Contactar Coordinación"
                  : "Consulta Bloqueada"}
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalizationStatusCard;
