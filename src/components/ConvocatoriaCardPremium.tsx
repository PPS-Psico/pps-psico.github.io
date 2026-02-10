import React, { useState } from "react";
import { getEspecialidadClasses } from "../utils/formatters";

export interface ConvocatoriaDetailProps {
  id: string;
  nombre: string;
  orientacion: string;
  direccion: string;
  descripcion: string;
  actividades: string[];
  actividadesLabel?: string; // New prop
  horasAcreditadas: string;
  horariosCursada: string;
  cupo: string;
  requisitoObligatorio: string;
  reqCv?: boolean; // New prop
  timeline: {
    inscripcion: string;
    inicio: string;
    fin: string;
  };
  logoUrl?: string; // Optional company logo
  status?: string; // 'abierta', 'cerrada', etc.
  estadoInscripcion?: "inscripto" | "seleccionado" | "no_seleccionado" | null;
  onInscribirse?: () => void;
  onVerConvocados?: () => void;
  invertLogo?: boolean;
  horariosFijos?: boolean;
  isCompleted?: boolean; // Prevents enrollment if student already completed this PPS
  fechaEncuentroInicial?: string; // NEW: Fecha de encuentro inicial obligatorio
}

const ConvocatoriaCardPremium: React.FC<ConvocatoriaDetailProps> = ({
  nombre,
  orientacion,
  direccion,
  descripcion,
  actividades,
  actividadesLabel = "Actividades",
  horasAcreditadas,
  horariosCursada,
  cupo,
  requisitoObligatorio,
  reqCv = false,
  timeline,
  status = "abierta",
  estadoInscripcion = null,
  onInscribirse,
  onVerConvocados,
  horariosFijos = false,
  isCompleted = false,
  fechaEncuentroInicial,
}) => {
  // Theme based on orientation - used for tags and accents, but timeline has its own evolution
  const theme = getEspecialidadClasses(orientacion);
  const [isHovered, setIsHovered] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);

  // --- Dynamic Button Logic ---
  const getButtonConfig = () => {
    // Shared base classes for all states to maintain consistent sizing with better mobile support
    const baseClasses =
      "px-4 md:px-6 py-2 md:py-2.5 rounded-xl md:rounded-[14px] font-bold text-[10px] md:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 md:gap-2 transition-all duration-300 min-w-[140px] md:min-w-[190px] relative overflow-hidden h-9 md:h-11 border shadow-sm";

    // PRIORITY 1: If already completed, block enrollment entirely
    if (isCompleted) {
      return {
        text: "YA REALIZADA",
        icon: "check_circle",
        classes: `${baseClasses} bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-80`,
        disabled: true,
      };
    }

    const estadoLower = estadoInscripcion?.toLowerCase();
    const statusLower = status?.toLowerCase();

    // PRIORITY 2: Check if convocatoria is cerrada/cerrado BEFORE checking estadoInscripcion
    // This ensures closed convocatorias show the correct status regardless of student's enrollment state
    if (statusLower === "cerrada" || statusLower === "cerrado") {
      // Student was inscripto but convocatoria is now closed - show "VER RESULTADOS"
      const wasInscripto = estadoLower === "inscripto";
      return {
        text: wasInscripto ? "VER RESULTADOS" : "CERRADA",
        icon: "groups",
        classes: `${baseClasses} bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:border-indigo-400 dark:hover:border-indigo-600 active:scale-95`,
        disabled: false,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onVerConvocados?.();
        },
      };
    }

    if (estadoLower === "seleccionado") {
      return {
        text: "SELECCIONADO",
        icon: "stars",
        classes: `${baseClasses} bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-500 dark:to-teal-500 text-white border-transparent shadow-emerald-500/25 dark:shadow-emerald-900/50 active:scale-95`,
        disabled: false, // Clickable to see convocados or detail
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onVerConvocados?.();
        },
      };
    }

    if (estadoLower === "inscripto") {
      return {
        text: "INSCRIPTO",
        icon: "how_to_reg",
        // Professional teal/slate feel for "pending/sent"
        classes: `${baseClasses} bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700 cursor-default shadow-none`,
        disabled: true,
      };
    }

    if (estadoLower === "no_seleccionado") {
      return {
        text: "CERRADA",
        icon: "groups",
        classes: `${baseClasses} bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:border-indigo-400 dark:hover:border-indigo-600 active:scale-95`,
        disabled: false,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onVerConvocados?.();
        },
      };
    }

    // Default: Abierta y no inscripto - Premium Gradient Button
    return {
      text: "INSCRIBIRSE",
      icon: "arrow_forward",
      classes: `${baseClasses} bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white border-transparent shadow-blue-500/25 dark:shadow-indigo-500/30 active:scale-95 group/btn`,
      content: (
        <>
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer-slide_1.5s_infinite] pointer-events-none" />
          <span className="relative z-10">INSCRIBIRSE</span>
        </>
      ),
      disabled: false,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onInscribirse?.();
      },
    };
  };

  const btnConfig = getButtonConfig();

  // Logic for hiding requirements when CV is not requested
  const showCvMetric = reqCv;

  return (
    <article
      className={`
        w-full relative overflow-hidden flex flex-col
        rounded-[24px]
        bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30
        dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950
        backdrop-blur-xl
        border border-slate-100 dark:border-slate-800/60
        transition-all duration-500 ease-out
        group cursor-pointer
        ${!isExpanded ? "hover:border-slate-200 dark:hover:border-slate-700/50" : ""}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsExpanded(!isExpanded)}
      style={{
        transform: isHovered && !isExpanded ? "translateY(-2px)" : "translateY(0)",
        boxShadow:
          isHovered && !isExpanded
            ? "0 12px 24px -8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)"
            : "0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.01)",
      }}
    >
      {/* Orientation indicator - Subtle colored dot */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
        <div
          className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-gradient-to-br ${theme.gradient} shadow-sm`}
        />
      </div>

      {/* ─── 1. HEADER SECTION (Always Visible) ─── */}
      {/* Mobile: Column layout with title+chevron row and button below */}
      {/* Desktop: Row layout */}
      <div className="pt-6 pb-4 px-4 md:pt-10 md:pb-8 md:px-8 flex flex-col md:flex-row md:items-start justify-between gap-3 md:gap-6 relative z-10 bg-gradient-to-b from-transparent via-transparent to-slate-50/30 dark:to-slate-800/20">
        {/* Brand & Title with Chevron */}
        <div className="flex-1 min-w-0">
          {/* Title row with chevron for mobile */}
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-lg md:text-2xl font-black text-slate-800 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
              {nombre}
            </h2>

            {/* Mobile Chevron - Next to title */}
            <div
              className={`
                md:hidden flex-shrink-0 flex w-8 h-8 rounded-full items-center justify-center
                bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500
                transition-all duration-300
                ${isExpanded ? "rotate-180 bg-blue-50 text-blue-500" : "group-hover:bg-slate-200 dark:group-hover:bg-slate-700"}
              `}
            >
              <span className="material-icons !text-lg">expand_more</span>
            </div>
          </div>

          {/* Desktop: Show orientation tag and address */}
          <div className="hidden md:flex flex-wrap items-center gap-1.5 md:gap-2 mt-1.5 md:mt-2">
            <span
              className={`px-2.5 py-0.5 rounded-lg text-[10px] uppercase font-black tracking-wider border ${theme.tag}`}
            >
              {orientacion}
            </span>

            {/* Logic: Hours only visible when collapsed. */}
            {!isExpanded && (
              <span className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <span className="material-icons !text-xs md:!text-sm">schedule</span>
                {horasAcreditadas}hs
              </span>
            )}

            {/* Location Tag - Desktop only */}
            {(() => {
              const isVirtual = direccion.toLowerCase().includes("virtual");
              const TagComponent = isVirtual ? "span" : "a";
              const linkProps = isVirtual
                ? {}
                : {
                    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  };

              return (
                <TagComponent
                  {...linkProps}
                  onClick={(e: React.MouseEvent) => !isVirtual && e.stopPropagation()}
                  className={`
                    inline-flex items-center gap-1 text-[9px] md:text-[10px] uppercase font-black px-2 md:px-2.5 py-0.5 md:py-1 rounded-md md:rounded-lg transition-colors group/addr border
                    ${
                      isVirtual
                        ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                        : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer"
                    }
                  `}
                  title={isVirtual ? "Modalidad Virtual" : "Ver Ubicación en Mapa"}
                >
                  <span
                    className={`material-icons !text-xs md:!text-sm ${isVirtual ? "" : "text-indigo-500 group-hover/addr:text-indigo-700"} transition-colors`}
                  >
                    {isVirtual ? "wifi" : "location_on"}
                  </span>
                  <span
                    className={`whitespace-normal leading-tight max-w-[150px] md:max-w-none truncate md:whitespace-normal ${!isVirtual && "group-hover/addr:underline decoration-indigo-500/30 underline-offset-2"} transition-all`}
                  >
                    {direccion}
                  </span>
                </TagComponent>
              );
            })()}
          </div>
        </div>

        {/* Right Side: Button & Chevron (Desktop only) */}
        <div className="flex items-center gap-2 md:gap-3 md:self-start">
          {/* Mobile: Button below title */}
          <button
            disabled={btnConfig.disabled}
            onClick={btnConfig.onClick}
            className={`${btnConfig.classes} md:order-none`}
          >
            {btnConfig.content || <span className="text-[10px] md:text-xs">{btnConfig.text}</span>}
            {btnConfig.icon && (
              <span className="material-icons !text-base md:!text-lg relative z-10">
                {btnConfig.icon}
              </span>
            )}
          </button>

          {/* Chevron Toggle - Desktop */}
          <div
            className={`
              hidden md:flex w-10 h-10 rounded-full items-center justify-center
              bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500
              transition-all duration-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700
              ${isExpanded ? "rotate-180 bg-blue-50 text-blue-500" : ""}
            `}
          >
            <span className="material-icons">expand_more</span>
          </div>
        </div>
      </div>

      {/* ─── EXPANDABLE CONTENT ─── */}
      <div
        className={`grid transition-all duration-500 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          {/* ─── 2. METRICS ROW ─── */}
          <div className="px-4 md:px-8 pb-4 md:pb-6">
            {/* Mobile: Grid 2x2 with Address card */}
            <div className="grid grid-cols-2 md:hidden gap-2">
              {/* Hours with Orientation */}
              <MetricItem
                icon="schedule"
                label="ACREDITA"
                value={`${horasAcreditadas}hs ${orientacion}`}
                theme="indigo"
              />

              {/* Meeting/Schedule */}
              {fechaEncuentroInicial ? (
                <MetricItem
                  icon="groups"
                  label="ENCUENTRO"
                  value={(() => {
                    const dateObj = new Date(fechaEncuentroInicial);
                    const dateStr = dateObj.toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                    });
                    const hours = dateObj.getHours();
                    const minutes = dateObj.getMinutes();
                    if (hours || minutes) {
                      return `${dateStr} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}hs`;
                    }
                    return dateStr;
                  })()}
                  theme="amber"
                />
              ) : (
                <MetricItem
                  icon="event_available"
                  label={horariosFijos ? "FIJOS" : "HORARIOS"}
                  value={
                    horariosCursada.length > 15
                      ? horariosCursada.substring(0, 15) + "..."
                      : horariosCursada
                  }
                  theme={horariosFijos ? "teal" : "blue"}
                />
              )}

              {/* Spots */}
              <MetricItem icon="group" label="CUPOS" value={cupo} theme="teal" />

              {/* Address - Clickable */}
              {(() => {
                const isVirtual = direccion.toLowerCase().includes("virtual");
                if (isVirtual) {
                  return (
                    <MetricItem icon="wifi" label="MODALIDAD" value="VIRTUAL" theme="purple" />
                  );
                }
                return (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="block"
                  >
                    <MetricItem
                      icon="location_on"
                      label="UBICACIÓN"
                      value={direccion.length > 20 ? direccion.substring(0, 20) + "..." : direccion}
                      theme="rose"
                      isClickable
                    />
                  </a>
                );
              })()}
            </div>

            {/* Desktop: Original grid */}
            <div
              className={`hidden md:grid md:grid-cols-3 ${reqCv ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-2 md:gap-3`}
            >
              {/* Updated Hours Metric Format */}
              <MetricItem
                icon="schedule"
                label="ACREDITA"
                value={`${horasAcreditadas} horas de ${orientacion}`}
                theme="indigo"
              />

              {fechaEncuentroInicial ? (
                <MetricItem
                  icon="groups"
                  label="ENCUENTRO INICIAL"
                  value={(() => {
                    const dateObj = new Date(fechaEncuentroInicial);
                    const dateStr = dateObj.toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                    });
                    const hours = dateObj.getHours();
                    const minutes = dateObj.getMinutes();
                    if (hours || minutes) {
                      return `${dateStr} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} hs`;
                    }
                    return dateStr;
                  })()}
                  theme="amber"
                  className={!reqCv ? "lg:col-span-2" : ""}
                />
              ) : (
                <MetricItem
                  icon="event_available"
                  label={horariosFijos ? "HORARIOS FIJOS" : "HORARIOS"}
                  value={horariosCursada}
                  theme={horariosFijos ? "teal" : "blue"}
                  className={!reqCv ? "lg:col-span-2" : ""}
                />
              )}

              <MetricItem icon="group" label="Cupos" value={cupo} theme="teal" />

              {showCvMetric && (
                <MetricItem
                  icon="description"
                  label="Documentación"
                  value="Obligatorio Adjuntar CV"
                  theme="amber"
                />
              )}
            </div>
          </div>

          {/* Separator with Gradient Fade */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-800" />

          {/* ─── 3. CONTENT BODY ─── */}
          <div className="p-4 md:p-8 flex flex-col lg:flex-row gap-6 md:gap-10">
            {/* Description */}
            <div className="flex-1">
              <SectionHeader icon="info_outline" title="Descripción" color="text-indigo-400" />
              <p className="text-slate-600 dark:text-slate-300 text-xs md:text-sm lg:text-base leading-relaxed text-justify font-medium">
                {descripcion}
              </p>

              {/* Requisito Excluyente / Información Importante */}
              {requisitoObligatorio && (
                <div className="mt-6 md:mt-8 animate-fade-in-up">
                  <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/50 dark:border-amber-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                      <span className="material-icons !text-lg md:!text-xl">campaign</span>
                      <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">
                        Requisito / Importante
                      </span>
                    </div>
                    <p className="text-amber-900 dark:text-amber-200 text-sm md:text-base font-bold leading-relaxed">
                      {requisitoObligatorio}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Activities List (Stacked full width) */}
            <div className="lg:w-[45%] flex flex-col gap-8">
              {/* Schedule Section - Always show if has content */}
              {horariosCursada && horariosCursada.trim() && (
                <div className="flex flex-col">
                  <SectionHeader
                    icon="calendar_month"
                    title="Días y Horarios"
                    color="text-blue-400"
                  />
                  <div className="flex flex-col gap-2 w-full">
                    {(() => {
                      const isComplex =
                        horariosCursada.includes(";") ||
                        horariosCursada.includes("\n") ||
                        horariosCursada.length > 40;

                      if (isComplex) {
                        // Multiple schedules - show as list
                        const scheduleItems = horariosCursada
                          .split(";")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        return scheduleItems.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30"
                          >
                            <span className="material-icons !text-sm text-blue-500 mt-0.5">
                              check_circle
                            </span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              {item}
                            </span>
                          </div>
                        ));
                      } else {
                        // Simple schedule - show as single item
                        return (
                          <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                            <span className="material-icons !text-sm text-blue-500 mt-0.5">
                              check_circle
                            </span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              {horariosCursada}
                            </span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}

              <div className="flex flex-col">
                <SectionHeader icon="task_alt" title={actividadesLabel} color="text-teal-400" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 md:gap-3 w-full">
                  {actividades.map((act, i) => (
                    <div
                      key={i}
                      className={`
                                            w-full flex items-center px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl
                                            bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60
                                            hover:border-blue-200 dark:hover:border-blue-500/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300
                                        `}
                    >
                      <div
                        className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full mr-2 md:mr-3 flex-shrink-0 bg-gradient-to-br ${theme.gradient || "from-blue-400 to-indigo-400"}`}
                      />
                      <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                        {act}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─── 4. TIMELINE FOOTER ─── */}
          <div className="bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 p-4 md:p-6 md:px-8 mt-auto backdrop-blur-sm">
            <h3 className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 md:mb-8 flex items-center gap-2">
              <span className="material-icons !text-sm md:!text-base">timeline</span>
              Cronograma Evolutivo
            </h3>

            <div className="relative isolate mb-4 md:mb-8">
              {/* Connector Line (Multi-Color Gradient) */}
              <div className="absolute top-[14px] md:top-[18px] left-0 right-0 h-1 md:h-1.5 bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400 opacity-30 hidden md:block rounded-full transform -translate-y-1/2" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0">
                {/* Point 1: Inscripción (Indigo/Violet) */}
                <TimelinePoint
                  title="Inscripción"
                  date={timeline.inscripcion}
                  icon="edit_calendar"
                  colorClass="text-indigo-600"
                  bgClass="bg-indigo-100"
                  borderClass="border-indigo-500"
                  ringClass="ring-indigo-100"
                />

                {/* Point 2: Inicio (Blue) */}
                <TimelinePoint
                  title="Inicio"
                  date={timeline.inicio}
                  icon="play_arrow"
                  isCenter
                  colorClass="text-blue-600"
                  bgClass="bg-blue-100"
                  borderClass="border-blue-500"
                  ringClass="ring-blue-100"
                />

                {/* Point 3: Finalización (Emerald/Green) */}
                <TimelinePoint
                  title="Finalización"
                  date={timeline.fin}
                  icon="flag"
                  isLast
                  colorClass="text-emerald-600"
                  bgClass="bg-emerald-100"
                  borderClass="border-emerald-500"
                  ringClass="ring-emerald-100"
                />
              </div>
            </div>

            {/* CTA Button AREA in Expanded View */}
            {/* Button moved to header */}
          </div>
        </div>
      </div>
    </article>
  );
};

