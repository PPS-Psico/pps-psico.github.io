
import React from 'react';
import { Orientacion, ALL_ORIENTACIONES } from '../types';
import Select from './Select';

interface OrientacionSelectorProps {
  selectedOrientacion: string;
  onOrientacionChange: (orientacion: Orientacion | "") => void;
  showSaveConfirmation: boolean;
}

const OrientacionSelector: React.FC<OrientacionSelectorProps> = React.memo(({ selectedOrientacion, onOrientacionChange, showSaveConfirmation }) => {
  return (
    <div className="relative group min-w-[200px]">
        {showSaveConfirmation && (
          <div className="absolute -top-6 left-0 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter flex items-center gap-1 animate-fade-in-up">
            <span className="material-icons !text-xs">check_circle</span> Guardado
          </div>
        )}
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Especialidad</p>
        <Select
            id="orientacion-elegida-select" 
            aria-label="Seleccionar orientación principal"
            value={selectedOrientacion}
            onChange={(e) => onOrientacionChange(e.target.value as Orientacion | "")}
            className="text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl py-2"
        >
            <option value="">🎯 Seleccionar...</option>
            {ALL_ORIENTACIONES.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
        </Select>
    </div>
  );
});

OrientacionSelector.displayName = 'OrientacionSelector';
export default OrientacionSelector;
