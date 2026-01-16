import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../lib/db';
import {
    FIELD_NOMBRE_INSTITUCIONES,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
    FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_FECHA_FIN_LANZAMIENTOS,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
    FIELD_ACTIVIDADES_LANZAMIENTOS,
    FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS,
    FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS,
    FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
    FIELD_FECHA_PUBLICACION_LANZAMIENTOS,
    FIELD_DESCRIPCION_LANZAMIENTOS,
    FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS,
    FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS,
    FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
    FIELD_DIRECCION_LANZAMIENTOS,
} from '../../constants';
import { useError } from '../../contexts/ErrorContext';
import SubTabs from '../SubTabs';
import Button from '../ui/Button';
import Toast from '../ui/Toast';
import EmptyState from '../EmptyState';

import AIContentGenerator from './LanzadorConvocatorias/AIContentGenerator';
import Step1Institucion from './LanzadorConvocatorias/Step1Institucion';
import Step2Detalles from './LanzadorConvocatorias/Step2Detalles';
import Step3Actividades from './LanzadorConvocatorias/Step3Actividades';
import Step4Horarios from './LanzadorConvocatorias/Step4Horarios';

interface LanzadorConvocatoriasProps {
    isTestingMode?: boolean;
    forcedTab?: 'new' | 'history';
}

type FormData = {
    [key: string]: string | number | undefined | null | string[] | boolean;
    nombrePPS: string | undefined;
    fechaInicio: string | undefined;
    fechaFin: string | undefined;
    fechaInicioInscripcion: string | undefined;
    fechaFinInscripcion: string | undefined;
    orientacion: string | undefined;
    horasAcreditadas: number | undefined;
    cuposDisponibles: number | undefined;
    estadoConvocatoria: string | undefined;
    direccion: string | undefined;
    descripcion: string;
    requisitoObligatorio: string;
    programarLanzamiento: boolean;
    fechaPublicacion: string;
    mensajeWhatsApp: string;
    actividadesLabel: string;
    horariosFijos: boolean;
    rawActivityText: string;
    institucionId: string;
};

const initialState: FormData = {
    nombrePPS: '',
    fechaInicio: '',
    fechaFin: '',
    fechaInicioInscripcion: '',
    fechaFinInscripcion: '',
    orientacion: '',
    horasAcreditadas: 0,
    cuposDisponibles: 1,
    estadoConvocatoria: 'Abierta',
    direccion: '',
    descripcion: '',
    requisitoObligatorio: '',
    programarLanzamiento: false,
    fechaPublicacion: '',
    mensajeWhatsApp: '',
    actividadesLabel: 'Actividades',
    horariosFijos: false,
    rawActivityText: '',
    institucionId: '',
};

