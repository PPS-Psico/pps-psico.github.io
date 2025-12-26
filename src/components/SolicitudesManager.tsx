
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { db } from '../lib/db';
import { supabase } from '../lib/supabaseClient';
import { mockDb } from '../services/mockDb';
import type { SolicitudPPSFields } from '../types';
import {
    COL_NOMBRE_INSTITUCION_SOLICITUD,
    COL_ESTADO_SEGUIMIENTO,
    COL_ESTADO_FINALIZACION,
    TABLE_PPS,
    TABLE_FINALIZACION
} from '../constants';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Toast from './Toast';
import { formatDate, getStatusVisuals, normalizeStringForComparison } from '../utils/formatters';
import SubTabs from './SubTabs';
import FinalizacionReview from './FinalizacionReview';
import { sendSmartEmail } from '../utils/emailService';
import CollapsibleSection from './CollapsibleSection';
import ConfirmModal from './ConfirmModal';

// Clean helper now handled by mappers or simple checks
const clean = (val: any) => val || '';

const InfoField: React.FC<{ label: string; value?: string | null; fullWidth?: boolean }> = ({ label, value, fullWidth }) => (
    <div className={`${fullWidth ? 'col-span-full' : ''} group`}>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5 group-hover:text-blue-500 transition-colors">{label}</p>
        <p className="text-slate-800 dark:text-slate-200 text-sm font-medium whitespace-pre-wrap break-words">
            {value || <span className="text-slate-300 dark:text-slate-600 italic">Sin datos</span>}
        </p>
    </div>
);

