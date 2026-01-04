
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { schema } from '../lib/dbSchema';
import {
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS, FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS, FIELD_HORARIO_FORMULA_CONVOCATORIAS,
    TABLE_NAME_CONVOCATORIAS, FIELD_NOMBRE_ESTUDIANTES,
    FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_NOMBRE_PPS_CONVOCATORIAS,
    FIELD_FECHA_INICIO_LANZAMIENTOS, FIELD_FECHA_INICIO_CONVOCATORIAS
} from '../constants';
import { formatDate } from '../utils/formatters';
import Loader from './Loader';
import RecordEditModal from './RecordEditModal';
import Toast from './ui/Toast';
import PaginationControls from './PaginationControls';
import ContextMenu from './ContextMenu';
import AdminSearch from './AdminSearch';
import Button from './ui/Button';
import ConfirmModal from './ConfirmModal';

const TABLE_CONFIG = {
    label: 'Inscripciones',
    tableName: TABLE_NAME_CONVOCATORIAS,
    schema: schema.convocatorias,
    searchFields: [FIELD_NOMBRE_PPS_CONVOCATORIAS],
    fieldConfig: [
        { key: FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS, label: 'ID Estudiante', type: 'text' as const },
        { key: FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, label: 'ID Lanzamiento', type: 'text' as const },
        { key: FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS, label: 'Estado', type: 'select' as const, options: ['Inscripto', 'Seleccionado', 'No Seleccionado', 'Baja'] },
        { key: FIELD_HORARIO_FORMULA_CONVOCATORIAS, label: 'Horario Asignado', type: 'text' as const },
    ]
};

const getStatusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('seleccionado') && !s.includes('no')) {
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    }
    if (s.includes('inscripto')) {
        return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    }
    if (s.includes('no seleccionado')) {
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';
    }
    if (s.includes('baja')) {
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
};

