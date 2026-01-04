
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { schema } from '../lib/dbSchema';
import {
    FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES, FIELD_DNI_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES, FIELD_TELEFONO_ESTUDIANTES, FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
    FIELD_ESTADO_ESTUDIANTES, FIELD_FECHA_FINALIZACION_ESTUDIANTES, FIELD_NOTAS_INTERNAS_ESTUDIANTES,
    FIELD_NOMBRE_SEPARADO_ESTUDIANTES, FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
    FIELD_ESTUDIANTE_LINK_PRACTICAS, FIELD_HORAS_PRACTICAS, TABLE_NAME_ESTUDIANTES
} from '../constants';
import { ALL_ESTADOS_ESTUDIANTE } from '../schemas';
import Loader from './Loader';
import Toast from './ui/Toast';
import RecordEditModal from './RecordEditModal';
import PaginationControls from './PaginationControls';
import ContextMenu from './ContextMenu';
import Button from './ui/Button';
import ConfirmModal from './ConfirmModal';
import EmptyState from './EmptyState';

const TABLE_CONFIG = {
    label: 'Estudiantes',
    tableName: TABLE_NAME_ESTUDIANTES,
    schema: schema.estudiantes,
    // FIX: Eliminar DNI de searchFields para evitar errores de tipo en la búsqueda simple.
    // DNI es numérico y ilike falla. Búsqueda por Legajo y Nombre es suficiente para la mayoría de casos.
    searchFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES],
    fieldConfig: [
        { key: FIELD_LEGAJO_ESTUDIANTES, label: 'Legajo', type: 'text' as const },
        { key: FIELD_NOMBRE_SEPARADO_ESTUDIANTES, label: 'Nombre', type: 'text' as const },
        { key: FIELD_APELLIDO_SEPARADO_ESTUDIANTES, label: 'Apellido', type: 'text' as const },
        { key: FIELD_DNI_ESTUDIANTES, label: 'DNI', type: 'number' as const },
        { key: FIELD_CORREO_ESTUDIANTES, label: 'Correo', type: 'email' as const },
        { key: FIELD_TELEFONO_ESTUDIANTES, label: 'Teléfono', type: 'tel' as const },
        { key: FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES, label: 'Orientación', type: 'select' as const, options: ['', 'Clinica', 'Educacional', 'Laboral', 'Comunitaria'] },
        { key: FIELD_ESTADO_ESTUDIANTES, label: 'Estado', type: 'select' as const, options: ALL_ESTADOS_ESTUDIANTE },
        { key: FIELD_FECHA_FINALIZACION_ESTUDIANTES, label: 'Fecha Fin', type: 'date' as const },
        { key: FIELD_NOTAS_INTERNAS_ESTUDIANTES, label: 'Notas', type: 'textarea' as const },
    ]
};

