

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { schema } from '../lib/dbSchema';
import { 
    FIELD_NOMBRE_INSTITUCIONES, FIELD_TELEFONO_INSTITUCIONES, 
    FIELD_DIRECCION_INSTITUCIONES, FIELD_CONVENIO_NUEVO_INSTITUCIONES,
    TABLE_NAME_INSTITUCIONES, FIELD_TUTOR_INSTITUCIONES, FIELD_ORIENTACIONES_INSTITUCIONES,
    FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS, FIELD_ESPECIALIDAD_PRACTICAS
} from '../constants';
import Loader from './Loader';
import RecordEditModal from './RecordEditModal';
import Toast from './Toast';
import ContextMenu from './ContextMenu';
import Button from './Button';
import PaginationControls from './PaginationControls';
import { normalizeStringForComparison, getEspecialidadClasses, cleanInstitutionName, toTitleCase } from '../utils/formatters';
import ConfirmModal from './ConfirmModal';

const TABLE_CONFIG = {
    label: 'Instituciones',
    tableName: TABLE_NAME_INSTITUCIONES,
    schema: schema.instituciones,
    searchFields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_DIRECCION_INSTITUCIONES],
    fieldConfig: [
        { key: FIELD_NOMBRE_INSTITUCIONES, label: 'Nombre', type: 'text' as const },
        { key: FIELD_TELEFONO_INSTITUCIONES, label: 'Teléfono', type: 'tel' as const },
        { key: FIELD_DIRECCION_INSTITUCIONES, label: 'Dirección', type: 'text' as const },
        { key: FIELD_CONVENIO_NUEVO_INSTITUCIONES, label: 'Año del Convenio', type: 'select' as const, options: ['2024', '2025', '2026', 'Legacy', 'No'] },
        { key: FIELD_TUTOR_INSTITUCIONES, label: 'Tutor', type: 'text' as const },
        { key: FIELD_ORIENTACIONES_INSTITUCIONES, label: 'Orientaciones (Calc. Automático)', type: 'text' as const },
    ]
};

const LISTA_CONVENIOS_2024 = [
    "Banco Provincia del Neuquen",
    "Centro de Inclusión Social y Laboral APASIDO",
    "Colegio Nuestra Señora de Fátima",
    "Colegio San José Obrero de Neuquén",
    "Escuela Cristiana Vida",
    "Ministerio de Trabajo y Desarrollo Laboral"
];
const LISTA_CONVENIOS_2025 = [
    "Centro Evaluador Camioneros",
    "Colegio Psicólogos CPAVZO",
    "Consultorios Las Lilas",
    "Corporate Resources",
    "Escuela de Formación Cooperativa y Laboral N8",
    "Fundación Kano",
    "Hospital Centenario Natalio Burd",
    "Institución Fernando Ulloa",
    "Instituto de Formación Docente N4",
    "Randstad",
    "Sanatorio Juan XXIII",
    "Subsecretaría de Familia",
    "Clinica Fava",
    "ACUCADES"
];

