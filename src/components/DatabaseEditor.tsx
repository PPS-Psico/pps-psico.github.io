
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { mockDb } from '../services/mockDb';
import { schema } from '../lib/dbSchema';
import type { AppRecord, LanzamientoPPSFields, InstitucionFields, AirtableRecord, EstudianteFields } from '../types';
import SubTabs from './SubTabs';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Toast from './Toast';
import RecordEditModal from './RecordEditModal';
import DuplicateToStudentModal from './DuplicateToStudentModal';
import AdminSearch from './AdminSearch';
import ConfirmModal from './ConfirmModal';
import { formatDate, getEspecialidadClasses, normalizeStringForComparison, getStatusVisuals } from '../utils/formatters';
import Card from './Card';
import { ALL_ORIENTACIONES } from '../types';
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
    FIELD_FINALIZARON_ESTUDIANTES,
    TABLE_NAME_PRACTICAS,
    TABLE_NAME_ESTUDIANTES,
    TABLE_NAME_INSTITUCIONES,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_NOMBRE_SEPARADO_ESTUDIANTES,
    FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
    TABLE_NAME_CONVOCATORIAS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_HORARIO_FORMULA_CONVOCATORIAS,
    FIELD_FECHA_INICIO_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_TERMINO_CURSAR_CONVOCATORIAS,
    FIELD_FINALES_ADEUDA_CONVOCATORIAS,
    FIELD_NOMBRE_PPS_CONVOCATORIAS,
    FIELD_CV_CONVOCATORIAS,
    FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS,
    FIELD_AIRTABLE_ID
} from '../constants';

interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'tel' | 'select' | 'checkbox';
    options?: readonly string[] | { value: string; label: string }[];
    width?: string;
    align?: 'left' | 'center' | 'right';
}

interface TableConfig {
    label: string;
    icon: string;
    tableName: string;
    schema: any;
    fieldConfig: FieldConfig[];
    displayFields: string[];
    searchFields: string[];
}

const EDITABLE_TABLES: Record<string, TableConfig> = {
    estudiantes: { 
        label: 'Estudiantes', 
        icon: 'school', 
        tableName: TABLE_NAME_ESTUDIANTES,
        schema: schema.estudiantes,
        displayFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES, FIELD_DNI_ESTUDIANTES, FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES],
        searchFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_NOMBRE_SEPARADO_ESTUDIANTES, FIELD_APELLIDO_SEPARADO_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES],
        fieldConfig: [
            { key: FIELD_LEGAJO_ESTUDIANTES, label: 'Legajo', type: 'text', width: 'w-24' },
            { key: FIELD_NOMBRE_SEPARADO_ESTUDIANTES, label: 'Nombre (Pila)', type: 'text' },
            { key: FIELD_APELLIDO_SEPARADO_ESTUDIANTES, label: 'Apellido', type: 'text' },
            { key: FIELD_DNI_ESTUDIANTES, label: 'DNI', type: 'number' },
            { key: FIELD_CORREO_ESTUDIANTES, label: 'Correo', type: 'email' },
            { key: FIELD_TELEFONO_ESTUDIANTES, label: 'Teléfono', type: 'tel' },
            { key: FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES, label: 'Orientación', type: 'select', options: ['', 'Clinica', 'Educacional', 'Laboral', 'Comunitaria'], width: 'w-32' },
            { key: FIELD_NOTAS_INTERNAS_ESTUDIANTES, label: 'Notas Internas', type: 'textarea' },
            { key: FIELD_FINALIZARON_ESTUDIANTES, label: 'Finalizó PPS', type: 'checkbox' },
            { key: FIELD_NOMBRE_ESTUDIANTES, label: 'Nombre Completo', type: 'text', width: 'w-64' },
            { key: '__totalHours', label: 'Horas', type: 'number', width: 'w-24', align: 'center' }, // Virtual config
        ]
    },
    convocatorias: {
        label: 'Inscripciones',
        icon: 'how_to_reg',
        tableName: TABLE_NAME_CONVOCATORIAS,
        schema: schema.convocatorias,
        displayFields: ['__studentName', '__lanzamientoName', FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS, FIELD_HORARIO_FORMULA_CONVOCATORIAS],
        searchFields: [FIELD_NOMBRE_PPS_CONVOCATORIAS], 
        fieldConfig: [
            { key: FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS, label: 'Estudiante', type: 'text' },
            { key: FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, label: 'Lanzamiento', type: 'text' },
            { key: FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS, label: 'Estado', type: 'select', options: ['Inscripto', 'Seleccionado', 'No Seleccionado', 'Baja'] },
            { key: FIELD_HORARIO_FORMULA_CONVOCATORIAS, label: 'Horario', type: 'text' },
            { key: FIELD_TERMINO_CURSAR_CONVOCATORIAS, label: 'Terminó Cursar', type: 'select', options: ['Sí', 'No'] },
            { key: FIELD_FINALES_ADEUDA_CONVOCATORIAS, label: 'Finales Adeudados', type: 'text' },
            { key: FIELD_FECHA_INICIO_CONVOCATORIAS, label: 'Inicio', type: 'date' },
            { key: FIELD_CV_CONVOCATORIAS, label: 'Link CV', type: 'text' },
            { key: FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS, label: 'Link Cert. Trabajo', type: 'text' },
        ]
    },
    practicas: {
        label: 'Prácticas',
        icon: 'work_history',
        tableName: TABLE_NAME_PRACTICAS,
        schema: schema.practicas,
        displayFields: ['__studentName', '__lanzamientoName', FIELD_ESPECIALIDAD_PRACTICAS, FIELD_HORAS_PRACTICAS, FIELD_FECHA_INICIO_PRACTICAS, FIELD_ESTADO_PRACTICA],
        searchFields: [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS, FIELD_ESPECIALIDAD_PRACTICAS],
        fieldConfig: [
            { key: FIELD_ESTUDIANTE_LINK_PRACTICAS, label: 'Estudiante', type: 'text' }, 
            { key: FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, label: 'Lanzamiento/Institución', type: 'text' },
            { key: FIELD_FECHA_INICIO_PRACTICAS, label: 'Inicio', type: 'date', width: 'w-32' },
            { key: FIELD_FECHA_FIN_PRACTICAS, label: 'Fin', type: 'date', width: 'w-32' },
            { key: FIELD_HORAS_PRACTICAS, label: 'Horas', type: 'number', width: 'w-24', align: 'center' },
            { key: FIELD_ESTADO_PRACTICA, label: 'Estado', type: 'select', options: ['En curso', 'Finalizada', 'Convenio Realizado', 'No se pudo concretar', 'Pendiente', 'En proceso'] },
            { key: FIELD_ESPECIALIDAD_PRACTICAS, label: 'Especialidad', type: 'select', options: ALL_ORIENTACIONES, width: 'w-40' },
            { key: FIELD_NOTA_PRACTICAS, label: 'Nota', type: 'select', options: ['Sin calificar', 'Entregado (sin corregir)', 'No Entregado', 'Desaprobado', '4', '5', '6', '7', '8', '9', '10'] },
        ]
    },
    instituciones: { 
        label: 'Instituciones', 
        icon: 'apartment', 
        tableName: TABLE_NAME_INSTITUCIONES,
        schema: schema.instituciones,
        displayFields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_DIRECCION_INSTITUCIONES, FIELD_TELEFONO_INSTITUCIONES, FIELD_CONVENIO_NUEVO_INSTITUCIONES],
        searchFields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_DIRECCION_INSTITUCIONES],
        fieldConfig: [
            { key: FIELD_NOMBRE_INSTITUCIONES, label: 'Nombre', type: 'text' },
            { key: FIELD_TELEFONO_INSTITUCIONES, label: 'Teléfono', type: 'tel' },
            { key: FIELD_DIRECCION_INSTITUCIONES, label: 'Dirección', type: 'text' },
            { key: FIELD_CONVENIO_NUEVO_INSTITUCIONES, label: 'Convenio Nuevo', type: 'checkbox' },
            { key: FIELD_TUTOR_INSTITUCIONES, label: 'Tutor', type: 'text' },
        ]
    },
};

