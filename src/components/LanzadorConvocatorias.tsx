
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import type { InstitucionFields, LanzamientoPPSFields, AirtableRecord, LanzamientoPPS } from '../types';
import {
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_INFORME_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_DIRECCION_INSTITUCIONES,
  FIELD_TELEFONO_INSTITUCIONES,
  FIELD_TUTOR_INSTITUCIONES,
  TABLE_NAME_INSTITUCIONES,
  FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS,
  FIELD_REQ_CV_LANZAMIENTOS,
  FIELD_CODIGO_CAMPUS_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
  FIELD_CODIGO_CAMPUS_INSTITUCIONES
} from '../constants';
import Card from './Card';
import Loader from './Loader';
import Toast from './Toast';
import { ALL_ORIENTACIONES, Orientacion } from '../types';
import { normalizeStringForComparison, formatDate, getEspecialidadClasses } from '../utils/formatters';
import SubTabs from './SubTabs';
import EmptyState from './EmptyState';
import RecordEditModal from './RecordEditModal';
import { schema } from '../lib/dbSchema';
import CollapsibleSection from './CollapsibleSection';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import Checkbox from './Checkbox';
import { GoogleGenAI } from "@google/genai";

const mockInstitutions = [
  { id: 'recInstMock1', [FIELD_NOMBRE_INSTITUCIONES]: 'Hospital de Juguete' },
  { id: 'recInstMock1', [FIELD_NOMBRE_INSTITUCIONES]: 'Hospital de Juguete' },
  { id: 'recInstMock2', [FIELD_NOMBRE_INSTITUCIONES]: 'Escuela de Pruebas' },
  { id: 'recInstMock3', [FIELD_NOMBRE_INSTITUCIONES]: 'Empresa Ficticia S.A.' },
];

