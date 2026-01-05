

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    TABLE_NAME_PPS,
    FIELD_ESTADO_PPS,
    TABLE_NAME_LANZAMIENTOS_PPS,
    FIELD_ESTADO_GESTION_LANZAMIENTOS,
    FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
    FIELD_NOTAS_GESTION_LANZAMIENTOS
} from '../../constants';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import ConfirmModal from '../ConfirmModal';

const YearEndResetTool: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const handleReset = async () => {
        setIsLoading(true);
        try {
            // 1. Archivar Solicitudes de PPS (Autogestión)
            // Archivamos todo lo que NO esté ya archivado.
            // Using casting to any to bypass strict type check for now
            const { error: requestsError, count: requestsCount } = await (supabase as any)
                .from(TABLE_NAME_PPS)
                .update({ [FIELD_ESTADO_PPS]: 'Archivado' })
                .neq(FIELD_ESTADO_PPS, 'Archivado')
                .select('id', { count: 'exact' });

            if (requestsError) throw new Error(`Error archivando solicitudes: ${requestsError.message}`);

            // 2. Resetear Gestión de Lanzamientos
            // Volvemos todo a "Pendiente" y limpiamos fechas/notas para el nuevo ciclo.
            const { error: launchesError, count: launchesCount } = await (supabase as any)
                .from(TABLE_NAME_LANZAMIENTOS_PPS)
                .update({
                    [FIELD_ESTADO_GESTION_LANZAMIENTOS]: 'Pendiente de Gestión',
                    [FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS]: null,
                    [FIELD_NOTAS_GESTION_LANZAMIENTOS]: null
                })
                .neq(FIELD_ESTADO_GESTION_LANZAMIENTOS, 'Pendiente de Gestión') // Solo actualizamos lo que se tocó
                .select('id', { count: 'exact' });

            if (launchesError) throw new Error(`Error reseteando lanzamientos: ${launchesError.message}`);

            setToastInfo({
                message: `Ciclo reiniciado con éxito. ${requestsCount || 0} solicitudes archivadas y ${launchesCount || 0} gestiones reseteadas.`,
                type: 'success'
            });

        } catch (error: any) {
            console.error("Error reseteando ciclo:", error);
            setToastInfo({ message: error.message || 'Error desconocido.', type: 'error' });
        } finally {
            setIsLoading(false);
            setShowConfirm(false);
        }
    };

    return (
        <Card
            title="Reinicio de Ciclo Lectivo"
            icon="restart_alt"
            className="border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-900/10"
        >
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            <ConfirmModal
                isOpen={showConfirm}
                title="¿Confirmar Reinicio de Ciclo?"
                message="Esta acción archivará todas las solicitudes de PPS activas y reseteará el estado de gestión de los lanzamientos a 'Pendiente'. Esto prepara el sistema para el próximo año. ¿Estás seguro?"
                onConfirm={handleReset}
                onClose={() => setShowConfirm(false)}
                type="danger"
                confirmText="Sí, Reiniciar Ciclo"
            />

            <div className="p-4">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    Utiliza esta herramienta al finalizar el año académico. Archivará automáticamente las solicitudes pendientes y reseteará el estado de gestión de las instituciones para comenzar el nuevo ciclo limpio.
                </p>
                <Button
                    variant="danger"
                    onClick={() => setShowConfirm(true)}
                    isLoading={isLoading}
                    icon="warning"
                >
                    Reiniciar Ciclo (Archivar Todo)
                </Button>
            </div>
        </Card>
    );
};

export default YearEndResetTool;