// ─── SUB COMPONENTS ───

const SectionHeader: React.FC<{ icon: string; title: string; color?: string }> = ({
  icon,
  title,
  color = "text-slate-300",
}) => (
  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
    <span className={`material-icons !text-lg ${color}`}>{icon}</span>
    {title}
  </h3>
);

// Updated MetricItem with colored themes
const MetricItem: React.FC<{
  icon: string;
  label: string;
  value: string;
  theme?: "slate" | "indigo" | "blue" | "teal" | "amber" | "purple" | "rose";
  className?: string;
  isClickable?: boolean;
}> = ({ icon, label, value, theme = "slate", className = "", isClickable = false }) => {
  const themeStyles = {
    slate:
      "bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400",
    indigo:
      "bg-indigo-50/60 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30 text-indigo-500",
    blue: "bg-blue-50/60 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30 text-blue-500",
    teal: "bg-teal-50/60 dark:bg-teal-900/10 border-teal-100 dark:border-teal-800/30 text-teal-500",
    amber:
      "bg-amber-50/80 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30 ring-4 ring-amber-50/50 dark:ring-transparent text-amber-500",
    purple:
      "bg-purple-50/60 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/30 text-purple-500",
    rose: "bg-rose-50/60 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30 text-rose-500",
  };

  const activeStyle = themeStyles[theme];

  return (
    <div
      className={`
      relative p-2 md:p-4 rounded-xl md:rounded-2xl flex flex-col justify-center gap-1 md:gap-1.5 border overflow-hidden
      ${activeStyle}
      transition-all hover:scale-[1.02] duration-300 text-center
      ${isClickable ? "cursor-pointer hover:shadow-md active:scale-95" : ""}
      ${className}
    `}
      title={value}
    >
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

      <div className="relative z-10 flex items-center justify-center gap-1 md:gap-1.5 mb-0.5 md:mb-1">
        <span className="material-icons !text-base md:!text-lg">{icon}</span>
      </div>
      <div className="relative z-10 text-[9px] md:text-[10px] uppercase font-black opacity-70 tracking-wider leading-none">
        {label}
      </div>
      <div className="relative z-10 text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
        {value}
      </div>
    </div>
  );
};

