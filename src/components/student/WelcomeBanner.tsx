import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { EstudianteFields } from "../../types";

interface WelcomeBannerProps {
  studentName?: string;
  studentDetails: EstudianteFields | null;
  isLoading: boolean;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ studentName, isLoading }) => {
  const [greeting, setGreeting] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12 && hour >= 5) setGreeting("Buenos días");
    else if (hour < 20 && hour >= 12) setGreeting("Buenas tardes");
    else setGreeting("Buenas noches");

    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const dateStr = new Date().toLocaleDateString("es-ES", options);
    // Capitalizar primera letra
    setCurrentDate(dateStr.charAt(0).toUpperCase() + dateStr.slice(1));
  }, []);

  if (isLoading)
    return (
      <div className="mb-8 pt-4 px-2">
        <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
          <div className="flex-1 space-y-4">
            <div className="h-12 sm:h-16 md:h-20 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-xl animate-shimmer relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer" />
            </div>
            <div className="h-8 sm:h-10 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-xl animate-shimmer relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer" />
            </div>
          </div>
          <div className="hidden md:block">
            <div className="h-12 w-48 bg-slate-200 dark:bg-slate-700 rounded-full animate-shimmer relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer" />
            </div>
          </div>
        </div>
      </div>
    );

  const firstName = studentName?.split(" ")[0] || "Estudiante";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative mb-8 pt-4 px-2"
    >
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        {/* Saludo Principal - Línea fluida en PC */}
        <div className="flex-1">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            <span className="block md:inline">
              {greeting}
              <span className="hidden md:inline">,</span>
            </span>
            <span className="hidden md:inline"> </span>
            <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-[var(--uflo-purple)] via-[var(--uflo-navy)] to-[var(--uflo-teal)] dark:from-purple-300 dark:via-blue-300 dark:to-uflo-teal">
              {firstName}.
            </span>
          </h1>
        </div>

        {/* Fecha (Solo visible en PC para equilibrar el peso visual) */}
        <div className="hidden md:block text-right">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/60 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-bold shadow-sm backdrop-blur-md">
            <span className="material-icons !text-lg text-blue-500">calendar_today</span>
            <span>{currentDate}</span>
          </div>
        </div>
      </div>

      {/* Separador sutil para delimitar el header del contenido */}
      <div className="hidden md:block mt-6 h-px w-full bg-gradient-to-r from-slate-200 via-slate-100 to-transparent dark:from-slate-800 dark:via-slate-900"></div>
    </motion.div>
  );
};

export default React.memo(WelcomeBanner);
