
import React, { useState, useMemo, useEffect } from 'react';
import type { LanzamientoPPS } from '../../types';
import {
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_FECHA_FIN_LANZAMIENTOS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_ESTADO_GESTION_LANZAMIENTOS,
    FIELD_NOTAS_GESTION_LANZAMIENTOS,
    FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
    FIELD_FECHA_INICIO_LANZAMIENTOS
} from '../../constants';
import { getEspecialidadClasses, parseToUTCDate, normalizeStringForComparison } from '../../utils/formatters';

// Opciones Simplificadas
const GESTION_STATUS_OPTIONS = [
    'Pendiente de Gestión',
    'Relanzamiento Confirmado',
    'Esperando Respuesta',
    'No se Relanza',
    'Archivado'
];

interface GestionCardProps {
    pps: LanzamientoPPS;
    onSave: (id: string, updates: Partial<LanzamientoPPS>) => Promise<boolean>;
    isUpdating: boolean;
    cardType: string;
    institution?: { id: string; phone?: string };
    onSavePhone: (institutionId: string, phone: string) => Promise<boolean>;
    daysLeft?: number;
    urgency?: 'high' | 'normal';
}

const GestionCard: React.FC<GestionCardProps> = React.memo(({ pps, onSave, isUpdating, institution, onSavePhone, daysLeft, urgency }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [status, setStatus] = useState(pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] || 'Pendiente de Gestión');
    const [notes, setNotes] = useState(pps[FIELD_NOTAS_GESTION_LANZAMIENTOS] || '');

    // ... (keep existing state logic)

    // Initialize date
    const [relaunchDate, setRelaunchDate] = useState(() => {
        const rDate = pps[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS];
        if (rDate) return rDate;
        const sDate = pps[FIELD_FECHA_INICIO_LANZAMIENTOS];
        if (sDate) {
            const d = parseToUTCDate(sDate);
            if (d && d.getUTCFullYear() >= 2026) return sDate;
        }
        return '';
    });

    const [isJustSaved, setIsJustSaved] = useState(false);
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [newPhone, setNewPhone] = useState('');

    const especialidadVisuals = getEspecialidadClasses(pps[FIELD_ORIENTACION_LANZAMIENTOS]);

    // Detectar cambios
    const hasChanges = useMemo(() => {
        const originalStatus = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] || 'Pendiente de Gestión';
        const originalNotes = pps[FIELD_NOTAS_GESTION_LANZAMIENTOS] || '';
        const originalDate = pps[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS] || '';

        const dateChanged = status === 'Relanzamiento Confirmado' ? relaunchDate !== originalDate : false;

        return status !== originalStatus || notes !== originalNotes || dateChanged;
    }, [status, notes, relaunchDate, pps]);

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasChanges) return;

        const updates: Partial<LanzamientoPPS> = {
            [FIELD_ESTADO_GESTION_LANZAMIENTOS]: status,
            [FIELD_NOTAS_GESTION_LANZAMIENTOS]: notes,
        };

        if (status === 'Relanzamiento Confirmado') {
            updates[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS] = relaunchDate;
        }

        setIsJustSaved(true);
        const success = await onSave(pps.id, updates);
        if (success) {
            setTimeout(() => setIsJustSaved(false), 2000);
            setIsExpanded(false);
        } else {
            setIsJustSaved(false);
        }
    };

    const handleWhatsAppClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!institution?.phone) return;
        const phoneStr = institution.phone || '';
        const cleanPhone = phoneStr.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank', 'noopener,noreferrer');
    };

    const handleSavePhone = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!institution || !newPhone.trim()) return;
        const success = await onSavePhone(institution.id, newPhone.trim());
        if (success) {
            setIsEditingPhone(false);
            setNewPhone('');
        }
    };

    // Status Color Logic
    const statusColor = useMemo(() => {
        if (status === 'Relanzamiento Confirmado') return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
        if (status === 'No se Relanza') return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
        if (status === 'Esperando Respuesta') return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }, [status]);

    // Urgency Badge
    const UrgencyBadge = () => {
        if (daysLeft === undefined) return null;

        // Context: Active (daysLeft > 0)
        if (daysLeft > 0 && daysLeft <= 7) {
            return (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 flex items-center gap-1 animate-pulse">
                    <span className="material-icons !text-[10px]">timer</span> Finaliza en {daysLeft} días
                </span>
            );
        }

        if (daysLeft > 7 && daysLeft <= 30) {
            return (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <span className="material-icons !text-[10px]">schedule</span> Vence en {daysLeft} días
                </span>
            );
        }

        // Context: Finished (daysLeft <= 0)
        // Note: For finished items, daysLeft comes as negative from the hook logic for the "Finalizadas" section,
        // BUT verify how it is passed. In ConvocatoriaManager I passed `-(pps.daysSinceEnd)`.
        // So daysLeft for finished items is indeed negative.
        if (daysLeft <= 0) {
            return (
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <span className="material-icons !text-[10px]">history</span> Finalizó hace {Math.abs(daysLeft)} días
                </span>
            );
        }

        return null;
    };

    const displayRelaunchDate = () => {
        if (!relaunchDate) return null;
        const d = parseToUTCDate(relaunchDate);
        if (d) return d.getFullYear();
        return relaunchDate.length > 15 ? relaunchDate.substring(0, 12) + '...' : relaunchDate;
    };

    const isEffectivelyConfirmed = status === 'Relanzamiento Confirmado' || (relaunchDate && new Date(relaunchDate).getFullYear() >= 2026);

    // Dynamic Border Class based on Orientation
    const cardBorderClass = isExpanded
        ? 'shadow-xl ring-1 ring-blue-500/20 border-blue-300 dark:border-blue-700'
        : urgency === 'high'
            ? 'shadow-sm hover:shadow-md border-l-4 border-l-rose-500 border-t border-r border-b border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-900/10'
            : `shadow-sm hover:shadow-md border-l-4 ${especialidadVisuals.leftBorder} border-t border-r border-b border-slate-200 dark:border-slate-700`;

    return (
        <div
            className={`relative bg-white dark:bg-gray-900 rounded-xl transition-all duration-300 overflow-hidden ${cardBorderClass}`}
            onClick={() => !isEditingPhone && setIsExpanded(!isExpanded)}
        >
            {/* Header Content */}
            <div className="p-4 pl-5 cursor-pointer">
                <div className="flex justify-between items-start gap-3">
                    <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`${especialidadVisuals.tag} text-[10px] py-0.5 px-2 font-bold`}>{pps[FIELD_ORIENTACION_LANZAMIENTOS]}</span>
                            {isEffectivelyConfirmed && relaunchDate && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">
                                    <span className="material-icons !text-[10px]">event</span>
                                    {displayRelaunchDate()}
                                </span>
                            )}
                            <UrgencyBadge />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 leading-tight truncate pr-4" title={pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]}>
                            {pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                        </h4>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                        {institution?.phone ? (
                            <button
                                onClick={handleWhatsAppClick}
                                className="p-2 rounded-full bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition-colors"
                                title="WhatsApp"
                            >
                                <span className="material-icons !text-lg">chat</span>
                            </button>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsEditingPhone(true); }}
                                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Agregar Teléfono"
                            >
                                <span className="material-icons !text-lg">add_call</span>
                            </button>
                        )}
                        <div className={`transform transition-transform duration-300 text-slate-400 ${isExpanded ? 'rotate-180' : ''}`}>
                            <span className="material-icons">expand_more</span>
                        </div>
                    </div>
                </div>

                {isEditingPhone && (
                    <div className="absolute top-3 right-12 z-20 flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <input
                            type="tel"
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            className="w-28 text-xs p-1.5 border-none bg-transparent focus:ring-0 outline-none text-slate-800 dark:text-white"
                            placeholder="Número..."
                            autoFocus
                        />
                        <button onClick={handleSavePhone} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><span className="material-icons !text-sm">check</span></button>
                        <button onClick={(e) => { e.stopPropagation(); setIsEditingPhone(false); }} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><span className="material-icons !text-sm">close</span></button>
                    </div>
                )}
            </div>

            {/* Expanded Body */}
            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-slate-800' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden bg-slate-50/50 dark:bg-slate-800/20 cursor-default" onClick={e => e.stopPropagation()}>
                    <div className="p-4 space-y-4">

                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Estado</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className={`w-full text-sm font-semibold rounded-lg py-2.5 px-3 border outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors appearance-none ${statusColor}`}
                                >
                                    {GESTION_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {/* Smart Action Button for 2026 Relaunch */}
                            {(status !== 'Relanzamiento Confirmado' && status !== 'No se Relanza') && (
                                <div className="mt-6">
                                    <button
                                        onClick={() => {
                                            setStatus('Relanzamiento Confirmado');
                                        }}
                                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline decoration-dotted underline-offset-4"
                                    >
                                        Confirmar 2026
                                    </button>
                                </div>
                            )}
                        </div>

                        {isEffectivelyConfirmed && (
                            <div className="animate-fade-in bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                                <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <span className="material-icons !text-sm">event</span>
                                    Fecha Estimada Incio 2026
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: 15/03/2026..."
                                    value={relaunchDate}
                                    onChange={(e) => setRelaunchDate(e.target.value)}
                                    className="w-full text-sm font-medium rounded-lg py-2 px-3 border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/50 outline-none text-slate-800 dark:text-slate-100"
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                                <span className="material-icons !text-xs">edit_note</span>
                                Bitácora de Gestión
                            </label>
                            <div className="relative">
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 pl-4 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                                    placeholder="Escribe aquí los avances..."
                                />
                                <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-400 rounded-r opacity-50"></div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handleSave}
                                disabled={isUpdating || !hasChanges || isJustSaved}
                                className={`flex items-center gap-2 py-2 px-6 rounded-lg text-sm font-bold shadow-sm transition-all transform active:scale-95
                                ${isJustSaved
                                        ? 'bg-emerald-500 text-white cursor-default'
                                        : hasChanges
                                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    }
                            `}
                            >
                                {isUpdating ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <span className="material-icons !text-base">{isJustSaved ? 'check' : 'save'}</span>}
                                <span>{isJustSaved ? 'Guardado' : 'Guardar Cambios'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default GestionCard;