interface TimelinePointProps {
  title: string;
  date: string;
  icon: string;
  isCenter?: boolean;
  isLast?: boolean;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  ringClass: string;
}

const TimelinePoint: React.FC<TimelinePointProps> = ({
  title,
  date,
  icon,
  isCenter,
  isLast,
  colorClass,
  bgClass,
  borderClass,
  ringClass,
}) => {
  return (
    <div
      className={`relative flex md:flex-col items-center md:items-start gap-4 md:gap-3 group/point ${isCenter ? "md:items-center" : ""} ${isLast ? "md:items-end" : ""}`}
    >
      {/* Marker - Desktop (Premium Colored) */}
      <div
        className={`
        hidden md:flex relative z-10 w-10 h-10 rounded-full items-center justify-center border-[3px]
        bg-white dark:bg-slate-800 shadow-md ${borderClass} group-hover/point:scale-110 transition-transform duration-300
      `}
      >
        <span className={`material-icons !text-sm ${colorClass}`}>{icon}</span>
        {/* Subtle colored ring */}
        <div className={`absolute inset-0 rounded-full ring-4 ${ringClass} opacity-40`} />
      </div>

      {/* Marker - Mobile (Simple Colored) */}
      <div
        className={`
        md:hidden w-8 h-8 rounded-full flex items-center justify-center ${bgClass} ${colorClass}
      `}
      >
        <span className="material-icons !text-sm">{icon}</span>
      </div>

      <div
        className={`flex flex-col ${isCenter ? "md:items-center" : ""} ${isLast ? "md:items-end" : ""}`}
      >
        <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${colorClass}`}>
          {title}
        </span>
        <span className={`text-sm font-bold text-slate-800 dark:text-white`}>{date}</span>
      </div>
    </div>
  );
};

export default ConvocatoriaCardPremium;