const RequestListItem: React.FC<{
    req: any;
    onDeleteRequest: (id: string) => void;
    onUpdate: (id: string, fields: Partial<SolicitudPPSFields>) => Promise<void>;
    isUpdatingParent: boolean;
}> = ({ req, onDeleteRequest, onUpdate, isUpdatingParent }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [status, setStatus] = useState(req.estado_seguimiento || 'Pendiente');
    const [notes, setNotes] = useState(req.notas || '');
    const [isLocalSaving, setIsLocalSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const statusVisuals = getStatusVisuals(status);
    const normalizedStatus = normalizeStringForComparison(status);
    const isStagnant = req._daysSinceUpdate > 4 && !['finalizada', 'cancelada', 'rechazada', 'archivado', 'realizada', 'no se pudo concretar'].includes(normalizedStatus);
    const institucion = req.nombre_institucion;
    const instEmail = req.email_institucion;
    const updateTimeDisplay = req.actualizacion || req.created_at;

    useEffect(() => {
        setHasChanges(status !== (req.estado_seguimiento || 'Pendiente') || notes !== (req.notas || ''));
    }, [status, notes, req]);

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasChanges) return;
        setIsLocalSaving(true);
        // Map UI fields back to DB columns if needed, but constants handle this mostly
        await onUpdate(req.id, { estado_seguimiento: status, notas: notes });
        setIsLocalSaving(false);
        setHasChanges(false);
    };

    const handleDraftEmail = (e: React.MouseEvent) => {
        e.stopPropagation();
        const subject = `Propuesta de Convenio PPS - UFLO - Alumno: ${req._studentName}`;
        const body = `Estimados ${institucion},\n\nMe comunico desde la coordinación de Prácticas Profesionales...\n`;
        const mailto = `mailto:${instEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailto, '_blank');
        if (status === 'Pendiente') { setStatus('En conversaciones'); setHasChanges(true); }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setStatus(req.estado_seguimiento || 'Pendiente');
        setNotes(req.notas || '');
        setIsExpanded(false);
    };

    return (
        <div className={`group relative bg-white dark:bg-slate-900 rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-900/30 shadow-lg' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm'} ${isStagnant && !isExpanded ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${isExpanded ? 'w-1' : 'w-1.5'} ${statusVisuals.accentBg}`}></div>
            <div onClick={() => setIsExpanded(!isExpanded)} className="p-4 pl-5 cursor-pointer">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border transition-colors ${isExpanded ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{req._studentName.charAt(0)}</div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">{institucion || 'Institución s/n'}</h4>
                                {isStagnant && !isExpanded && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">!</span>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5"><span className="font-medium">{req._studentName}</span><span className="text-slate-300 dark:text-slate-600">•</span><span className="font-mono">{req._studentLegajo}</span></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-center pl-14 sm:pl-0">
                         <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide ${statusVisuals.labelClass}`}>{status}</span>
                         <span className={`material-icons text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h5 className="font-bold text-xs uppercase text-slate-500">Detalles de la Solicitud</h5>
                            <InfoField label="Localidad" value={req.localidad} />
                            <InfoField label="Dirección" value={req.direccion_completa} />
                            <InfoField label="Referente" value={req.referente_institucion} />
                            <InfoField label="Contacto" value={req.contacto_tutor} fullWidth />
                        </div>
                        <div className="space-y-4">
                            <h5 className="font-bold text-xs uppercase text-slate-500">Gestión</h5>
                             <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Estado Actual</label>
                                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"><option value="Pendiente">Pendiente</option><option value="En conversaciones">En conversaciones</option><option value="Realizada">Realizada</option><option value="No se pudo concretar">No se pudo concretar</option><option value="Archivado">Archivado</option></select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notas</label>
                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={handleCancel} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
                                <button onClick={handleSave} disabled={!hasChanges || isLocalSaving} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-all">{isLocalSaving ? 'Guardando...' : 'Guardar'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SolicitudesManager: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
    const location = useLocation();
    const [activeTabId, setActiveTabId] = useState('ingreso');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    
    const queryClient = useQueryClient();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'egreso') setActiveTabId('egreso');
        else if (tab === 'ingreso') setActiveTabId('ingreso');
    }, [location.search]);

    const tabs = [
        { id: 'ingreso', label: 'Solicitudes de PPS', icon: 'login' },
        { id: 'egreso', label: 'Solicitudes de Finalización', icon: 'logout' },
    ];

    const { data: requestsData, isLoading, error } = useQuery({
        queryKey: ['adminSolicitudes', isTestingMode],
        queryFn: async () => {
            if (isTestingMode) {
                 const mockRequests = await mockDb.getAll('solicitudes_pps');
                 return mockRequests.map((req: any) => ({ ...req, _studentName: req.nombre_alumno || 'Estudiante Mock', _studentLegajo: req.legajo || '12345', _studentEmail: req.email, _daysSinceUpdate: 0 }));
            }
            
            // OPTIMIZED QUERY: Fetch everything (or paginate if too large)
            // Note: We're doing client-side filtering for search/status for responsiveness on moderate datasets
            // For huge datasets, move filtering to .eq() here.
            const { data, error } = await supabase
                .from(TABLE_PPS)
                .select('*, estudiantes!fk_solicitud_estudiante(nombre, legajo, correo)')
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);

            return data.map((req: any) => {
                const studentData = req.estudiantes;
                const updatedAt = new Date(req.actualizacion || req.created_at || Date.now());
                return { 
                    ...req, 
                    id: String(req.id), 
                    createdTime: req.created_at, 
                    _studentName: studentData?.nombre || req.nombre_alumno || 'Estudiante', 
                    _studentLegajo: studentData?.legajo || req.legajo || '---', 
                    _studentEmail: studentData?.correo || req.email, 
                    _daysSinceUpdate: Math.floor((new Date().getTime() - updatedAt.getTime()) / (1000 * 3600 * 24)) 
                };
            });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ recordId, fields }: { recordId: string, fields: any }) => {
             if (isTestingMode) return await mockDb.update('solicitudes_pps', recordId, fields);
             const originalRecord = requestsData?.find(r => r.id === recordId);
             
             // Email Trigger
             if (originalRecord && fields[COL_ESTADO_SEGUIMIENTO] && fields[COL_ESTADO_SEGUIMIENTO] !== originalRecord[COL_ESTADO_SEGUIMIENTO]) {
                 await sendSmartEmail('solicitud', { 
                    studentName: (originalRecord as any)._studentName, 
                    studentEmail: (originalRecord as any)._studentEmail, 
                    institution: originalRecord.nombre_institucion, 
                    newState: fields[COL_ESTADO_SEGUIMIENTO], 
                    notes: fields.notas || originalRecord.notas 
                });
             }
             return db.solicitudes.update(recordId, fields);
        },
        onSuccess: () => { setToastInfo({ message: 'Solicitud actualizada.', type: 'success' }); queryClient.invalidateQueries({ queryKey: ['adminSolicitudes', isTestingMode] }); },
        onError: (err: any) => setToastInfo({ message: `Error: ${err.message}`, type: 'error' })
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            if (isTestingMode) return await mockDb.delete('solicitudes_pps', id);
            await db.solicitudes.delete(id);
        },
        onSuccess: () => { setToastInfo({ message: 'Solicitud eliminada.', type: 'success' }); queryClient.invalidateQueries({ queryKey: ['adminSolicitudes', isTestingMode] }); setIdToDelete(null); },
        onError: (err: any) => { setToastInfo({ message: `Error: ${err.message}`, type: 'error' }); setIdToDelete(null); }
    });

    const { activeList, historyList } = useMemo(() => {
        if (!requestsData) return { activeList: [], historyList: [] };
        const searchLower = searchTerm.toLowerCase();
        const active: any[] = [], history: any[] = [];
        const historyStatuses = ['finalizada', 'cancelada', 'rechazada', 'archivado', 'realizada', 'no se pudo concretar'];
        
        requestsData.forEach((req: any) => {
            if (searchTerm && !(String(req._studentName).toLowerCase().includes(searchLower) || String(req._studentLegajo).toLowerCase().includes(searchLower) || (req.nombre_institucion || '').toLowerCase().includes(searchLower))) return;
            
            const status = normalizeStringForComparison(req.estado_seguimiento);
            
            if (statusFilter === 'requieren_atencion' && (historyStatuses.includes(status) || req._daysSinceUpdate <= 4)) return;
            if (statusFilter !== 'all' && statusFilter !== 'requieren_atencion' && normalizeStringForComparison(statusFilter) !== status) return;
            
            if (historyStatuses.includes(status)) history.push(req); else active.push(req);
        });
        return { activeList: active, historyList: history };
    }, [requestsData, searchTerm, statusFilter]);

    if (isLoading) return <div className="flex justify-center p-12"><Loader /></div>;
    if (error) return <EmptyState icon="error" title="Error" message={error.message} />;

    return (
        <div className="space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            <ConfirmModal isOpen={!!idToDelete} title="¿Eliminar solicitud?" message="Esta acción es permanente y no se puede deshacer." confirmText="Eliminar" type="danger" onConfirm={() => idToDelete && deleteMutation.mutate(idToDelete)} onClose={() => setIdToDelete(null)} />
            
            <SubTabs tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />

            {activeTabId === 'egreso' ? <FinalizacionReview isTestingMode={isTestingMode} /> : (
                <div className="animate-fade-in-up space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="relative w-full md:w-96">
                            <input type="text" placeholder="Buscar por alumno o institución..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white transition-all"/>
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400">search</span>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full md:w-48 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white cursor-pointer">
                                <option value="all">Estado: Todos</option>
                                <option value="requieren_atencion">⚠️ Requieren Atención</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="En conversaciones">En conversaciones</option>
                                <option value="Realizada">Realizada</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {activeList.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 pl-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Pendientes de Gestión ({activeList.length})</h3>
                                <div className="grid grid-cols-1 gap-4">{activeList.map(req => <RequestListItem key={req.id} req={req} onDeleteRequest={setIdToDelete} onUpdate={async (id, fields) => { await updateMutation.mutateAsync({ recordId: id, fields }); }} isUpdatingParent={updateMutation.isPending} />)}</div>
                            </div>
                        )}
                        {historyList.length > 0 && (
                             <CollapsibleSection title="Historial y Finalizadas" count={historyList.length} icon="history" iconBgColor="bg-slate-100 dark:bg-slate-800" iconColor="text-slate-500 dark:text-slate-400" borderColor="border-slate-200 dark:border-slate-800" defaultOpen={false}>
                                <div className="grid grid-cols-1 gap-4 mt-4">{historyList.map(req => <RequestListItem key={req.id} req={req} onDeleteRequest={setIdToDelete} onUpdate={async (id, fields) => { await updateMutation.mutateAsync({ recordId: id, fields }); }} isUpdatingParent={updateMutation.isPending} />)}</div>
                            </CollapsibleSection>
                        )}
                        {activeList.length === 0 && historyList.length === 0 && <div className="py-12"><EmptyState icon="inbox" title="Sin Solicitudes" message="No se encontraron registros con los filtros actuales." /></div>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SolicitudesManager;
