
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { schema } from '../../lib/dbSchema';
import type { AppRecord } from '../../types';
import SubTabs from '../SubTabs';
import Loader from '../Loader';
import EmptyState from '../EmptyState';
import Toast from '../ui/Toast';
import RecordEditModal from './RecordEditModal';
import { formatDate, normalizeStringForComparison, getEspecialidadClasses } from '../../utils/formatters';
import Card from '../ui/Card';
import { ALL_ORIENTACIONES } from '../../types';
import {
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_ESTUDIANTE_LINK_PRACTICAS,
    FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
    FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
    FIELD_FECHA_INICIO_PRACTICAS,
    FIELD_DNI_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_TELEFONO_ESTUDIANTES,
    FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
    FIELD_NOTAS_INTERNAS_ESTUDIANTES,
    FIELD_FECHA_FIN_PRACTICAS,
    FIELD_HORAS_PRACTICAS,
    FIELD_ESTADO_PRACTICA,
    FIELD_ESPECIALIDAD_PRACTICAS,
    FIELD_NOTA_PRACTICAS,
    FIELD_NOMBRE_INSTITUCIONES,
    FIELD_TELEFONO_INSTITUCIONES,
    FIELD_DIRECCION_INSTITUCIONES,
    FIELD_CONVENIO_NUEVO_INSTITUCIONES,
    FIELD_TUTOR_INSTITUCIONES,
    FIELD_ORIENTACIONES_INSTITUCIONES
} from '../../constants';

interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'tel' | 'select' | 'checkbox';
    options?: readonly string[];
}

interface TableConfig {
    label: string;
    schema: any; // Used by RecordEditModal to map keys if necessary
    fieldConfig: FieldConfig[];
    displayFields: string[];
    searchFields: string[]; // Fields to apply the search term against
}

const EDITABLE_TABLES: Record<string, TableConfig & { icon: string }> = {
    estudiantes: {
        label: 'Estudiantes',
        icon: 'school',
        schema: schema.estudiantes,
        displayFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES, FIELD_DNI_ESTUDIANTES, FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES],
        searchFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES, FIELD_DNI_ESTUDIANTES],
        fieldConfig: [
            { key: FIELD_NOMBRE_ESTUDIANTES, label: 'Nombre Completo', type: 'text' },
            { key: FIELD_LEGAJO_ESTUDIANTES, label: 'Legajo', type: 'text' },
            { key: FIELD_DNI_ESTUDIANTES, label: 'DNI', type: 'number' },
            { key: FIELD_CORREO_ESTUDIANTES, label: 'Correo', type: 'email' },
            { key: FIELD_TELEFONO_ESTUDIANTES, label: 'Teléfono', type: 'tel' },
            { key: FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES, label: 'Orientación Elegida', type: 'select', options: ['', 'Clinica', 'Educacional', 'Laboral', 'Comunitaria'] },
            { key: FIELD_NOTAS_INTERNAS_ESTUDIANTES, label: 'Notas Internas', type: 'textarea' },
        ]
    },
    practicas: {
        label: 'Prácticas',
        icon: 'work_history',
        schema: schema.practicas,
        // Note: Searching by Student Name or Launch Name is tricky with server-side pagination without joins.
        // We fallback to searching fields present in the table or accept limitation.
        displayFields: ['__studentName', '__lanzamientoName', FIELD_ESPECIALIDAD_PRACTICAS, FIELD_FECHA_INICIO_PRACTICAS, FIELD_ESTADO_PRACTICA],
        searchFields: [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS, FIELD_ESPECIALIDAD_PRACTICAS],
        fieldConfig: [
            { key: FIELD_ESTUDIANTE_LINK_PRACTICAS, label: 'ID Estudiante (UUID)', type: 'text' },
            { key: FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, label: 'ID Lanzamiento (UUID)', type: 'text' },
            { key: FIELD_FECHA_INICIO_PRACTICAS, label: 'Fecha Inicio', type: 'date' },
            { key: FIELD_FECHA_FIN_PRACTICAS, label: 'Fecha Fin', type: 'date' },
            { key: FIELD_HORAS_PRACTICAS, label: 'Horas', type: 'number' },
            { key: FIELD_ESTADO_PRACTICA, label: 'Estado', type: 'select', options: ['En curso', 'Finalizada', 'Convenio Realizado', 'No se pudo concretar'] },
            { key: FIELD_ESPECIALIDAD_PRACTICAS, label: 'Especialidad', type: 'select', options: ALL_ORIENTACIONES },
            { key: FIELD_NOTA_PRACTICAS, label: 'Nota', type: 'select', options: ['Sin calificar', 'Entregado (sin corregir)', 'No Entregado', 'Desaprobado', '4', '5', '6', '7', '8', '9', '10'] },
        ]
    },
    instituciones: {
        label: 'Instituciones',
        icon: 'apartment',
        schema: schema.instituciones,
        displayFields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_TELEFONO_INSTITUCIONES, FIELD_CONVENIO_NUEVO_INSTITUCIONES, FIELD_ORIENTACIONES_INSTITUCIONES],
        searchFields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_DIRECCION_INSTITUCIONES],
        fieldConfig: [
            { key: FIELD_NOMBRE_INSTITUCIONES, label: 'Nombre', type: 'text' },
            { key: FIELD_TELEFONO_INSTITUCIONES, label: 'Teléfono', type: 'tel' },
            { key: FIELD_DIRECCION_INSTITUCIONES, label: 'Dirección', type: 'text' },
            { key: FIELD_CONVENIO_NUEVO_INSTITUCIONES, label: 'Convenio Nuevo', type: 'checkbox' },
            { key: FIELD_TUTOR_INSTITUCIONES, label: 'Tutor', type: 'text' },
            { key: FIELD_ORIENTACIONES_INSTITUCIONES, label: 'Orientaciones (CSV)', type: 'text' },
        ]
    },
};