type TableKey = keyof typeof EDITABLE_TABLES;

interface DatabaseEditorProps {
  isTestingMode?: boolean;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

// ... (SortableHeader & PaginationControls remain the same) ...
const SortableHeader: React.FC<{
  label: string;
  sortKey: string;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  requestSort: (key: string) => void;
  className?: string;
  hasCheckbox?: boolean;
  onSelectAll?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  allSelected?: boolean;
  align?: 'left' | 'center' | 'right';
}> = ({ label, sortKey, sortConfig, requestSort, className = "", hasCheckbox, onSelectAll, allSelected, align = 'left' }) => {
  const isActive = sortConfig.key === sortKey;
  const icon = isActive ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
  
  return (
    <th
      scope="col"
      className={`px-6 py-4 select-none group bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 ${className}`}
    >
        <div className={`flex items-center gap-2 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
            {hasCheckbox && (
                <input 
                    type="checkbox" 
                    checked={allSelected} 
                    onChange={onSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                />
            )}
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1.5 focus:outline-none group/btn">
                <span className={`text-[11px] font-extrabold uppercase tracking-widest transition-colors ${isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 group-hover/btn:text-slate-700 dark:group-hover/btn:text-slate-200'}`}>
                    {label}
                </span>
                <span className={`material-icons !text-xs transition-all duration-200 ${isActive ? 'opacity-100 text-blue-600 dark:text-blue-400 transform scale-110' : 'opacity-0 -ml-2 group-hover/btn:opacity-40 group-hover/btn:ml-0'}`}>
                    {icon}
                </span>
            </button>
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
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-3 px-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
                <span>Mostrar</span>
                <select 
                    value={itemsPerPage} 
                    onChange={(e) => { onItemsPerPageChange(Number(e.target.value)); onPageChange(1); }}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-slate-700 dark:text-slate-200 shadow-sm"
                >
                    {ITEMS_PER_PAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <span>filas</span>
            </div>
            <span className="hidden sm:inline w-px h-4 bg-slate-200 dark:bg-slate-700 mx-2"></span>
            <span className="hidden sm:inline">
                <strong>{totalItems}</strong> registros encontrados
            </span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button 
                onClick={() => onPageChange(currentPage - 1)} 
                disabled={currentPage === 1}
                className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all shadow-sm disabled:shadow-none text-slate-600 dark:text-slate-300"
            >
                <span className="material-icons !text-lg">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[80px] text-center">
                Pág {currentPage} / {totalPages || 1}
            </span>
            <button 
                onClick={() => onPageChange(currentPage + 1)} 
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all shadow-sm disabled:shadow-none text-slate-600 dark:text-slate-300"
            >
                <span className="material-icons !text-lg">chevron_right</span>
            </button>
        </div>
    </div>
);

const ContextMenu: React.FC<{
    x: number;
    y: number;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onClose: () => void;
    isPracticaTable?: boolean;
}> = ({ x, y, onEdit, onDuplicate, onDelete, onClose, isPracticaTable }) => {
    const adjustedTop = Math.min(y, window.innerHeight - 200); 

    return createPortal(
        <>
            <div 
                className="fixed inset-0 z-[9998]" 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            />
            <div 
                className="fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 min-w-[200px] animate-fade-in text-sm ring-1 ring-black/5"
                style={{ top: adjustedTop, left: x }}
                onClick={(e) => e.stopPropagation()} 
            >
                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50 mb-1">
                    Acciones
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-colors"
                >
                    <span className="material-icons text-blue-500 !text-lg">edit</span> Editar Registro
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDuplicate(); }} 
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-colors"
                >
                    <span className="material-icons text-slate-400 !text-lg">content_copy</span> {isPracticaTable ? 'Duplicar a otro Alumno' : 'Duplicar'}
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"></div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                    className="w-full text-left px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center gap-3 transition-colors"
                >
                    <span className="material-icons !text-lg">delete</span> Eliminar
                </button>
            </div>
        </>,
        document.body
    );
};

const cleanDisplayValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.replace(/[\[\]\{\}"]/g, '').trim();
};

const getErrorMessage = (err: any) => {
    if (typeof err === 'string') return err;
    if (err?.message) return err.message;
    if (err?.error?.message) return err.error.message;
    if (err?.error && typeof err.error === 'string') return err.error;
    return 'Error desconocido';
};

const DatabaseEditor: React.FC<DatabaseEditorProps> = ({ isTestingMode = false }) => {
    const [activeTable, setActiveTable] = useState<TableKey>('estudiantes');
    const [editingRecord, setEditingRecord] = useState<AppRecord<any> | { isCreating: true; initialData?: any } | null>(null);
    const [duplicateTargetRecord, setDuplicateTargetRecord] = useState<AppRecord<any> | null>(null);
    const [toastInfo, setToastInfo] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; record: AppRecord<any> } | null>(null);
    
    // Deletion State
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    const [filterStudentId, setFilterStudentId] = useState<string>('');
    const [selectedStudentLabel, setSelectedStudentLabel] = useState<string>('');

    const [filterInstitutionId, setFilterInstitutionId] = useState<string>('');
    const [filterLaunchId, setFilterLaunchId] = useState<string>('');

    // Filter Data State
    const [allInstitutions, setAllInstitutions] = useState<AirtableRecord<InstitucionFields>[]>([]);
    const [availableLaunches, setAvailableLaunches] = useState<AirtableRecord<LanzamientoPPSFields>[]>([]);
    
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: '', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    
    // Bulk Actions State
    const [isBulkEditMode, setIsBulkEditMode] = useState(false);
    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState('');
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    const queryClient = useQueryClient();
    
    const hasSpecificFilters = activeTable === 'practicas' || activeTable === 'convocatorias';

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset state on table change
    useEffect(() => {
        setCurrentPage(1);
        setSearchTerm('');
        setFilterStudentId('');
        setSelectedStudentLabel('');
        setFilterInstitutionId('');
        setFilterLaunchId('');
        setContextMenu(null);
        setIsBulkEditMode(false);
        setSelectedRowIds(new Set());
        setSelectedRowId(null);
        setIdToDelete(null);
    }, [activeTable]);

    // Load Filter Data for Practicas (Institutions)
    useEffect(() => {
        if (activeTable === 'practicas') {
            if (isTestingMode) {
                 mockDb.getAll('instituciones').then(recs => {
                    const sorted = recs.sort((a: any, b: any) => (a[FIELD_NOMBRE_INSTITUCIONES] || '').localeCompare(b[FIELD_NOMBRE_INSTITUCIONES] || ''));
                    setAllInstitutions(sorted as any);
                });
            } else {
                db.instituciones.getAll({ fields: [FIELD_NOMBRE_INSTITUCIONES] }).then(recs => {
                    const sorted = recs.sort((a, b) => (a[FIELD_NOMBRE_INSTITUCIONES] || '').localeCompare(b[FIELD_NOMBRE_INSTITUCIONES] || ''));
                    setAllInstitutions(sorted);
                });
            }
        }
    }, [activeTable, isTestingMode]);

    // Load Launches when Institution is selected
    useEffect(() => {
        setFilterLaunchId('');

        if (filterInstitutionId) {
             const institution = allInstitutions.find(i => i.id === filterInstitutionId);
             const instName = institution?.[FIELD_NOMBRE_INSTITUCIONES];
             if (instName) {
                 const fetchFn = isTestingMode ? mockDb.getAll('lanzamientos_pps') : db.lanzamientos.getAll({ fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS] });
                 
                 fetchFn.then((recs: any[]) => {
                     const filtered = recs.filter(l => {
                         const ppsName = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '';
                         return normalizeStringForComparison(ppsName).includes(normalizeStringForComparison(instName));
                     }).sort((a, b) => {
                         const dateA = new Date(a[FIELD_FECHA_INICIO_LANZAMIENTOS] || 0).getTime();
                         const dateB = new Date(b[FIELD_FECHA_INICIO_LANZAMIENTOS] || 0).getTime();
                         return dateB - dateA;
                     });
                     setAvailableLaunches(filtered as any);
                 });
             }
        } else {
            setAvailableLaunches([]);
        }
    }, [filterInstitutionId, allInstitutions, isTestingMode]);


    const activeTableConfig = EDITABLE_TABLES[activeTable];
    
    const dbFilters = useMemo(() => {
        const filters: Record<string, any> = {};
        
        if (activeTable === 'practicas') {
            if (filterStudentId) filters[FIELD_ESTUDIANTE_LINK_PRACTICAS] = filterStudentId;
            
            if (filterLaunchId) {
                const launch = availableLaunches.find(l => l.id === filterLaunchId);
                if (launch) {
                    filters[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] = filterLaunchId;
                }
            } else if (filterInstitutionId) {
                const inst = allInstitutions.find(i => i.id === filterInstitutionId);
                if (inst) filters[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] = inst[FIELD_NOMBRE_INSTITUCIONES];
            }
        } else if (activeTable === 'convocatorias') {
            if (filterStudentId) filters[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] = filterStudentId;
        }
        return filters;
    }, [activeTable, filterStudentId, filterLaunchId, filterInstitutionId, allInstitutions, availableLaunches]);

    const queryKey = ['databaseEditor', activeTable, currentPage, itemsPerPage, sortConfig, debouncedSearch, dbFilters, isTestingMode];

    const { data: queryResult, isLoading, error } = useQuery({
        queryKey,
        queryFn: async () => {
             if (isTestingMode) {
                 // Simulate server-side filtering/pagination locally
                 const allRecords = await mockDb.getAll(activeTableConfig.tableName, dbFilters);
                 
                 let filtered = allRecords;
                 if (debouncedSearch) {
                     const lowerSearch = debouncedSearch.toLowerCase();
                     filtered = allRecords.filter((r: any) => {
                         return activeTableConfig.searchFields.some(field => {
                             const val = r[field];
                             return String(val || '').toLowerCase().includes(lowerSearch);
                         });
                     });
                 }
                 
                 if (sortConfig.key) {
                     filtered.sort((a: any, b: any) => {
                         const valA = a[sortConfig.key] || '';
                         const valB = b[sortConfig.key] || '';
                         if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                         if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                         return 0;
                     });
                 }
                 
                 const total = filtered.length;
                 const start = (currentPage - 1) * itemsPerPage;
                 const paginated = filtered.slice(start, start + itemsPerPage);
                 
                 // If practices or convocatorias, mock join logic
                 if (activeTable === 'practicas' || activeTable === 'convocatorias') {
                     const studentIds = paginated.map((r: any) => activeTable === 'practicas' ? r[FIELD_ESTUDIANTE_LINK_PRACTICAS] : r[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
                     const students = await mockDb.getAll('estudiantes'); // Simplify by getting all
                     const studentMap = new Map(students.map((s: any) => [s.id, s]));
                     
                     const launchIds = paginated.map((r: any) => activeTable === 'practicas' ? r[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] : r[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]);
                     const launches = await mockDb.getAll('lanzamientos_pps');
                     const launchMap = new Map(launches.map((l: any) => [l.id, l]));

                     const enriched = paginated.map((p: any) => {
                         const sId = activeTable === 'practicas' ? p[FIELD_ESTUDIANTE_LINK_PRACTICAS] : p[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
                         const lId = activeTable === 'practicas' ? p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] : p[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                         
                         const student = studentMap.get(sId);
                         const launch = launchMap.get(lId);
                         
                         return {
                             ...p,
                             __studentName: student ? `${student[FIELD_NOMBRE_ESTUDIANTES]} (${student[FIELD_LEGAJO_ESTUDIANTES]})` : 'Desconocido',
                             __lanzamientoName: launch ? launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] : 'N/A'
                         }
                     });
                     return { records: enriched, total };
                 }

                 return { records: paginated, total };
             }

            const { records, total, error } = await (db as any)[activeTable].getPage(
                currentPage,
                itemsPerPage,
                {
                    searchTerm: hasSpecificFilters ? undefined : debouncedSearch, 
                    searchFields: activeTableConfig.searchFields,
                    sort: sortConfig.key ? { field: sortConfig.key, direction: sortConfig.direction } : undefined,
                    filters: dbFilters
                }
            );

            if (error) throw new Error(getErrorMessage(error));

            if ((activeTable === 'practicas' || activeTable === 'convocatorias') && records.length > 0) {
                // Hydrate with Student Names for better display
                const studentIds = records.map((r: any) => 
                     activeTable === 'practicas' ? r[FIELD_ESTUDIANTE_LINK_PRACTICAS] : r[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]
                ).flat().filter(Boolean);

                const lanzamientoIds = records.map((r: any) => 
                     activeTable === 'practicas' ? r[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] : r[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]
                ).flat().filter(Boolean);

                const [estudiantesRes, lanzamientosRes] = await Promise.all([
                    db.estudiantes.getAll({ filters: { id: studentIds }, fields: [FIELD_LEGAJO_ESTUDIANTES, FIELD_NOMBRE_ESTUDIANTES] }),
                    db.lanzamientos.getAll({ filters: { id: lanzamientoIds }, fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS] })
                ]);
    
                const estudiantesMap = new Map(estudiantesRes.map(r => [r.id, r]));
                const lanzamientosMap = new Map(lanzamientosRes.map(r => [r.id, r]));
    
                const enrichedRecords = records.map((p: any) => {
                    const rawStudentId = p[activeTable === 'practicas' ? FIELD_ESTUDIANTE_LINK_PRACTICAS : FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
                    const studentId = Array.isArray(rawStudentId) ? rawStudentId[0] : rawStudentId;
                    
                    const rawLanzamientoId = p[activeTable === 'practicas' ? FIELD_LANZAMIENTO_VINCULADO_PRACTICAS : FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                    const lanzamientoId = Array.isArray(rawLanzamientoId) ? rawLanzamientoId[0] : rawLanzamientoId;
                    
                    const student = estudiantesMap.get(studentId as string);
                    const studentName = student?.[FIELD_NOMBRE_ESTUDIANTES] || 'Desconocido';
                    const studentLegajo = student?.[FIELD_LEGAJO_ESTUDIANTES] || '---';
                    
                    const fallbackName = activeTable === 'practicas' 
                        ? cleanDisplayValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) 
                        : (p as any)[FIELD_NOMBRE_PPS_CONVOCATORIAS] || 'N/A';
                    
                    const lanzamientoName = lanzamientosMap.get(lanzamientoId as string)?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] || fallbackName;
    
                    return {
                        ...p,
                        __studentName: `${studentName}`, 
                        __studentLegajo: studentLegajo,
                        __lanzamientoName: lanzamientoName
                    };
                });
                return { records: enrichedRecords, total };
            }
            else if (activeTable === 'estudiantes' && records.length > 0) {
                // For students, fetch total hours sum as a virtual field
                const studentIds = records.map((r: any) => r.id);
                // Optimized fetch: Only get hours for visible students
                const allPractices = await db.practicas.getAll({
                    filters: { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds },
                    fields: [FIELD_ESTUDIANTE_LINK_PRACTICAS, FIELD_HORAS_PRACTICAS]
                });
                
                const enrichedRecords = records.map((s: any) => {
                    const studentPractices = allPractices.filter(p => {
                        const link = p[FIELD_ESTUDIANTE_LINK_PRACTICAS];
                        return Array.isArray(link) ? link.includes(s.id) : link === s.id;
                    });
                    const totalHours = studentPractices.reduce((sum, p) => sum + (p[FIELD_HORAS_PRACTICAS] || 0), 0);
                    return { ...s, __totalHours: totalHours };
                });
                
                return { records: enrichedRecords, total };
            }
            
            return { records, total };
        },
        placeholderData: (previousData: any) => previousData,
    });

    const records = queryResult?.records || [];
    const totalItems = queryResult?.total || 0;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const updateMutation = useMutation({
        mutationFn: ({ recordId, fields }: { recordId: string, fields: any }) => {
             if (isTestingMode) return mockDb.update(activeTableConfig.tableName, recordId, fields);
            return db[activeTable].update(recordId, fields);
        },
        onSuccess: () => {
            setToastInfo({ message: 'Registro actualizado.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['databaseEditor', activeTable] });
            setEditingRecord(null);
        },
        onError: (e) => setToastInfo({ message: `Error: ${getErrorMessage(e)}`, type: 'error' }),
    });

    const createMutation = useMutation({
        mutationFn: (fields: any) => {
            if (isTestingMode) return mockDb.create(activeTableConfig.tableName, fields);
            return db[activeTable].create(fields);
        },
        onSuccess: () => {
             setToastInfo({ message: 'Registro creado.', type: 'success' });
             setEditingRecord(null);
             setDuplicateTargetRecord(null);
             queryClient.invalidateQueries({ queryKey: ['databaseEditor', activeTable] }); 
        },
        onError: (e) => setToastInfo({ message: `Error: ${getErrorMessage(e)}`, type: 'error' }),
    });

    const deleteMutation = useMutation({
        mutationFn: (recordId: string) => {
            if (isTestingMode) return mockDb.delete(activeTableConfig.tableName, recordId);
            return db[activeTable].delete(recordId);
        },
        onSuccess: (_, deletedId) => {
             queryClient.setQueriesData({ queryKey: ['databaseEditor', activeTable] }, (oldData: any) => {
                 if (!oldData || !oldData.records) return oldData;
                 // For optimistic UI in mock mode where delete might return success object
                 const idToRemove = typeof deletedId === 'object' ? (deletedId as any).id : deletedId; 
                 return {
                     ...oldData,
                     records: oldData.records.filter((r: any) => r.id !== idToRemove),
                     total: Math.max(0, oldData.total - 1)
                 };
             });

             setToastInfo({ message: 'Registro eliminado.', type: 'success' });
             queryClient.invalidateQueries({ queryKey: ['databaseEditor', activeTable] });
             
             setIdToDelete(null);
             setContextMenu(null);
             setSelectedRowId(null);
        },
        onError: (e) => {
            setToastInfo({ message: `Error al eliminar: ${getErrorMessage(e)}`, type: 'error' });
            setIdToDelete(null);
        },
    });
    
    const bulkUpdateMutation = useMutation({
        mutationFn: async (updates: { id: string, fields: any }[]) => {
            if (isTestingMode) {
                // Mock bulk update
                for (const update of updates) {
                    await mockDb.update(activeTableConfig.tableName, update.id, update.fields);
                }
                return updates;
            }
            return (db as any)[activeTable].updateMany(updates);
        },
        onSuccess: (data) => {
            setToastInfo({ message: `${data?.length || 0} registros actualizados.`, type: 'success' });
            setSelectedRowIds(new Set());
            setIsBulkEditMode(false);
            queryClient.invalidateQueries({ queryKey: ['databaseEditor', activeTable] });
        },
        onError: (e) => setToastInfo({ message: `Error en actualización masiva: ${getErrorMessage(e)}`, type: 'error' }),
    });

    const tableTabs = Object.entries(EDITABLE_TABLES).map(([key, { label, icon }]) => ({ id: key, label, icon }));

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };
    
    const handleRowContextMenu = (e: React.MouseEvent, record: AppRecord<any>) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, record });
    };

    const handleDeleteClick = (recordId: string) => {
        setIdToDelete(recordId);
        setContextMenu(null); 
    };

    const confirmDelete = () => {
        if (idToDelete) {
            deleteMutation.mutate(idToDelete);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const ids = new Set<string>(records.map((r: any) => String(r.id)));
            setSelectedRowIds(ids);
        } else {
            setSelectedRowIds(new Set());
        }
    };

    const handleRowSelect = (id: string) => {
        const newSet = new Set(selectedRowIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRowIds(newSet);
    };
    
    const handleBulkUpdateStatus = () => {
        if (!bulkStatus) return;
        const updates = Array.from(selectedRowIds).map(id => ({ id, fields: { [FIELD_ESTADO_PRACTICA]: bulkStatus } }));
        bulkUpdateMutation.mutate(updates);
    };

    const handleDuplicateWithStudent = (studentId: string) => {
        if (!duplicateTargetRecord) return;
        const { id, createdTime, created_at, ...originalFields } = duplicateTargetRecord;
        const newFields: any = { ...originalFields };
        
        delete newFields[FIELD_AIRTABLE_ID];
        newFields[FIELD_ESTUDIANTE_LINK_PRACTICAS] = studentId;

        delete newFields['__studentName'];
        delete newFields['__lanzamientoName'];
        delete newFields['__studentLegajo'];
        
        createMutation.mutate(newFields);
    };
    
    const handleSimpleDuplicate = (record: AppRecord<any>) => {
         const { id, createdTime, created_at, ...originalFields } = record;
         const newFields: any = { ...originalFields };
         
         delete newFields[FIELD_AIRTABLE_ID];
         
         const primaryKey = activeTableConfig.displayFields[0];
         if (newFields[primaryKey] && typeof newFields[primaryKey] === 'string') {
             newFields[primaryKey] += ' (Copia)';
         }
         delete newFields['__studentName'];
         delete newFields['__lanzamientoName'];
         delete newFields['__studentLegajo'];
         delete newFields['__totalHours'];
         createMutation.mutate(newFields);
    };
    
    const handleStudentSelect = (student: AirtableRecord<any>) => {
        setFilterStudentId(student.id);
        setSelectedStudentLabel(`${student[FIELD_NOMBRE_ESTUDIANTES]} (${student[FIELD_LEGAJO_ESTUDIANTES]})`);
    };

    const clearStudentFilter = () => {
        setFilterStudentId('');
        setSelectedStudentLabel('');
        setSearchTerm(''); 
    };

    const renderCellValue = (record: AppRecord<any>, fieldConfig: any) => {
        const key = fieldConfig.key;
        let value = record[key];

        if (key === FIELD_ESTADO_PRACTICA) {
            const status = String(value || '');
            const visuals = getStatusVisuals(status);
            return (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${visuals.labelClass} whitespace-nowrap`}>
                    <span className="material-icons !text-xs">{visuals.icon}</span>
                    {status}
                </span>
            );
        }

        if (key === FIELD_HORAS_PRACTICAS) {
            return <div className="font-mono font-bold text-slate-700 dark:text-slate-200">{value || '-'}</div>;
        }

        if (key === '__totalHours') {
            const hours = Number(value || 0);
            const isTargetReached = hours >= 250;
            return (
                <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold border ${isTargetReached ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200'}`}>
                    {hours} hs
                </span>
            );
        }

        if (fieldConfig.type === 'checkbox') {
            return value ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">Sí</span>
            ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">No</span>
            );
        }

        if (fieldConfig.type === 'date') {
            return <span className="font-mono text-[13px] whitespace-nowrap text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{formatDate(value)}</span>;
        }
        
        if (key === FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES || key === FIELD_ESPECIALIDAD_PRACTICAS) {
            if (!value) return <span className="text-slate-400">-</span>;
            const visuals = getEspecialidadClasses(String(value));
            return <span className={`${visuals.tag} whitespace-nowrap shadow-none border-0`}>{String(value)}</span>;
        }

        if (key === FIELD_NOMBRE_ESTUDIANTES || key === '__studentName') {
             const displayValue = String(value || 'Desconocido');
             const legajo = activeTable === 'estudiantes' ? record[FIELD_LEGAJO_ESTUDIANTES] : record['__studentLegajo'];
             const initial = displayValue.charAt(0);
             const colors = ['bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-violet-100 text-violet-600', 'bg-amber-100 text-amber-600', 'bg-rose-100 text-rose-600'];
             const colorClass = colors[displayValue.length % colors.length];

             return (
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-white/50 dark:border-slate-700 shadow-sm ${colorClass} dark:bg-opacity-20`}>
                        {initial}
                    </div>
                    <div className="flex flex-col min-w-0">
                         <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-[14px]" title={displayValue}>{displayValue}</span>
                         {activeTable !== 'estudiantes' && <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono leading-none">{legajo}</span>}
                    </div>
                </div>
             );
        }
        
        if (key === FIELD_CORREO_ESTUDIANTES) {
             if (!value) return <span className="text-slate-400">-</span>;
             return (
                 <a href={`mailto:${value}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 text-xs font-medium group">
                     <span className="material-icons !text-sm text-slate-400 group-hover:text-blue-500">email</span>
                     <span className="truncate max-w-[150px]" title={String(value)}>{String(value)}</span>
                 </a>
             );
        }

        if (key === FIELD_TELEFONO_ESTUDIANTES) {
             if (!value) return <span className="text-slate-400">-</span>;
             return (
                 <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                     <span className="material-icons !text-sm text-slate-400">smartphone</span>
                     <span className="font-mono">{String(value)}</span>
                 </div>
             );
        }
        
        if (key === '__lanzamientoName') {
            return (
                <div className="flex items-center gap-2">
                    <span className="material-icons text-slate-400 !text-sm">business</span>
                    <div className="text-slate-700 dark:text-slate-300 text-[14px] truncate font-medium" title={String(value)}>{String(value)}</div>
                </div>
            );
        }

        return <span className="truncate block max-w-[200px]" title={String(value || '')}>{String(value || '')}</span>;
    };

