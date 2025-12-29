
import React, { useState } from 'react';
import type { Practica } from '../types';
import {
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_NOTA_PRACTICAS
} from '../constants';
import {
  formatDate,
  getEspecialidadClasses,
  getStatusVisuals,
  parseToUTCDate,
  normalizeStringForComparison
} from '../utils/formatters';
import EmptyState from './EmptyState';
import NotaSelector from './NotaSelector';
import { TableSkeleton } from './Skeletons';

const cleanInstitutionName = (val: any): string => {
    if (val === null || val === undefined) return 'N/A';
    if (Array.isArray(val)) return cleanInstitutionName(val[0]);
    let str = String(val);
    return str.replace(/[\[\]\{\}"]/g, '').trim();
}

interface PracticasTableProps {
    practicas: Practica[];
    handleNotaChange: (practicaId: string, nota: string, convocatoriaId?: string) => void;
    handleFechaFinChange?: (practicaId: string, fecha: string) => void; 
    isLoading?: boolean;
}

const GradeDisplay: React.FC<{ 
    nota: string; 
    onClick: () => void; 
    isSaving: boolean; 
    isSuccess: boolean;
    isOpen: boolean;
}> = ({ nota, onClick, isSaving, isSuccess, isOpen }) => {
    
    const getGradeStyle = (n: string) => {
        const num = parseInt(n, 10);
        if (!isNaN(num)) {
             if (num >= 7) return "text-emerald-600 dark:text-emerald-400 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20";
             if (num >= 4) return "text-amber-600 dark:text-amber-400 border-amber-200 bg-amber-50 dark:bg-amber-900/20";
             return "text-rose-600 dark:text-rose-400 border-rose-200 bg-rose-50 dark:bg-rose-900/20";
        }
        return "text-slate-400 dark:text-slate-500 border-slate-200 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700";
    };

    const style = getGradeStyle(nota);
    const displayText = !isNaN(parseInt(nota, 10)) ? nota : '-';

    return (
        <div 
            className={`
                relative flex items-center justify-center w-12 h-12 rounded-xl border-2 text-xl font-bold transition-all duration-300 cursor-pointer
                ${style} 
                ${isSaving ? 'animate-pulse opacity-70' : 'hover:scale-105 hover:shadow-md'}
                ${isOpen ? 'ring-4 ring-blue-100 dark:ring-blue-900/40 border-blue-400 z-50' : ''}
            `}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            title="Clic para editar nota"
        >
            {isSaving ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isSuccess ? (
                <span className="material-icons !text-lg">check</span>
            ) : (
                displayText
            )}
        </div>
    );
};

const DateDisplay: React.FC<{
    dateStr: string | null;
    onDateChange: (newDate: string) => void;
    label: string;
}> = ({ dateStr, onDateChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const inputValue = dateStr ? dateStr.split('T')[0] : '';
    
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsEditing(false);
        if (e.target.value && e.target.value !== inputValue) {
            onDateChange(e.target.value);
        }
    };
    
    const handleContainerClick = () => {
        if (window.matchMedia('(min-width: 768px)').matches) {
             setIsEditing(true);
        }
    };

    if (isEditing) {
        return (
            <input 
                type="date" 
                autoFocus
                defaultValue={inputValue}
                onBlur={handleBlur}
                className="bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 py-0.5 text-xs text-slate-800 dark:text-white outline-none w-28"
            />
        );
    }

    return (
        <span 
            onClick={handleContainerClick}
            className="group/date relative cursor-default md:cursor-pointer flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="Clic para editar fecha (Solo PC)"
        >
            {formatDate(dateStr)}
            <span className="material-icons !text-[10px] opacity-0 group-hover/date:opacity-100 transition-opacity hidden md:inline-block">edit</span>
        </span>
    );
};

const PracticaRow: React.FC<{
  practica: Practica;
  onNotaChange: (id: string, nota: string) => void;
  onFechaFinChange?: (id: string, fecha: string) => void;
  isSaving: boolean;
  isSuccess: boolean;
}> = ({ practica, onNotaChange, onFechaFinChange, isSaving, isSuccess }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const institucion = cleanInstitutionName(practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]);
    let status = practica[FIELD_ESTADO_PRACTICA];

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (normalizeStringForComparison(status) === 'en curso' && practica[FIELD_FECHA_FIN_PRACTICAS]) {
        const endDate = parseToUTCDate(practica[FIELD_FECHA_FIN_PRACTICAS]);
        if (endDate && endDate < now) {
            status = 'Finalizada';
        }
    }

    const statusVisuals = getStatusVisuals(status || '');
    const espVisuals = getEspecialidadClasses(practica[FIELD_ESPECIALIDAD_PRACTICAS] || '');
    const notaActual = practica[FIELD_NOTA_PRACTICAS] || 'Sin calificar';

    const handleSelectGrade = (selectedNota: string) => {
        onNotaChange(practica.id, selectedNota);
        setIsMenuOpen(false);
    };

    return (
        <div 
            className={`
                group relative bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between overflow-hidden
                ${isMenuOpen ? 'z-50 ring-1 ring-blue-200 dark:ring-blue-800' : 'z-0'}
            `}
        >
            {/* Left Border Accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${espVisuals.gradient}`}></div>
            
            <div className="pl-3 flex-1 min-w-0 w-full">
                <div className="flex items-center gap-2 mb-2">
                    <span className={`${espVisuals.tag} text-[10px] py-0.5 px-2 font-bold`}>
                        {practica[FIELD_ESPECIALIDAD_PRACTICAS] || 'General'}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusVisuals.labelClass} border bg-opacity-10`}>
                        {status}
                    </span>
                </div>
                {/* Institution Name - Allowed wrapping */}
                <h3 className="text-base font-bold text-slate-900 dark:text-white pr-2 leading-tight break-words hyphens-auto">
                    {institucion}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded border border-slate-100 dark:border-slate-700/50">
                        <span className="material-icons !text-sm opacity-70">date_range</span>
                        <span>{formatDate(practica[FIELD_FECHA_INICIO_PRACTICAS])}</span>
                        <span className="mx-1">-</span>
                        <DateDisplay 
                            dateStr={practica[FIELD_FECHA_FIN_PRACTICAS] || null} 
                            onDateChange={(newDate) => onFechaFinChange && onFechaFinChange(practica.id, newDate)}
                            label="Fecha Fin"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0">
                 {/* Center hours vertically with label. Force center alignment. */}
                 <div className="flex flex-col items-center justify-center min-w-[3rem] text-center">
                    <p className="text-2xl font-black text-slate-800 dark:text-slate-200 leading-none text-center w-full">
                        {practica[FIELD_HORAS_PRACTICAS] || 0}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 text-center w-full">Horas</p>
                </div>
                
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

                <div className="relative flex flex-col items-center">
                    <GradeDisplay 
                        nota={notaActual} 
                        onClick={() => !isSaving && setIsMenuOpen(!isMenuOpen)}
                        isSaving={isSaving} 
                        isSuccess={isSuccess}
                        isOpen={isMenuOpen}
                    />
                    
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 text-center">Nota</p>

                    {/* Custom Menu Overlay */}
                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }} />
                            
                            <NotaSelector 
                                onSelect={handleSelectGrade}
                                onClose={() => setIsMenuOpen(false)}
                                currentValue={notaActual}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const PracticasTable: React.FC<PracticasTableProps> = ({ practicas, handleNotaChange, handleFechaFinChange, isLoading = false }) => {
  const [savingNotaId, setSavingNotaId] = useState<string | null>(null);
  const [justUpdatedPracticaId, setJustUpdatedPracticaId] = useState<string | null>(null);

  const onLocalNoteChange = async (practicaId: string, nota: string) => {
      setSavingNotaId(practicaId);
      await handleNotaChange(practicaId, nota);
      setSavingNotaId(null);
      setJustUpdatedPracticaId(practicaId);
      setTimeout(() => setJustUpdatedPracticaId(null), 2000);
  };

  if (isLoading) {
      return (
          <div className="flex flex-col gap-3">
              <div className="flex justify-between items-end px-2 mb-1">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              </div>
              <TableSkeleton />
          </div>
      );
  }

  if (practicas.length === 0) {
    return (
      <EmptyState
        icon="work_off"
        title="Sin Prácticas"
        message="Aún no tienes historial de prácticas registradas."
        className="bg-transparent border-none shadow-none p-0"
      />
    );
  }

  const sortedPracticas = [...practicas].sort((a, b) => {
      const dateA = new Date(a[FIELD_FECHA_INICIO_PRACTICAS] || 0).getTime();
      const dateB = new Date(b[FIELD_FECHA_INICIO_PRACTICAS] || 0).getTime();
      return dateB - dateA;
  });

  return (
    <div className="flex flex-col gap-3">
        <div className="flex justify-between items-end px-2 mb-1">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total: {sortedPracticas.length} Prácticas
            </h3>
        </div>

        {sortedPracticas.map((practica) => (
             <PracticaRow 
                key={practica.id}
                practica={practica}
                onNotaChange={onLocalNoteChange}
                onFechaFinChange={handleFechaFinChange}
                isSaving={savingNotaId === practica.id}
                isSuccess={justUpdatedPracticaId === practica.id}
             />
        ))}
    </div>
  );
};

export default React.memo(PracticasTable);