type TableKey = keyof typeof EDITABLE_TABLES;

interface ContextMenuProps {
    x: number;
    y: number;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onEdit, onDuplicate, onDelete, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px] animate-fade-in text-sm"
            style={{ top: y, left: x }}
        >
            <button onClick={onEdit} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="material-icons !text-base">edit</span> Editar
            </button>
            <button onClick={onDuplicate} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="material-icons !text-base">content_copy</span> Duplicar
            </button>
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
            <button onClick={onDelete} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2">
                <span className="material-icons !text-base">delete</span> Eliminar
            </button>
        </div>
    );
};

interface DatabaseEditorProps {
    isTestingMode?: boolean;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

const SortableHeader: React.FC<{
    label: string;
    sortKey: string;
    sortConfig: { key: string; direction: 'asc' | 'desc' };
    requestSort: (key: string) => void;
    className?: string;
}> = ({ label, sortKey, sortConfig, requestSort, className = "text-left" }) => {
    const isActive = sortConfig.key === sortKey;
    const icon = isActive ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';

    return (
        <th
            scope="col"
            className={`px-6 py-3 cursor-pointer select-none group hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${className}`}
            onClick={() => requestSort(sortKey)}
        >
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
                <span className={`material-icons !text-sm transition-opacity ${isActive ? 'opacity-100 text-blue-600 dark:text-blue-400' : 'opacity-30 group-hover:opacity-70'}`}>{icon}</span>
            </div>
        </th>
    );
};

const PaginationControls: React.FC<{
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (items: number) => void;
    totalItems: number;
}> = ({ currentPage, totalPages, onPageChange, itemsPerPage, onItemsPerPageChange, totalItems }) => (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4 px-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <span>Filas por pág:</span>
            <select
                value={itemsPerPage}
                onChange={(e) => { onItemsPerPageChange(Number(e.target.value)); onPageChange(1); }}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
            >
                {ITEMS_PER_PAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <span className="hidden sm:inline">
                | Total: <strong>{totalItems}</strong> registros
            </span>
        </div>

        <div className="flex items-center gap-2">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
                <span className="material-icons">chevron_left</span>
            </button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Pág {currentPage} de {totalPages || 1}
            </span>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
                <span className="material-icons">chevron_right</span>
            </button>
        </div>
    </div>
);

const cleanDisplayValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Remove brackets, braces, quotes (common in migrated lookup fields)
    return str.replace(/[\[\]\{\}"]/g, '').trim();
};


const DatabaseEditor: React.FC<DatabaseEditorProps> = ({ isTestingMode = false }) => {
    const [activeTable, setActiveTable] = useState<TableKey>('estudiantes');
    const [editingRecord, setEditingRecord] = useState<AppRecord<any> | { isCreating: true } | null>(null);
    const [toastInfo, setToastInfo] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; record: AppRecord<any> } | null>(null);

    // Server-side state
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: '', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    const queryClient = useQueryClient();

    // Debounce search to avoid too many requests
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // Reset to page 1 on search
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const activeTableConfig = EDITABLE_TABLES[activeTable];
    const queryKey = ['databaseEditor', activeTable, currentPage, itemsPerPage, sortConfig, debouncedSearch, isTestingMode];

    const { data: queryResult, isLoading, error } = useQuery({
        queryKey,
        queryFn: async () => {
            if (isTestingMode) return { records: [], total: 0 };

            const { records, total, error } = await db[activeTable].getPage(
                currentPage,
                itemsPerPage,
                {
                    searchTerm: debouncedSearch,
                    searchFields: activeTableConfig.searchFields,
                    sort: sortConfig.key ? { field: sortConfig.key, direction: sortConfig.direction } : undefined
                }
            );

            if (error) throw new Error(error.error as string);

            // Special handling for "practicas" which needs joined data for display
            if (activeTable === 'practicas' && records.length > 0) {
                // We only fetch related data for the current page to be efficient
                const [estudiantesRes, lanzamientosRes] = await Promise.all([
                    db.estudiantes.getAll({ fields: [FIELD_LEGAJO_ESTUDIANTES, FIELD_NOMBRE_ESTUDIANTES] }),
                    db.lanzamientos.getAll({ fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS] })
                ]);

                const estudiantesMap = new Map(estudiantesRes.map(r => [r.id, r]));
                const lanzamientosMap = new Map(lanzamientosRes.map(r => [r.id, r]));

                const enrichedRecords = records.map(p => {
                    const rawStudentId = p[FIELD_ESTUDIANTE_LINK_PRACTICAS];
                    const studentId = Array.isArray(rawStudentId) ? rawStudentId[0] : rawStudentId;

                    const rawLanzamientoId = p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS];
                    const lanzamientoId = Array.isArray(rawLanzamientoId) ? rawLanzamientoId[0] : rawLanzamientoId;

                    const student = estudiantesMap.get(studentId as string);
                    const studentName = student?.[FIELD_NOMBRE_ESTUDIANTES] || 'Desconocido';
                    const studentLegajo = student?.[FIELD_LEGAJO_ESTUDIANTES] || '---';

                    const lanzamientoName = lanzamientosMap.get(lanzamientoId as string)?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] || cleanDisplayValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) || 'N/A';

                    return {
                        ...p,
                        __studentName: `${studentName} (${studentLegajo})`,
                        __lanzamientoName: lanzamientoName
                    };
                });
                return { records: enrichedRecords, total };
            }

            return { records, total };
        },
        placeholderData: (previousData: any) => previousData, // Keep showing old data while fetching new page
    });

    const records = queryResult?.records || [];
    const totalItems = queryResult?.total || 0;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const updateMutation = useMutation({
        mutationFn: ({ recordId, fields }: { recordId: string, fields: any }) => {
            if (isTestingMode) return new Promise(resolve => setTimeout(() => resolve(null), 500));
            return db[activeTable].update(recordId, fields);
        },
        onSuccess: () => {
            setToastInfo({ message: 'Registro actualizado.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['databaseEditor', activeTable] }); // Invalidate all pages for this table
            setEditingRecord(null);
        },
        onError: (e) => setToastInfo({ message: `Error: ${e.message}`, type: 'error' }),
    });

    const createMutation = useMutation({
        mutationFn: (fields: any) => {
            if (isTestingMode) return new Promise(resolve => setTimeout(() => resolve(null), 500));
            return db[activeTable].create(fields);
        },
        onSuccess: () => {
            setToastInfo({ message: 'Registro creado.', type: 'success' });
            setEditingRecord(null);
            queryClient.invalidateQueries({ queryKey: ['databaseEditor', activeTable] });
        },
        onError: (e) => setToastInfo({ message: `Error: ${e.message}`, type: 'error' }),
    });

    const deleteMutation = useMutation({
        mutationFn: (recordId: string) => {
            if (isTestingMode) return new Promise(resolve => setTimeout(() => resolve(null), 500));
            return db[activeTable].delete(recordId);
        },
        onSuccess: () => {
            setToastInfo({ message: 'Registro eliminado.', type: 'success' });
            setContextMenu(null);
            setSelectedRowId(null);
            queryClient.invalidateQueries({ queryKey: ['databaseEditor', activeTable] });
        },
        onError: (e) => setToastInfo({ message: `Error: ${e.message}`, type: 'error' }),
    });

    const duplicateMutation = useMutation({
        mutationFn: (record: AppRecord<any>) => {
            const { id, createdTime, created_at, ...originalFields } = record;
            const newFields: { [key: string]: any } = { ...originalFields };

            // Append (Copia) to primary field
            const primaryFieldKey = EDITABLE_TABLES[activeTable].displayFields[0];
            if (newFields[primaryFieldKey]) {
                newFields[primaryFieldKey] = `${newFields[primaryFieldKey]} (Copia)`;
            }
            // Remove computed fields
            delete newFields['__studentName'];
            delete newFields['__lanzamientoName'];

            if (isTestingMode) return new Promise(resolve => setTimeout(() => resolve(null), 500));
            return db[activeTable].create(newFields);
        },
        onSuccess: () => {
            setToastInfo({ message: 'Registro duplicado.', type: 'success' });
            setContextMenu(null);
            queryClient.invalidateQueries({ queryKey: ['databaseEditor', activeTable] });
        },
        onError: (e) => setToastInfo({ message: `Error: ${e.message}`, type: 'error' }),
    });

    const tableTabs = Object.entries(EDITABLE_TABLES).map(([key, { label, icon }]) => ({ id: key, label, icon }));

    useEffect(() => {
        setCurrentPage(1);
        setSearchTerm('');
        setContextMenu(null);
        setSelectedRowId(null);
    }, [activeTable]);

    // Keyboard support for deletion
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRowId) {
                const activeTag = document.activeElement?.tagName;
                if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
                    handleDelete(selectedRowId);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRowId]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1); // Reset to first page on sort change
    };

    const handleRowContextMenu = (e: React.MouseEvent, record: AppRecord<any>) => {
        e.preventDefault();
        setSelectedRowId(record.id);
        setContextMenu({ x: e.clientX, y: e.clientY, record });
    };

    const handleDelete = (recordId: string) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este registro? Esta acción no se puede deshacer.')) {
            deleteMutation.mutate(recordId);
        }
    };

    const renderCellValue = (record: AppRecord<any>, fieldConfig: any) => {
        const key = fieldConfig.key;
        let value = record[key];

        if (fieldConfig.type === 'checkbox') {
            return value ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">Sí</span>
            ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">No</span>
            );
        }

        if (fieldConfig.type === 'date') {
            return <span className="font-mono text-xs whitespace-nowrap">{formatDate(value)}</span>;
        }

        if (key === FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES || key === FIELD_ESPECIALIDAD_PRACTICAS || key === FIELD_ORIENTACIONES_INSTITUCIONES) {
            if (!value) return <span className="text-slate-400">-</span>;
            // Handle CSV for orientations
            if (key === FIELD_ORIENTACIONES_INSTITUCIONES) {
                const list = String(value).split(',').map(s => s.trim()).filter(Boolean);
                return (
                    <div className="flex flex-wrap gap-1">
                        {list.map((o, i) => {
                            const visuals = getEspecialidadClasses(o);
                            return <span key={i} className={`${visuals.tag} text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap shadow-none border-0`}>{o}</span>
                        })}
                    </div>
                );
            }
            const visuals = getEspecialidadClasses(String(value));
            return <span className={`${visuals.tag} whitespace-nowrap shadow-none border-0`}>{String(value)}</span>;
        }

        return <span className="truncate block max-w-[200px]" title={String(value || '')}>{String(value || '')}</span>;
    };

    return (
        <Card title="Editor de Base de Datos" icon="storage">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onEdit={() => { setEditingRecord(contextMenu.record); setContextMenu(null); }}
                    onDuplicate={() => { duplicateMutation.mutate(contextMenu.record); setContextMenu(null); }}
                    onDelete={() => { handleDelete(contextMenu.record.id); setContextMenu(null); }}
                    onClose={() => setContextMenu(null)}
                />
            )}

            <div className="mt-4">
                <SubTabs
                    tabs={tableTabs}
                    activeTabId={activeTable}
                    onTabChange={(id) => { setActiveTable(id as TableKey); setSearchTerm(''); setSortConfig({ key: '', direction: 'asc' }); }}
                />
            </div>

            <div className="mt-6 border-t border-slate-200/60 dark:border-slate-700/60 pt-6">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-wrap">

                        {/* Search */}
                        <div className="relative w-full md:w-72 group">
                            <input
                                type="search"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 !text-lg pointer-events-none">search</span>
                            {searchTerm && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" style={{ opacity: isLoading ? 1 : 0 }} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => selectedRowId && handleDelete(selectedRowId)}
                            disabled={!selectedRowId}
                            className={`w-full md:w-auto bg-white border border-rose-300 text-rose-600 font-bold py-2.5 px-5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all shrink-0 ${!selectedRowId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-rose-50 shadow-sm'}`}
                        >
                            <span className="material-icons !text-lg">delete</span>
                            Eliminar
                        </button>

                        <button onClick={() => setEditingRecord({ isCreating: true })} className="w-full md:w-auto bg-blue-600 text-white font-bold py-2.5 px-5 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shrink-0">
                            <span className="material-icons !text-lg">add_circle</span>
                            Nuevo Registro
                        </button>
                    </div>
                </div>

                {isLoading && records.length === 0 && <div className="py-10"><Loader /></div>}
                {error && <EmptyState icon="error" title="Error de Carga" message={error.message} />}

                {(!isLoading || records.length > 0) && !error && (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        {activeTableConfig.displayFields.map(key => {
                                            const fieldConfig = activeTableConfig.fieldConfig.find(f => f.key === key);
                                            const label = fieldConfig ? fieldConfig.label : (key.startsWith('__') ? key.substring(2).replace(/([A-Z])/g, ' $1') : key);
                                            const className = key === '__lanzamientoName' || key === FIELD_NOMBRE_ESTUDIANTES ? "min-w-[250px]" : "";
                                            return <SortableHeader key={key} label={label} sortKey={key} sortConfig={sortConfig} requestSort={requestSort} className={className} />;
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {records.length > 0 ? records.map((record, idx) => {
                                        const isSelected = selectedRowId === record.id;
                                        return (
                                            <tr
                                                key={record.id}
                                                onClick={() => setSelectedRowId(isSelected ? null : record.id)}
                                                onDoubleClick={() => setEditingRecord(record)}
                                                onContextMenu={(e) => handleRowContextMenu(e, record)}
                                                className={`transition-colors cursor-pointer ${isSelected
                                                    ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-300 dark:ring-blue-700'
                                                    : idx % 2 === 0 ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'bg-slate-50/30 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                                                    }`}
                                            >
                                                {activeTableConfig.displayFields.map(key => {
                                                    const fieldConfig = activeTableConfig.fieldConfig.find(f => f.key === key) || { key };
                                                    return (
                                                        <td key={key} className="px-6 py-3 text-slate-700 dark:text-slate-300 align-middle">
                                                            {renderCellValue(record, fieldConfig)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={activeTableConfig.displayFields.length}>
                                                <div className="py-12"><EmptyState icon="search_off" title="Sin Resultados" message="No hay registros que coincidan con tu búsqueda." /></div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            itemsPerPage={itemsPerPage}
                            onItemsPerPageChange={setItemsPerPage}
                            totalItems={totalItems}
                        />
                    </div>
                )}
            </div>

            {editingRecord && (
                <RecordEditModal
                    isOpen={!!editingRecord}
                    onClose={() => setEditingRecord(null)}
                    record={'isCreating' in editingRecord ? null : editingRecord}
                    tableConfig={activeTableConfig}
                    onSave={(recordId, fields) => {
                        if (recordId) { updateMutation.mutate({ recordId, fields }); } else { createMutation.mutate(fields); }
                    }}
                    isSaving={updateMutation.isPending || createMutation.isPending}
                />
            )}
        </Card>
    );
};

export default DatabaseEditor;
