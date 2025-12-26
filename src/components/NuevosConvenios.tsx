
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import type { InstitucionFields, LanzamientoPPSFields, AirtableRecord } from '../types';
import {
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_TUTOR_INSTITUCIONES,
} from '../constants';
import Card from './Card';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Toast from './Toast';
import Button from './Button';
import { normalizeStringForComparison, parseToUTCDate, formatDate } from '../utils/formatters';

const getGroupName = (name: string | undefined): string => {
    if (!name) return 'Sin Nombre';
    // Splits by a hyphen, en-dash, or em-dash with optional surrounding spaces for robustness.
    return name.split(/\s*[-–—]\s*/)[0].trim();
};

interface PotentialAgreement {
    institutionId: string;
    institutionName: string;
    launches: { id: string; name: string; date: string }[];
}

const NuevosConvenios: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
    const queryClient = useQueryClient();
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['conveniosData', isTestingMode],
        queryFn: async () => {
            if (isTestingMode) {
                return {
                    instituciones: [{ id: 'inst_test_1', createdTime: '', [FIELD_NOMBRE_INSTITUCIONES]: 'Inst Test Nueva', [FIELD_CONVENIO_NUEVO_INSTITUCIONES]: 2024 } as any, { id: 'inst_test_2', createdTime: '', [FIELD_NOMBRE_INSTITUCIONES]: 'Inst Test Potencial' } as any],
                    lanzamientos: [{ id: 'lanz_test_1', createdTime: '', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Inst Test Nueva - Sede A', [FIELD_FECHA_INICIO_LANZAMIENTOS]: `${new Date().getFullYear()}-03-01` } as any, { id: 'lanz_test_2', createdTime: '', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Inst Test Potencial - Taller B', [FIELD_FECHA_INICIO_LANZAMIENTOS]: `${new Date().getFullYear()}-04-01` } as any]
                };
            }
            const [institucionesRes, lanzamientosRes] = await Promise.all([
                db.instituciones.getAll(),
                db.lanzamientos.getAll()
            ]);
            return { instituciones: institucionesRes, lanzamientos: lanzamientosRes };
        },
    });
    
    const confirmMutation = useMutation({
        mutationFn: (institutionId: string) => {
            const currentYear = new Date().getFullYear();
            if (isTestingMode) {
                console.log("TEST MODE: Confirming agreement for", institutionId);
                return new Promise(resolve => setTimeout(resolve, 500));
            }
            // Actualizamos con el año actual en lugar de true
            // Cast to any because the schema defines this field as boolean, but we store the year
            return db.instituciones.update(institutionId, { [FIELD_CONVENIO_NUEVO_INSTITUCIONES]: currentYear as any });
        },
        onSuccess: () => {
            setToastInfo({ message: 'Convenio confirmado con éxito.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['conveniosData', isTestingMode] });
            queryClient.invalidateQueries({ queryKey: ['metricsData'] });
        },
        onError: (e: Error) => {
            setToastInfo({ message: `Error al confirmar: ${e.message}`, type: 'error' });
        }
    });

    const { confirmed, potentials } = useMemo(() => {
        if (!data) return { confirmed: [], potentials: [] };

        const currentYear = new Date().getFullYear();

        const institutionsMap = new Map<string, { id: string, isNew: boolean, year?: number }>();
        data.instituciones.forEach(inst => {
            const name = inst[FIELD_NOMBRE_INSTITUCIONES];
            if (name) {
                const yearVal = Number(inst[FIELD_CONVENIO_NUEVO_INSTITUCIONES]);
                const isNew = !isNaN(yearVal) && yearVal >= (currentYear - 1); // Consideramos "Nuevo" si es de este año o el anterior
                institutionsMap.set(normalizeStringForComparison(name), {
                    id: inst.id,
                    isNew,
                    year: yearVal
                });
            }
        });
        
        const launchesThisYear = data.lanzamientos
            .filter(l => {
                const date = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
                return date && date.getUTCFullYear() === currentYear;
            })
            .sort((a, b) => {
                const dateA = parseToUTCDate(a[FIELD_FECHA_INICIO_LANZAMIENTOS])?.getTime() || 0;
                const dateB = parseToUTCDate(b[FIELD_FECHA_INICIO_LANZAMIENTOS])?.getTime() || 0;
                return dateA - dateB;
            });

        const confirmedMap = new Map<string, Date>();
        const potentialsMap = new Map<string, PotentialAgreement>();

        launchesThisYear.forEach(launch => {
            const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (!ppsName) return;

            const groupName = getGroupName(ppsName);
            const normalizedGroupName = normalizeStringForComparison(groupName);
            const institutionInfo = institutionsMap.get(normalizedGroupName);

            if (institutionInfo) {
                if (institutionInfo.isNew) {
                    if (!confirmedMap.has(groupName)) {
                        const launchDate = parseToUTCDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS]);
                        if (launchDate) {
                            confirmedMap.set(groupName, launchDate);
                        }
                    }
                } else {
                    if (!potentialsMap.has(institutionInfo.id)) {
                        potentialsMap.set(institutionInfo.id, {
                            institutionId: institutionInfo.id,
                            institutionName: groupName,
                            launches: []
                        });
                    }
                    potentialsMap.get(institutionInfo.id)!.launches.push({
                        id: launch.id,
                        name: ppsName,
                        date: launch[FIELD_FECHA_INICIO_LANZAMIENTOS] || 'N/A'
                    });
                }
            }
        });

        const confirmed = Array.from(confirmedMap.entries())
            .map(([name, date]) => ({ name, date }))
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(item => item.name);

        return {
            confirmed,
            potentials: Array.from(potentialsMap.values()).sort((a,b) => a.institutionName.localeCompare(b.institutionName))
        };
    }, [data]);

    if (isLoading) return <div className="flex justify-center p-8"><Loader /></div>;
    if (error) return <EmptyState icon="error" title="Error" message={error.message} />;

    return (
        <div className="space-y-8">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            
            <Card icon="verified" title={`Convenios Nuevos Confirmados (${new Date().getFullYear()})`} description="Instituciones marcadas como 'Convenio Nuevo' que tuvieron lanzamientos este año.">
                {confirmed.length > 0 ? (
                    <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                        {confirmed.map(name => (
                            <li key={name} className="flex items-center gap-2 text-sm">
                                <span className="material-icons text-emerald-500 !text-base">check_circle</span>
                                <span className="text-slate-700 dark:text-slate-200">{name}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No se han confirmado convenios nuevos este año.</p>
                )}
            </Card>

            <Card icon="add_business" title="Posibles Convenios Nuevos a Confirmar" description="Instituciones con lanzamientos este año que no están marcadas con el año de convenio.">
                {potentials.length > 0 ? (
                    <div className="mt-4 space-y-4">
                        {potentials.map(item => (
                            <div key={item.institutionId} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{item.institutionName}</h4>
                                    <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                                        {item.launches.map(l => <li key={l.id}>- {l.name} ({formatDate(l.date)})</li>)}
                                    </ul>
                                </div>
                                <Button 
                                    size="sm"
                                    onClick={() => confirmMutation.mutate(item.institutionId)}
                                    isLoading={confirmMutation.isPending && confirmMutation.variables === item.institutionId}
                                    icon="add_task"
                                >
                                    Confirmar {new Date().getFullYear()}
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">¡Excelente! Todas las instituciones con lanzamientos este año están correctamente marcadas.</p>
                )}
            </Card>
        </div>
    );
};

export default NuevosConvenios;
