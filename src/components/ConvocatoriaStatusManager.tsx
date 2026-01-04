
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { fetchAllData, updateRecord } from '../services/supabaseService';
import type { LanzamientoPPS } from '../types';
import {
  TABLE_NAME_LANZAMIENTOS_PPS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
} from '../constants';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Toast from './ui/Toast';
import { getEspecialidadClasses, formatDate, getStatusVisuals } from '../utils/formatters';

const mockLanzamientosStatus: LanzamientoPPS[] = [
  { id: 'lanz_status_1', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Prueba Abierta', [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Abierta', [FIELD_ORIENTACION_LANZAMIENTOS]: 'Clinica' } as any,
  { id: 'lanz_status_2', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Prueba Cerrada', [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Cerrado', [FIELD_ORIENTACION_LANZAMIENTOS]: 'Laboral' } as any,
  { id: 'lanz_status_3', [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Prueba Oculta', [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Oculto', [FIELD_ORIENTACION_LANZAMIENTOS]: 'Comunitaria' } as any,
];

type LoadingState = 'initial' | 'loading' | 'loaded' | 'error';
const STATUS_OPTIONS = ['Abierta', 'Cerrado', 'Oculto'];

interface StatusCardProps {
  pps: LanzamientoPPS;
  onStatusChange: (id: string, newStatus: string) => Promise<boolean>;
  isUpdating: boolean;
}

const StatusCard: React.FC<StatusCardProps> = React.memo(({ pps, onStatusChange, isUpdating }) => {
  // Use direct value, defaulting to 'Cerrado' only if null/undefined
  const [status, setStatus] = useState(pps[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] || 'Cerrado');
  const [justSaved, setJustSaved] = useState(false);
  const especialidadVisuals = getEspecialidadClasses(pps[FIELD_ORIENTACION_LANZAMIENTOS]);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    const success = await onStatusChange(pps.id, newStatus);
    if (success) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  const headerBg = justSaved ? 'bg-emerald-50 dark:bg-emerald-900/30' : especialidadVisuals.headerBg;
  const headerTextColor = justSaved ? 'text-emerald-800 dark:text-emerald-200' : especialidadVisuals.headerText;
  const statusVisuals = getStatusVisuals(status);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-slate-200/60 dark:border-slate-700 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-px group">
      <div className={`p-3 border-b border-slate-200/60 dark:border-slate-700 transition-colors duration-300 ${headerBg}`}>
        <h4 className={`font-bold text-sm ${headerTextColor}`}>{pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]}</h4>
        <div className="mt-1">
          <span className={`${especialidadVisuals.tag} shadow-sm`}>{pps[FIELD_ORIENTACION_LANZAMIENTOS]}</span>
        </div>
      </div>
      <div className="p-3 bg-slate-50/30 dark:bg-slate-800/20">
        <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <span className="material-icons !text-sm">date_range</span>
          <span>{formatDate(pps[FIELD_FECHA_INICIO_LANZAMIENTOS])} - {formatDate(pps[FIELD_FECHA_FIN_LANZAMIENTOS])}</span>
        </p>
        <div className="mt-3 relative">
          <label htmlFor={`status-${pps.id}`} className="sr-only">Estado de la convocatoria</label>
          <div className={`absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none ${justSaved ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
            <span className="material-icons !text-base">{justSaved ? 'check_circle' : statusVisuals.icon}</span>
          </div>
          <select
            id={`status-${pps.id}`}
            value={status}
            onChange={handleStatusChange}
            disabled={isUpdating}
            className={`w-full appearance-none rounded-lg border border-slate-300 dark:border-slate-600 py-2 pl-9 pr-8 text-sm font-semibold shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none disabled:cursor-not-allowed ${justSaved ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-200 dark:ring-emerald-800/50' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'}`}
          >
            {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
            {isUpdating
              ? <div className="w-4 h-4 border-2 border-slate-400/50 dark:border-slate-500/50 border-t-slate-500 dark:border-t-slate-400 rounded-full animate-spin" />
              : <span className="material-icons !text-base text-slate-400 dark:text-slate-500">unfold_more</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
});

const CollapsibleSection: React.FC<{ title: string; count: number; children: React.ReactNode; defaultOpen?: boolean; icon: string; }> = ({ title, count, children, defaultOpen = true, icon }) => (
  <details className="group" open={defaultOpen}>
    <summary className="list-none flex items-center gap-3 cursor-pointer mb-4 p-1 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <span className="material-icons text-slate-500 dark:text-slate-400">{icon}</span>
      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-2.5 py-1 rounded-full">{count}</span>
      <div className="flex-grow border-b-2 border-slate-200/60 dark:border-slate-700/60"></div>
      <span className="material-icons text-slate-400 dark:text-slate-500 transition-transform duration-300 group-open/rotate-180">expand_more</span>
    </summary>
    {children}
  </details>
);

interface ConvocatoriaStatusManagerProps {
  isTestingMode?: boolean;
}

const ConvocatoriaStatusManager: React.FC<ConvocatoriaStatusManagerProps> = ({ isTestingMode = false }) => {
  const [lanzamientos, setLanzamientos] = useState<LanzamientoPPS[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('initial');
  const [error, setError] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingState('loading');
    setError(null);

    if (isTestingMode) {
      setLanzamientos(mockLanzamientosStatus);
      setLoadingState('loaded');
      return;
    }

    const { records, error: fetchError } = await fetchAllData(
      TABLE_NAME_LANZAMIENTOS_PPS,
      [
        FIELD_NOMBRE_PPS_LANZAMIENTOS,
        FIELD_FECHA_INICIO_LANZAMIENTOS,
        FIELD_FECHA_FIN_LANZAMIENTOS,
        FIELD_ORIENTACION_LANZAMIENTOS,
        FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
      ],
      undefined,
      [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: 'desc' }]
    );

    if (fetchError) {
      setError('No se pudieron cargar las convocatorias. ' + (typeof fetchError.error === 'string' ? fetchError.error : fetchError.error.message));
      setLoadingState('error');
    } else {
      const mappedRecords = records.map(r => ({ ...r, id: r.id } as LanzamientoPPS));
      setLanzamientos(mappedRecords);
      setLoadingState('loaded');
    }
  }, [isTestingMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = useCallback(async (id: string, newStatus: string): Promise<boolean> => {
    setUpdatingId(id);

    if (isTestingMode) {
      console.log("TEST MODE: Simulating status change for", id, newStatus);
      await new Promise(resolve => setTimeout(resolve, 500));
      setLanzamientos(prev => prev.map(pps => pps.id === id ? { ...pps, [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: newStatus } : pps));
      setToastInfo({ message: 'Estado (simulado) actualizado.', type: 'success' });
      setUpdatingId(null);
      return true;
    }

    // FIX: Update estado_gestion to un-archive if needed
    const updates: any = {
      [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: newStatus
    };

    // Si abrimos la convocatoria, nos aseguramos de que no esté archivada internamente
    if (newStatus === 'Abierta') {
      updates[FIELD_ESTADO_GESTION_LANZAMIENTOS] = 'Relanzamiento Confirmado';
    }

    const { error: updateError } = await updateRecord(TABLE_NAME_LANZAMIENTOS_PPS, id, updates);

    let success = false;
    if (updateError) {
      setToastInfo({ message: 'Error al actualizar el estado.', type: 'error' });
    } else {
      setToastInfo({ message: 'Estado actualizado exitosamente.', type: 'success' });
      setLanzamientos(prev => prev.map(pps => pps.id === id ? { ...pps, [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: newStatus } : pps));
      success = true;
    }

    setUpdatingId(null);
    return success;
  }, [isTestingMode]);

  const groupedLanzamientos = useMemo(() => {
    const abiertas: LanzamientoPPS[] = [];
    const cerradas: LanzamientoPPS[] = [];
    const ocultas: LanzamientoPPS[] = [];

    lanzamientos.forEach(pps => {
      const status = pps[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS];
      // No sanitization needed, use exact value
      if (status === 'Abierta') abiertas.push(pps);
      else if (status === 'Oculto') ocultas.push(pps);
      else cerradas.push(pps);
    });
    return { abiertas, cerradas, ocultas };
  }, [lanzamientos]);

  const renderContent = () => {
    if (loadingState === 'loading' || loadingState === 'initial') return <Loader />;
    if (loadingState === 'error') return <EmptyState icon="error" title="Error" message={error!} />;
    if (lanzamientos.length === 0) return <EmptyState icon="folder_off" title="Sin Convocatorias" message="No se encontraron convocatorias para gestionar." />;

    return (
      <div className="space-y-8">
        <CollapsibleSection title="Abiertas" count={groupedLanzamientos.abiertas.length} icon="door_open" defaultOpen>
          {groupedLanzamientos.abiertas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedLanzamientos.abiertas.map(pps => <StatusCard key={pps.id} pps={pps} onStatusChange={handleStatusChange} isUpdating={updatingId === pps.id} />)}
            </div>
          ) : <p className="text-slate-500 dark:text-slate-400 text-sm">No hay convocatorias abiertas.</p>}
        </CollapsibleSection>

        <CollapsibleSection title="Cerradas" count={groupedLanzamientos.cerradas.length} icon="lock">
          {groupedLanzamientos.cerradas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedLanzamientos.cerradas.map(pps => <StatusCard key={pps.id} pps={pps} onStatusChange={handleStatusChange} isUpdating={updatingId === pps.id} />)}
            </div>
          ) : <p className="text-slate-500 dark:text-slate-400 text-sm">No hay convocatorias cerradas.</p>}
        </CollapsibleSection>

        <CollapsibleSection title="Ocultas" count={groupedLanzamientos.ocultas.length} icon="visibility_off">
          {groupedLanzamientos.ocultas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedLanzamientos.ocultas.map(pps => <StatusCard key={pps.id} pps={pps} onStatusChange={handleStatusChange} isUpdating={updatingId === pps.id} />)}
            </div>
          ) : <p className="text-slate-500 dark:text-slate-400 text-sm">No hay convocatorias ocultas.</p>}
        </CollapsibleSection>
      </div>
    );
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
      {renderContent()}
    </div>
  );
};

export default ConvocatoriaStatusManager;
