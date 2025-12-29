
import React from 'react';
import { addBusinessDays, getBusinessDaysDiff, normalizeStringForComparison, formatDate } from '../utils/formatters';

interface FinalizationStatusCardProps {
    status: string;
    requestDate: string;
    studentName?: string;
}

const FinalizationStatusCard: React.FC<FinalizationStatusCardProps> = ({ status, requestDate, studentName }) => {
    const startDate = new Date(requestDate);
    const targetDate = addBusinessDays(startDate, 14);
    const now = new Date();
    
    const normalizedStatus = normalizeStringForComparison(status);
    const isFinished = normalizedStatus === 'cargado' || normalizedStatus === 'finalizada';
    const isEnProceso = normalizedStatus === 'en proceso';
    
    // Cálculos de progreso
    let daysDisplay = getBusinessDaysDiff(now, targetDate);
    const totalBusinessDays = 14;
    const daysPassed = totalBusinessDays - Math.max(0, daysDisplay);
    
    // Porcentaje de barra (Solo basado en tiempo)
    let percentage = Math.min(100, Math.max(5, (daysPassed / totalBusinessDays) * 100)); 
    if (daysDisplay < 0) percentage = 100;
    
    const firstName = studentName?.split(' ')[0] || 'Estudiante';
    const isOverdue = daysDisplay < 0;

    // Detectar si la fecha estimada cae en Enero o Febrero o si hubo feriados
    const targetMonth = targetDate.getMonth();
    // Mensaje de advertencia si hay receso o feriados largos cerca
    const showRecessWarning = targetMonth === 0 || targetMonth === 1 || targetMonth === 2 || (startDate.getMonth() === 11 && startDate.getDate() > 15);

    const gradientName = (
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
            {firstName}
        </span>
    );

    // --- VISTA DE ÉXITO (YA CARGADO) ---
    if (isFinished) {
        return (
            <div className="max-w-4xl mx-auto mt-8 animate-fade-in-up">
                <div className="relative overflow-hidden rounded-[2.5rem] bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800 p-10 sm:p-14 shadow-xl shadow-emerald-100/50 dark:shadow-none text-center backdrop-blur-xl">
                    {/* Background decorations for subtle elegance */}
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-emerald-100/40 dark:bg-emerald-900/10 blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-teal-100/40 dark:bg-teal-900/10 blur-3xl pointer-events-none"></div>
                    
                    <div className="relative z-10 flex flex-col items-center gap-8">
                        <div className="h-24 w-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-lg animate-bounce-slow text-emerald-500 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
                            <span className="material-icons !text-5xl">verified</span>
                        </div>
                        
                        <div className="space-y-4 max-w-2xl">
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 dark:text-white drop-shadow-sm">
                                ¡Felicitaciones, {gradientName}!
                            </h1>
                            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                Tu acreditación ha sido completada exitosamente. <br/>
                                Tus horas de Práctica Profesional Supervisada ya se encuentran cargadas en el sistema académico.
                            </p>
                        </div>

                        <div className="mt-4">
                            <a 
                                href="https://alumno.uflo.edu.ar" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300"
                            >
                                <span>Verificar en Autogestión</span>
                                <span className="material-icons !text-xl group-hover:translate-x-1 transition-transform">open_in_new</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- CONFIGURACIÓN DE ESTADOS ---
    let renderTitle = () => <span className="text-slate-900 dark:text-white">¡Solicitud Recibida!</span>;
    let bannerText = "Felicitaciones por finalizar tu recorrido de prácticas. Estamos evaluando tu solicitud y validando la documentación presentada.";
    let bannerStatus = "Solicitud Enviada";
    let bannerColorClass = "text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800";
    
    // 0 = Paso 1 (Validación), 1 = Paso 2 (Circuito), 2 = Paso 3 (Fin)
    let currentStepIndex = 0; 

    if (isEnProceso) {
        renderTitle = () => <>Todo marcha bien, {gradientName}.</>;
        bannerText = "Tus documentos fueron validados correctamente y el expediente se encuentra en proceso de acreditación interna.";
        bannerStatus = "En Proceso";
        bannerColorClass = "text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800";
        currentStepIndex = 1;
    }

    const steps = [
        {
            title: "Validación Documental",
            desc: "Revisión de firmas y planillas.",
            icon: "inventory_2"
        },
        {
            title: "Circuito Administrativo",
            desc: "Aprobación final por áreas UFLO.",
            icon: "settings_suggest"
        },
        {
            title: "Acreditación Final",
            desc: "Carga definitiva en sistema SAC.",
            icon: "school"
        }
    ];

    return (
        <div className="max-w-7xl mx-auto mt-6 animate-fade-in-up pb-12 space-y-6">
            
            {/* BANNER SUPERIOR */}
            <div className="relative overflow-hidden bg-white dark:bg-[#0F172A] rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl p-8 sm:p-12">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-50/50 to-transparent dark:from-blue-900/10 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border shadow-sm ${bannerColorClass}`}>
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current"></span>
                        </span>
                        {bannerStatus}
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-black leading-tight mb-4 tracking-tighter">
                        {renderTitle()}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-lg sm:text-xl leading-relaxed max-w-4xl font-medium">
                        {bannerText}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* --- TIMELINE (IZQUIERDA) --- */}
                <div className="lg:col-span-8">
                    <div className="bg-white/80 dark:bg-[#0F172A]/80 rounded-[2rem] border border-slate-200/80 dark:border-slate-800 p-8 sm:p-10 backdrop-blur-xl h-full flex flex-col shadow-md shadow-slate-200/40 dark:shadow-none relative">
                        
                        <div className="flex items-center gap-3 mb-10">
                            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
                                <span className="material-icons !text-2xl">timeline</span>
                            </div>
                            <h3 className="font-extrabold text-slate-800 dark:text-white text-xl tracking-tight">
                                Etapas del Proceso
                            </h3>
                        </div>
                        
                        <div className="flex-grow flex flex-col justify-center pl-2">
                             <div className="relative space-y-12">
                                 
                                 {/* Línea de fondo (Gris) */}
                                 <div className="absolute left-[28px] top-4 bottom-4 w-1 bg-slate-100 dark:bg-slate-800 -z-10 rounded-full"></div>
                                 
                                 {/* Línea de progreso (Color) */}
                                 <div 
                                    className="absolute left-[28px] top-4 w-1 bg-gradient-to-b from-emerald-400 to-blue-500 -z-10 rounded-full transition-all duration-1000 ease-in-out"
                                    style={{ height: `${(currentStepIndex / (steps.length - 1)) * 85}%` }}
                                 ></div>

                                {steps.map((step, idx) => {
                                    const isCompleted = idx < currentStepIndex;
                                    const isActive = idx === currentStepIndex;
                                    const isPending = idx > currentStepIndex;

                                    return (
                                        <div key={idx} className={`relative flex items-center gap-6 ${isPending ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                                            
                                            {/* ICONO */}
                                            <div className={`
                                                flex-shrink-0 w-14 h-14 rounded-full border-[5px] flex items-center justify-center z-10 transition-all duration-500
                                                ${isCompleted 
                                                    ? 'bg-emerald-500 border-white dark:border-slate-900 text-white shadow-lg shadow-emerald-500/30 scale-105' 
                                                    : isActive 
                                                        ? 'bg-white dark:bg-slate-900 border-blue-500 text-blue-600 shadow-xl shadow-blue-500/20 ring-4 ring-blue-100 dark:ring-blue-900/30 scale-110'
                                                        : 'bg-slate-100 dark:bg-slate-800 border-white dark:border-slate-900 text-slate-400'
                                                }
                                            `}>
                                                <span className={`material-icons !text-2xl ${isActive ? 'animate-pulse' : ''}`}>
                                                    {isCompleted ? 'check' : step.icon}
                                                </span>
                                            </div>

                                            {/* TEXTO */}
                                            <div className="py-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className={`text-lg font-bold tracking-tight ${isActive ? 'text-blue-700 dark:text-blue-400' : isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {step.title}
                                                    </h4>
                                                    {isCompleted && (
                                                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                                            Completado
                                                        </span>
                                                    )}
                                                    {isActive && (
                                                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                                                            En Curso
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed max-w-md">
                                                    {step.desc}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                    </div>
                </div>

                {/* --- SIDEBAR (DERECHA) --- */}
                <div className="lg:col-span-4 space-y-4 flex flex-col">
                    
                    {/* CARD ESTIMACIÓN */}
                    <div className="bg-white dark:bg-[#0F172A] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden relative group flex-grow flex flex-col">
                        <div className={`h-1.5 w-full ${isOverdue ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}></div>

                        <div className="p-6 flex flex-col flex-grow justify-center">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">Tiempo Estimado</h3>
                                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500">
                                     <span className="material-icons !text-xl">timer</span>
                                </div>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center mb-8">
                                <span className={`text-6xl font-black tracking-tighter leading-none ${isOverdue ? "text-rose-500 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                                    {Math.max(0, daysDisplay)}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                    Días Hábiles
                                </span>
                            </div>

                            {showRecessWarning && (
                                <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-xl flex items-start gap-2.5">
                                    <span className="material-icons text-amber-500 !text-base mt-0.5">beach_access</span>
                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-snug">
                                        Se descuentan feriados nacionales y receso de enero.
                                    </p>
                                </div>
                            )}

                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${isOverdue ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                                <div className="flex flex-col items-center border-r border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Solicitado</span>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono">
                                        {formatDate(startDate.toISOString())}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Resolución</span>
                                    <span className={`text-sm font-bold font-mono ${isOverdue ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {formatDate(targetDate.toISOString())}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CARD SOPORTE - UPDATED PADDING */}
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] px-6 pt-12 pb-8 border border-slate-200 dark:border-slate-700 shadow-md relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-white dark:from-slate-800 dark:to-slate-900 pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-slate-600 shadow-sm">
                                    <span className="material-icons !text-xl">support_agent</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-lg leading-none">¿Ayuda?</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sólo si el plazo venció.</p>
                                </div>
                            </div>
                            
                            <a 
                                href={isOverdue 
                                    ? `mailto:blas.rivera@uflouniversidad.edu.ar?subject=Consulta Acreditación - ${studentName || firstName}`
                                    : undefined
                                }
                                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all
                                    ${isOverdue 
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md cursor-pointer hover:-translate-y-0.5' 
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600 cursor-not-allowed'
                                    }`}
                                onClick={(e) => { if(!isOverdue) e.preventDefault(); }}
                            >
                                <span className="material-icons !text-lg">{isOverdue ? 'mail' : 'lock_clock'}</span>
                                {isOverdue ? 'Contactar' : 'Espera el plazo'}
                            </a>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default FinalizationStatusCard;
