import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { schema } from '../../lib/dbSchema';
import {
    FIELD_ESTUDIANTE_LINK_PRACTICAS, FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
    FIELD_ESPECIALIDAD_PRACTICAS, FIELD_HORAS_PRACTICAS, FIELD_FECHA_INICIO_PRACTICAS,
    FIELD_FECHA_FIN_PRACTICAS, FIELD_ESTADO_PRACTICA, FIELD_NOTA_PRACTICAS,
    TABLE_NAME_PRACTICAS, FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES,
    FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_NOMBRE_INSTITUCIONES, FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
    FIELD_FECHA_INICIO_LANZAMIENTOS
} from '../../constants';
import { ALL_ORIENTACIONES } from '../../types';
import { formatDate, getStatusVisuals, cleanInstitutionName, safeGetId, getEspecialidadClasses } from '../../utils/formatters';
import Loader from '../Loader';
import RecordEditModal from './RecordEditModal';
import ContextMenu from './ContextMenu';
import DuplicateToStudentModal from './DuplicateToStudentModal';
import AdminSearch from './AdminSearch';
import Toast from '../ui/Toast';
import Button from '../ui/Button';
import PaginationControls from '../PaginationControls';
import ConfirmModal from '../ConfirmModal';
import SearchableSelect from '../SearchableSelect';

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
        { key: FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS, label: 'Nombre Institución', type: 'text' as const }
    ]
};