const EditorInstituciones: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [menu, setMenu] = useState<{ x: number, y: number, record: any } | null>(null);
    const [toastInfo, setToastInfo] = useState<any>(null);
    const [isFixingData, setIsFixingData] = useState(false);
    const [isSyncingOrientations, setIsSyncingOrientations] = useState(false);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['editor-instituciones', currentPage, itemsPerPage, searchTerm],
        queryFn: async () => {
            const result = await db.instituciones.getPage(currentPage, itemsPerPage, {
                searchTerm,
                searchFields: TABLE_CONFIG.searchFields,
                sort: { field: FIELD_CONVENIO_NUEVO_INSTITUCIONES, direction: 'desc' }
            });
            
            // FILTRO DE SEGURIDAD: Ocultar registros que empiezan con "UFLO -"
            if (result.records) {
                result.records = result.records.filter((r: any) => 
                    !String(r[FIELD_NOMBRE_INSTITUCIONES] || '').toUpperCase().startsWith('UFLO -')
                );
            }
            return result;
        }
    });

    const handleError = (e: Error) => {
        console.error(e);
        setToastInfo({ message: `Error: ${e.message}`, type: 'error' });
    };

    const updateMutation = useMutation({
        mutationFn: (vars: any) => {
            let val = vars.fields[FIELD_CONVENIO_NUEVO_INSTITUCIONES];
            if (val === 'No' || val === 'false') val = null;
            if (val === 'Legacy' || val === 'true') val = 'Legacy';
            
            const cleanFields = {
                ...vars.fields,
                [FIELD_CONVENIO_NUEVO_INSTITUCIONES]: val
            };
            return db.instituciones.update(vars.id, cleanFields);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-instituciones'] });
            setToastInfo({ message: 'Institución actualizada', type: 'success' });
            setEditingRecord(null);
        },
        onError: handleError
    });

    const createMutation = useMutation({
        mutationFn: (fields: any) => db.instituciones.create(fields),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-instituciones'] });
            setToastInfo({ message: 'Institución creada', type: 'success' });
            setEditingRecord(null);
        },
        onError: handleError
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => db.instituciones.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-instituciones'] });
            setToastInfo({ message: 'Institución eliminada', type: 'success' });
            setIdToDelete(null);
        },
        onError: (err) => {
             handleError(err as Error);
             setIdToDelete(null);
        }
    });

    const handleBatchFix = async () => {
        setIsFixingData(true);
        try {
            const allInstitutions = await db.instituciones.getAll({ 
                fields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_CONVENIO_NUEVO_INSTITUCIONES] 
            });
            
            const updates: any[] = [];
            const processList = (list: string[], year: string) => {
                for (const instNameFromList of list) {
                    const targetNorm = normalizeStringForComparison(instNameFromList);
                    const matches = allInstitutions.filter((i: any) => {
                        const name = String(i[FIELD_NOMBRE_INSTITUCIONES] || '');
                        if (name.toUpperCase().startsWith('UFLO -')) return false;

                        const dbNameNorm = normalizeStringForComparison(name);
                        return dbNameNorm.includes(targetNorm) || targetNorm.includes(dbNameNorm);
                    });
                    for (const match of matches) {
                         if (String(match[FIELD_CONVENIO_NUEVO_INSTITUCIONES]) !== year) {
                             updates.push({ id: match.id, fields: { [FIELD_CONVENIO_NUEVO_INSTITUCIONES]: year } });
                         }
                    }
                }
            };
            processList(LISTA_CONVENIOS_2024, '2024');
            processList(LISTA_CONVENIOS_2025, '2025');
            
            const uniqueUpdates = Array.from(new Map(updates.map(item => [item.id, item])).values());
            if (uniqueUpdates.length > 0) {
                 await db.instituciones.updateMany(uniqueUpdates as any);
                 queryClient.invalidateQueries({ queryKey: ['editor-instituciones'] });
                 setToastInfo({ message: `Se actualizaron ${uniqueUpdates.length} convenios.`, type: 'success' });
            } else {
                 setToastInfo({ message: `No hay nuevas instituciones para actualizar.`, type: 'info' });
            }
        } catch (e: any) { handleError(e); } finally { setIsFixingData(false); }
    };

    const handleSyncOrientations = async () => {
        setIsSyncingOrientations(true);
        try {
            const [allInstitutions, allPracticas] = await Promise.all([
                db.instituciones.getAll({ fields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_ORIENTACIONES_INSTITUCIONES] }),
                db.practicas.getAll({ fields: [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS, FIELD_ESPECIALIDAD_PRACTICAS] })
            ]);

            const orientationsMap = new Map<string, Set<string>>();
            
            allPracticas.forEach((p: any) => {
                const name = cleanInstitutionName(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]);
                const especialidad = p[FIELD_ESPECIALIDAD_PRACTICAS];
                if (name && especialidad) {
                    const normName = normalizeStringForComparison(name.split('-')[0].trim());
                    const normEsp = toTitleCase(especialidad.trim()); 
                    
                    if (!orientationsMap.has(normName)) orientationsMap.set(normName, new Set());
                    orientationsMap.get(normName)!.add(normEsp);
                }
            });

            const updates: any[] = [];
            for (const inst of allInstitutions) {
                const name = inst[FIELD_NOMBRE_INSTITUCIONES];
                if (!name) continue;
                
                if (String(name).toUpperCase().startsWith('UFLO -')) continue;

                const normName = normalizeStringForComparison(name);
                let foundOrientations = new Set<string>();
                
                if (orientationsMap.has(normName)) {
                    foundOrientations = orientationsMap.get(normName)!;
                } else {
                     for (const [key, val] of orientationsMap.entries()) {
                         if (key.length > 3 && normName.includes(key)) val.forEach(o => foundOrientations.add(o));
                     }
                }

                if (foundOrientations.size > 0) {
                    const uniqueArray = Array.from(foundOrientations).sort();
                    const limitedArray = uniqueArray.slice(0, 4); 
                    const newString = limitedArray.join(', ');
                    
                    const currentStr = String(inst[FIELD_ORIENTACIONES_INSTITUCIONES] || '').trim();
                    if (currentStr !== newString) {
                        updates.push({ id: inst.id, fields: { [FIELD_ORIENTACIONES_INSTITUCIONES]: newString } });
                    }
                }
            }

            if (updates.length > 0) {
                const CHUNK = 50;
                for (let i = 0; i < updates.length; i += CHUNK) {
                    await db.instituciones.updateMany(updates.slice(i, i + CHUNK) as any);
                }
                queryClient.invalidateQueries({ queryKey: ['editor-instituciones'] });
                setToastInfo({ message: `Orientaciones actualizadas y limpias.`, type: 'success' });
            } else {
                setToastInfo({ message: 'Todo sincronizado.', type: 'success' });
            }
        } catch (e: any) { handleError(e); } finally { setIsSyncingOrientations(false); }
    };

    const handleRowContextMenu = (e: React.MouseEvent, record: any) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, record });
    };

    const getYearBadgeStyle = (rawYear: any) => {
        if (!rawYear) return '';
        const y = String(rawYear).toLowerCase().trim();
        if (y === '2026') return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
        if (y === '2025') return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
        if (y === '2024') return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
        if (y === 'legacy' || y === 'true') return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    };

    const renderConvenioValue = (val: any) => {
        if (!val || val === 'false') return <span className="text-slate-300 text-xs">-</span>;
        let display = String(val);
        if (display === 'true') display = 'Legacy';
        return (
             <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border shadow-sm ${getYearBadgeStyle(display)}`}>
                <span className="material-icons !text-xs">verified</span>
                {display}
            </span>
        );
    }

    const renderOrientaciones = (orientacionesStr: string) => {
        if (!orientacionesStr) return <span className="text-slate-300 text-xs italic">Sin especificar</span>;
        const lista = String(orientacionesStr).split(',').map(s => s.trim()).filter(Boolean);
        return (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
                {lista.map((o, idx) => (
                    <span key={idx} className={`${getEspecialidadClasses(o).tag} px-1.5 py-0.5 rounded text-[10px] font-semibold border shadow-none truncate max-w-full`}>
                        {o}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            
            <ConfirmModal
                isOpen={!!idToDelete}
                title="¿Eliminar Institución?"
                message="Esta acción eliminará la institución. No se puede deshacer."
                confirmText="Eliminar Definitivamente"
                cancelText="Cancelar"
                type="danger"
                onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
                onClose={() => setIdToDelete(null)}
            />

            {/* --- BARRA DE FILTROS (INDIGO) --- */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-end gap-6 shadow-sm">
                <div className="relative flex-1 w-full md:w-auto space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest ml-1">Buscador</label>
                    <div className="relative">
                        <input 
                            type="search" 
                            placeholder="Buscar Institución..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:text-slate-100"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 !text-lg">search</span>
                    </div>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto flex-wrap justify-end">
                     <button onClick={handleSyncOrientations} disabled={isSyncingOrientations} className="h-11 px-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-xl font-bold text-xs border border-blue-100 dark:border-blue-800 flex items-center gap-2 hover:bg-blue-100 transition-colors">
                        {isSyncingOrientations ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <span className="material-icons !text-base">sync</span>}
                        Sincronizar Orientaciones
                    </button>
                     <button onClick={handleBatchFix} disabled={isFixingData} className="h-11 px-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-xl font-bold text-xs border border-indigo-100 dark:border-indigo-800 flex items-center gap-2 hover:bg-indigo-100 transition-colors">
                        {isFixingData ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <span className="material-icons !text-base">auto_fix_high</span>}
                        Asignar Años
                    </button>
                    <Button onClick={() => setEditingRecord({ isCreating: true })} icon="add_business" className="h-11 bg-indigo-600 hover:bg-indigo-700">Nueva</Button>
                </div>
            </div>

            {/* --- TABLA --- */}
            {isLoading ? <div className="py-12"><Loader /></div> : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-indigo-50/70 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Institución</th>
                                    <th className="px-6 py-4">Orientaciones</th>
                                    <th className="px-6 py-4 text-center">Año Convenio</th>
                                    <th className="px-6 py-4">Referente</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data?.records.map((i: any) => (
                                    <tr 
                                        key={i.id} 
                                        onContextMenu={(e) => handleRowContextMenu(e, i)} 
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-context-menu group"
                                        onDoubleClick={() => setEditingRecord(i)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-extrabold text-slate-800 dark:text-slate-100 text-base mb-1">{cleanInstitutionName(i[FIELD_NOMBRE_INSTITUCIONES])}</div>
                                            <div className="text-xs text-slate-500">{i[FIELD_DIRECCION_INSTITUCIONES]}</div>
                                        </td>
                                        <td className="px-6 py-4">{renderOrientaciones(i[FIELD_ORIENTACIONES_INSTITUCIONES])}</td>
                                        <td className="px-6 py-4 text-center">{renderConvenioValue(i[FIELD_CONVENIO_NUEVO_INSTITUCIONES])}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{i[FIELD_TUTOR_INSTITUCIONES] || 'No asignado'}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls 
                        currentPage={currentPage} 
                        totalPages={Math.ceil((data?.total || 0) / itemsPerPage)} 
                        onPageChange={setCurrentPage} 
                        itemsPerPage={itemsPerPage} 
                        onItemsPerPageChange={setItemsPerPage} 
                        totalItems={data?.total || 0}
                    />
                </div>
            )}

            {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} options={[{ label: 'Editar', icon: 'edit', onClick: () => setEditingRecord(menu.record) }, { label: 'Eliminar', icon: 'delete', variant: 'danger', onClick: () => setIdToDelete(menu.record.id) }]}/>}
            {editingRecord && <RecordEditModal isOpen={!!editingRecord} onClose={() => setEditingRecord(null)} record={editingRecord.isCreating ? null : editingRecord} tableConfig={TABLE_CONFIG} onSave={(id, fields) => id ? updateMutation.mutate({ id, fields }) : createMutation.mutate(fields)} isSaving={updateMutation.isPending || createMutation.isPending}/>}
        </div>
    );
};

export default EditorInstituciones;