const EditorEstudiantes: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [menu, setMenu] = useState<{ x: number, y: number, record: any } | null>(null);
    const [toastInfo, setToastInfo] = useState<any>(null);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    const queryClient = useQueryClient();

    // Debounce para no saturar la API mientras escribes
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data, isLoading } = useQuery({
        queryKey: ['editor-students', currentPage, itemsPerPage, debouncedSearch, filterEstado, isTestingMode],
        queryFn: async () => {
            const filters: any = {};
            if (filterEstado) filters[FIELD_ESTADO_ESTUDIANTES] = filterEstado;

            const { records, total, error } = await db.estudiantes.getPage(currentPage, itemsPerPage, {
                searchTerm: debouncedSearch,
                searchFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES],
                filters
            });
            if (error) throw error;

            // Enriquecer con horas totales para visibilidad inmediata
            const studentIds = records.map(r => r.id);
            if (studentIds.length === 0) return { records: [], total: 0 };

            const practicas = await db.practicas.getAll({
                filters: { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds },
                fields: [FIELD_ESTUDIANTE_LINK_PRACTICAS, FIELD_HORAS_PRACTICAS]
            });

            const enriched = records.map(s => {
                const sPracticas = practicas.filter(p => {
                    const link = p[FIELD_ESTUDIANTE_LINK_PRACTICAS];
                    return Array.isArray(link) ? link.includes(s.id) : link === s.id;
                });
                return {
                    ...s,
                    __totalHours: sPracticas.reduce((sum, p) => sum + (p[FIELD_HORAS_PRACTICAS] || 0), 0)
                };
            });

            return { records: enriched, total };
        }
    });

    const updateMutation = useMutation({
        mutationFn: (vars: any) => db.estudiantes.update(vars.id, vars.fields),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-students'] });
            setToastInfo({ message: 'Estudiante actualizado', type: 'success' });
            setEditingRecord(null);
        }
    });

    const createMutation = useMutation({
        mutationFn: (fields: any) => db.estudiantes.create(fields),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-students'] });
            setToastInfo({ message: 'Estudiante creado', type: 'success' });
            setEditingRecord(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => db.estudiantes.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-students'] });
            setToastInfo({ message: 'Estudiante eliminado', type: 'success' });
            setIdToDelete(null);
            setSelectedRowId(null);
        },
        onError: (err: any) => {
            setToastInfo({ message: `Error al eliminar: ${err.message}`, type: 'error' });
            setIdToDelete(null);
        }
    });

    const handleRowClick = (id: string) => {
        setSelectedRowId(prev => prev === id ? null : id);
    };

    const handleRowContextMenu = (e: React.MouseEvent, record: any) => {
        e.preventDefault();
        setSelectedRowId(record.id);
        setMenu({ x: e.clientX, y: e.clientY, record });
    };

    const getStatusStyle = (estado: string) => {
        switch (estado) {
            case 'Activo': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
            case 'Finalizado': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
            case 'Inactivo': return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
            case 'Nuevo (Sin cuenta)': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
            default: return 'bg-slate-50 text-slate-500 border-slate-200';
        }
    };

    return (
        <div className="space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            <ConfirmModal
                isOpen={!!idToDelete}
                title="¿Eliminar Estudiante?"
                message="Esta acción eliminará permanentemente al estudiante y sus registros. ¿Confirmar?"
                confirmText="Eliminar"
                type="danger"
                onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
                onClose={() => setIdToDelete(null)}
            />

            {/* BARRA DE FILTROS */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-end shadow-sm">
                <div className="flex-1 w-full space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscador Inteligente</label>
                    <div className="relative group">
                        <input
                            type="search"
                            placeholder="Nombre o legajo..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:text-slate-200"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 group-focus-within:text-blue-500 transition-colors">search</span>
                    </div>
                </div>

                <div className="w-full md:w-56 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrar Estado</label>
                    <select
                        value={filterEstado}
                        onChange={e => setFilterEstado(e.target.value)}
                        className="w-full h-11 px-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-slate-700 dark:text-slate-200"
                    >
                        <option value="">Todos</option>
                        {ALL_ESTADOS_ESTUDIANTE.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={() => setEditingRecord({ isCreating: true })} icon="person_add" className="h-11 shadow-md bg-blue-600 hover:bg-blue-700 w-full sm:w-auto px-6">Nuevo</Button>
                </div>
            </div>

            {/* ACCIONES RÁPIDAS */}
            <div className="flex justify-end h-10">
                {selectedRowId && (
                    <div className="flex gap-2 animate-fade-in">
                        <button
                            onClick={() => setIdToDelete(selectedRowId)}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-rose-100 border border-rose-200 transition-all"
                        >
                            <span className="material-icons !text-base">delete</span> Eliminar Selección
                        </button>
                    </div>
                )}
            </div>

            {/* TABLA */}
            {isLoading ? <div className="py-12"><Loader /></div> : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-[#020617] shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Estudiante</th>
                                    <th className="px-6 py-4">Legajo</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-center">Horas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data?.records.map((s: any) => {
                                    const isSelected = selectedRowId === s.id;
                                    return (
                                        <tr
                                            key={s.id}
                                            onClick={() => handleRowClick(s.id)}
                                            onDoubleClick={() => setEditingRecord(s)}
                                            onContextMenu={(e) => handleRowContextMenu(e, s)}
                                            className={`transition-all cursor-pointer group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-200 dark:ring-blue-800' : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shadow-sm border transition-transform group-hover:scale-110 ${isSelected ? 'bg-blue-600 text-white border-blue-400' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                                        {(s[FIELD_NOMBRE_ESTUDIANTES] || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className={`font-bold transition-colors ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 group-hover:text-blue-600'}`}>
                                                        {s[FIELD_NOMBRE_ESTUDIANTES]}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                                                {s[FIELD_LEGAJO_ESTUDIANTES]}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wide ${getStatusStyle(s[FIELD_ESTADO_ESTUDIANTES])}`}>
                                                    {s[FIELD_ESTADO_ESTUDIANTES] || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`text-sm font-black ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{Math.round(s.__totalHours || 0)}</span>
                                                <span className="text-[10px] text-slate-400 ml-1 font-bold uppercase">hs</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {data?.records.length === 0 && (
                        <div className="py-20 bg-slate-50/30 dark:bg-black/10">
                            <EmptyState icon="search_off" title="Sin coincidencias" message="No encontramos alumnos con esos criterios." />
                        </div>
                    )}
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
                    x={menu.x} y={menu.y}
                    onClose={() => setMenu(null)}
                    options={[
                        { label: 'Editar Perfil', icon: 'edit', onClick: () => setEditingRecord(menu.record) },
                        { label: 'Eliminar Registro', icon: 'delete', variant: 'danger', onClick: () => setIdToDelete(menu.record.id) }
                    ]}
                />
            )}

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

export default EditorEstudiantes;