    const ActionButtons = () => (
        <div className="flex items-center gap-2">
            {isBulkEditMode && (
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 animate-scale-in origin-right">
                    <select 
                        value={bulkStatus} 
                        onChange={e => setBulkStatus(e.target.value)}
                        className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 outline-none focus:border-blue-500"
                    >
                        <option value="">Cambiar Estado...</option>
                        <option value="Finalizada">Finalizada</option>
                        <option value="En curso">En curso</option>
                    </select>
                    <button 
                        onClick={handleBulkUpdateStatus}
                        disabled={selectedRowIds.size === 0 || !bulkStatus}
                        className="text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        Aplicar ({selectedRowIds.size})
                    </button>
                    <button onClick={() => {setIsBulkEditMode(false); setSelectedRowIds(new Set())}} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-1"><span className="material-icons !text-lg">close</span></button>
                </div>
            )}

            {!isBulkEditMode && activeTable === 'practicas' && (
                <button 
                    onClick={() => setIsBulkEditMode(true)}
                    className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    title="Edición masiva"
                >
                    <span className="material-icons !text-xl">playlist_add_check</span>
                </button>
            )}

            <button 
                onClick={() => selectedRowId && handleDeleteClick(selectedRowId)} 
                disabled={!selectedRowId}
                className={`px-4 py-2.5 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-all shrink-0 ${!selectedRowId ? 'opacity-50 cursor-not-allowed hidden md:flex' : 'hover:bg-rose-50 dark:hover:bg-rose-900/20 shadow-sm'}`}
            >
                <span className="material-icons !text-lg">delete</span>
                <span className="hidden sm:inline">Eliminar</span>
            </button>

            <button onClick={() => setEditingRecord({ isCreating: true })} className="bg-blue-600 text-white font-bold py-2.5 px-5 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 hover:shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all active:scale-95">
                <span className="material-icons !text-lg">add_circle</span>
                <span className="hidden sm:inline">Nuevo</span>
            </button>
        </div>
    );

