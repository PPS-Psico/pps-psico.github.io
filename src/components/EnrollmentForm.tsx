
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { z } from 'zod';
import { Estudiante } from '../types';
import { FIELD_TRABAJA_ESTUDIANTES, FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES } from '../constants';
import { supabase } from '../lib/supabaseClient';

// --- COMPONENTES UI INTERNOS ESTILIZADOS ---

const SelectionCard: React.FC<{
    selected: boolean;
    onClick: () => void;
    title: string;
    subtitle?: string;
    icon?: string;
}> = ({ selected, onClick, title, subtitle, icon }) => (
    <div
        onClick={onClick}
        className={`
      relative cursor-pointer rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 transition-all duration-200 flex items-center gap-3 sm:gap-4 group select-none
      ${selected
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-600/20 dark:border-blue-400 ring-1 ring-blue-500/20 shadow-md transform scale-[1.01]'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5'
            }
    `}
    >
        <div className={`
        flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-200
        ${selected
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-300'
            }
    `}>
            <span className="material-icons text-xl sm:!text-2xl">{icon || (selected ? 'check' : 'radio_button_unchecked')}</span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h4 className={`text-sm font-bold leading-tight ${selected ? 'text-blue-900 dark:text-blue-100' : 'text-slate-800 dark:text-slate-100'}`}>{title}</h4>
            {/* Subtítulo oculto en mobile, visible en sm+ */}
            {subtitle && <p className={`hidden sm:block text-xs truncate font-medium mt-0.5 ${selected ? 'text-blue-700/80 dark:text-blue-200/70' : 'text-slate-500 dark:text-slate-500'}`}>{subtitle}</p>}
        </div>

        {selected && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 text-blue-600 dark:text-blue-400 animate-scale-in">
                <span className="material-icons !text-base sm:!text-lg">check_circle</span>
            </div>
        )}
    </div>
);

