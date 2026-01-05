
import React, { useMemo } from 'react';
import type { LanzamientoPPS } from '../types';
import { FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS, FIELD_ESTADO_GESTION_LANZAMIENTOS, FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS } from '../constants';
import { parseToUTCDate, normalizeStringForComparison } from '../utils/formatters';

interface CalendarPlanningProps {
    items: LanzamientoPPS[];
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const CalendarPlanning: React.FC<CalendarPlanningProps> = ({ items }) => {

    // Group items by month for 2026 (or future dates)
    const calendarData = useMemo(() => {
        const data: Record<number, LanzamientoPPS[]> = {};

        // Initialize months
        for (let i = 0; i < 12; i++) data[i] = [];

        items.forEach(item => {
            const status = normalizeStringForComparison(item[FIELD_ESTADO_GESTION_LANZAMIENTOS]);
            const dateStr = item[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS] || item[FIELD_FECHA_INICIO_LANZAMIENTOS];

            if ((status === 'relanzamiento confirmado' || status === 'abierta') && dateStr) {
                const currentYear = new Date().getFullYear();
                let isValidYear = true;
                let monthIndex = -1;
                let dayOfMonth = '?';

                // 1. Try parsing loose Spanish text Month
                const lowerDateStr = dateStr.toLowerCase();
                monthIndex = MONTHS.findIndex(m => lowerDateStr.includes(m.toLowerCase()));

                // If pure text based, check if it contains a explicit year that is NOT 2026 (or current)
                // e.g "Marzo 2025" -> should be excluded
                const yearMatch = dateStr.match(/\b20\d{2}\b/);
                if (yearMatch) {
                    if (parseInt(yearMatch[0]) !== currentYear) isValidYear = false;
                }

                // 2. If no text month found, try standard Date parsing
                if (monthIndex === -1) {
                    const date = parseToUTCDate(dateStr);
                    if (date) {
                        // Check strict year
                        if (date.getUTCFullYear() !== currentYear) {
                            isValidYear = false;
                        } else {
                            monthIndex = date.getUTCMonth();
                            dayOfMonth = String(date.getUTCDate());
                        }
                    }
                }

                // If valid month found AND year is correct
                if (isValidYear && monthIndex >= 0 && monthIndex < 12) {
                    // Store display date temporarily in the object instance (safe for render scope)
                    (item as any)._displayDay = dayOfMonth;
                    data[monthIndex].push(item);
                }
            }
        });

        return data;
    }, [items]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in">
            {MONTHS.map((monthName, index) => {
                const launches = calendarData[index];
                const hasLaunches = launches.length > 0;

                // Highlight current month
                const isCurrentMonth = new Date().getMonth() === index;

                return (
                    <div key={monthName} className={`rounded-xl border ${hasLaunches ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50 opacity-70'} ${isCurrentMonth ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''} overflow-hidden flex flex-col h-full`}>
                        <div className={`p-3 border-b ${hasLaunches ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800' : 'border-slate-100 dark:border-slate-800'} flex justify-between items-center`}>
                            <h3 className={`font-bold ${hasLaunches ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-500 dark:text-slate-500'}`}>
                                {monthName} {isCurrentMonth && <span className="text-[10px] text-blue-500 uppercase ml-1">(Actual)</span>}
                            </h3>
                            {hasLaunches && <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-full">{launches.length}</span>}
                        </div>

                        <div className="p-3 flex-grow">
                            {hasLaunches ? (
                                <ul className="space-y-2">
                                    {launches.map(launch => (
                                        <li key={launch.id} className="text-xs group relative pl-3 border-l-2 border-emerald-400">
                                            <div className="font-semibold text-slate-700 dark:text-slate-200 truncate" title={launch[FIELD_NOMBRE_PPS_LANZAMIENTOS]}>
                                                {launch[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                                            </div>
                                            <div className="text-slate-500 dark:text-slate-400 flex justify-between mt-0.5">
                                                <span>{(launch as any)._displayDay !== '?' ? `Día ${(launch as any)._displayDay}` : 'A confirmar'}</span>
                                                {launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] && <span>{launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]} cupos</span>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                                    <span className="text-xs italic">Sin planificación</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CalendarPlanning;
