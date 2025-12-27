
import React, { useState, useEffect } from 'react';
import { EstudianteFields } from '../types';

interface WelcomeBannerProps {
  studentName?: string;
  studentDetails: EstudianteFields | null;
  isLoading: boolean;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  studentName,
  isLoading,
}) => {
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12 && hour >= 5) setGreeting('Buenos días');
    else if (hour < 20 && hour >= 12) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('es-ES', options);
    // Capitalizar primera letra
    setCurrentDate(dateStr.charAt(0).toUpperCase() + dateStr.slice(1));
  }, []);

  if (isLoading) return <div className="h-24 w-full bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse mb-8" />;

  const firstName = studentName?.split(' ')[0] || 'Estudiante';

  return (
    <div className="relative mb-8 pt-4 px-2">
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        {/* Saludo Principal - Línea fluida en PC */}
        <div className="flex-1">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                <span className="block md:inline">
                    {greeting}<span className="hidden md:inline">,</span>
                </span>
                <span className="hidden md:inline"> </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
                    {firstName}.
                </span>
            </h1>
        </div>

        {/* Fecha (Solo visible en PC para equilibrar el peso visual) */}
        <div className="hidden md:block text-right">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-bold shadow-sm">
                <span className="material-icons !text-lg text-blue-500">calendar_today</span>
                <span>{currentDate}</span>
            </div>
        </div>
      </div>
      
      {/* Separador sutil para delimitar el header del contenido */}
      <div className="hidden md:block mt-6 h-px w-full bg-gradient-to-r from-slate-200 via-slate-100 to-transparent dark:from-slate-800 dark:via-slate-900"></div>
    </div>
  );
};

export default React.memo(WelcomeBanner);
