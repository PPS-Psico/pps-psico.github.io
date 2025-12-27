
import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadFinalizationFile, submitFinalizationRequest } from '../services/dataService';
import Card from './Card';
import Button from './Button';
import Toast from './Toast';
import EmptyState from './EmptyState';
import { supabase } from '../lib/supabaseClient'; // Solo para downloadTemplate que es lectura publica

interface FinalizacionFormProps {
    studentAirtableId: string | null;
    onClose?: () => void;
}

type FileUploadType = 'informe' | 'horas' | 'asistencia';

interface FileCategoryState {
    files: File[];
    uploading: boolean;
    uploadedData: { url: string; filename: string }[];
}

const FinalizacionForm: React.FC<FinalizacionFormProps> = ({ studentAirtableId, onClose }) => {
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const [dragActive, setDragActive] = useState<string | null>(null);
    const queryClient = useQueryClient();
    
    const [fileCategories, setFileCategories] = useState<Record<FileUploadType, FileCategoryState>>({
        horas: { files: [], uploading: false, uploadedData: [] },
        asistencia: { files: [], uploading: false, uploadedData: [] },
        informe: { files: [], uploading: false, uploadedData: [] },
    });
    
    const [sugerencias, setSugerencias] = useState('');

    const fileInputRefs = {
        horas: useRef<HTMLInputElement>(null),
        asistencia: useRef<HTMLInputElement>(null),
        informe: useRef<HTMLInputElement>(null),
    };

    const handleFilesAdded = (newFiles: FileList | null, type: FileUploadType) => {
        if (!newFiles || newFiles.length === 0) return;

        const validFiles: File[] = [];
        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            if (file.size > 10 * 1024 * 1024) { 
                setToastInfo({ message: `El archivo ${file.name} es demasiado grande (máx 10MB).`, type: 'error' });
                continue;
            }
            validFiles.push(file);
        }

        setFileCategories(prev => {
            const isSingleFile = type === 'horas';
            const currentFiles = isSingleFile ? [] : [...prev[type].files];
            return {
                ...prev,
                [type]: {
                    ...prev[type],
                    files: [...currentFiles, ...validFiles]
                }
            }
        });
    };

    const handleFileRemove = (type: FileUploadType, index: number) => {
        setFileCategories(prev => {
            const newFiles = [...prev[type].files];
            newFiles.splice(index, 1);
            return {
                ...prev,
                [type]: { ...prev[type], files: newFiles }
            };
        });
    };

    const handleDrag = (e: React.DragEvent, type: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(type);
        } else if (e.type === 'dragleave') {
            setDragActive(null);
        }
    };

    const handleDrop = (e: React.DragEvent, type: FileUploadType) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(null);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesAdded(e.dataTransfer.files, type);
        }
    };

    const submitMutation = useMutation({
        mutationFn: async () => {
            if (!studentAirtableId) throw new Error("ID de estudiante no disponible.");
            
            const categories = Object.keys(fileCategories) as FileUploadType[];
            
            if (fileCategories.horas.files.length === 0) throw new Error("Falta la Planilla de Seguimiento.");
            if (fileCategories.asistencia.files.length === 0) throw new Error("Falta la Planilla de Asistencia.");
            if (fileCategories.informe.files.length === 0) throw new Error("Falta el Informe Final.");

            // 1. Upload Process using Service
            const uploadedResults: Partial<Record<FileUploadType, { url: string, filename: string }[]>> = {};

            for (const type of categories) {
                const categoryState = fileCategories[type];
                if (categoryState.files.length === 0) continue;

                setFileCategories(prev => ({ ...prev, [type]: { ...prev[type], uploading: true } }));
                
                const typeUploads = [];
                try {
                    for (const file of categoryState.files) {
                        const url = await uploadFinalizationFile(file, studentAirtableId, type);
                        typeUploads.push({ url, filename: file.name });
                    }
                    uploadedResults[type] = typeUploads;
                    
                    setFileCategories(prev => ({ 
                        ...prev, 
                        [type]: { ...prev[type], uploading: false, uploadedData: typeUploads } 
                    }));
                } catch (e) {
                    setFileCategories(prev => ({ ...prev, [type]: { ...prev[type], uploading: false } }));
                    throw e;
                }
            }
            
            // 2. Create DB Record & Archive via Service
            await submitFinalizationRequest(studentAirtableId, {
                informes: uploadedResults.informe || [],
                horas: uploadedResults.horas || [],
                asistencias: uploadedResults.asistencia || [],
                sugerencias
            });

            return true;
        },
        onSuccess: () => {
            setIsSubmitted(true);
            queryClient.invalidateQueries({ queryKey: ['finalizacionRequest'] });
            queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
            setToastInfo({ message: 'Solicitud enviada con éxito. Se procesará tu acreditación.', type: 'success' });
        },
        onError: (error: any) => {
            console.error("Submission Error:", error);
            const errorMsg = error.message || "Error desconocido";
            setToastInfo({ message: `Error al enviar: ${errorMsg}. Revisa tu conexión e intenta nuevamente.`, type: 'error' });
        }
    });

    const handleDownloadTemplate = async (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDownloadingTemplate(true);
        try {
            const { data, error } = await supabase.storage
                .from('plantillas')
                .download('Planilla_Seguimiento.xlsx');

            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'Planilla_Seguimiento_PPS.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            setToastInfo({ message: 'Plantilla descargada.', type: 'success' });
        } catch (error: any) {
            console.error("Error descargando plantilla", error);
            setToastInfo({ message: 'No se pudo descargar la plantilla.', type: 'error' });
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    if (isSubmitted) {
        return (
            <Card 
                title="Solicitud Recibida" 
                icon="check_circle" 
                className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-none border"
            >
                <div className="dark:text-slate-200">
                    <EmptyState
                        icon="mark_email_read"
                        title="¡Documentación Enviada!"
                        message="Hemos recibido tus archivos correctamente. Tu solicitud está en proceso y el contador de acreditación está activo."
                    />
                </div>
                <div className="mt-6 text-center">
                    <Button variant="secondary" onClick={() => onClose ? onClose() : window.location.reload()}>Volver al Inicio</Button>
                </div>
            </Card>
        );
    }

    const uploadSections = [
        { 
            key: 'horas' as FileUploadType, 
            label: 'Planilla de Seguimiento', 
            desc: 'Excel de seguimiento de horas completo.', 
            icon: 'schedule',
            iconColor: 'text-blue-500',
            bgColor: 'bg-blue-100 dark:bg-blue-900/30',
            hasTemplate: true,
            allowsMultiple: false 
        },
        { 
            key: 'asistencia' as FileUploadType, 
            label: 'Planillas de Asistencia', 
            desc: 'Registros diarios de todas tus PPS presenciales. Puedes subir fotos o PDFs.', 
            icon: 'event_available',
            iconColor: 'text-purple-500',
            bgColor: 'bg-purple-100 dark:bg-purple-900/30',
            allowsMultiple: true
        },
        { 
            key: 'informe' as FileUploadType, 
            label: 'Informes Finales', 
            desc: 'Informes de todas las prácticas. Puedes subir múltiples archivos.', 
            icon: 'description',
            iconColor: 'text-emerald-500',
            bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
            allowsMultiple: true
        },
    ];

    return (
        <div className="animate-fade-in-up h-full flex flex-col bg-white dark:bg-slate-900">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            
            {/* Header Estilizado */}
            <div className="p-5 border-b border-indigo-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-slate-900/50 flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm border border-indigo-100 dark:border-slate-700">
                        <span className="material-icons !text-2xl">verified</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Solicitud de Finalización</h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Adjunta la documentación para cerrar el ciclo.</p>
                    </div>
                </div>
                <button 
                    onClick={onClose} 
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                    <span className="material-icons !text-xl">close</span>
                </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {uploadSections.map((section) => {
                    const categoryState = fileCategories[section.key];
                    const isActive = dragActive === section.key;
                    const hasFiles = categoryState.files.length > 0;

                    return (
                        <div key={section.key} className={`
                            relative rounded-2xl border-2 transition-all duration-300 overflow-hidden
                            ${isActive 
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-lg scale-[1.01]' 
                                : hasFiles 
                                    ? 'border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-slate-800' 
                                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-blue-200 dark:hover:border-slate-600'
                            }
                        `}>
                             <div className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${section.bgColor} ${section.iconColor}`}>
                                            <span className="material-icons !text-xl">{section.icon}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{section.label}</h4>
                                            {section.hasTemplate && (
                                                <button 
                                                    onClick={handleDownloadTemplate}
                                                    disabled={isDownloadingTemplate}
                                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5"
                                                >
                                                    {isDownloadingTemplate ? 'Descargando...' : 'Descargar plantilla'}
                                                    <span className="material-icons !text-[10px]">download</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {hasFiles && (
                                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <span className="material-icons !text-[12px]">check</span>
                                            Listo
                                        </span>
                                    )}
                                </div>
                                
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 pl-1">{section.desc}</p>

                                {/* Drop Zone Area */}
                                <div 
                                    className={`
                                        rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors
                                        ${isActive 
                                            ? 'border-blue-400 bg-white/50 dark:bg-black/20' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                                        }
                                    `}
                                    onDragEnter={(e) => handleDrag(e, section.key)}
                                    onDragLeave={(e) => handleDrag(e, section.key)}
                                    onDragOver={(e) => handleDrag(e, section.key)}
                                    onDrop={(e) => handleDrop(e, section.key)}
                                    onClick={() => fileInputRefs[section.key].current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRefs[section.key]}
                                        onChange={(e) => handleFilesAdded(e.target.files, section.key)}
                                        className="hidden"
                                        multiple={section.allowsMultiple}
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                                    />
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={`material-icons !text-2xl ${isActive ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'}`}>cloud_upload</span>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                            {isActive ? 'Suelta aquí' : (hasFiles ? 'Agregar más archivos' : 'Haz clic para subir')}
                                        </span>
                                    </div>
                                </div>

                                {/* File List */}
                                {hasFiles && (
                                    <div className="mt-3 space-y-2">
                                        {categoryState.files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="material-icons text-slate-400 !text-base shrink-0">description</span>
                                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{file.name}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleFileRemove(section.key, idx)}
                                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                                                >
                                                    <span className="material-icons !text-base">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-icons text-amber-500 !text-lg">tips_and_updates</span>
                        <h3 className="text-amber-900 dark:text-amber-100 font-bold text-sm">
                            Espacio de sugerencias (Opcional)
                        </h3>
                    </div>
                    <textarea
                        value={sugerencias}
                        onChange={(e) => setSugerencias(e.target.value)}
                        rows={2}
                        className="w-full text-xs rounded-xl border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-amber-400 text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                        placeholder="¿Algo para mejorar en el proceso?"
                    />
                </div>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-end items-center gap-3">
                {submitMutation.isPending && (
                    <span className="text-xs font-bold text-slate-500 animate-pulse flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div> Subiendo archivos...
                    </span>
                )}
                <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                         onClick={() => onClose ? onClose() : window.location.reload()}
                         className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                         disabled={submitMutation.isPending}
                    >
                        Cancelar
                    </button>
                    <Button
                        onClick={() => submitMutation.mutate()}
                        isLoading={submitMutation.isPending}
                        disabled={fileCategories.horas.files.length === 0 || fileCategories.asistencia.files.length === 0 || fileCategories.informe.files.length === 0}
                        icon="send"
                        className="flex-1 sm:flex-none shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        Finalizar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FinalizacionForm;