const EditorPracticas: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode }) => {
    const [filterStudentId, setFilterStudentId] = useState('');
    const [studentLabel, setStudentLabel] = useState('');
    const [selectedInstId, setSelectedInstId] = useState('');
    const [selectedLaunchId, setSelectedLaunchId] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    const [menu, setMenu] = useState<{ x: number, y: number, record: any } | null>(null);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [duplicatingRecord, setDuplicatingRecord] = useState<any>(null);
    const [toastInfo, setToastInfo] = useState<any>(null);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    const queryClient = useQueryClient();

    const { data: institutions = [] } = useQuery({
        queryKey: ['institutions-filter'],
        queryFn: () => db.instituciones.getAll({ fields: [FIELD_NOMBRE_INSTITUCIONES] })
    });

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

    const { data, isLoading } = useQuery({
        queryKey: ['editor-practicas', currentPage, itemsPerPage, filterStudentId, selectedInstId, selectedLaunchId],
        queryFn: async () => {
            const filters: any = {};

            // Filtro por Estudiante (Exacto UUID)
            if (filterStudentId) filters[FIELD_ESTUDIANTE_LINK_PRACTICAS] = filterStudentId;

            // --- ESTRATEGIA HÍBRIDA DE FILTRADO ---
            if (selectedInstId) {
                const inst = institutions.find(i => i.id === selectedInstId);
                if (inst) {
                    const searchName = cleanInstitutionName(inst[FIELD_NOMBRE_INSTITUCIONES]).split(' - ')[0].trim();
                    filters[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] = `%${searchName}%`;
                }
            }

            if (selectedLaunchId) {
                const launch = launches.find(l => l.id === selectedLaunchId);
                if (launch && launch[FIELD_FECHA_INICIO_LANZAMIENTOS]) {
                    filters[FIELD_FECHA_INICIO_PRACTICAS] = launch[FIELD_FECHA_INICIO_LANZAMIENTOS];
                } else {
                    filters[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] = selectedLaunchId;
                }
            }

            const { records, total, error } = await db.practicas.getPage(currentPage, itemsPerPage, { filters });
            if (error) throw error;

            const studentIds = records.map(r => safeGetId(r[FIELD_ESTUDIANTE_LINK_PRACTICAS])).filter(Boolean) as string[];
            const students = await db.estudiantes.getAll({ filters: { id: studentIds }, fields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES] });
            const studentMap = new Map(students.map(s => [s.id, s]));

            const enriched = records.map(p => ({
                ...p,
                [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: cleanInstitutionName(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]),
                __student: studentMap.get(safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]) || '') || { nombre: 'Desconocido', legajo: '---' }
            }));

            return { records: enriched, total };
        }
    });

    const sanitizeFields = (fields: any) => {
        const clean: any = { ...fields };
        if (clean[FIELD_ESTUDIANTE_LINK_PRACTICAS]) clean[FIELD_ESTUDIANTE_LINK_PRACTICAS] = safeGetId(clean[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
        if (clean[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]) clean[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] = safeGetId(clean[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS]);
        if (clean[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) clean[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] = cleanInstitutionName(clean[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]);
        return clean;
    };

    const updateMutation = useMutation({
        mutationFn: (vars: any) => db.practicas.update(vars.id, sanitizeFields(vars.fields)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-practicas'] });
            setToastInfo({ message: 'Registro actualizado', type: 'success' });
            setEditingRecord(null);
        }
    });

    const createMutation = useMutation({
        mutationFn: (fields: any) => db.practicas.create(sanitizeFields(fields)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-practicas'] });
            setToastInfo({ message: 'Registro creado', type: 'success' });
            setEditingRecord(null);
        }
    });

    const duplicateMutation = useMutation({
        mutationFn: async ({ record, targetStudentId }: { record: any, targetStudentId: string }) => {
            const { id, created_at, createdTime, ...fields } = record;
            const cleanFields = sanitizeFields(fields);
            cleanFields[FIELD_ESTUDIANTE_LINK_PRACTICAS] = targetStudentId;
            delete cleanFields.__student;
            delete cleanFields.__studentName;
            return db.practicas.create(cleanFields);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['editor-practicas'] });
            setToastInfo({ message: 'Práctica duplicada', type: 'success' });
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
        }
    });

    const handleRowContextMenu = (e: React.MouseEvent, record: any) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, record });
        setSelectedRowId(record.id);
    };

    const institutionOptions = institutions.map(i => ({
        value: i.id,
        label: cleanInstitutionName(i[FIELD_NOMBRE_INSTITUCIONES])
    })).sort((a, b) => a.label.localeCompare(b.label));

    const launchOptions = launches.map(l => ({
        value: l.id,
        label: formatDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]) + (l[FIELD_NOMBRE_PPS_LANZAMIENTOS] ? ` - ${l[FIELD_NOMBRE_PPS_LANZAMIENTOS]}` : '')
    }));

    return (
        <div className="space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            <ConfirmModal
                isOpen={!!idToDelete}
                title="¿Eliminar Práctica?"
                message="Se borrará el registro. ¿Confirmar?"
                confirmText="Eliminar"
                type="danger"
                onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)}
                onClose={() => setIdToDelete(null)}
            />

            {/* FILTROS */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-4 items-end shadow-sm">

                <div className="md:col-span-3 space-y-1.5 h-full">
                    {!filterStudentId ? (
                        <div className="h-full">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">Alumno</label>
                            <div className="h-11">
                                <AdminSearch onStudentSelect={(s) => { setFilterStudentId(s.id); setStudentLabel(s[FIELD_NOMBRE_ESTUDIANTES] || ''); }} />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Alumno</label>
                            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 h-11 px-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                <span className="text-xs font-bold truncate text-blue-800 dark:text-blue-300">{studentLabel}</span>
                                <button onClick={() => setFilterStudentId('')} className="material-icons !text-sm text-blue-500 hover:text-blue-700">close</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="md:col-span-4">
                    <SearchableSelect
                        label="Institución"
                        options={[{ value: '', label: 'Todas' }, ...institutionOptions]}
                        value={selectedInstId}
                        onChange={(val) => { setSelectedInstId(val); setSelectedLaunchId(''); }}
                        placeholder="Buscar institución..."
                        className="w-full"
                    />
                </div>

                <div className="md:col-span-3">
                    <SearchableSelect
                        label="Fecha / Convocatoria"
                        options={[{ value: '', label: 'Todas' }, ...launchOptions]}
                        value={selectedLaunchId}
                        onChange={setSelectedLaunchId}
                        placeholder={selectedInstId ? "Seleccionar fecha..." : "Selecciona Inst. primero"}
                        disabled={!selectedInstId}
                        className="w-full"
                    />
                </div>

                <div className="md:col-span-2">
                    <Button onClick={() => setEditingRecord({ isCreating: true })} icon="add_circle" className="h-11 bg-blue-600 hover:bg-blue-700 w-full shadow-md">Nueva</Button>
                </div>
            </div>

            <div className="flex justify-end h-8">
                {selectedRowId && (
                    <button onClick={() => setIdToDelete(selectedRowId)} className="flex items-center gap-2 px-4 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-black uppercase border border-rose-200 dark:border-rose-800 animate-fade-in hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors">
                        <span className="material-icons !text-sm">delete</span> Eliminar
                    </button>
                )}
            </div>

            {/* TABLA */}
            {isLoading ? <div className="py-12"><Loader /></div> : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-[#020617] shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Institución</th>
                                    <th className="px-6 py-4">Estudiante</th>
                                    <th className="px-6 py-4">Inicio</th>
                                    <th className="px-6 py-4 text-center">Horas</th>
                                    <th className="px-6 py-4">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data?.records.map((p: any) => {
                                    const isSelected = selectedRowId === p.id;
                                    const espVisuals = getEspecialidadClasses(p[FIELD_ESPECIALIDAD_PRACTICAS]);

                                    return (
                                        <tr key={p.id} onClick={() => setSelectedRowId(isSelected ? null : p.id)} onContextMenu={(e) => handleRowContextMenu(e, p)} onDoubleClick={() => setEditingRecord(p)} className={`transition-all cursor-pointer group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'}`}>
                                            <td className="px-6 py-4">
                                                <div className={`font-black truncate max-w-[250px] ${espVisuals.headerText}`}>
                                                    {cleanInstitutionName(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS])}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-700 dark:text-slate-300">{p.__student.nombre}</div>
                                                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{p.__student.legajo}</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">{formatDate(p[FIELD_FECHA_INICIO_PRACTICAS])}</td>
                                            <td className="px-6 py-4 text-center font-black text-blue-600 dark:text-blue-400">{p[FIELD_HORAS_PRACTICAS]} hs</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black border uppercase ${getStatusVisuals(p[FIELD_ESTADO_PRACTICA]).labelClass}`}>
                                                    {p[FIELD_ESTADO_PRACTICA]}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls currentPage={currentPage} totalPages={Math.ceil((data?.total || 0) / itemsPerPage)} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} onItemsPerPageChange={setItemsPerPage} totalItems={data?.total || 0} />
                </div>
            )}

            {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} options={[{ label: 'Editar', icon: 'edit', onClick: () => setEditingRecord(menu.record) }, { label: 'Duplicar a otro', icon: 'content_copy', onClick: () => setDuplicatingRecord(menu.record) }, { label: 'Eliminar', icon: 'delete', variant: 'danger', onClick: () => setIdToDelete(menu.record.id) }]} />}
            {editingRecord && <RecordEditModal isOpen={!!editingRecord} onClose={() => setEditingRecord(null)} record={editingRecord.isCreating ? null : editingRecord} tableConfig={TABLE_CONFIG} onSave={(id, fields) => id ? updateMutation.mutate({ id, fields }) : createMutation.mutate(fields)} isSaving={updateMutation.isPending || createMutation.isPending} />}
            {duplicatingRecord && <DuplicateToStudentModal isOpen={!!duplicatingRecord} onClose={() => setDuplicatingRecord(null)} sourceRecordLabel={cleanInstitutionName(duplicatingRecord[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS])} onConfirm={(targetId) => duplicateMutation.mutate({ record: duplicatingRecord, targetStudentId: targetId })} isSaving={duplicateMutation.isPending} />}
        </div>
    );
};

export default EditorPracticas;
