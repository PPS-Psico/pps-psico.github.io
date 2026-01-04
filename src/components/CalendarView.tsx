import React, { useMemo } from 'react';
import type { Convocatoria, LanzamientoPPS, InformeTask, CalendarEvent } from '../types';
import {
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_FECHA_FIN_LANZAMIENTOS,
    FIELD_HORARIO_FORMULA_CONVOCATORIAS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_DIRECCION_LANZAMIENTOS,
    FIELD_FECHA_INICIO_CONVOCATORIAS,
    FIELD_NOMBRE_PPS_CONVOCATORIAS,
} from '../constants';
import { parseToUTCDate, getEspecialidadClasses, normalizeStringForComparison, formatDate } from '../utils/formatters';
import EmptyState from './EmptyState';
import { generateRecurringCalendarLinks } from '../utils/calendarUtils';
import Card from './ui/Card';

interface HomeViewProps {
    myEnrollments: Convocatoria[];
    allLanzamientos: LanzamientoPPS[];
    informeTasks: InformeTask[];
}

const UpcomingPracticeItem: React.FC<{ event: CalendarEvent; date: Date }> = ({ event, date }) => {
    const calendarLinks = generateRecurringCalendarLinks(event, date);

    return (
        <div className="bg-white dark:bg-slate-800/70 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)}
                    </p>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mt-1">{event.name}</h4>
                </div>
                <span className={`${event.colorClasses.tag} mt-1`}>{event.orientation}</span>
            </div>
            <div className="mt-3 space-y-2 text-sm">
                <p className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md font-medium">{event.schedule}</p>
                <div className="text-slate-600 dark:text-slate-400 flex items-start gap-2 pt-1">
                    <span className="material-icons !text-base mt-0.5 text-slate-400 dark:text-slate-500">location_on</span>
                    <div>
                        <span>{event.location}</span>
                        {event.location && event.location !== 'No especificada' && event.location.toLowerCase() !== 'online' && (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1 ml-1"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Ver en Google Maps
                                <span className="material-icons !text-xs">open_in_new</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
            {calendarLinks && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">Sincronizar:</span>
                    <a href={calendarLinks.google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-600/50 transition-colors">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.24C21 11.51 20.94 10.8 20.81 10.12H12.24V13.89H17.22C17.03 15.03 16.5 15.99 15.67 16.62V19.12H19.07C20.39 17.93 21.09 16.14 21.09 13.89C21.03 13.33 21 12.79 21 12.24Z" fill="#4285F4" /><path d="M12.24 21.49C15.03 21.49 17.34 20.59 19.07 19.12L15.67 16.62C14.79 17.24 13.59 17.62 12.24 17.62C9.64 17.62 7.42 15.99 6.63 13.71H3.12V16.29C4.86 19.41 8.25 21.49 12.24 21.49Z" fill="#34A853" /><path d="M6.63 13.71C6.42 13.11 6.3 12.48 6.3 11.84C6.3 11.2 6.42 10.57 6.63 9.97V7.39H3.12C2.42 8.76 2 10.25 2 11.84C2 13.43 2.42 14.92 3.12 16.29L6.63 13.71Z" fill="#FBBC05" /><path d="M12.24 6.05999C13.68 6.02999 15.09 6.56999 16.11 7.50999L19.14 4.71999C17.34 3.08999 14.97 2.18999 12.24 2.18999C8.25 2.18999 4.86 4.26999 3.12 7.38999L6.63 9.96999C7.42 7.68999 9.64 6.05999 12.24 6.05999Z" fill="#EA4335" /></svg>
                        Google
                    </a>
                    <a href={calendarLinks.ical} download={`${event.name.replace(/ /g, '_')}.ics`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-600/50 transition-colors">
                        <span className="material-icons !text-sm">event</span>
                        iCal
                    </a>
                </div>
            )}
        </div>
    );
};

const HomeView: React.FC<HomeViewProps> = ({ myEnrollments, allLanzamientos, informeTasks }) => {

    const allPracticeEvents = useMemo(() => {
        const events: { date: Date, event: CalendarEvent }[] = [];
        const dayMap: { [key: string]: number } = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };

        const enrolledPractices = myEnrollments
            .filter(e => normalizeStringForComparison(e[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) === 'seleccionado')
            .map(enrollment => {
                let pps: LanzamientoPPS | undefined;
                const lanzamientoId = (enrollment[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] || [])[0];
                if (lanzamientoId) pps = allLanzamientos.find(l => l.id === lanzamientoId);
                // Fallback logic could go here if needed
                return pps ? { pps, enrollment } : null;
            })
            .filter((item): item is { pps: LanzamientoPPS, enrollment: Convocatoria } => item !== null);

        enrolledPractices.forEach(({ pps, enrollment }) => {
            const ppsStartDate = parseToUTCDate(pps[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            const ppsEndDate = parseToUTCDate(pps[FIELD_FECHA_FIN_LANZAMIENTOS]);
            const schedule = (enrollment[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || '').trim();
            if (!schedule || !ppsStartDate || !ppsEndDate) return;

            const normalizedSchedule = normalizeStringForComparison(schedule);
            const scheduleDays = Object.keys(dayMap).filter(d => normalizedSchedule.includes(d) && !normalizedSchedule.includes(`no ${d}`));
            const scheduleDayNumbers = scheduleDays.map(d => dayMap[d]);

            for (let d = new Date(ppsStartDate); d <= ppsEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
                if (scheduleDayNumbers.includes(d.getUTCDay())) {
                    const orientation = pps[FIELD_ORIENTACION_LANZAMIENTOS] || 'General';
                    events.push({
                        date: new Date(d),
                        event: {
                            id: pps.id,
                            name: pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || 'Práctica',
                            schedule: schedule,
                            orientation: orientation,
                            location: pps[FIELD_DIRECCION_LANZAMIENTOS] || 'No especificada',
                            colorClasses: getEspecialidadClasses(orientation),
                            startDate: pps[FIELD_FECHA_INICIO_LANZAMIENTOS],
                            endDate: pps[FIELD_FECHA_FIN_LANZAMIENTOS],
                        }
                    });
                }
            }
        });
        return events.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [myEnrollments, allLanzamientos]);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const todayEvents = allPracticeEvents.filter(e => e.date.getTime() === today.getTime()).map(e => e.event);
    const upcomingEvents = allPracticeEvents.filter(e => e.date > today).slice(0, 5);

    const pendingInformes = useMemo(() => {
        const now = new Date();
        const fifteenDaysFromNow = new Date();
        fifteenDaysFromNow.setDate(now.getDate() + 15);

        return informeTasks.filter(task => {
            if (task.informeSubido) return false;
            const finalizacionDate = parseToUTCDate(task.fechaFinalizacion);
            if (!finalizacionDate) return false;
            const deadline = new Date(finalizacionDate);
            deadline.setDate(deadline.getDate() + 30);
            return deadline <= fifteenDaysFromNow;
        });
    }, [informeTasks]);

    if (allPracticeEvents.length === 0 && pendingInformes.length === 0) {
        return <EmptyState icon="home" title="Bienvenido a tu Panel" message="Cuando tengas prácticas o informes pendientes, aparecerán aquí." />;
    }

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Today's Card */}
            <Card icon="today" title="Actividades para Hoy" titleAs="h2" className="border-blue-200/80 dark:border-blue-700/80 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/20 dark:to-slate-800/20">
                {todayEvents.length > 0 ? (
                    <div className="space-y-4 mt-4 pt-4 border-t border-blue-200/50 dark:border-blue-700/50">
                        {todayEvents.map((event, index) => <UpcomingPracticeItem key={index} event={event} date={today} />)}
                    </div>
                ) : (
                    <p className="mt-4 pt-4 border-t border-blue-200/50 dark:border-blue-700/50 text-slate-600 dark:text-slate-300">No tienes actividades programadas para hoy. ¡Aprovecha el día!</p>
                )}
            </Card>

            {/* Pending Reports Card */}
            {pendingInformes.length > 0 && (
                <Card icon="pending_actions" title="Informes con Entrega Próxima" titleAs="h2" className="border-amber-200/80 dark:border-amber-700/80 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-900/20 dark:to-slate-800/20">
                    <div className="space-y-3 mt-4 pt-4 border-t border-amber-200/50 dark:border-amber-700/50">
                        {pendingInformes.map(task => (
                            <a key={task.convocatoriaId} href={task.informeLink} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-amber-200/60 dark:border-amber-700/60 hover:bg-amber-50/50 dark:hover:bg-amber-900/30 transition-colors">
                                <p className="font-bold text-slate-800 dark:text-slate-100">{task.ppsName}</p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold mt-1">Fecha límite de entrega: {formatDate(new Date(parseToUTCDate(task.fechaFinalizacion)!.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString())}</p>
                            </a>
                        ))}
                    </div>
                </Card>
            )}

            {/* Upcoming Practices */}
            {upcomingEvents.length > 0 && (
                <Card icon="event_upcoming" title="Próximas Prácticas" titleAs="h2">
                    <div className="space-y-4 mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                        {upcomingEvents.map(({ date, event }) => <UpcomingPracticeItem key={`${event.id}-${date.toISOString()}`} event={event} date={date} />)}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default HomeView;
