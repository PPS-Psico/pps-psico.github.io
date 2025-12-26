
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { schema } from '../lib/dbSchema';
import { 
    FIELD_ESTUDIANTE_LINK_PRACTICAS, FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, 
    FIELD_ESPECIALIDAD_PRACTICAS, FIELD_HORAS_PRACTICAS, FIELD_FECHA_INICIO_PRACTICAS, 
    FIELD_FECHA_FIN_PRACTICAS, FIELD_ESTADO_PRACTICA, FIELD_NOTA_PRACTICAS,
    TABLE_NAME_PRACTICAS, FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES,
    FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_NOMBRE_INSTITUCIONES, FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
    FIELD_FECHA_INICIO_LANZAMIENTOS
} from '../constants';
import { ALL_ORIENTACIONES } from '../types';
import { formatDate, getEspecialidadClasses, getStatusVisuals, cleanInstitutionName, safeGetId } from '../utils/formatters';
import Loader from './Loader';
import RecordEditModal from './RecordEditModal';
import ContextMenu from './ContextMenu';
import DuplicateToStudentModal from './DuplicateToStudentModal';
import AdminSearch from './AdminSearch';
import Toast from './Toast';
import Button from './Button';
import PaginationControls from './PaginationControls';
import ConfirmModal from './ConfirmModal';

const TABLE_CONFIG = {
    label: 'Prácticas',
    tableName: TABLE_NAME_PRACTICAS,
    schema: schema.practicas,
    fieldConfig: [
        { key: FIELD_ESTUDIANTE_LINK_PRACTICAS, label: 'ID Estudiante', type: 'text' as const },
        { key: FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, label: 'ID Lanzamiento', type: 'text' as const },
        { key: FIELD_ESPECIALIDAD_PRACTICAS, label: 'Especialidad', type: 'select' as const, options: ALL_ORIENTACIONES },
        { key: FIELD_HORAS_PRACTICAS, label: 'Horas', type: 'number' as const },
        { key: FIELD_FECHA_INICIO_PRACTICAS, label: 'Inicio', type: 'date' as const },
        { key: FIELD_FECHA_FIN_PRACTICAS, label: 'Fin', type: 'date' as const },
        { key: FIELD_ESTADO_PRACTICA, label: 'Estado', type: 'select' as const, options: ['En curso', 'Finalizada', 'Convenio Realizado', 'No se pudo concretar'] },
        { key: FIELD_NOTA_PRACTICAS, label: 'Nota', type: 'text' as const },
    ]
};

