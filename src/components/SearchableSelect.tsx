
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface Option {
    value: string;
    label: string;
    subLabel?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = "Seleccionar...",
    label,
    disabled = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Obtener el label actual basado en el valor seleccionado
    const selectedOption = options.find(o => o.value === value);

    // Sincronizar el término de búsqueda con la selección actual cuando cambia externamente
    useEffect(() => {
        if (selectedOption && !isOpen) {
            setSearchTerm(selectedOption.label);
        } else if (!value && !isOpen) {
            setSearchTerm('');
        }
    }, [selectedOption, value, isOpen]);

    // Filtrar opciones
    const filteredOptions = useMemo(() => {
        // Si el usuario está escribiendo, filtramos
        if (isOpen && searchTerm !== selectedOption?.label) {
             const lowerTerm = searchTerm.toLowerCase();
             return options.filter(opt => 
                opt.label.toLowerCase().includes(lowerTerm) || 
                (opt.subLabel && opt.subLabel.toLowerCase().includes(lowerTerm))
             );
        }
        // Si no, mostramos todo
        return options;
    }, [options, searchTerm, isOpen, selectedOption]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Restaurar el texto si no se seleccionó nada nuevo
                if (selectedOption) setSearchTerm(selectedOption.label);
                else setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedOption]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const handleInputFocus = () => {
        setIsOpen(true);
        // UX: Si hay un valor seleccionado, seleccionamos todo el texto para facilitar el borrado/escritura
        if (inputRef.current) {
            inputRef.current.select();
        }
    };

    const handleInputClick = () => {
        // UX: Si el usuario hace clic, aseguramos que se abra y si quiere borrar, puede hacerlo
        if(!isOpen) setIsOpen(true);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    {label}
                </label>
            )}
            
            <div className="relative group">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                    onFocus={handleInputFocus}
                    onClick={handleInputClick}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`
                        w-full h-11 pl-4 pr-10 rounded-xl text-sm font-bold transition-all duration-200 outline-none
                        border-2 
                        ${disabled 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed' 
                            : isOpen
                                ? 'bg-white dark:bg-slate-900 border-blue-500 ring-4 ring-blue-500/10 text-slate-800 dark:text-white'
                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-slate-600'
                        }
                    `}
                />
                
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {value && !disabled && (
                        <button 
                            onClick={handleClear}
                            className="p-0.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                        >
                            <span className="material-icons !text-sm">close</span>
                        </button>
                    )}
                    <span className={`material-icons !text-lg transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'}`}>
                        expand_more
                    </span>
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in-up">
                    {filteredOptions.length > 0 ? (
                        <ul className="py-1">
                            {filteredOptions.map((opt) => (
                                <li key={opt.value}>
                                    <button
                                        onClick={() => handleSelect(opt.value)}
                                        className={`
                                            w-full text-left px-4 py-2.5 text-sm transition-colors flex flex-col border-b border-slate-50 dark:border-slate-700/50 last:border-0
                                            ${opt.value === value 
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                            }
                                        `}
                                    >
                                        <span className="font-bold">{opt.label}</span>
                                        {opt.subLabel && <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{opt.subLabel}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                            No se encontraron resultados
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
