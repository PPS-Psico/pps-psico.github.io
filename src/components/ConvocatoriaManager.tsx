
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGestionConvocatorias, FilterType } from '../hooks/useGestionConvocatorias';
import {
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
} from '../constants';
import { normalizeStringForComparison } from '../utils/formatters';
import Loader from './Loader';
import Toast from './ui/Toast';
import EmptyState from './EmptyState';
import GestionCard from './GestionCard';
import CollapsibleSection from './CollapsibleSection';

interface ConvocatoriaManagerProps {
    forcedOrientations?: string[];
    isTestingMode?: boolean;
}

const ConvocatoriaManager: React.FC<ConvocatoriaManagerProps> = ({ forcedOrientations, isTestingMode = false }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialFilter = (searchParams.get('filter') as FilterType) || 'all';

    const {
        institutionsMap,
        loadingState,
        error,
        toastInfo,
        setToastInfo,
        updatingIds,
        searchTerm,
        setSearchTerm,
        handleSave,
        handleUpdateInstitutionPhone,
        filteredData,
        filterType,
        setFilterType
    } = useGestionConvocatorias({ forcedOrientations, isTestingMode, initialFilter });

    // Sync state with URL when it changes manually
    useEffect(() => {
        if (filterType !== 'all') {
            setSearchParams({ filter: filterType });
        } else {
            setSearchParams({});
        }
    }, [filterType, setSearchParams]);

    if (loadingState === 'loading' || loadingState === 'initial') return <div className="flex justify-center p-10"><Loader /></div>;
    if (error) return <EmptyState icon="error" title="Error" message={error} />;

    return (
        <div className="animate-fade-in-up space-y-8">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            {/* HEADER: Estilo Premium Dark */}
            <div className="p-4 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm sticky top-20 z-30 backdrop-blur-md bg-white/90 dark:bg-[#0F172A]/90">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 whitespace-nowrap">
                            <span className="material-icons text-blue-600 dark:text-blue-400">tune</span>
                            Panel de Gestión
                        </h2>

                        {/* Filter Tabs - Darker Backgrounds */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-black/40 p-1 rounded-lg border border-transparent dark:border-white/5">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                Todo
                            </button>
                            <button
                                onClick={() => setFilterType('vencidas')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterType === 'vencidas' ? 'bg-white dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 shadow-sm border border-transparent dark:border-rose-800/50' : 'text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400'}`}
                            >
                                <span className="material-icons !text-xs">priority_high</span> Vencidas
                            </button>
                            <button
                                onClick={() => setFilterType('proximas')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterType === 'proximas' ? 'bg-white dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 shadow-sm border border-transparent dark:border-amber-800/50' : 'text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400'}`}
                            >
                                <span className="material-icons !text-xs">schedule</span> Próximas
                            </button>
                        </div>
                    </div>

                    <div className="relative w-full sm:w-80 group">
                        <input
                            id="pps-filter"
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Filtrar por nombre de PPS..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-slate-50 dark:bg-black/20 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors">search</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 1: RELANZAMIENTOS CONFIRMADOS (Si los hay) */}
            {filteredData.relanzamientosConfirmados.length > 0 && filterType === 'all' && (
                <CollapsibleSection
                    title="Relanzamientos Confirmados"
                    count={filteredData.relanzamientosConfirmados.length}
                    icon="flight_takeoff"
                    iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    borderColor="border-emerald-300 dark:border-emerald-800"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
                        {filteredData.relanzamientosConfirmados.map(pps => (
                            <GestionCard
                                key={pps.id}
                                pps={pps}
                                onSave={handleSave}
                                isUpdating={updatingIds.has(pps.id)}
                                cardType="relanzamientosConfirmados"
                                institution={institutionsMap.get(normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || ''))}
                                onSavePhone={handleUpdateInstitutionPhone}
                            />
                        ))}
                    </div>
                </CollapsibleSection>
            )}

            {/* SECCIÓN 2: PENDIENTES DE GESTIÓN (LISTADO PRINCIPAL SIN PAGINACIÓN) */}
            {filteredData.pendientesDeGestion.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <span className="material-icons text-blue-500 dark:text-blue-400">inbox</span>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            {filterType === 'vencidas' ? 'Instituciones Vencidas' : filterType === 'proximas' ? 'Vencimientos Próximos' : 'Instituciones para Gestionar'}
                        </h3>
                        <span className="ml-2 text-sm font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                            {filteredData.pendientesDeGestion.length}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
                        {filteredData.pendientesDeGestion.map((pps: any) => (
                            <GestionCard
                                key={pps.id}
                                pps={pps}
                                onSave={handleSave}
                                isUpdating={updatingIds.has(pps.id)}
                                cardType="pendientes"
                                institution={institutionsMap.get(normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || ''))}
                                onSavePhone={handleUpdateInstitutionPhone}
                                daysLeft={pps.daysLeft} // Pass calculated days left
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <EmptyState
                    icon={filterType === 'vencidas' ? "check_circle" : "done_all"}
                    title={filterType === 'vencidas' ? "Al día" : "Bandeja Vacía"}
                    message={filterType === 'vencidas' ? "No hay convocatorias vencidas pendientes de gestión." : "No hay instituciones en esta categoría."}
                />
            )}
        </div>
    );
};

export default ConvocatoriaManager;
