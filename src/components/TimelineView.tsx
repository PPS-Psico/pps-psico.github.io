
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllData } from '../services/supabaseService';
import type { LanzamientoPPS } from '../types';
import {
  TABLE_NAME_LANZAMIENTOS_PPS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
} from '../constants';
import Loader from './Loader';
import EmptyState from './EmptyState';
import { parseToUTCDate } from '../utils/formatters';
import { mapLanzamiento } from '../utils/mappers';

const MOCK_TIMELINE_DATA: any[] = [
    { id: 'tl_mock_1', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Hospital de Simulación', [FIELD_FECHA_INICIO_LANZAMIENTOS]: `${new Date().getFullYear()}-03-10`, [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 10 },
    { id: 'tl_mock_2', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Escuela de Prueba', [FIELD_FECHA_INICIO_LANZAMIENTOS]: `${new Date().getFullYear()}-03-20`, [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 5 },
    { id: 'tl_mock_3', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Empresa Ficticia', [FIELD_FECHA_INICIO_LANZAMIENTOS]: `${new Date().getFullYear()}-05-05`, [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 8 },
    { id: 'tl_mock_4', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Hospital de Simulación - Tarde', [FIELD_FECHA_INICIO_LANZAMIENTOS]: `${new Date().getFullYear()}-03-12`, [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 8 },
];

const fetchTimelineData = async (): Promise<LanzamientoPPS[]> => {
  const { records, error } = await fetchAllData(
    TABLE_NAME_LANZAMIENTOS_PPS,
    [
      FIELD_NOMBRE_PPS_LANZAMIENTOS,
      FIELD_ORIENTACION_LANZAMIENTOS,
      FIELD_FECHA_INICIO_LANZAMIENTOS,
      FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
    ],
    undefined,
    [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: 'asc' }]
  );

  if (error) {
    const errorMsg = typeof error.error === 'string' ? error.error : error.error.message;
    throw new Error(`Error fetching timeline data: ${errorMsg}`);
  }

  // Use the mapper to convert DB rows to AppRecords
  return records.map(mapLanzamiento);
};

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const getGroupName = (name: string | undefined): string => {
    if (!name) return 'Sin Nombre';
    return name.split(' - ')[0].trim();
};

interface TimelineViewProps {
  isTestingMode?: boolean;
}

const TimelineView: React.FC<TimelineViewProps> = ({ isTestingMode = false }) => {
    const [targetYear, setTargetYear] = useState(new Date().getFullYear());

    const { data: launches, isLoading, error } = useQuery({
        queryKey: ['timelineData', isTestingMode],
        queryFn: () => isTestingMode ? Promise.resolve(MOCK_TIMELINE_DATA as LanzamientoPPS[]) : fetchTimelineData(),
    });
    
    const availableYears = useMemo(() => {
        if (!launches) return [new Date().getFullYear()];
        const years = new Set(launches.map(launch => {
            const date = parseToUTCDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            return date ? date.getUTCFullYear() : null;
        }));
        return Array.from(years).filter((y): y is number => y !== null).sort((a, b) => b - a);
    }, [launches]);

    const { totalLaunchesForYear, totalCuposForYear, launchesByMonth } = useMemo(() => {
        if (!launches) {
            return { totalLaunchesForYear: 0, totalCuposForYear: 0, launchesByMonth: [] };
        }

        const launchesForYear = launches.filter(launch => {
            const date = parseToUTCDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            return date && date.getUTCFullYear() === targetYear;
        });
        
        const totalCupos = launchesForYear.reduce((sum, launch) => {
            return sum + Number(launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
        }, 0);
        
        const monthlyData: { [key: number]: {
            cuposTotal: number;
            institutions: Map<string, { cupos: number; variants: string[] }>;
        } } = {};

        launchesForYear.forEach(launch => {
            const date = parseToUTCDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS])!;
            const monthIndex = date.getUTCMonth();
            
            if (!monthlyData[monthIndex]) {
                monthlyData[monthIndex] = {
                    cuposTotal: 0,
                    institutions: new Map(),
                };
            }
            
            const cupos = Number(launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
            monthlyData[monthIndex].cuposTotal += cupos;
            
            const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (ppsName) {
                const groupName = getGroupName(ppsName);
                const institutionData = monthlyData[monthIndex].institutions.get(groupName) || { cupos: 0, variants: [] };
                institutionData.cupos += cupos;
                institutionData.variants.push(ppsName);
                monthlyData[monthIndex].institutions.set(groupName, institutionData);
            }
        });
        
        const finalLaunchesByMonth = MONTH_NAMES.map((monthName, index) => {
            const data = monthlyData[index];
            if (data) {
                return {
                    monthName,
                    ppsCount: data.institutions.size,
                    cuposTotal: data.cuposTotal,
                    institutions: Array.from(data.institutions.entries())
                        .map(([name, details]) => ({
                            name,
                            cupos: details.cupos,
                            variants: details.variants.sort(),
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name)),
                };
            }
            return null;
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        const totalLaunchesForYearSet = new Set<string>();
        launchesForYear.forEach(launch => {
            const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (ppsName) {
                const groupName = getGroupName(ppsName);
                const monthIndex = parseToUTCDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS])!.getUTCMonth();
                totalLaunchesForYearSet.add(`${groupName}::${monthIndex}`);
            }
        });

        return {
            totalLaunchesForYear: totalLaunchesForYearSet.size,
            totalCuposForYear: totalCupos,
            launchesByMonth: finalLaunchesByMonth,
        };
    }, [launches, targetYear]);

    if (isLoading) return <div className="flex justify-center p-8"><Loader /></div>;
    if (error) return <EmptyState icon="error" title="Error" message={error.message} />;
    
    return (
        <div className="animate-fade-in-up space-y-8">
             {/* HEADER & SELECTOR */}
             <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                 <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Cronograma {targetYear}</h2>
                 <div className="relative w-full sm:w-48">
                     <select 
                        value={targetYear} 
                        onChange={e => setTargetYear(Number(e.target.value))}
                        className="w-full appearance-none pl-4 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                        aria-label="Seleccionar año"
                     >
                         {availableYears.map((year: number) => <option key={year} value={year}>{year}</option>)}
                     </select>
                     <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
                 </div>
            </div>
            
            {/* STATS CARD */}
            <div className="bg-white dark:bg-[#0B1120] p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 text-center">
                    <div className="pt-4 sm:pt-0">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Convocatorias Lanzadas</p>
                        <p className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter">{totalLaunchesForYear}</p>
                    </div>
                    <div className="pt-4 sm:pt-0">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Cupos Totales</p>
                        <p className="text-6xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{totalCuposForYear}</p>
                    </div>
                </div>
            </div>

            {/* MONTH CARDS */}
            {launchesByMonth.length === 0 ? (
                <EmptyState icon="calendar_today" title={`Sin Actividad en ${targetYear}`} message={`No se encontraron lanzamientos de PPS para el ciclo ${targetYear}.`} />
            ) : (
                <div className="space-y-6">
                    {launchesByMonth.map((monthData, idx) => (
                        <div key={monthData.monthName} className="relative group">
                            {/* Connector Line */}
                            {idx !== launchesByMonth.length - 1 && (
                                <div className="absolute left-[27px] top-10 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800 -z-10 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 transition-colors"></div>
                            )}
                            
                            <div className="bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm text-slate-900 dark:text-white">
                                            <span className="text-xs font-bold uppercase text-slate-400">{monthData.monthName.substring(0,3)}</span>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{monthData.monthName}</h3>
                                    </div>
                                    <div className="flex gap-2">
                                         <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50">
                                            {monthData.ppsCount} Convocatorias
                                        </span>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-900/50">
                                            {monthData.cuposTotal} Cupos
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {monthData.institutions.map(inst => {
                                        const hasVariants = inst.variants.length > 1;
                                        return (
                                            <div key={inst.name} className="flex flex-col justify-center p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                                <div className="flex justify-between items-start gap-2">
                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 leading-tight">{inst.name}</span>
                                                    <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                                                        {inst.cupos}
                                                    </span>
                                                </div>
                                                {hasVariants && (
                                                    <p className="text-[10px] text-slate-400 mt-1 pl-1 border-l-2 border-slate-200 dark:border-slate-700">
                                                        {inst.variants.length} comisiones
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TimelineView;