    const FilterToolbar = () => (
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 flex flex-col xl:flex-row gap-4">
            {/* 1. Main Search - Large & Prominent */}
            <div className="flex-1 relative group">
                {!hasSpecificFilters ? (
                    <div className="relative h-full">
                        <input 
                            type="search" 
                            placeholder={activeTable === 'estudiantes' ? "Buscar por nombre, legajo o DNI..." : "Buscar..."}
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full h-11 pl-11 pr-10 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-icons text-slate-400 !text-xl pointer-events-none group-focus-within:text-blue-500 transition-colors">search</span>
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <span className="material-icons !text-lg">close</span>
                            </button>
                        )}
                    </div>
                ) : (
                    // Specialized Search Component Wrapper (For Students/Complex Tables)
                     <div className="relative h-full">
                        {filterStudentId ? (
                            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 h-11 px-3 rounded-xl border border-blue-200 dark:border-blue-800 animate-fade-in">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-7 h-7 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                                        {selectedStudentLabel.charAt(0)}
                                    </div>
                                    <span className="text-sm font-bold text-blue-900 dark:text-blue-100 truncate">
                                        {selectedStudentLabel}
                                    </span>
                                </div>
                                <button 
                                    onClick={clearStudentFilter}
                                    className="p-1.5 rounded-full text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                                    title="Quitar filtro"
                                >
                                    <span className="material-icons !text-base">close</span>
                                </button>
                            </div>
                        ) : (
                            <div className="h-11">
                                <AdminSearch 
                                    onStudentSelect={handleStudentSelect}
                                    isTestingMode={isTestingMode}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 2. Secondary Filters (Horizontal Row) */}
            {hasSpecificFilters && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2 xl:pb-0">
                    {/* Institution Filter */}
                    {activeTable === 'practicas' && (
                        <>
                            <div className="relative min-w-[200px]">
                                <select 
                                    value={filterInstitutionId} 
                                    onChange={(e) => { setFilterInstitutionId(e.target.value); }}
                                    className="w-full h-11 pl-3 pr-8 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer appearance-none hover:bg-white dark:hover:bg-slate-800"
                                >
                                    <option value="">🏢 Todas las instituciones</option>
                                    {allInstitutions.map(i => (
                                        <option key={i.id} value={i.id}>{i[FIELD_NOMBRE_INSTITUCIONES]}</option>
                                    ))}
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 material-icons text-slate-400 pointer-events-none !text-lg">expand_more</span>
                            </div>

                            {/* Launch Filter (Dependent) */}
                            {filterInstitutionId && (
                                <div className="relative min-w-[200px] animate-fade-in">
                                    <select 
                                        value={filterLaunchId} 
                                        onChange={(e) => setFilterLaunchId(e.target.value)}
                                        className="w-full h-11 pl-3 pr-8 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer appearance-none hover:bg-white dark:hover:bg-slate-800"
                                    >
                                        <option value="">📅 Cualquier fecha</option>
                                        {availableLaunches.map(l => (
                                            <option key={l.id} value={l.id}>
                                                {formatDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS])} - {l[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 material-icons text-slate-400 pointer-events-none !text-lg">expand_more</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* 3. Actions Group */}
            <div className="flex-shrink-0 flex items-center justify-end xl:w-auto w-full pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800">
                <ActionButtons />
            </div>
        </div>
    );

    return (
        <Card title="Editor de Base de Datos" icon="storage" className="border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] shadow-lg">
            {toastInfo && (
                <Toast 
                    message={toastInfo.message} 
                    type={toastInfo.type} 
                    onClose={() => setToastInfo(null)} 
                />
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal 
                isOpen={!!idToDelete}
                onClose={() => setIdToDelete(null)}
                onConfirm={confirmDelete}
                title="Confirmar Eliminación"
                message="¿Estás seguro de que deseas eliminar este registro permanentemente? Esta acción no se puede deshacer."
                confirmText="Sí, Eliminar"
                type="danger"
            />
            
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onEdit={() => { setEditingRecord(contextMenu.record); setContextMenu(null); }}
                    onDuplicate={() => {
                        if (activeTable === 'practicas') { setDuplicateTargetRecord(contextMenu.record); } 
                        else { handleSimpleDuplicate(contextMenu.record); }
                        setContextMenu(null);
                    }}
                    onDelete={() => handleDeleteClick(contextMenu.record.id)}
                    onClose={() => setContextMenu(null)}
                    isPracticaTable={activeTable === 'practicas'}
                />
            )}
            
            {duplicateTargetRecord && (
                <DuplicateToStudentModal 
                    isOpen={!!duplicateTargetRecord}
                    onClose={() => setDuplicateTargetRecord(null)}
                    onConfirm={handleDuplicateWithStudent}
                    sourceRecordLabel={(duplicateTargetRecord as any).__lanzamientoName || duplicateTargetRecord[activeTableConfig.displayFields[0]] || 'Registro'}
                />
            )}

            <div className="mt-4">
                <SubTabs 
                    tabs={tableTabs} 
                    activeTabId={activeTable} 
                    onTabChange={(id) => { setActiveTable(id as TableKey); setSearchTerm(''); setSortConfig({ key: '', direction: 'asc' }); }} 
                />
            </div>

            <div className="mt-6 pt-2">
                <FilterToolbar />
                
                {isLoading && records.length === 0 && <div className="py-20"><Loader /></div>}
                {error && <EmptyState icon="error" title="Error de Carga" message={error.message} />}
                
                {(!isLoading || records.length > 0) && !error && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 ring-1 ring-black/5 dark:ring-white/5 relative z-0">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[900px] text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                                        {activeTableConfig.displayFields.map((key, idx) => {
                                            const fieldConfig = activeTableConfig.fieldConfig.find(f => f.key === key);
                                            const label = fieldConfig ? fieldConfig.label : (key.startsWith('__') ? key.substring(2).replace(/([A-Z])/g, ' $1') : key);
                                            
                                            // Dynamic widths
                                            let widthClass = fieldConfig?.width || "";
                                            if (!widthClass) {
                                                if (key === '__studentName') widthClass = "w-64";
                                                else if (key === '__lanzamientoName') widthClass = "w-64";
                                                else if (fieldConfig?.type === 'date') widthClass = "w-32";
                                            }
                                            
                                            return (
                                                <SortableHeader 
                                                    key={key} 
                                                    label={label} 
                                                    sortKey={key} 
                                                    sortConfig={sortConfig} 
                                                    requestSort={requestSort} 
                                                    className={`${widthClass} sticky top-0 z-10`}
                                                    hasCheckbox={idx === 0 && isBulkEditMode}
                                                    onSelectAll={handleSelectAll}
                                                    allSelected={selectedRowIds.size > 0 && selectedRowIds.size === records.length}
                                                    align={fieldConfig?.align || 'left'}
                                                />
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {records.map((record: any, idx: number) => {
                                        const isSelected = selectedRowIds.has(record.id);
                                        const isContextOpen = contextMenu?.record.id === record.id;
                                        
                                        return (
                                            <tr 
                                                key={record.id} 
                                                onClick={() => isBulkEditMode ? handleRowSelect(record.id) : setSelectedRowId(selectedRowId === record.id ? null : record.id)}
                                                onDoubleClick={() => setEditingRecord(record)}
                                                onContextMenu={(e) => handleRowContextMenu(e, record)}
                                                className={`group transition-all duration-150 cursor-pointer ${
                                                    isSelected || selectedRowId === record.id
                                                        ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' 
                                                        : isContextOpen
                                                            ? 'bg-slate-100 dark:bg-slate-800'
                                                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 bg-white dark:bg-slate-900'
                                                }`}
                                            >
                                                {activeTableConfig.displayFields.map((key, colIdx) => {
                                                    const fieldConfig = activeTableConfig.fieldConfig.find(f => f.key === key) || { key } as FieldConfig;
                                                    return (
                                                        <td key={key} className={`px-4 py-4 align-middle border-b border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-800 ${colIdx === 0 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'} ${fieldConfig.align === 'center' ? 'text-center' : fieldConfig.align === 'right' ? 'text-right' : 'text-left'}`}>
                                                            {colIdx === 0 && (
                                                                <div className="flex items-center gap-3">
                                                                    {isBulkEditMode && (
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={isSelected} 
                                                                            onChange={() => handleRowSelect(record.id)}
                                                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                                                            onClick={e => e.stopPropagation()}
                                                                        />
                                                                    )}
                                                                    {/* Row Indicator */}
                                                                    {selectedRowId === record.id && !isBulkEditMode && (
                                                                        <div className="w-1 h-8 absolute left-0 bg-blue-500 rounded-r-md"></div>
                                                                    )}
                                                                    {renderCellValue(record, fieldConfig)}
                                                                </div>
                                                            )}
                                                            {colIdx !== 0 && renderCellValue(record, fieldConfig)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
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
                    initialData={'isCreating' in editingRecord ? editingRecord.initialData : undefined}
                    tableConfig={activeTableConfig} 
                    onSave={(recordId, fields) => {
                        const cleanFields = { ...fields };
                        Object.keys(cleanFields).forEach(key => {
                            if (key.startsWith('__')) {
                                delete cleanFields[key];
                            }
                        });
                        
                        if (recordId) { updateMutation.mutate({ recordId, fields: cleanFields }); } 
                        else { createMutation.mutate(cleanFields); }
                    }} 
                    isSaving={updateMutation.isPending || createMutation.isPending} 
                />
            )}
        </Card>
    );
};

export default DatabaseEditor;