const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}> = ({ checked, onChange, label }) => (
    <div
        onClick={() => onChange(!checked)}
        className={`flex items-center justify-between cursor-pointer group p-4 rounded-2xl border transition-all duration-200 ${checked ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-500/50' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-300 dark:hover:border-blue-600'}`}
    >
        <span className={`text-sm font-bold transition-colors ${checked ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-200'}`}>{label}</span>
        <div className={`relative w-12 h-7 rounded-full transition-colors duration-300 ease-in-out border-2 ${checked ? 'bg-blue-600 border-blue-600' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
            <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </div>
    </div>
);

const FileUploadButton: React.FC<{
    onClick: () => void;
    fileName?: string | null;
    label: string;
    hasError?: boolean;
}> = ({ onClick, fileName, label, hasError }) => (
    <div
        onClick={onClick}
        className={`
            group relative cursor-pointer border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition-all duration-200
            ${hasError
                ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/10 dark:border-rose-800'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-400 dark:hover:border-blue-500'
            }
        `}
    >
        <div className={`w-10 h-10 rounded-full shadow-sm flex items-center justify-center mb-2 transition-transform duration-200 group-hover:-translate-y-1 ${hasError ? 'bg-rose-100 text-rose-500' : 'bg-white dark:bg-slate-800 text-blue-500 dark:text-blue-400'}`}>
            <span className="material-icons !text-xl">{hasError ? 'priority_high' : (fileName ? 'description' : 'cloud_upload')}</span>
        </div>
        <span className={`text-xs font-bold text-center ${hasError ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300'}`}>
            {fileName ? "Archivo seleccionado" : label}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 text-center max-w-[180px] truncate">
            {fileName || "PDF o Imagen (Máx 5MB)"}
        </span>
    </div>
);

interface EnrollmentFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (formData: any) => void;
    convocatoriaName: string;
    isSubmitting: boolean;
    horariosDisponibles?: string[];
    permiteCertificado?: boolean;
    studentProfile: Estudiante | null;
    reqCertificadoTrabajo?: boolean;
    reqCv?: boolean;
}

type FormData = {
    terminoDeCursar: boolean | null;
    cursandoElectivas: boolean | null;
    finalesAdeudados: string;
    otraSituacionAcademica: string;
    horarios: string[];
    certificadoLink?: string;
    trabaja: boolean;
    certificadoTrabajoFile?: File | null;
    existingCertificadoTrabajo?: string | null;
    cvFile?: File | null;
};

const initialFormData: FormData = {
    terminoDeCursar: null,
    cursandoElectivas: null,
    finalesAdeudados: '',
    otraSituacionAcademica: '',
    horarios: [],
    certificadoLink: '',
    trabaja: false,
    certificadoTrabajoFile: null,
    existingCertificadoTrabajo: null,
    cvFile: null,
};

export const EnrollmentForm: React.FC<EnrollmentFormProps> = ({
    isOpen,
    onClose,
    onSubmit,
    convocatoriaName,
    isSubmitting,
    horariosDisponibles = [],
    permiteCertificado = false,
    studentProfile,
    reqCertificadoTrabajo = true,
    reqCv = false,
}) => {
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'submit', string>>>({});
    const [fileUploadProgress, setFileUploadProgress] = useState(0);

    const formRef = useRef<HTMLFormElement>(null);
    const certFileInputRef = useRef<HTMLInputElement>(null);
    const cvFileInputRef = useRef<HTMLInputElement>(null);

    const isSingleSchedule = horariosDisponibles.length === 1;
    const showHorariosSelection = horariosDisponibles.length > 1;

    useEffect(() => {
        if (isOpen) {
            const initialHorarios = isSingleSchedule ? [horariosDisponibles[0]] : [];
            const works = studentProfile?.[FIELD_TRABAJA_ESTUDIANTES] || false;
            const cert = studentProfile?.[FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES] || null;

            setFormData({
                ...initialFormData,
                horarios: initialHorarios,
                trabaja: works,
                existingCertificadoTrabajo: cert
            });
            setErrors({});
            setFileUploadProgress(0);
        }
    }, [isOpen, horariosDisponibles, isSingleSchedule, studentProfile]);

    const finalSchema = useMemo(() => {
        return z.object({
            terminoDeCursar: z.boolean().nullable(),
            cursandoElectivas: z.boolean().nullable(),
            finalesAdeudados: z.string(),
            otraSituacionAcademica: z.string(),
            horarios: z.array(z.string()),
            certificadoLink: z.string().optional(),
            trabaja: z.boolean(),
            certificadoTrabajoFile: z.any().optional(),
            existingCertificadoTrabajo: z.string().nullable().optional(),
            cvFile: z.any().optional(),
        }).superRefine((data, ctx) => {
            if (data.terminoDeCursar === null) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['terminoDeCursar'], message: 'Selecciona tu situación académica.' });
            } else if (data.terminoDeCursar === true) {
                if (data.finalesAdeudados === '') {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['finalesAdeudados'], message: 'Indica los finales adeudados.' });
                }
            } else if (data.terminoDeCursar === false) {
                if (data.cursandoElectivas === null) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cursandoElectivas'], message: 'Indica si cursas electivas.' });
                }
            }

            if (showHorariosSelection && data.horarios.length === 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['horarios'], message: 'Selecciona al menos un horario.' });
            }

            if (data.trabaja && reqCertificadoTrabajo) {
                if (!data.certificadoTrabajoFile && !data.existingCertificadoTrabajo) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['trabaja'], message: 'Es obligatorio adjuntar el certificado laboral.' });
                }
            }

            if (reqCv && !data.cvFile) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cvFile'], message: 'El CV es obligatorio.' });
            }
        });
    }, [showHorariosSelection, reqCertificadoTrabajo, reqCv]);

    const handleHorarioToggle = (horario: string) => {
        setFormData(prev => {
            const exists = prev.horarios.includes(horario);
            return {
                ...prev,
                horarios: exists ? prev.horarios.filter(h => h !== horario) : [...prev.horarios, horario]
            };
        });
    };

    const handleWorkStatusChange = (checked: boolean) => {
        // Si el usuario intenta destildar "trabaja" y ya tiene un certificado guardado
        if (!checked && formData.existingCertificadoTrabajo) {
            const confirmDelete = window.confirm("⚠️ ¿Estás seguro de indicar que NO trabajas?\n\nAl hacerlo, se eliminará el certificado laboral que tenías guardado. Esta acción no se puede deshacer.");

            if (confirmDelete) {
                setFormData(prev => ({
                    ...prev,
                    trabaja: false,
                    existingCertificadoTrabajo: null,
                    certificadoTrabajoFile: null
                }));
            }
        } else {
            // Comportamiento normal
            setFormData(prev => ({ ...prev, trabaja: checked }));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'certificadoTrabajoFile' | 'cvFile') => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                setErrors(prev => ({ ...prev, submit: "El archivo supera los 5MB permitidos." }));
                return;
            }
            setFormData(prev => ({ ...prev, [fieldName]: file }));

            if (fieldName === 'certificadoTrabajoFile') setErrors(prev => ({ ...prev, trabaja: undefined }));
            if (fieldName === 'cvFile') setErrors(prev => ({ ...prev, cvFile: undefined }));
        }
    };

    // Helper to upload files to Supabase
    const uploadFile = async (file: File, folder: string): Promise<string> => {
        if (!studentProfile?.id) throw new Error("No ID");
        const fileExt = file.name.split('.').pop();
        const fileName = `${studentProfile.id}/${folder}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('documentos_estudiantes').upload(fileName, file, { upsert: true });
        if (uploadError) throw new Error(uploadError.message);
        const { data } = supabase.storage.from('documentos_estudiantes').getPublicUrl(fileName);
        return data.publicUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        const result = finalSchema.safeParse(formData);

        if (!result.success) {
            const fieldErrors = result.error.flatten().fieldErrors;
            const newErrors: Partial<Record<keyof FormData, string>> = {};
            for (const key in fieldErrors) {
                newErrors[key as keyof FormData] = (fieldErrors as any)[key]?.[0];
            }
            setErrors(newErrors);

            const firstError = document.querySelector('[data-error="true"]');
            firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        try {
            let certificadoUrl = formData.trabaja ? formData.existingCertificadoTrabajo : null;
            let cvUrl = null;

            if ((formData.trabaja && formData.certificadoTrabajoFile) || formData.cvFile) {
                setFileUploadProgress(10);
                const interval = setInterval(() => setFileUploadProgress(p => Math.min(p + 20, 90)), 300);

                if (formData.trabaja && formData.certificadoTrabajoFile) {
                    certificadoUrl = await uploadFile(formData.certificadoTrabajoFile, 'certificado_trabajo');
                }
                if (formData.cvFile) {
                    cvUrl = await uploadFile(formData.cvFile, 'cv');
                }

                clearInterval(interval);
                setFileUploadProgress(100);
            }

            await onSubmit({ ...result.data, certificadoTrabajoUrl: certificadoUrl, cvUrl: cvUrl });
        } catch (error: any) {
            setErrors({ submit: error.message || 'Error al enviar.' });
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            {/* UNIFIED CONTAINER: Floating Window on Mobile (95vw) & Desktop (max-w-2xl) */}
            <div
                className="relative w-[95vw] max-h-[90dvh] sm:w-full sm:max-w-2xl sm:max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-transform duration-300 animate-scale-in"
                onClick={e => e.stopPropagation()}
            >

                {/* Header Sticky */}
                <div className="flex-shrink-0 px-4 py-4 sm:px-6 sm:py-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 z-10 flex items-center justify-between safe-area-top">
                    <div className="min-w-0 pr-4">
                        <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5">Inscripción</p>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">
                            {convocatoriaName}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors"
                    >
                        <span className="material-icons !text-xl">close</span>
                    </button>
                </div>

                {/* Banner Horario Único (Si aplica) */}
                {isSingleSchedule && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 px-6 py-3 border-b border-blue-100/50 dark:border-blue-800/30 flex items-center gap-3">
                        <span className="material-icons text-blue-500 dark:text-blue-400 !text-lg">schedule</span>
                        <div>
                            <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Horario de la Práctica</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">{horariosDisponibles[0]}</p>
                        </div>
                    </div>
                )}

                {/* Body Scrollable */}
                <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 custom-scrollbar pb-safe">

                    {errors.submit && (
                        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-start gap-2">
                            <span className="material-icons !text-lg mt-0.5">error</span>
                            <span>{errors.submit}</span>
                        </div>
                    )}

                    {/* Disclaimer Responsivo */}
                    <div className="flex gap-4 p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                        <span className="material-icons text-amber-500 !text-2xl shrink-0 mt-0.5">warning_amber</span>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Compromiso y Responsabilidad</h4>
                            {/* Texto Mobile Resumido */}
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-medium block sm:hidden">
                                Al inscribirte asumes un compromiso. La falta de responsabilidad afectará futuras convocatorias.
                            </p>
                            {/* Texto Desktop Completo */}
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-medium hidden sm:block">
                                Al inscribirte, asumes un compromiso con la institución y la facultad. Darse de baja sobre la fecha, ausentarse sin aviso o cualquier otra decisión que demuestre falta de responsabilidad, será tenido en cuenta en futuras convocatorias.
                            </p>
                        </div>
                    </div>

                    {/* Situación Laboral */}
                    {reqCertificadoTrabajo && (
                        <section>
                            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <span className="material-icons !text-sm">work</span> Situación Laboral
                            </h3>

                            <div className="space-y-4">
                                <ToggleSwitch
                                    label="¿Trabajas actualmente?"
                                    checked={formData.trabaja}
                                    onChange={handleWorkStatusChange}
                                />

                                {/* ANIMACIÓN GRID-ROWS PARA REVELADO SUAVE */}
                                <div
                                    className={`grid transition-[grid-template-rows,opacity,padding] duration-300 ease-out ${formData.trabaja
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                        }`}
                                >
                                    <div className="overflow-hidden min-h-0">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-3 block uppercase tracking-wide">
                                                Certificado Laboral (Obligatorio)
                                            </label>

                                            {formData.existingCertificadoTrabajo && !formData.certificadoTrabajoFile && (
                                                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50 mb-3">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                                        <span className="material-icons !text-lg">check_circle</span>
                                                        <span>Certificado Vigente</span>
                                                    </div>
                                                    <a href={formData.existingCertificadoTrabajo} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Ver archivo</a>
                                                </div>
                                            )}

                                            <input type="file" ref={certFileInputRef} className="hidden" accept=".pdf,.jpg,.png,.jpeg" onChange={(e) => handleFileChange(e, 'certificadoTrabajoFile')} />

                                            <FileUploadButton
                                                onClick={() => certFileInputRef.current?.click()}
                                                label={formData.certificadoTrabajoFile ? "Cambiar Archivo" : (formData.existingCertificadoTrabajo ? "Actualizar Certificado" : "Subir Certificado")}
                                                fileName={formData.certificadoTrabajoFile?.name}
                                                hasError={!!errors.trabaja}
                                            />
                                            {errors.trabaja && <p className="text-xs text-rose-500 font-semibold mt-2 flex items-center gap-1"><span className="material-icons !text-xs">error</span> {errors.trabaja}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Selección Horarios */}
                    {showHorariosSelection && (
                        <section data-error={!!errors.horarios}>
                            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <span className="material-icons !text-sm">schedule</span> Disponibilidad Horaria
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {horariosDisponibles.map((horario) => (
                                    <div
                                        key={horario}
                                        onClick={() => handleHorarioToggle(horario)}
                                        className={`
                                        cursor-pointer px-5 py-4 rounded-2xl border transition-all flex items-center justify-between group select-none
                                        ${formData.horarios.includes(horario)
                                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-600/20 dark:border-blue-500 shadow-md ring-1 ring-blue-500/20'
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm'
                                            }
                                    `}
                                    >
                                        <span className={`text-sm font-bold ${formData.horarios.includes(horario) ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {horario}
                                        </span>
                                        {formData.horarios.includes(horario) && (
                                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center animate-scale-in">
                                                <span className="material-icons !text-sm">check</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {errors.horarios && <p className="text-xs text-rose-500 font-semibold mt-2 ml-1">{errors.horarios}</p>}
                        </section>
                    )}

                    {/* Situación Académica */}
                    <section>
                        <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="material-icons !text-sm">school</span> Estado Académico
                        </h3>

                        <div className="space-y-6">
                            <div data-error={!!errors.terminoDeCursar}>
                                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">¿Terminaste de cursar?</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <SelectionCard
                                        title="Sí"
                                        subtitle="Solo debo finales o TIF"
                                        icon="school"
                                        selected={formData.terminoDeCursar === true}
                                        onClick={() => setFormData(p => ({ ...p, terminoDeCursar: true, cursandoElectivas: null }))}
                                    />
                                    <SelectionCard
                                        title="No"
                                        subtitle="Aún curso materias"
                                        icon="menu_book"
                                        selected={formData.terminoDeCursar === false}
                                        onClick={() => setFormData(p => ({ ...p, terminoDeCursar: false, finalesAdeudados: '' }))}
                                    />
                                </div>
                                {errors.terminoDeCursar && <p className="text-xs text-rose-500 font-semibold mt-2 ml-1">{errors.terminoDeCursar}</p>}
                            </div>

                            {formData.terminoDeCursar === true && (
                                <div className="animate-fade-in" data-error={!!errors.finalesAdeudados}>
                                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Finales Adeudados</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {["Solo TIF/PPS", "1 Final", "2 Finales", "3 Finales", "4 Finales", "5+"].map(opt => (
                                            <div
                                                key={opt}
                                                onClick={() => setFormData(p => ({ ...p, finalesAdeudados: opt }))}
                                                className={`
                                                cursor-pointer px-3 py-3 rounded-xl border text-xs font-bold text-center transition-all duration-200 select-none
                                                ${formData.finalesAdeudados === opt
                                                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:border-blue-400 dark:text-blue-100 ring-1 ring-blue-500/20 shadow-md'
                                                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md'
                                                    }
                                            `}
                                            >
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                    {errors.finalesAdeudados && <p className="text-xs text-rose-500 font-semibold mt-2 ml-1">{errors.finalesAdeudados}</p>}
                                </div>
                            )}

                            {formData.terminoDeCursar === false && (
                                <div className="animate-fade-in" data-error={!!errors.cursandoElectivas}>
                                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">¿Cursas Electivas?</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <SelectionCard
                                            title="Sí"
                                            selected={formData.cursandoElectivas === true}
                                            onClick={() => setFormData(p => ({ ...p, cursandoElectivas: true }))}
                                        />
                                        <SelectionCard
                                            title="No"
                                            selected={formData.cursandoElectivas === false}
                                            onClick={() => setFormData(p => ({ ...p, cursandoElectivas: false }))}
                                        />
                                    </div>
                                    {errors.cursandoElectivas && <p className="text-xs text-rose-500 font-semibold mt-2 ml-1">{errors.cursandoElectivas}</p>}
                                </div>
                            )}

                            <div data-error={!!errors.otraSituacionAcademica}>
                                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Comentarios (Opcional)</label>
                                <textarea
                                    value={formData.otraSituacionAcademica}
                                    onChange={(e) => setFormData(p => ({ ...p, otraSituacionAcademica: e.target.value }))}
                                    className="w-full p-4 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none resize-none transition-all placeholder:text-slate-400"
                                    placeholder="Ej: Estoy cursando el TIF..."
                                    rows={2}
                                />
                                {errors.otraSituacionAcademica && <p className="text-xs text-rose-500 font-semibold mt-2 ml-1">{errors.otraSituacionAcademica}</p>}
                            </div>
                        </div>
                    </section>

                    {reqCv && (
                        <section data-error={!!errors.cvFile}>
                            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <span className="material-icons !text-sm">description</span> Curriculum Vitae
                            </h3>

                            <input type="file" ref={cvFileInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, 'cvFile')} />
                            <FileUploadButton
                                onClick={() => cvFileInputRef.current?.click()}
                                label={formData.cvFile ? "CV Seleccionado" : "Adjuntar CV (PDF/Word)"}
                                fileName={formData.cvFile?.name}
                                hasError={!!errors.cvFile}
                            />
                            {errors.cvFile && <p className="text-xs text-rose-500 font-semibold mt-2 flex items-center gap-1"><span className="material-icons !text-xs">error</span> {errors.cvFile}</p>}
                        </section>
                    )}

                    <div className="h-10 sm:h-0"></div>
                </form>

                {/* Footer Sticky */}
                <div className="flex-shrink-0 p-4 sm:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 relative z-20 safe-area-bottom">
                    {fileUploadProgress > 0 && fileUploadProgress < 100 && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${fileUploadProgress}%` }}></div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full sm:flex-1 py-3.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={(e) => {
                            if (formRef.current) formRef.current.requestSubmit();
                        }}
                        disabled={isSubmitting}
                        className="w-full sm:flex-[2] py-3.5 rounded-xl font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:translate-y-0 text-sm"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin" />
                                <span>Procesando...</span>
                            </>
                        ) : (
                            <>
                                <span>Confirmar Inscripción</span>
                                <span className="material-icons !text-lg">arrow_forward</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