const EditorConvocatorias: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
    // --- FILTROS ---
    const [filterStudentId, setFilterStudentId] = useState('');
    const [studentLabel, setStudentLabel] = useState('');
    const [filterLanzamientoId, setFilterLanzamientoId] = useState('');

    // --- PAGINACIÓN ---
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // --- ACCIONES ---
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [menu, setMenu] = useState<{ x: number, y: number, record: any } | null>(null);
    const [toastInfo, setToastInfo] = useState<any>(null);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    const queryClient = useQueryClient();

    // 1. Cargar Lanzamientos para el filtro
    const { data: launches = [] } = useQuery({
        queryKey: ['launches-filter-list'],
        queryFn: () => db.lanzamientos.getAll({
            fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS],
            sort: [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: 'desc' }]
        })
    });

    // 2. Cargar Convocatorias
    const { data, isLoading } = useQuery({
        queryKey: ['editor-convocatorias', currentPage, itemsPerPage, filterStudentId, filterLanzamientoId],
        queryFn: async () => {
            const filters: any = {};
            if (filterStudentId) filters[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] = filterStudentId;
            if (filterLanzamientoId) filters[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] = filterLanzamientoId;

            const { records, total, error } = await db.convocatorias.getPage(currentPage, itemsPerPage, {
                filters,
                sort: { field: 'created_at', direction: 'desc' }
            });
            if (error) throw error;

            // Enriquecer datos (Nombre estudiante y Nombre PPS)
            const studentIds = records.map(r => r[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string).filter(Boolean);
            const launchIds = records.map(r => r[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] as string).filter(Boolean);

            const [students, fetchedLaunches] = await Promise.all([
                db.estudiantes.getAll({ filters: { id: studentIds }, fields: [FIELD_NOMBRE_ESTUDIANTES] }),
                db.lanzamientos.getAll({ filters: { id: launchIds }, fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS] })
            ]);

            const studentMap = new Map(students.map(s => [s.id, s]));
            const launchMap = new Map(fetchedLaunches.map(l => [l.id, l]));

            const enriched = records.map(c => {
                const sId = c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string;
                const lId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] as string;

                const s = sId ? studentMap.get(sId) : null;
                const l = lId ? launchMap.get(lId) : null;

                return {
                    ...c,
                    __studentName: s ? s[FIELD_NOMBRE_ESTUDIANTES] : 'Desconocido',
                    __ppsName: l ? l[FIELD_NOMBRE_PPS_LANZAMIENTOS] : (c[FIELD_NOMBRE_PPS_CONVOCATORIAS] || 'N/A')
                };
            });

            return { records: enriched, total };
        }
    });

    // --- MUTACIONES ---
    const updateMutation = useMutation({
        mutationFn: (vars: any) => db.convocatorias.update(vars.id, vars.fields),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-convocatorias'] });
            setToastInfo({ message: 'Inscripción actualizada', type: 'success' });
            setEditingRecord(null);
        }
    });

    const createMutation = useMutation({
        mutationFn: (fields: any) => db.convocatorias.create(fields),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-convocatorias'] });
            setToastInfo({ message: 'Inscripción creada', type: 'success' });
            setEditingRecord(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => db.convocatorias.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-convocatorias'] });
            setToastInfo({ message: 'Inscripción eliminada', type: 'success' });
            setIdToDelete(null);
            setSelectedRowId(null);
        },
        onError: () => {
            setToastInfo({ message: 'Error al eliminar', type: 'error' });
            setIdToDelete(null);
        }
    });

    const handleRowContextMenu = (e: React.MouseEvent, record: any) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, record });
        setSelectedRowId(record.id);
    };

    return (
        <div className="space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            <ConfirmModal
                isOpen={!!idToDelete}
                title="¿Eliminar Inscripción?"
                message="Esta acción eliminará el registro de inscripción. No se puede deshacer."
                confirmText="Eliminar Definitivamente"
                cancelText="Cancelar"
                type="danger"
                onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
                onClose={() => setIdToDelete(null)}
            />

            {/* --- FILTROS --- */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6 items-end shadow-sm">

                {/* Filtro Estudiante */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest ml-1">Estudiante</label>
                    {!filterStudentId ? (
                        <div className="h-11"><AdminSearch onStudentSelect={(s) => { setFilterStudentId(s.id); setStudentLabel(s[FIELD_NOMBRE_ESTUDIANTES] || ''); }} /></div>
                    ) : (
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 h-11 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <span className="text-xs font-bold truncate text-indigo-800 dark:text-indigo-300">{studentLabel}</span>
                            <button onClick={() => setFilterStudentId('')} className="material-icons !text-sm text-indigo-400 hover:text-indigo-600 transition-colors">close</button>
                        </div>
                    )}
                </div>

                {/* Filtro Lanzamiento */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest ml-1">Lanzamiento / PPS</label>
                    <div className="relative">
                        <select
                            value={filterLanzamientoId}
                            onChange={e => setFilterLanzamientoId(e.target.value)}
                            className="w-full h-11 pl-4 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-all text-slate-700 dark:text-slate-200"
                        >
                            <option value="">Todas las convocatorias</option>
                            {launches.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l[FIELD_NOMBRE_PPS_LANZAMIENTOS]} ({formatDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS])})
                                </option>
                            ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={() => setEditingRecord({ isCreating: true })} icon="add_card" className="h-11 w-full md:w-auto bg-indigo-600 hover:bg-indigo-700">Nueva Inscripción</Button>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={() => selectedRowId && setIdToDelete(selectedRowId)}
                    disabled={!selectedRowId}
                    className={`bg-white border border-rose-300 text-rose-600 font-bold py-2 px-5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all ${!selectedRowId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-rose-50 shadow-sm'}`}
                >
                    <span className="material-icons !text-lg">delete</span>
                    Eliminar
                </button>
            </div>

            {/* --- TABLA --- */}
            {isLoading ? <div className="py-12"><Loader /></div> : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-indigo-50/70 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Estudiante</th>
                                    <th className="px-6 py-4">Convocatoria PPS</th>
                                    <th className="px-6 py-4">Horario</th>
                                    <th className="px-6 py-4">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data?.records.map((c: any) => {
                                    const badgeClass = getStatusStyle(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]);
                                    const isSelected = selectedRowId === c.id;

                                    return (
                                        <tr
                                            key={c.id}
                                            className={`transition-colors cursor-pointer group ${isSelected
                                                ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-300 dark:ring-blue-700'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                }`}
                                            onClick={() => setSelectedRowId(isSelected ? null : c.id)}
                                            onDoubleClick={() => setEditingRecord(c)}
                                            onContextMenu={(e) => handleRowContextMenu(e, c)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-white dark:from-indigo-900 dark:to-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-300 text-sm font-bold border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                                        {(c.__studentName || '?').charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {c.__studentName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-2">
                                                    <span className="material-icons text-slate-300 !text-base mt-0.5">business</span>
                                                    <div className="font-medium text-slate-700 dark:text-slate-300 text-xs sm:text-sm truncate max-w-[280px]" title={c.__ppsName}>
                                                        {c.__ppsName}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 inline-block max-w-[200px] truncate" title={c[FIELD_HORARIO_FORMULA_CONVOCATORIAS]}>
                                                    <span className="material-icons !text-xs opacity-60">schedule</span>
                                                    {c[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || 'Sin horario'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wide shadow-sm ${badgeClass}`}>
                                                    {c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || 'Pendiente'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
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

            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    onClose={() => setMenu(null)}
                    options={[
                        { label: 'Editar Inscripción', icon: 'edit', onClick: () => setEditingRecord(menu.record) },
                        { label: 'Eliminar', icon: 'delete', variant: 'danger', onClick: () => setIdToDelete(menu.record.id) }
                    ]}
                />
            )}

            {/* --- MODAL DE EDICIÓN --- */}
            {editingRecord && (
                <RecordEditModal
                    isOpen={!!editingRecord}
                    onClose={() => setEditingRecord(null)}
                    record={editingRecord.isCreating ? null : editingRecord}
                    tableConfig={TABLE_CONFIG}
                    onSave={(id, fields) => id ? updateMutation.mutate({ id, fields }) : createMutation.mutate(fields)}
                    isSaving={updateMutation.isPending || createMutation.isPending}
                />
            )}
        </div>
    );
};

export default EditorConvocatorias;