const mockLastLanzamiento = {
  id: 'recLanzMock1',
  [FIELD_ORIENTACION_LANZAMIENTOS]: 'Clinica',
  [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: 120,
  [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: 5,
  [FIELD_INFORME_LANZAMIENTOS]: 'http://example.com/informe-mock',
  [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: 'Lunes 9 a 13hs; Miércoles 14 a 18hs',
  [FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS]: true,
  [FIELD_REQ_CV_LANZAMIENTOS]: false,
  [FIELD_DIRECCION_LANZAMIENTOS]: 'Calle Falsa 123',
  [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: '<div class="card">Ejemplo de código</div>'
};

type FormData = {
    [key: string]: string | number | undefined | null | string[] | boolean;
    nombrePPS: string | undefined;
    fechaInicio: string | undefined;
    fechaFin: string | undefined;
    orientacion: string | undefined;
    horasAcreditadas: number | undefined;
    cuposDisponibles: number | undefined;
    informe: string | undefined;
    estadoConvocatoria: string | undefined;
    reqCertificadoTrabajo: boolean;
    reqCv: boolean;
    direccion: string | undefined;
};

const initialState: FormData = {
    nombrePPS: '',
    fechaInicio: '',
    fechaFin: '',
    orientacion: '',
    horasAcreditadas: 0,
    cuposDisponibles: 1,
    informe: '',
    estadoConvocatoria: 'Abierta',
    reqCertificadoTrabajo: true,
    reqCv: false,
    direccion: '',
};

interface LanzadorConvocatoriasProps {
  isTestingMode?: boolean;
  forcedTab?: 'new' | 'history';
}

const InputWrapper: React.FC<{ label: string; icon: string; children: React.ReactNode; className?: string }> = ({ label, icon, children, className = "" }) => (
    <div className={`group ${className}`}>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
            <span className="material-icons text-slate-300 dark:text-slate-600 group-focus-within:text-blue-500 transition-colors !text-sm">{icon}</span>
            {label}
        </label>
        {children}
    </div>
);

// --- MODAL PARA NUEVA INSTITUCIÓN ---
const NewInstitutionModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: (data: any) => void; 
    isLoading: boolean;
}> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    const [newData, setNewData] = useState({
        nombre: '',
        direccion: '',
        telefono: '',
        tutor: '',
        orientacionSugerida: '' as Orientacion | ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(newData);
    };

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-icons text-blue-600">add_business</span>
                        Registrar Nueva Institución
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Esta institución se guardará como "Convenio Nuevo".
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Nombre Institución *</label>
                        <Input 
                            value={newData.nombre} 
                            onChange={e => setNewData({...newData, nombre: e.target.value})} 
                            placeholder="Ej: Fundación Crecer" 
                            required 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Dirección</label>
                            <Input 
                                value={newData.direccion} 
                                onChange={e => setNewData({...newData, direccion: e.target.value})} 
                                placeholder="Calle y Altura" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Teléfono</label>
                            <Input 
                                value={newData.telefono} 
                                onChange={e => setNewData({...newData, telefono: e.target.value})} 
                                placeholder="Cod. Área + Nro" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Tutor (Lic. en Psicología)</label>
                        <Input 
                            value={newData.tutor} 
                            onChange={e => setNewData({...newData, tutor: e.target.value})} 
                            placeholder="Nombre y Apellido" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">Orientación Sugerida</label>
                        <Select 
                            value={newData.orientacionSugerida} 
                            onChange={e => setNewData({...newData, orientacionSugerida: e.target.value as any})}
                        >
                            <option value="">Seleccionar para pre-llenar...</option>
                            {ALL_ORIENTACIONES.map(o => <option key={o} value={o}>{o}</option>)}
                        </Select>
                    </div>
                    
                    <div className="pt-4 flex justify-end gap-3">
                        <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
                        <Button variant="primary" type="submit" isLoading={isLoading} disabled={!newData.nombre}>Guardar Institución</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const LAUNCH_TABLE_CONFIG = {
    label: 'Lanzamientos',
    schema: schema.lanzamientos,
    fieldConfig: [
        { key: FIELD_NOMBRE_PPS_LANZAMIENTOS, label: 'Nombre PPS', type: 'text' as const },
        { key: FIELD_FECHA_INICIO_LANZAMIENTOS, label: 'Fecha Inicio', type: 'date' as const },
        { key: FIELD_FECHA_FIN_LANZAMIENTOS, label: 'Fecha Finalización', type: 'date' as const },
        { key: FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS, label: 'Horarios (separar con ;)', type: 'text' as const },
        { key: FIELD_ORIENTACION_LANZAMIENTOS, label: 'Orientación', type: 'select' as const, options: ['Clinica', 'Educacional', 'Laboral', 'Comunitaria'] },
        { key: FIELD_HORAS_ACREDITADAS_LANZAMIENTOS, label: 'Horas Acreditadas', type: 'number' as const },
        { key: FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS, label: 'Cupos', type: 'number' as const },
        { key: FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS, label: 'Estado Convocatoria', type: 'select' as const, options: ['Abierta', 'Cerrado', 'Oculto'] },
        { key: FIELD_ESTADO_GESTION_LANZAMIENTOS, label: 'Estado Gestión', type: 'select' as const, options: ['Pendiente de Gestión', 'En Conversación', 'Relanzamiento Confirmado', 'No se Relanza', 'Archivado'] },
        { key: FIELD_NOTAS_GESTION_LANZAMIENTOS, label: 'Notas de Gestión', type: 'textarea' as const },
        { key: FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS, label: 'Pedir Cert. Trabajo', type: 'checkbox' as const },
        { key: FIELD_REQ_CV_LANZAMIENTOS, label: 'Pedir CV', type: 'checkbox' as const },
        { key: FIELD_DIRECCION_LANZAMIENTOS, label: 'Dirección', type: 'text' as const },
        { key: FIELD_CODIGO_CAMPUS_LANZAMIENTOS, label: 'Código HTML Campus', type: 'textarea' as const },
    ]
};

const LanzadorConvocatorias: React.FC<LanzadorConvocatoriasProps> = ({ isTestingMode = false, forcedTab }) => {
    const [internalTab, setInternalTab] = useState('new');
    const activeTab = forcedTab || internalTab;

    const [formData, setFormData] = useState<FormData>(initialState);
    const [schedules, setSchedules] = useState<string[]>(['']); // Lista de horarios
    const [campusCode, setCampusCode] = useState<string>(''); // Nuevo estado para el código HTML
    const [showCampusPreview, setShowCampusPreview] = useState(false);
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    
    const [instiSearch, setInstiSearch] = useState('');
    const [selectedInstitution, setSelectedInstitution] = useState<AirtableRecord<InstitucionFields> | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const queryClient = useQueryClient();
    
    // UI States
    const [isNewInstitutionModalOpen, setIsNewInstitutionModalOpen] = useState(false);
    const [editingLaunch, setEditingLaunch] = useState<AirtableRecord<LanzamientoPPSFields> | null>(null);

    const { data: institutions = [], isLoading: isLoadingInstitutions } = useQuery<AirtableRecord<InstitucionFields>[]>({
        queryKey: ['allInstitutionsForLauncher', isTestingMode],
        queryFn: () => {
            if (isTestingMode) {
                return Promise.resolve(mockInstitutions as unknown as AirtableRecord<InstitucionFields>[]);
            }
            return db.instituciones.getAll({ fields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_CONVENIO_NUEVO_INSTITUCIONES, FIELD_CODIGO_CAMPUS_INSTITUCIONES] });
        },
    });

    const { data: lastLanzamiento, isLoading: isLoadingLastLanzamiento } = useQuery({
        queryKey: ['lastLanzamiento', selectedInstitution?.id, isTestingMode],
        queryFn: async () => {
            if (!selectedInstitution) return null;
            if (isTestingMode) {
                if (mockInstitutions.some(i => i.id === selectedInstitution.id)) {
                    return mockLastLanzamiento as unknown as AirtableRecord<LanzamientoPPSFields>;
                }
                return null;
            }
            
            const records = await db.lanzamientos.get({
                filters: {
                    [FIELD_NOMBRE_PPS_LANZAMIENTOS]: selectedInstitution[FIELD_NOMBRE_INSTITUCIONES]
                },
                sort: [{ field: 'fecha_inicio', direction: 'desc' }],
                maxRecords: 1,
            });
            return records[0] || null;
        },
        enabled: !!selectedInstitution,
    });
    
    const { data: launchHistory = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ['launchHistory', isTestingMode],
        queryFn: async () => {
            if (isTestingMode) return [];
            return db.lanzamientos.getAll({ sort: [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: 'desc' }] });
        },
        // IMPORTANT: Always fetch history to keep list updated, but only if needed
        enabled: true
    });

    // SORTING AND GROUPING LOGIC FOR HISTORY TAB
    const { visibleHistory, hiddenHistory } = useMemo(() => {
        const sorted = [...launchHistory].sort((a, b) => {
            const statusA = normalizeStringForComparison(a[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
            const statusB = normalizeStringForComparison(b[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
            
            const isOpenA = statusA === 'abierta' || statusA === 'abierto';
            const isOpenB = statusB === 'abierta' || statusB === 'abierto';
            
            if (isOpenA && !isOpenB) return -1;
            if (!isOpenA && isOpenB) return 1;
            
            const dateA = new Date(a[FIELD_FECHA_INICIO_LANZAMIENTOS] || 0).getTime();
            const dateB = new Date(b[FIELD_FECHA_INICIO_LANZAMIENTOS] || 0).getTime();
            
            return dateB - dateA;
        });

        const visible: LanzamientoPPS[] = [];
        const hidden: LanzamientoPPS[] = [];

        sorted.forEach(launch => {
            const status = normalizeStringForComparison(launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
            if (status === 'oculto') {
                hidden.push(launch);
            } else {
                visible.push(launch);
            }
        });

        return { visibleHistory: visible, hiddenHistory: hidden };
    }, [launchHistory]);

    // MUTATIONS
    const createInstitutionMutation = useMutation({
        mutationFn: async (data: any) => {
             if (isTestingMode) {
                 return { id: 'new-mock', ...data, [FIELD_NOMBRE_INSTITUCIONES]: data.nombre };
             }
             return db.instituciones.create({
                 [FIELD_NOMBRE_INSTITUCIONES]: data.nombre,
                 [FIELD_DIRECCION_INSTITUCIONES]: data.direccion,
                 [FIELD_TELEFONO_INSTITUCIONES]: data.telefono,
                 [FIELD_TUTOR_INSTITUCIONES]: data.tutor,
                 [FIELD_CONVENIO_NUEVO_INSTITUCIONES]: true
             });
        },
        onSuccess: (newInst, variables) => {
             setToastInfo({ message: 'Institución registrada con éxito.', type: 'success' });
             setSelectedInstitution(newInst as any);
             setInstiSearch(newInst[FIELD_NOMBRE_INSTITUCIONES] as string);
             
             // Auto-fill launch form
             setFormData(prev => ({
                 ...prev,
                 nombrePPS: newInst[FIELD_NOMBRE_INSTITUCIONES] as string,
                 orientacion: variables.orientacionSugerida,
                 direccion: newInst[FIELD_DIRECCION_INSTITUCIONES] as string // Pre-fill address from new institution
             }));
             
             setIsNewInstitutionModalOpen(false);
             if (!isTestingMode) queryClient.invalidateQueries({ queryKey: ['allInstitutionsForLauncher'] });
        },
        onError: (err: any) => setToastInfo({ message: `Error: ${err.message}`, type: 'error' })
    });
    
    // Mutation to save ONLY the institution template code
    const updateInstitutionMutation = useMutation({
        mutationFn: async ({ id, code }: { id: string, code: string }) => {
            if (isTestingMode) return;
            return db.instituciones.update(id, { [FIELD_CODIGO_CAMPUS_INSTITUCIONES]: code });
        },
        onSuccess: () => {
             setToastInfo({ message: 'Plantilla HTML guardada en la institución.', type: 'success' });
             if (!isTestingMode) queryClient.invalidateQueries({ queryKey: ['allInstitutionsForLauncher'] });
        },
        onError: (err: any) => setToastInfo({ message: `Error guardando plantilla: ${err.message}`, type: 'error' })
    });

    const createLaunchMutation = useMutation({
        mutationFn: async (newLaunchData: any) => {
            if (isTestingMode) {
                console.log('TEST MODE: Simulating launch creation with data:', newLaunchData);
                return new Promise(resolve => setTimeout(() => resolve(null), 1000));
            }
            return db.lanzamientos.create(newLaunchData);
        },
        onSuccess: () => {
            setToastInfo({ message: 'Convocatoria lanzada con éxito.', type: 'success' });
            setFormData(initialState);
            setSchedules(['']);
            setCampusCode(''); // Reset campus code
            setInstiSearch('');
            setSelectedInstitution(null);
            if (!isTestingMode) {
                queryClient.invalidateQueries({ queryKey: ['allLanzamientos'] });
                queryClient.invalidateQueries({ queryKey: ['launchHistory'] });
                queryClient.invalidateQueries({ queryKey: ['conveniosData'] });
            }
        },
        onError: (error: any) => {
            const msg = error?.error?.message || error?.message || JSON.stringify(error);
            setToastInfo({ message: `Error al lanzar: ${msg}`, type: 'error' });
        },
    });
    
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string, updates: any }) => {
             return db.lanzamientos.update(id, updates);
        },
        onSuccess: (_, variables) => {
            const newStatus = variables.updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS];
             setToastInfo({ message: `Estado actualizado a "${newStatus}".`, type: 'success' });
             queryClient.invalidateQueries({ queryKey: ['launchHistory'] });
        },
        onError: (error: any) => {
             setToastInfo({ message: `Error al actualizar estado: ${error.message}`, type: 'error' });
        }
    });

    const updateDetailsMutation = useMutation({
        mutationFn: ({ id, fields }: { id: string, fields: any }) => {
            return db.lanzamientos.update(id, fields);
        },
        onSuccess: () => {
            setToastInfo({ message: 'Lanzamiento actualizado.', type: 'success' });
            setEditingLaunch(null);
            queryClient.invalidateQueries({ queryKey: ['launchHistory'] });
        },
        onError: (error: any) => {
            setToastInfo({ message: `Error al guardar cambios: ${error.message}`, type: 'error' });
        }
    });

    const filteredInstitutions = useMemo(() => {
        if (!instiSearch) return [];
        const normalizedSearch = normalizeStringForComparison(instiSearch);
        return institutions
            .filter(inst => normalizeStringForComparison(inst[FIELD_NOMBRE_INSTITUCIONES]).includes(normalizedSearch))
            .slice(0, 7);
    }, [instiSearch, institutions]);

    const handleSelectInstitution = (inst: AirtableRecord<InstitucionFields>) => {
        setSelectedInstitution(inst);
        setInstiSearch(inst[FIELD_NOMBRE_INSTITUCIONES] || '');
        setFormData(prev => ({ 
            ...prev, 
            nombrePPS: inst[FIELD_NOMBRE_INSTITUCIONES] || '',
            direccion: inst[FIELD_DIRECCION_INSTITUCIONES] || prev.direccion // Auto-fill address if available in institution
        }));
        
        // Priority: Load from Institution Template if exists
        const institutionTemplate = inst[FIELD_CODIGO_CAMPUS_INSTITUCIONES];
        if (institutionTemplate) {
            setCampusCode(String(institutionTemplate));
        } else {
             // If not, clear it or it will be populated by "Last Launch" effect later
             setCampusCode('');
        }
        
        setIsDropdownOpen(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        
        // Explicitly cast the value to any to avoid TS error about boolean vs string assignment on dynamic keys
        const newValue = type === 'checkbox' ? checked : value;

        setFormData(prev => ({ 
            ...prev, 
            [name]: newValue as any 
        }));
    };

    const handleScheduleChange = (index: number, value: string) => {
        const newSchedules = [...schedules];
        newSchedules[index] = value;
        setSchedules(newSchedules);
    };

    const addSchedule = () => setSchedules([...schedules, '']);
    const removeSchedule = (index: number) => {
        const newSchedules = schedules.filter((_, i) => i !== index);
        setSchedules(newSchedules.length ? newSchedules : ['']);
    };
    
    const handleLoadLastData = useCallback(() => {
        if (!lastLanzamiento) return;
        const prevSchedulesString = lastLanzamiento[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS];
        let prevSchedulesList = [''];
        if (prevSchedulesString) {
            prevSchedulesList = prevSchedulesString.split(';').map(s => s.trim()).filter(Boolean);
            if (prevSchedulesList.length === 0) prevSchedulesList = [''];
        }
        setFormData(prev => ({
            ...prev,
            orientacion: lastLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS],
            horasAcreditadas: lastLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS],
            cuposDisponibles: lastLanzamiento[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS],
            informe: lastLanzamiento[FIELD_INFORME_LANZAMIENTOS],
            reqCertificadoTrabajo: lastLanzamiento[FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS] !== false,
            reqCv: !!lastLanzamiento[FIELD_REQ_CV_LANZAMIENTOS],
            direccion: lastLanzamiento[FIELD_DIRECCION_LANZAMIENTOS] || prev.direccion // Load address from last launch
        }));
        setSchedules(prevSchedulesList);
        
        // Load campus code from last launch IF AVAILABLE AND NO TEMPLATE LOADED YET
        // (If user manually cleared it, this re-populates it, which is fine)
        if (lastLanzamiento[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] && !campusCode) {
            setCampusCode(lastLanzamiento[FIELD_CODIGO_CAMPUS_LANZAMIENTOS] as string);
        }
        
        setToastInfo({ message: 'Datos de la última convocatoria cargados.', type: 'success' });
    }, [lastLanzamiento, campusCode]);

    // Effect to auto-load last data when institution is selected, IF it exists.
    useEffect(() => {
        // Only auto-load if we haven't typed anything yet (simple heuristic)
        if (lastLanzamiento && selectedInstitution && formData.horasAcreditadas === 0) {
            handleLoadLastData();
        }
    }, [lastLanzamiento, selectedInstitution, handleLoadLastData, formData.horasAcreditadas]);

    const handleCopyToClipboard = () => {
        if (!campusCode) return;
        navigator.clipboard.writeText(campusCode).then(() => {
            setToastInfo({ message: 'Código copiado al portapapeles.', type: 'success' });
        });
    }

    const handleSaveTemplate = () => {
        if (!selectedInstitution) {
            setToastInfo({ message: 'Selecciona una institución primero.', type: 'error' });
            return;
        }
        if (!campusCode) {
            setToastInfo({ message: 'El código está vacío.', type: 'error' });
            return;
        }
        updateInstitutionMutation.mutate({ id: selectedInstitution.id, code: campusCode });
    }

    const handleGenerateCampusCode = async () => {
        if (!campusCode) {
            setToastInfo({ message: 'No hay código HTML base para actualizar.', type: 'error' });
            return;
        }
        if (!formData.fechaInicio || !formData.fechaFin || !formData.horasAcreditadas) {
            setToastInfo({ message: 'Completa fechas y horas antes de generar el código.', type: 'error' });
            return;
        }

        setIsGeneratingCode(true);
        try {
            // Fix: Initialize GoogleGenAI with process.env.API_KEY directly as per guidelines
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const horarioString = schedules.join('; ');

            const prompt = `
                Actúa como un desarrollador web experto. Tengo un fragmento de código HTML (una "tarjeta" o "banner" informativa para un campus virtual).
                Tu tarea es ACTUALIZAR el contenido de texto dentro de ese HTML con los nuevos datos que te proporcionaré.
                
                **IMPORTANTE:**
                1. MANTÉN INTACTA la estructura HTML, las clases CSS y los estilos inline. No borres ni agregues etiquetas, solo cambia el texto visible.
                2. Si el HTML original no tiene alguno de los datos, intenta agregarlo discretamente o ignóralo si no encaja, pero prioriza mantener el diseño original.
                3. Devuelve SOLAMENTE el código HTML actualizado, sin explicaciones ni markdown.

                **DATOS NUEVOS:**
                - Fecha de Inicio: ${formData.fechaInicio}
                - Fecha de Finalización: ${formData.fechaFin}
                - Horas Acreditadas: ${formData.horasAcreditadas}
                - Cupos: ${formData.cuposDisponibles}
                - Horarios: ${horarioString}
                - Institución: ${formData.nombrePPS}
                - Dirección: ${formData.direccion}

                **CÓDIGO HTML ORIGINAL:**
                ${campusCode}
            `;

            const response = await ai.models.generateContent({
                // Fix: Updated model name to gemini-3-flash-preview as recommended for text tasks
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });

            // Fix: Directly access text property from response object without calling it as a function
            const newCode = response.text.replace(/```html/g, '').replace(/```/g, '').trim();
            setCampusCode(newCode);
            
            // Auto-copy
            navigator.clipboard.writeText(newCode);
            setToastInfo({ message: 'Código actualizado y copiado al portapapeles.', type: 'success' });
        } catch (error: any) {
            console.error("AI Generation Error", error);
            setToastInfo({ message: 'Error al generar código con IA.', type: 'error' });
        } finally {
            setIsGeneratingCode(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombrePPS || !formData.fechaInicio || !formData.orientacion || !formData.horasAcreditadas) {
            setToastInfo({ message: 'Por favor, complete los campos requeridos.', type: 'error' });
            return;
        }
        const horarioFinal = schedules.map(s => s.trim()).filter(Boolean).join('; ');
        const finalPayload = {
            [FIELD_NOMBRE_PPS_LANZAMIENTOS]: formData.nombrePPS,
            [FIELD_FECHA_INICIO_LANZAMIENTOS]: formData.fechaInicio,
            [FIELD_FECHA_FIN_LANZAMIENTOS]: formData.fechaFin,
            [FIELD_ORIENTACION_LANZAMIENTOS]: formData.orientacion,
            [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: Number(formData.horasAcreditadas),
            [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: Number(formData.cuposDisponibles),
            [FIELD_INFORME_LANZAMIENTOS]: formData.informe,
            [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: horarioFinal,
            [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: formData.estadoConvocatoria,
            [FIELD_ESTADO_GESTION_LANZAMIENTOS]: 'Relanzamiento Confirmado',
            [FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS]: formData.reqCertificadoTrabajo,
            [FIELD_REQ_CV_LANZAMIENTOS]: formData.reqCv,
            [FIELD_DIRECCION_LANZAMIENTOS]: formData.direccion,
            [FIELD_CODIGO_CAMPUS_LANZAMIENTOS]: campusCode, // Save the code to launch
        };
        createLaunchMutation.mutate(finalPayload);
        
        // Also update the template if it changed (optional but good practice)
        if (selectedInstitution && campusCode) {
             updateInstitutionMutation.mutate({ id: selectedInstitution.id, code: campusCode });
        }
    };

    const handleStatusAction = (id: string, currentStatus: string, action: 'cerrar' | 'abrir' | 'ocultar') => {
        let updates: any = {};
        
        if (action === 'cerrar') {
            updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = 'Cerrado';
        } else if (action === 'abrir') {
            updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = 'Abierta';
            // CRITICAL FIX: Ensure it is not Archived, otherwise it won't show up in student view
            updates[FIELD_ESTADO_GESTION_LANZAMIENTOS] = 'Relanzamiento Confirmado'; 
        } else if (action === 'ocultar') {
            updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = 'Oculto';
        }
        
        updateStatusMutation.mutate({ id, updates });
    };

    const renderLaunchItem = useCallback((launch: LanzamientoPPS) => {
        const isAbierta = normalizeStringForComparison(launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]) === 'abierta' || normalizeStringForComparison(launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]) === 'abierto';
        const isOculta = normalizeStringForComparison(launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]) === 'oculto';
        
        return (
            <div key={launch.id} className={`bg-white dark:bg-slate-800/50 p-4 rounded-xl border transition-shadow hover:shadow-md ${isAbierta ? 'border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-100 dark:ring-emerald-900/30' : (isOculta ? 'border-slate-200 dark:border-slate-700 opacity-75' : 'border-slate-200 dark:border-slate-700')} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{launch[FIELD_NOMBRE_PPS_LANZAMIENTOS]}</h4>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${isAbierta ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (isOculta ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-100 text-slate-500 border-slate-200')}`}>
                            {launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Inicio: {formatDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS])} &bull; Orientación: {launch[FIELD_ORIENTACION_LANZAMIENTOS]}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setEditingLaunch(launch)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <span className="material-icons !text-xl">edit</span>
                    </button>
                    {isOculta ? (
                        <button onClick={() => handleStatusAction(launch.id, launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS], 'cerrar')} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Hacer Visible (Cerrada)">
                            <span className="material-icons !text-xl">visibility</span>
                        </button>
                    ) : isAbierta ? (
                        <button onClick={() => handleStatusAction(launch.id, launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS], 'cerrar')} className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Cerrar Convocatoria">
                            <span className="material-icons !text-xl">lock</span>
                        </button>
                    ) : (
                        <button onClick={() => handleStatusAction(launch.id, launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS], 'abrir')} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Reabrir Convocatoria">
                            <span className="material-icons !text-xl">lock_open</span>
                        </button>
                    )}
                    {!isOculta && (
                        <button onClick={() => handleStatusAction(launch.id, launch[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS], 'ocultar')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Ocultar">
                             <span className="material-icons !text-xl">visibility_off</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }, [handleStatusAction]);

    const inputClass = "w-full px-4 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all";

    return (
        <Card 
            title={activeTab === 'new' ? "Nuevo Lanzamiento" : "Historial de Lanzamientos"} 
            icon={activeTab === 'new' ? "rocket_launch" : "history"}
            description={activeTab === 'new' ? "Configura y publica una nueva convocatoria." : "Visualiza y administra convocatorias anteriores."}
            className="border-blue-200 dark:border-blue-800/30"
        >
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            
            {/* NEW INSTITUTION MODAL */}
            <NewInstitutionModal 
                isOpen={isNewInstitutionModalOpen}
                onClose={() => setIsNewInstitutionModalOpen(false)}
                onConfirm={createInstitutionMutation.mutate}
                isLoading={createInstitutionMutation.isPending}
            />

            {!forcedTab && (
                <div className="mt-4">
                    <SubTabs 
                        tabs={[
                            { id: 'new', label: 'Nuevo Lanzamiento', icon: 'add_circle' },
                            { id: 'history', label: 'Historial', icon: 'history' }
                        ]}
                        activeTabId={activeTab}
                        onTabChange={setInternalTab}
                    />
                </div>
            )}

            {/* USE CSS DISPLAY TO KEEP STATE ALIVE WHEN SWITCHING TABS WITHIN THE COMPONENT */}
            <div className={activeTab === 'new' ? 'block' : 'hidden'}>
                <form onSubmit={handleSubmit} className="mt-8 space-y-8 animate-fade-in">
                    
                    {/* BLOQUE 1: SELECCIÓN DE INSTITUCIÓN (PREMIUM UI) */}
                    <div className={`relative group ${isDropdownOpen ? 'z-50' : 'z-30'}`}>
                        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                        </div>

                        <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-600 rounded-l-md shadow-sm"></div>
                        <div className="pl-6 relative z-20">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm font-bold shadow-sm border border-blue-200 dark:border-blue-800">1</span>
                                Institución
                            </h3>
                            
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative">

                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="relative flex-grow w-full">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Buscar Institución Existente</label>
                                        <div className="relative">
                                            <input
                                                id="instiSearch"
                                                type="text"
                                                value={instiSearch}
                                                onChange={(e) => {
                                                    setInstiSearch(e.target.value);
                                                    setSelectedInstitution(null);
                                                    setIsDropdownOpen(true);
                                                }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                                placeholder="Escribe para buscar..."
                                                className="w-full h-11 pl-11 pr-4 text-lg font-medium bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors shadow-sm placeholder:font-normal"
                                                autoComplete="off"
                                                required
                                            />
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-icons text-slate-400 !text-xl">search</span>
                                        </div>

                                        {/* Dropdown de Resultados - Increased z-index to fly above everything */}
                                        {isDropdownOpen && filteredInstitutions.length > 0 && (
                                            <div className="absolute z-[100] mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 overflow-hidden animate-fade-in-up max-h-60 overflow-y-auto">
                                                <ul>
                                                    {filteredInstitutions.map(inst => (
                                                        <li 
                                                            key={inst.id} 
                                                            onClick={() => handleSelectInstitution(inst)} 
                                                            className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors flex items-center gap-3"
                                                        >
                                                            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-300">
                                                                <span className="material-icons !text-lg">business</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="block text-slate-700 dark:text-slate-200 font-medium">{inst[FIELD_NOMBRE_INSTITUCIONES]}</span>
                                                                {inst[FIELD_CONVENIO_NUEVO_INSTITUCIONES] && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">Convenio Nuevo</span>}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex-shrink-0 w-full md:w-auto">
                                        <button 
                                            type="button" 
                                            onClick={() => setIsNewInstitutionModalOpen(true)}
                                            className="w-full md:w-auto h-[52px] px-6 bg-white dark:bg-slate-700 border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-icons !text-xl">add</span>
                                            Nueva Institución
                                        </button>
                                    </div>
                                </div>

                                {lastLanzamiento && (
                                    <div className="mt-4 flex justify-end">
                                        <button 
                                            type="button" 
                                            onClick={handleLoadLastData} 
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-2 shadow-sm border border-indigo-100 dark:border-indigo-800"
                                        >
                                            <span className="material-icons !text-sm">auto_fix_high</span>
                                            Copiar datos del último lanzamiento
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE 2: DETALLES ACADÉMICOS (PREMIUM UI) */}
                    <div className="relative group z-20">
                         <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                             <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full -ml-10 -mb-10 pointer-events-none"></div>
                         </div>
                        
                        <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-md shadow-sm"></div>
                        <div className="pl-6 relative z-20">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-sm font-bold shadow-sm border border-indigo-200 dark:border-indigo-800">2</span>
                                Detalles Académicos
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative">
                                
                                <InputWrapper label="Orientación" icon="school">
                                    <select name="orientacion" value={formData.orientacion as string} onChange={handleChange} className={inputClass} required>
                                        <option value="">Seleccionar...</option>
                                        {ALL_ORIENTACIONES.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </InputWrapper>

                                <div className="grid grid-cols-2 gap-4">
                                    <InputWrapper label="Horas Acreditadas" icon="schedule">
                                        <input type="number" name="horasAcreditadas" value={formData.horasAcreditadas as number} onChange={handleChange} className={inputClass} required min="1" />
                                    </InputWrapper>
                                    <InputWrapper label="Cupos Disponibles" icon="group_add">
                                        <input type="number" name="cuposDisponibles" value={formData.cuposDisponibles as number} onChange={handleChange} className={inputClass} required min="1" />
                                    </InputWrapper>
                                </div>

                                {/* CHECKBOXES PARA REQUISITOS */}
                                <div className="col-span-1 md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Requisitos de Documentación</label>
                                    <div className="flex flex-col sm:flex-row gap-6">
                                        <Checkbox 
                                            id="check-certificado" 
                                            name="reqCertificadoTrabajo" 
                                            label="Solicitar Certificado de Trabajo (si aplica)" 
                                            checked={formData.reqCertificadoTrabajo as boolean} 
                                            onChange={handleChange} 
                                        />
                                        <Checkbox 
                                            id="check-cv" 
                                            name="reqCv" 
                                            label="Solicitar Curriculum Vitae (CV)" 
                                            checked={formData.reqCv as boolean} 
                                            onChange={handleChange} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE 3: LOGÍSTICA (PREMIUM UI) */}
                    <div className="relative group z-10">
                         <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                         </div>

                        <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-md shadow-sm"></div>
                        <div className="pl-6 relative z-20">
                             <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 text-sm font-bold shadow-sm border border-emerald-200 dark:border-emerald-800">3</span>
                                Cronograma y Logística
                            </h3>

                            <div className="bg-white dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-6 shadow-sm relative">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                    <InputWrapper label="Fecha de Inicio" icon="event">
                                        <input type="date" name="fechaInicio" value={formData.fechaInicio as string} onChange={handleChange} className={inputClass} required />
                                    </InputWrapper>

                                    <InputWrapper label="Fecha de Finalización" icon="event_busy">
                                        <input type="date" name="fechaFin" value={formData.fechaFin as string} onChange={handleChange} className={inputClass} required />
                                    </InputWrapper>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                    <InputWrapper label="Dirección / Lugar" icon="location_on">
                                        <input 
                                            type="text" 
                                            name="direccion" 
                                            value={formData.direccion as string} 
                                            onChange={handleChange} 
                                            placeholder="Calle Falsa 123"
                                            className={inputClass} 
                                        />
                                    </InputWrapper>
                                    <InputWrapper label="Link al Programa / Informe (Opcional)" icon="link">
                                        <input type="url" name="informe" value={formData.informe as string} onChange={handleChange} placeholder="https://..." className={inputClass} />
                                    </InputWrapper>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 relative z-10">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <span className="material-icons text-slate-300 dark:text-slate-600 !text-sm">schedule</span>
                                        Opciones de Horarios
                                    </label>
                                    {schedules.map((schedule, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <div className="flex-grow">
                                                 <input
                                                    type="text"
                                                    value={schedule}
                                                    onChange={(e) => handleScheduleChange(idx, e.target.value)}
                                                    placeholder="Ej: Lunes 9 a 13hs"
                                                    className={inputClass}
                                                    required
                                                />
                                            </div>
                                            {schedules.length > 1 && (
                                                <button type="button" onClick={() => removeSchedule(idx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                    <span className="material-icons !text-xl">remove_circle_outline</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={addSchedule} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 mt-2 pl-1">
                                        <span className="material-icons !text-lg">add</span> Agregar otro horario
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* BLOQUE 4: TARJETA CAMPUS (AI FEATURE) */}
                    <div className="relative group z-10">
                        <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500 rounded-l-md shadow-sm"></div>
                        <div className="pl-6 relative z-20">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-sm font-bold shadow-sm border border-amber-200 dark:border-amber-800">4</span>
                                Tarjeta del Campus (HTML)
                            </h3>
                            
                            <div className="bg-white dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm relative">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Aquí puedes pegar el código HTML de la tarjeta que se muestra en el campus. Usa la IA para actualizar fechas y horarios automáticamente.
                                </p>
                                
                                <div className="flex flex-wrap gap-2 mb-2 items-center">
                                     <button
                                        type="button"
                                        onClick={() => setShowCampusPreview(!showCampusPreview)}
                                        className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                     >
                                         {showCampusPreview ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}
                                     </button>
                                     <button
                                        type="button"
                                        onClick={handleGenerateCampusCode}
                                        disabled={isGeneratingCode || !campusCode}
                                        className="text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                     >
                                         {isGeneratingCode ? (
                                             <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"/>
                                         ) : (
                                             <span className="material-icons !text-xs">auto_awesome</span>
                                         )}
                                         Actualizar con IA
                                     </button>
                                     <div className="flex-1"></div>
                                     {selectedInstitution && (
                                         <button
                                             type="button"
                                             onClick={handleSaveTemplate}
                                             disabled={!campusCode || updateInstitutionMutation.isPending}
                                             className="text-xs font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                                         >
                                             <span className="material-icons !text-xs">save</span>
                                             Guardar Plantilla
                                         </button>
                                     )}
                                     <button
                                         type="button"
                                         onClick={handleCopyToClipboard}
                                         disabled={!campusCode}
                                         className="text-xs font-bold text-slate-700 bg-slate-200 dark:bg-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-300 transition-colors flex items-center gap-1"
                                     >
                                         <span className="material-icons !text-xs">content_copy</span>
                                         Copiar
                                     </button>
                                </div>
                                
                                {showCampusPreview && campusCode && (
                                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-100 text-black overflow-auto max-h-60 mb-4">
                                        <div dangerouslySetInnerHTML={{ __html: campusCode }} />
                                    </div>
                                )}

                                <textarea 
                                    value={campusCode}
                                    onChange={(e) => setCampusCode(e.target.value)}
                                    rows={6}
                                    className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 shadow-inner focus:ring-2 focus:ring-amber-500 outline-none resize-y"
                                    placeholder="<div>Pegar código HTML aquí...</div>"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ACTION FOOTER */}
                    <div className="pt-6 flex justify-end sticky bottom-6 z-40">
                        <button 
                            type="submit" 
                            disabled={createLaunchMutation.isPending}
                            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 px-10 rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-3 ring-4 ring-white dark:ring-slate-950"
                        >
                            {createLaunchMutation.isPending ? (
                                <><div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"/> Procesando...</>
                            ) : (
                                <><span className="material-icons !text-xl">rocket_launch</span> Publicar Convocatoria</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className={activeTab === 'history' ? 'block' : 'hidden'}>
                <div className="mt-6 space-y-8">
                    {isLoadingHistory ? <Loader /> : (visibleHistory.length === 0 && hiddenHistory.length === 0) ? <EmptyState icon="history_toggle_off" title="Sin Historial" message="No hay lanzamientos registrados." /> : (
                        <>
                             {/* LISTA VISIBLE (Abiertas / Cerradas) */}
                             <div className="space-y-4">
                                {visibleHistory.map(renderLaunchItem)}
                             </div>

                             {/* LISTA OCULTA (Colapsable) */}
                             {hiddenHistory.length > 0 && (
                                <CollapsibleSection 
                                    title="Archivados / Ocultos" 
                                    count={hiddenHistory.length}
                                    icon="visibility_off"
                                    iconBgColor="bg-slate-100 dark:bg-slate-800"
                                    iconColor="text-slate-500 dark:text-slate-400"
                                    borderColor="border-slate-200 dark:border-slate-700"
                                    defaultOpen={false}
                                >
                                    <div className="space-y-4">
                                        {hiddenHistory.map(renderLaunchItem)}
                                    </div>
                                </CollapsibleSection>
                             )}
                        </>
                    )}
                </div>
            </div>
            
            {editingLaunch && (
                 <RecordEditModal
                    isOpen={!!editingLaunch}
                    onClose={() => setEditingLaunch(null)}
                    record={editingLaunch}
                    tableConfig={LAUNCH_TABLE_CONFIG}
                    onSave={(id, fields) => updateDetailsMutation.mutate({ id: id!, fields })}
                    isSaving={updateDetailsMutation.isPending}
                 />
            )}
        </Card>
    );
};

export default LanzadorConvocatorias;
