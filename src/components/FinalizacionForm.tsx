
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
            desc: 'Excel de seguimiento de horas firmado por el tutor.', 
            icon: 'schedule',
            hasTemplate: true,
            allowsMultiple: false 
        },
        { 
            key: 'asistencia' as FileUploadType, 
            label: 'Planillas de Asistencia', 
            desc: 'Registros diarios de asistencia firmados. Puedes subir múltiples fotos o PDFs.', 
            icon: 'event_available',
            allowsMultiple: true
        },
        { 
            key: 'informe' as FileUploadType, 
            label: 'Informes Finales', 
            desc: 'Informes de la práctica. Puedes subir múltiples archivos si es necesario.', 
            icon: 'description',
            allowsMultiple: true
        },
    ];

    return (
        <div className="animate-fade-in-up h-full flex flex-col">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <span className="material-icons !text-2xl">verified</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Solicitud de Finalización</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Adjunta la documentación final para cerrar tu ciclo de prácticas.</p>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-8 bg-slate-50 dark:bg-slate-900/30">
                
                {uploadSections.map((section) => {
                    const categoryState = fileCategories[section.key];
                    const isActive = dragActive === section.key;

                    return (
                        <div key={section.key} className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <span className="material-icons text-blue-500 !text-lg">{section.icon}</span>
                                        {section.label}
                                    </h4>
                                    {(section.allowsMultiple || categoryState.files.length > 0) && (
                                        <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                            {categoryState.files.length} {categoryState.files.length === 1 ? 'archivo' : 'archivos'}
                                        </span>
                                    )}
                                </div>
                                {section.hasTemplate && (
                                    <button 
                                        onClick={handleDownloadTemplate}
                                        disabled={isDownloadingTemplate}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                                    >
                                        {isDownloadingTemplate ? <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <span className="material-icons !text-sm">download</span>}
                                        Descargar Plantilla
                                    </button>
                                )}
                            </div>
                            
                            <p className="text-sm text-slate-500 dark:text-slate-400">{section.desc}</p>

                            {section.allowsMultiple ? (
                                <div 
                                    className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 text-center cursor-pointer group
                                        ${isActive 
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                            : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-800 bg-slate-100/50 dark:bg-slate-800/50'
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
                                        multiple
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                                    />
                                    
                                    <div className="pointer-events-none">
                                        <span className={`material-icons !text-4xl mb-2 transition-colors ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-400'}`}>cloud_upload</span>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {isActive ? "Suelta los archivos aquí" : "Haz clic o arrastra tus archivos aquí"}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">Soporta PDF, Excel, Word, Imágenes (Máx 10MB)</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <input
                                        type="file"
                                        ref={fileInputRefs[section.key]}
                                        onChange={(e) => handleFilesAdded(e.target.files, section.key)}
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                                    />
                                    
                                    {categoryState.files.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRefs[section.key].current?.click()}
                                            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-sm"
                                        >
                                            <span className="material-icons text-blue-500 !text-xl">upload_file</span>
                                            <span>Seleccionar Archivo</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRefs[section.key].current?.click()}
                                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                                        >
                                            <span className="material-icons !text-sm">autorenew</span> Reemplazar archivo
                                        </button>
                                    )}
                                </div>
                            )}

                            {categoryState.files.length > 0 && (
                                <div className={`grid grid-cols-1 ${section.allowsMultiple ? 'sm:grid-cols-2' : ''} gap-2 mt-3`}>
                                    {categoryState.files.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm animate-fade-in">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <span className="material-icons text-slate-400 !text-xl shrink-0">description</span>
                                                <span className="text-sm text-slate-700 dark:text-slate-200 truncate" title={file.name}>{file.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleFileRemove(section.key, idx)}
                                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                                                title="Eliminar archivo"
                                            >
                                                <span className="material-icons !text-lg">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-sm mt-8">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-icons text-amber-500 !text-xl">tips_and_updates</span>
                        <h3 className="text-slate-800 dark:text-slate-100 font-semibold text-base leading-tight">
                            Sugerencias (Opcional)
                        </h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                        ¿Tienes alguna sugerencia para mejorar el proceso de prácticas? Tu opinión es valiosa.
                    </p>
                    <textarea
                        value={sugerencias}
                        onChange={(e) => setSugerencias(e.target.value)}
                        rows={3}
                        className="w-full text-sm rounded-lg border p-3 bg-slate-50 dark:bg-slate-900/50 shadow-inner outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                        placeholder="Escribe tus comentarios aquí..."
                    />
                </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end items-center gap-4">
                {submitMutation.isPending && (
                    <span className="text-sm text-slate-500 animate-pulse">Subiendo archivos, por favor espera...</span>
                )}
                <Button
                    onClick={() => submitMutation.mutate()}
                    isLoading={submitMutation.isPending}
                    disabled={fileCategories.horas.files.length === 0 || fileCategories.asistencia.files.length === 0 || fileCategories.informe.files.length === 0}
                    icon="send"
                    className="w-full sm:w-auto shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    Enviar Solicitud y Finalizar
                </Button>
            </div>
        </div>
    );
};

export default FinalizacionForm;
