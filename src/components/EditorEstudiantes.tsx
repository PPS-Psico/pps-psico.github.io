
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { schema } from '../lib/dbSchema';
import type { AppRecord, EstudianteFields } from '../types';
import { 
    FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES, FIELD_DNI_ESTUDIANTES, 
    FIELD_CORREO_ESTUDIANTES, FIELD_TELEFONO_ESTUDIANTES, FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
    FIELD_ESTADO_ESTUDIANTES, FIELD_FECHA_FINALIZACION_ESTUDIANTES, FIELD_NOTAS_INTERNAS_ESTUDIANTES,
    FIELD_NOMBRE_SEPARADO_ESTUDIANTES, FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
    FIELD_ESTUDIANTE_LINK_PRACTICAS, FIELD_HORAS_PRACTICAS, TABLE_NAME_ESTUDIANTES
} from '../constants';
import { ALL_ESTADOS_ESTUDIANTE } from '../schemas';
import Loader from './Loader';
import Toast from './Toast';
import RecordEditModal from './RecordEditModal';
import PaginationControls from './PaginationControls';
import ContextMenu from './ContextMenu';
import Button from './Button';
import ConfirmModal from './ConfirmModal';

const TABLE_CONFIG = {
    label: 'Estudiantes',
    tableName: TABLE_NAME_ESTUDIANTES,
    schema: schema.estudiantes,
    searchFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES, FIELD_DNI_ESTUDIANTES],
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
    
    // Actions State
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [menu, setMenu] = useState<{ x: number, y: number, record: any } | null>(null);
    const [toastInfo, setToastInfo] = useState<any>(null);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    const queryClient = useQueryClient();

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data, isLoading } = useQuery({
        queryKey: ['editor-students', currentPage, itemsPerPage, debouncedSearch, filterEstado, isTestingMode],
        queryFn: async () => {
            const filters: any = {};
            if (filterEstado) filters[FIELD_ESTADO_ESTUDIANTES] = filterEstado;

            const { records, total, error } = await db.estudiantes.getPage(currentPage, itemsPerPage, {
                searchTerm: debouncedSearch,
                searchFields: TABLE_CONFIG.searchFields,
                filters
            });
            if (error) throw error;

            // Enriquecer con horas totales
            const studentIds = records.map(r => r.id);
            const practicas = await db.practicas.getAll({ filters: { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds }, fields: [FIELD_ESTUDIANTE_LINK_PRACTICAS, FIELD_HORAS_PRACTICAS] });
            
            const enriched = records.map(s => {
                const sPracticas = practicas.filter(p => {
                    const link = p[FIELD_ESTUDIANTE_LINK_PRACTICAS];
                    return Array.isArray(link) ? link.includes(s.id) : link === s.id;
                });
                return { ...s, __totalHours: sPracticas.reduce((sum, p) => sum + (p[FIELD_HORAS_PRACTICAS] || 0), 0) };
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
        },
        onError: (err: any) => {
            setToastInfo({ message: `Error al eliminar: ${err.message}`, type: 'error' });
            setIdToDelete(null);
        }
    });

    const handleRowContextMenu = (e: React.MouseEvent, record: any) => {
        e.preventDefault();
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
                message="Esta acción eliminará al estudiante y sus datos asociados. No se puede deshacer."
                confirmText="Eliminar Definitivamente"
                cancelText="Cancelar"
                type="danger"
                onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
                onClose={() => setIdToDelete(null)}
            />

            {/* --- FILTROS --- */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-6 items-end shadow-sm">
                <div className="relative md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest ml-1">Buscador</label>
                    <div className="relative">
                        <input 
                            type="search" 
                            placeholder="Buscar por nombre, legajo o DNI..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:text-slate-100"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 text-lg">search</span>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest ml-1">Estado</label>
                    <div className="relative">
                        <select 
                            value={filterEstado} 
                            onChange={e => setFilterEstado(e.target.value)}
                            className="w-full h-11 pl-4 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-colors"
                        >
                            <option value="">Todos los Estados</option>
                            {ALL_ESTADOS_ESTUDIANTE.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                </div>

                <div>
                    <Button onClick={() => setEditingRecord({ isCreating: true })} icon="person_add" className="h-11 w-full bg-indigo-600 hover:bg-indigo-700">Nuevo</Button>
                </div>
            </div>

            {/* --- TABLA --- */}
            {isLoading ? <div className="py-12"><Loader /></div> : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-indigo-50/70 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Estudiante</th>
                                    <th className="px-6 py-4 font-mono">Legajo</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-center">Horas Acumuladas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data?.records.map((s: any) => (
                                    <tr 
                                        key={s.id} 
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                        onDoubleClick={() => setEditingRecord(s)}
                                        onContextMenu={(e) => handleRowContextMenu(e, s)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-white dark:from-indigo-900 dark:to-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-300 text-sm font-bold border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                                    {(s[FIELD_NOMBRE_ESTUDIANTES] || '?').charAt(0)}
                                                </div>
                                                <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {s[FIELD_NOMBRE_ESTUDIANTES]}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                                            {s[FIELD_LEGAJO_ESTUDIANTES]}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getStatusStyle(s[FIELD_ESTADO_ESTUDIANTES])}`}>
                                                {s[FIELD_ESTADO_ESTUDIANTES] || 'Desconocido'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-black text-slate-700 dark:text-slate-200 text-base">{s.__totalHours}</span>
                                            <span className="text-[10px] text-slate-400 ml-1 font-bold uppercase">hs</span>
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

            {/* --- MENÚ CONTEXTUAL --- */}
            {menu && (
                <ContextMenu 
                    x={menu.x} 
                    y={menu.y} 
                    onClose={() => setMenu(null)}
                    options={[
                        { label: 'Editar Estudiante', icon: 'edit', onClick: () => setEditingRecord(menu.record) },
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

export default EditorEstudiantes;
