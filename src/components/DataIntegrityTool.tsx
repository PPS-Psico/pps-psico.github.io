
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { 
    TABLE_NAME_ESTUDIANTES, 
    FIELD_ESTADO_ESTUDIANTES,
    FIELD_DNI_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_TELEFONO_ESTUDIANTES
} from '../constants';
import Card from './Card';
import Button from './Button';
import Toast from './Toast';

const isRealData = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'number') return val > 0;
    const str = String(val).replace(/[\[\]"']/g, '').trim();
    return str.length > 2 && str.toLowerCase() !== 'null';
};

const DataIntegrityTool: React.FC = () => {
    const [isFixing, setIsFixing] = useState(false);
    const [toast, setToast] = useState<{ m: string, t: 'success' | 'error' } | null>(null);
    const queryClient = useQueryClient();

    const fixDatabaseStates = async () => {
        setIsFixing(true);
        try {
            // 1. Traer todos los alumnos de la base de datos
            const { data: students, error } = await supabase
                .from(TABLE_NAME_ESTUDIANTES)
                .select('*');

            if (error) throw error;

            // 2. Identificar cuáles dicen "Nuevo" pero TIENEN datos
            const zombies = students?.filter(s => {
                const dbStatus = s[FIELD_ESTADO_ESTUDIANTES];
                const hasMail = isRealData(s[FIELD_CORREO_ESTUDIANTES]);
                const hasDni = isRealData(s[FIELD_DNI_ESTUDIANTES]);
                const hasTel = isRealData(s[FIELD_TELEFONO_ESTUDIANTES]);
                
                // Si la DB dice que es nuevo pero tiene datos reales... hay que corregirlo
                return (dbStatus === 'Nuevo (Sin cuenta)' || !dbStatus) && (hasMail || hasDni || hasTel);
            }) || [];

            if (zombies.length === 0) {
                setToast({ m: 'La base de datos ya está sincronizada con la realidad.', t: 'success' });
                return;
            }

            // 3. Corregir uno por uno en Supabase
            // Esto cambiará el valor físico de la celda 'estado'
            const promises = zombies.map(z => 
                supabase
                    .from(TABLE_NAME_ESTUDIANTES)
                    .update({ [FIELD_ESTADO_ESTUDIANTES]: 'Inactivo' })
                    .eq('id', z.id)
            );

            await Promise.all(promises);
            
            setToast({ m: `¡Éxito! Se corrigieron ${zombies.length} estados "Nuevo" a "Inactivo" en Supabase.`, t: 'success' });
            
            // Invalidar queries para que el Editor y las Métricas se refresquen
            queryClient.invalidateQueries();
        } catch (e: any) {
            setToast({ m: `Error técnico: ${e.message}`, t: 'error' });
        } finally {
            setIsFixing(false);
        }
    };

    return (
        <Card title="Mantenimiento de Base de Datos" icon="auto_fix_high">
            {toast && <Toast message={toast.m} type={toast.t} onClose={() => setToast(null)} />}
            <div className="p-4 space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                        <strong>Sincronización de Estados:</strong> Esta herramienta analiza si un alumno tiene Mail o DNI pero todavía figura como "Nuevo". Si es así, actualiza la base de datos para pasarlo a "Inactivo/Activo" según corresponda.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button 
                        onClick={fixDatabaseStates} 
                        isLoading={isFixing}
                        icon="cleaning_services"
                    >
                        Sincronizar Estados de Alumnos en Supabase
                    </Button>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                    Al terminar, el Editor DB mostrará automáticamente los estados actualizados.
                </p>
            </div>
        </Card>
    );
};

export default DataIntegrityTool;
