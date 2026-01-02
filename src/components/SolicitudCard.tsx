
import React from 'react';
import type { SolicitudPPS } from '../types';
import { FIELD_EMPRESA_PPS_SOLICITUD, FIELD_ESTADO_PPS, FIELD_ULTIMA_ACTUALIZACION_PPS, FIELD_NOTAS_PPS } from '../constants';
import { formatDate, getStatusVisuals, normalizeStringForComparison } from '../utils/formatters';

interface SolicitudCardProps {
  solicitud: SolicitudPPS;
}

const SolicitudCard: React.FC<SolicitudCardProps> = ({ solicitud }) => {
  const institucion = solicitud[FIELD_EMPRESA_PPS_SOLICITUD] || '';
  const status = solicitud[FIELD_ESTADO_PPS] || 'Pendiente';
  const notas = solicitud[FIELD_NOTAS_PPS];
  const actualizacion = solicitud[FIELD_ULTIMA_ACTUALIZACION_PPS];
  
  const visuals = getStatusVisuals(status);

  // Logic: Student only sees notes if the status is "No se pudo concretar" (to know why)
  const showNotes = normalizeStringForComparison(status) === 'no se pudo concretar';

  return (
    <article className="group bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden relative">
        {/* Accent Border */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${visuals.accentBg}`}></div>
        
        <div className="p-5 pl-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
            
            {/* Left Side: Info */}
            <div className="flex-grow min-w-0 space-y-2 w-full">
                 <div className="flex items-center gap-2 mb-1">
                    <span className={`${visuals.labelClass} shadow-sm border border-transparent`}>
                         <span className="material-icons !text-sm mr-1">{visuals.icon}</span>
                         {status}
                    </span>
                </div>
                
                {/* Title - Fixed wrapping */}
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight tracking-tighter break-words hyphens-auto" title={institucion}>
                    {institucion || 'Institución no especificada'}
                </h3>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <div className="flex items-center gap-1">
                         <span className="material-icons !text-base opacity-70">calendar_today</span>
                         <span>Actualizado: {formatDate(actualizacion)}</span>
                    </div>
                </div>

                {showNotes && notas && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50 text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                        <strong>Motivo:</strong> "{notas}"
                    </div>
                )}
            </div>

             {/* Right Side: Icon Graphic */}
            <div className="hidden sm:flex flex-shrink-0 items-center justify-center pl-4 border-l border-slate-100 dark:border-slate-800">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-300 ${visuals.iconContainerClass.replace('mr-4', '')} bg-opacity-20 dark:bg-opacity-10`}>
                     <span className={`material-icons !text-3xl ${visuals.accentBg.replace('bg-', 'text-')}`}>{visuals.icon}</span>
                </div>
            </div>
        </div>
    </article>
  );
};

export default SolicitudCard;