const EditorPracticas: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
    // --- FILTROS ---
    const [filterStudentId, setFilterStudentId] = useState('');
    const [studentLabel, setStudentLabel] = useState('');
    const [selectedInstId, setSelectedInstId] = useState('');
    const [selectedLaunchId, setSelectedLaunchId] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // --- ACCIONES ---
    const [menu, setMenu] = useState<{ x: number, y: number, record: any } | null>(null);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [duplicatingRecord, setDuplicatingRecord] = useState<any>(null);
    const [toastInfo, setToastInfo] = useState<any>(null);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    const queryClient = useQueryClient();

    // 1. Instituciones para el filtro
    const { data: institutions = [] } = useQuery({
        queryKey: ['institutions-filter'],
        queryFn: () => db.instituciones.getAll({ fields: [FIELD_NOMBRE_INSTITUCIONES] })
    });

    // 2. Convocatorias de la institución seleccionada
    const { data: launches = [] } = useQuery({
        queryKey: ['launches-filter', selectedInstId],
        queryFn: async () => {
            const inst = institutions.find(i => i.id === selectedInstId);
            if (!inst) return [];
            
            const rawName = cleanInstitutionName(inst[FIELD_NOMBRE_INSTITUCIONES]);
            const searchName = rawName.split(/ [-–—] /)[0].split('(')[0].trim();

            return db.lanzamientos.getAll({ 
                filters: { [FIELD_NOMBRE_PPS_LANZAMIENTOS]: `%${searchName}%` },
                fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS]
            });
        },
        enabled: !!selectedInstId
    });

    // 3. Cargar Prácticas con todos los filtros cruzados
    const { data, isLoading } = useQuery({
        queryKey: ['editor-practicas', currentPage, itemsPerPage, filterStudentId, selectedInstId, selectedLaunchId],
        queryFn: async () => {
            const filters: any = {};
            
            if (filterStudentId) filters[FIELD_ESTUDIANTE_LINK_PRACTICAS] = filterStudentId;
            
            if (selectedLaunchId) {
                filters[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] = selectedLaunchId;
            } else if (selectedInstId) {
                const inst = institutions.find(i => i.id === selectedInstId);
                if (inst) {
                    const rawName = cleanInstitutionName(inst[FIELD_NOMBRE_INSTITUCIONES]);
                    const searchName = rawName.split(/ [-–—] /)[0].split('(')[0].trim();
                    filters[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] = `%${searchName}%`;
                }
            }

            const { records, total, error } = await db.practicas.getPage(currentPage, itemsPerPage, { filters });
            if (error) throw error;

            // Enriquecer nombres de estudiantes
            const studentIds = Array.from(new Set(records.map(r => safeGetId(r[FIELD_ESTUDIANTE_LINK_PRACTICAS])).filter(Boolean))) as string[];
            const students = await db.estudiantes.getAll({ filters: { id: studentIds }, fields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES] });
            const studentMap = new Map(students.map(s => [s.id, s]));

            const enriched = records.map(p => ({
                ...p,
                __student: studentMap.get(safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS])!) || { nombre: 'Desconocido', legajo: '---' }
            }));

            return { records: enriched, total };
        }
    });

    // --- MUTACIONES ---
    const updateMutation = useMutation({
        mutationFn: (vars: any) => db.practicas.update(vars.id, vars.fields),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-practicas'] });
            setToastInfo({ message: 'Registro actualizado', type: 'success' });
            setEditingRecord(null);
        }
    });

    const createMutation = useMutation({
        mutationFn: (fields: any) => db.practicas.create(fields),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-practicas'] });
            setToastInfo({ message: 'Registro creado', type: 'success' });
            setEditingRecord(null);
        }
    });

    const duplicateMutation = useMutation({
        mutationFn: async ({ record, targetStudentId }: { record: any, targetStudentId: string }) => {
            const { id, created_at, createdTime, ...fields } = record;
            const cleanFields = { ...fields };
            delete cleanFields.__student;
            delete cleanFields.__studentName;

            return db.practicas.create({
                ...cleanFields,
                [FIELD_ESTUDIANTE_LINK_PRACTICAS]: targetStudentId
            } as any);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-practicas'] });
            setToastInfo({ message: 'Práctica duplicada con éxito', type: 'success' });
            setDuplicatingRecord(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => db.practicas.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-practicas'] });
            setToastInfo({ message: 'Registro eliminado', type: 'success' });
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
                title="¿Eliminar Práctica?"
                message="Esta acción eliminará el registro de la práctica. No se puede deshacer."
                confirmText="Eliminar Definitivamente"
                cancelText="Cancelar"
                type="danger"
                onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
                onClose={() => setIdToDelete(null)}
            />

            {/* --- FILTROS (INDIGO THEME) --- */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-6 items-end shadow-sm">
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest ml-1">Alumno</label>
                    {!filterStudentId ? (
                        <div className="h-11"><AdminSearch onStudentSelect={(s) => { setFilterStudentId(s.id); setStudentLabel(s[FIELD_NOMBRE_ESTUDIANTES] || ''); }} /></div>
                    ) : (
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 h-11 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <span className="text-xs font-bold truncate text-indigo-800 dark:text-indigo-300">{studentLabel}</span>
                            <button onClick={() => setFilterStudentId('')} className="material-icons !text-sm text-indigo-400 hover:text-indigo-600">close</button>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest ml-1">Institución</label>
                    <div className="relative">
                        <select 
                            value={selectedInstId} 
                            onChange={e => { setSelectedInstId(e.target.value); setSelectedLaunchId(''); }}
                            className="w-full h-11 pl-4 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-colors"
                        >
                            <option value="">Todas las instituciones</option>
                            {institutions.map(i => <option key={i.id} value={i.id}>{cleanInstitutionName(i[FIELD_NOMBRE_INSTITUCIONES])}</option>)}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest ml-1">Convocatoria</label>
                    <div className="relative">
                        <select 
                            value={selectedLaunchId} 
                            onChange={e => setSelectedLaunchId(e.target.value)}
                            disabled={!selectedInstId}
                            className="w-full h-11 pl-4 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-colors disabled:opacity-50"
                        >
                            <option value="">Cualquier fecha</option>
                            {launches.map(l => (
                                <option 
                                    key={l.id} 
                                    value={`${l.id}|${l[FIELD_NOMBRE_PPS_LANZAMIENTOS]}|${l[FIELD_FECHA_INICIO_LANZAMIENTOS]}`}
                                >
                                    {formatDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS])}
                                </option>
                            ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 pointer-events-none">expand_more</span>
                    </div>
                </div>

                <Button onClick={() => setEditingRecord({ isCreating: true })} icon="add_circle" className="h-11 w-full bg-indigo-600 hover:bg-indigo-700">Nueva Práctica</Button>
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
                                    <th className="px-6 py-4">Institución</th>
                                    <th className="px-6 py-4">Estudiante</th>
                                    <th className="px-6 py-4">Inicio</th>
                                    <th className="px-6 py-4">Finalización</th>
                                    <th className="px-6 py-4 text-center">Horas</th>
                                    <th className="px-6 py-4">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data?.records.map((p: any) => {
                                    const statusVis = getStatusVisuals(p[FIELD_ESTADO_PRACTICA]);
                                    const espVis = getEspecialidadClasses(p[FIELD_ESPECIALIDAD_PRACTICAS]);
                                    const isSelected = selectedRowId === p.id;
                                    return (
                                        <tr 
                                            key={p.id} 
                                            onClick={() => setSelectedRowId(isSelected ? null : p.id)}
                                            onContextMenu={(e) => handleRowContextMenu(e, p)}
                                            onDoubleClick={() => setEditingRecord(p)}
                                            className={`transition-colors cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' 
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className={`font-black text-base ${espVis.headerText || 'text-slate-900 dark:text-white'}`}>
                                                    {cleanInstitutionName(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS])}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-700 dark:text-slate-300">{p.__student.nombre}</div>
                                                <div className="text-[10px] font-mono text-slate-500">{p.__student.legajo}</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs">{formatDate(p[FIELD_FECHA_INICIO_PRACTICAS])}</td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                                                {formatDate(p[FIELD_FECHA_FIN_PRACTICAS])}
                                            </td>
                                            <td className="px-6 py-4 text-center font-black text-indigo-600 dark:text-indigo-400 text-base">{p[FIELD_HORAS_PRACTICAS]} hs</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${statusVis.labelClass}`}>
                                                    {p[FIELD_ESTADO_PRACTICA]}
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

            {/* --- COMPONENTES --- */}
            {menu && (
                <ContextMenu 
                    x={menu.x} y={menu.y} 
                    onClose={() => setMenu(null)}
                    options={[
                        { label: 'Editar Práctica', icon: 'edit', onClick: () => setEditingRecord(menu.record) },
                        { label: 'Duplicar a otro alumno', icon: 'content_copy', onClick: () => setDuplicatingRecord(menu.record) },
                        { label: 'Eliminar', icon: 'delete', variant: 'danger', onClick: () => setIdToDelete(menu.record.id) }
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

            {duplicatingRecord && (
                <DuplicateToStudentModal 
                    isOpen={!!duplicatingRecord}
                    onClose={() => setDuplicatingRecord(null)}
                    sourceRecordLabel={cleanInstitutionName(duplicatingRecord[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS])}
                    onConfirm={(targetId) => duplicateMutation.mutate({ record: duplicatingRecord, targetStudentId: targetId })}
                    isSaving={duplicateMutation.isPending}
                />
            )}
        </div>
    );
};

export default EditorPracticas;
