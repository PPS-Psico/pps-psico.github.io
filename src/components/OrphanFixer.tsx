
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    TABLE_NAME_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    TABLE_NAME_ESTUDIANTES,
    FIELD_ESTADO_ESTUDIANTES,
    TABLE_NAME_PRACTICAS,
    FIELD_ESTUDIANTE_LINK_PRACTICAS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    TABLE_NAME_LANZAMIENTOS_PPS
} from '../constants';
import Card from './ui/Card';
import Loader from './Loader';
import Toast from './ui/Toast';
import { safeGetId, parseToUTCDate } from '../utils/formatters';
import { useQueryClient } from '@tanstack/react-query';

const OrphanFixer: React.FC = () => {
    const [mismatchedCount, setMismatchedCount] = useState(0);
    const [isScanning, setIsScanning] = useState(true);
    const [isFixing, setIsFixing] = useState(false);
    const [toast, setToast] = useState<{ m: string, t: 'success' | 'error' } | null>(null);
    const [idsToFix, setIdsToFix] = useState<string[]>([]);
    const queryClient = useQueryClient();

    const scanForStatusMismatches = async () => {
        setIsScanning(true);
        try {
            const currentYear = new Date().getFullYear();

            // 1. Obtener lanzamientos del año para saber qué inscripciones son de este año
            const { data: launches } = await supabase.from(TABLE_NAME_LANZAMIENTOS_PPS).select('id, fecha_inicio');
            const validLaunchIds = new Set(
                launches?.filter(l => parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS])?.getUTCFullYear() === currentYear).map(l => l.id)
            );

            // 2. Obtener IDs de estudiantes con actividad en 2025
            const [convRes, pracRes] = await Promise.all([
                supabase.from(TABLE_NAME_CONVOCATORIAS).select(FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS + ',' + FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS),
                supabase.from(TABLE_NAME_PRACTICAS).select(FIELD_ESTUDIANTE_LINK_PRACTICAS + ',fecha_inicio')
            ]);

            const activeStudents = new Set<string>();

            convRes.data?.forEach(c => {
                const sId = safeGetId(c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
                const lId = safeGetId(c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]);
                if (sId && lId && validLaunchIds.has(lId)) activeStudents.add(sId);
            });

            (pracRes.data as any[])?.forEach((p: any) => {
                const sId = safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
                const date = parseToUTCDate(p.fecha_inicio);
                if (sId && date?.getUTCFullYear() === currentYear) activeStudents.add(sId);
            });

            // 3. Comparar con su estado actual en la tabla estudiantes
            const { data: students } = await supabase
                .from(TABLE_NAME_ESTUDIANTES)
                .select('id, estado')
                .in('id', Array.from(activeStudents));

            const toFix = students?.filter(s => s.estado !== 'Activo' && s.estado !== 'Finalizado').map(s => s.id) || [];

            setIdsToFix(toFix);
            setMismatchedCount(toFix.length);
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsScanning(false);
        }
    };

    const fixStatuses = async () => {
        if (idsToFix.length === 0) return;
        setIsFixing(true);
        try {
            const { error } = await supabase
                .from(TABLE_NAME_ESTUDIANTES)
                .update({ [FIELD_ESTADO_ESTUDIANTES]: 'Activo' })
                .in('id', idsToFix);

            if (error) throw error;

            setToast({ m: `¡Éxito! Se actualizaron ${idsToFix.length} estudiantes a estado 'Activo'.`, t: 'success' });
            setMismatchedCount(0);
            setIdsToFix([]);
            queryClient.invalidateQueries();
        } catch (e: any) {
            setToast({ m: `Error: ${e.message}`, t: 'error' });
        } finally {
            setIsFixing(false);
        }
    };

    useEffect(() => { scanForStatusMismatches(); }, []);

    return (
        <Card title="Sincronizador de Estados (Métricas)" icon="sync_alt">
            {toast && <Toast message={toast.m} type={toast.t} onClose={() => setToast(null)} />}

            <div className="p-4 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Esta herramienta detecta alumnos que tienen trámites en {new Date().getFullYear()} pero figuran como 'Inactivos' en la base de datos.
                </p>

                {isScanning ? (
                    <Loader />
                ) : mismatchedCount > 0 ? (
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                            <p className="text-blue-800 dark:text-blue-300 font-bold text-sm">
                                Se detectaron {mismatchedCount} estudiantes que deberían figurar como 'Activos'.
                            </p>
                        </div>
                        <button
                            onClick={fixStatuses}
                            disabled={isFixing}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                        >
                            {isFixing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-icons">auto_fix_high</span>}
                            Sincronizar Estados a 'Activo'
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-6 text-emerald-600 font-bold flex items-center justify-center gap-2">
                        <span className="material-icons">verified</span>
                        Todos los estados coinciden con la actividad real.
                    </div>
                )}
            </div>
        </Card>
    );
};

export default OrphanFixer;