const LanzadorConvocatorias: React.FC<LanzadorConvocatoriasProps> = ({ 
    forcedTab 
}) => {
    const [internalTab, setInternalTab] = useState('nuevo');
    const activeTab = forcedTab || internalTab;
    
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<FormData>(initialState);
    const [actividades, setActividades] = useState<string[]>([]);
    const [schedules, setSchedules] = useState<string[]>(['']);
    const [isGenerating, setIsGenerating] = useState(false);
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    const { showError, showSuccess } = useError();
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            return await db.lanzamientos.create(data);
        },
        onSuccess: () => {
            showSuccess('Convocatoria creada exitosamente');
            setFormData(initialState);
            setActividades([]);
            setSchedules(['']);
            setCurrentStep(1);
        },
        onError: (error: any) => {
            showError(error, 'Convocatoria Creation');
        }
    });

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const lanzamientoData: any = {
                [FIELD_NOMBRE_PPS_LANZAMIENTOS]: formData.nombrePPS,
                [FIELD_ORIENTACION_LANZAMIENTOS]: formData.orientacion,
                [FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]: formData.horasAcreditadas,
                [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: formData.cuposDisponibles,
                [FIELD_FECHA_INICIO_LANZAMIENTOS]: formData.fechaInicio,
                [FIELD_FECHA_FIN_LANZAMIENTOS]: formData.fechaFin,
                [FIELD_FECHA_INICIO_INSCRIPCION_LANZAMIENTOS]: formData.fechaInicioInscripcion,
                [FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]: formData.fechaFinInscripcion,
                [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: formData.programarLanzamiento ? 'Oculto' : 'Abierta',
                [FIELD_DESCRIPCION_LANZAMIENTOS]: formData.descripcion,
                [FIELD_REQUISITO_OBLIGATORIO_LANZAMIENTOS]: formData.requisitoObligatorio || null,
                [FIELD_FECHA_PUBLICACION_LANZAMIENTOS]: formData.programarLanzamiento ? formData.fechaPublicacion : new Date().toISOString(),
                [FIELD_MENSAJE_WHATSAPP_LANZAMIENTOS]: formData.mensajeWhatsApp,
                [FIELD_ACTIVIDADES_LABEL_LANZAMIENTOS]: formData.actividadesLabel,
                [FIELD_ACTIVIDADES_LANZAMIENTOS]: actividades,
                [FIELD_HORARIOS_FIJOS_LANZAMIENTOS]: schedules.join('; '),
                [FIELD_DIRECCION_LANZAMIENTOS]: formData.direccion,
            };

            if (formData.institucionId) {
                lanzamientoData[FIELD_NOMBRE_INSTITUCIONES] = formData.institucionId;
            }

            await createMutation.mutateAsync(lanzamientoData);
            queryClient.invalidateQueries({ queryKey: ['lanzamientos'] });
        } catch (error: any) {
            showError(error, 'Form Submission');
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            showError('Error al copiar al portapapeles', 'Clipboard');
        }
    };

    const nextStep = () => {
        setCurrentStep(prev => Math.min(prev + 1, 4));
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const tabs = [
        { id: 'nuevo', label: 'Nuevo Lanzamiento', icon: 'add_circle' },
        { id: 'history', label: 'Historial', icon: 'history' },
    ];

    return (
        <div className="space-y-6 p-6">
            {toastInfo && (
                <Toast 
                    message={toastInfo.message} 
                    type={toastInfo.type} 
                    onClose={() => setToastInfo(null)} 
                />
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    <span className="material-icons">rocket_launch</span>
                    Lanzador de Convocatorias
                </h2>
                
                <SubTabs tabs={tabs} activeTabId={activeTab} onTabChange={setInternalTab} />
            </div>

            {/* Tab: Nuevo - Formulario con pasos */}
            {activeTab === 'nuevo' && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-4 mb-8">
                        {[1, 2, 3, 4].map(step => (
                            <React.Fragment key={step}>
                                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                                    currentStep === step
                                        ? 'bg-blue-600 text-white'
                                        : currentStep > step
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                }`}>
                                    {currentStep > step ? <span className="material-icons">check</span> : step}
                                </div>
                                {step < 4 && (
                                    <div className={`h-1 w-16 ${
                                        currentStep > step ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                                    }`}></div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Institución */}
                        {currentStep === 1 && (
                            <Step1Institucion
                                formData={formData}
                                onChange={handleInputChange}
                                onNext={nextStep}
                            />
                        )}

                        {/* Step 2: Detalles */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <button onClick={prevStep} className="text-gray-500 hover:text-gray-700">
                                        <span className="material-icons">arrow_back</span>
                                    </button>
                                    <Step2Detalles
                                        formData={formData}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={nextStep} icon="arrow_forward">
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Actividades con IA */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <button onClick={prevStep} className="text-gray-500 hover:text-gray-700">
                                        <span className="material-icons">arrow_back</span>
                                    </button>
                                    <Step3Actividades
                                        formData={formData}
                                        onChange={handleInputChange}
                                        actividades={actividades}
                                        setActividades={setActividades}
                                        isGenerating={isGenerating}
                                        setIsGenerating={setIsGenerating}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={nextStep} icon="arrow_forward">
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Horarios */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <button onClick={prevStep} className="text-gray-500 hover:text-gray-700">
                                        <span className="material-icons">arrow_back</span>
                                    </button>
                                    <Step4Horarios
                                        schedules={schedules}
                                        setSchedules={setSchedules}
                                        horariosFijos={formData.horariosFijos}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                
                                {/* WhatsApp Message Preview */}
                                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                        Mensaje de WhatsApp (Generado automáticamente)
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={() => copyToClipboard(formData.mensajeWhatsApp)}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            {isCopied ? '¡Copiado!' : 'Copiar'}
                                        </Button>
                                        <textarea
                                            value={formData.mensajeWhatsApp}
                                            onChange={(e) => handleInputChange('mensajeWhatsApp', e.target.value)}
                                            rows={4}
                                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm font-mono"
                                            placeholder="El mensaje de WhatsApp se generará automáticamente..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <Button
                                variant="secondary"
                                onClick={() => setFormData(initialState)}
                                type="button"
                            >
                                Limpiar Formulario
                            </Button>
                            
                            <Button
                                type="submit"
                                icon="rocket_launch"
                                isLoading={createMutation.isPending}
                                disabled={currentStep < 4}
                            >
                                {formData.programarLanzamiento ? 'Programar' : 'Lanzar Convocatoria'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab: Historial */}
            {activeTab === 'history' && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Historial de Lanzamientos
                    </h3>
                    
                    <EmptyState
                        icon="history"
                        title="Próximamente"
                        message="El historial de lanzamientos estará disponible en una futura versión."
                    />
                </div>
            )}
        </div>
    );
};

export default LanzadorConvocatorias;