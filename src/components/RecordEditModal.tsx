import React, { useState, useEffect, useRef } from 'react';
import type { AirtableRecord } from '../types';
import { 
    FIELD_ESTUDIANTE_LINK_PRACTICAS, 
    FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS
} from '../constants';
import { cleanDbValue } from '../utils/formatters';

interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'tel' | 'select' | 'checkbox';
    options?: readonly string[] | { value: string; label: string }[];
}

interface TableConfig {
    label: string;
    schema: any;
    fieldConfig: FieldConfig[];
}

interface RecordEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: AirtableRecord<any> | null; // Null for creation mode
    initialData?: any; // Data to pre-fill when in creation mode (e.g. duplicating)
    tableConfig: TableConfig;
    onSave: (recordId: string | null, fields: any) => void;
    isSaving: boolean;
}

const RecordEditModal: React.FC<RecordEditModalProps> = ({ isOpen, onClose, record, initialData, tableConfig, onSave, isSaving }) => {
    const [formData, setFormData] = useState<any>({});
    const isCreateMode = !record;
    
    const mouseDownTarget = useRef<EventTarget | null>(null);

    useEffect(() => {
        const data: { [key: string]: any } = {};
        
        tableConfig.fieldConfig.forEach(field => {
            let rawVal;
            if (isCreateMode) {
                if (initialData && initialData[field.key] !== undefined) {
                    rawVal = initialData[field.key];
                } else {
                    rawVal = field.type === 'checkbox' ? false : '';
                }
            } else {
                // If the key is mapped in schema, use the mapped key, otherwise assume flat structure
                // But generally RecordEditModal is used with mapped objects already.
                const keyToCheck = field.key;
                rawVal = record ? record[keyToCheck] : '';
            }
            
            // CLEAN ON INIT: Ensure the form starts with clean string values
            if (typeof rawVal === 'string' || Array.isArray(rawVal)) {
                data[field.key] = cleanDbValue(rawVal);
            } else {
                data[field.key] = rawVal;
            }
        });
        setFormData(data);
    }, [record, tableConfig, isCreateMode, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const checkedValue = (e.target as HTMLInputElement).checked;
        setFormData((prev: any) => ({
            ...prev,
            [name]: isCheckbox ? checkedValue : value,
        }));
    };

    const handleSave = () => {
        const cleanedData = { ...formData };
        
        tableConfig.fieldConfig.forEach(field => {
            const val = cleanedData[field.key];
            
            // Garantizar tipos primitivos correctos
            if (field.type === 'number') {
                if (val === '' || val === null || val === undefined) {
                    cleanedData[field.key] = null;
                } else {
                    cleanedData[field.key] = Number(val);
                }
            } else if (field.type === 'text' || field.type === 'textarea' || field.type === 'select') {
                // DOUBLE CLEAN ON SAVE: Ensure we send clean string
                cleanedData[field.key] = cleanDbValue(val);
            }
        });

        onSave(record ? record.id : null, cleanedData);
    };
    
    if (!isOpen) return null;

    const renderField = (field: FieldConfig) => {
        const value = formData[field.key] ?? '';
        const isCheckbox = field.type === 'checkbox';
        const isTextarea = field.type === 'textarea';
        
        const inputClasses = `
            w-full rounded-xl border-2 
            border-slate-300 dark:border-slate-500 
            p-2.5 text-sm font-medium 
            bg-white dark:bg-slate-950 
            text-slate-900 dark:text-slate-100
            focus:border-blue-600 dark:focus:border-blue-400 
            focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 
            outline-none transition-all
            ${isCheckbox ? 'h-5 w-5 text-blue-600 rounded cursor-pointer' : ''}
        `;

        if (!isCreateMode && record) {
            let displayValue = null;
            let icon = 'link';
            
            if (field.key === FIELD_ESTUDIANTE_LINK_PRACTICAS || field.key === FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS) {
                displayValue = (record as any).__studentName;
                icon = 'person';
            } else if (field.key === FIELD_LANZAMIENTO_VINCULADO_PRACTICAS || field.key === FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS) {
                displayValue = (record as any).__lanzamientoName;
                icon = 'rocket_launch';
            }

            if (displayValue) {
                return (
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{field.label}</label>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                             <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-600 shadow-sm">
                                 <span className="material-icons !text-sm">{icon}</span>
                             </div>
                             <div className="min-w-0">
                                 <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{displayValue}</p>
                                 <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">ID: {value}</p>
                             </div>
                        </div>
                        <input type="hidden" name={field.key} value={value} />
                    </div>
                );
            }
        }

        if (isTextarea) {
             return (
                <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{field.label}</label>
                    <textarea name={field.key} value={value} onChange={handleChange} rows={3} className={inputClasses} />
                </div>
             );
        }

        if (field.type === 'select') {
            return (
                <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{field.label}</label>
                    <div className="relative">
                        <select name={field.key} value={value} onChange={handleChange} className={`${inputClasses} appearance-none pr-10`}>
                            <option value="">Seleccionar...</option>
                            {field.options?.map((opt) => {
                                if (typeof opt === 'string') {
                                    return <option key={opt} value={opt}>{opt}</option>;
                                }
                                return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                            })}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 dark:text-slate-500 pointer-events-none !text-lg">expand_more</span>
                    </div>
                </div>
            );
        }

        if (isCheckbox) {
             return (
                 <div className="col-span-1 flex items-center gap-3 mt-6 p-1">
                    <input type="checkbox" id={field.key} name={field.key} checked={!!value} onChange={handleChange} className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <label htmlFor={field.key} className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">{field.label}</label>
                </div>
            );
        }

        return (
            <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{field.label}</label>
                <input type={field.type} name={field.key} value={value} onChange={handleChange} className={inputClasses} />
            </div>
        );
    };
    
    return (
        <div 
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in" 
            onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
            onMouseUp={(e) => {
                if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) {
                    onClose();
                }
                mouseDownTarget.current = null;
            }}
        >
            <div 
                className="relative w-[95vw] max-h-[90dvh] sm:w-full sm:max-w-2xl sm:max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-transform duration-300 animate-scale-in" 
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()} 
            >
                <header className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                         <div className={`p-3 rounded-xl shadow-sm ${isCreateMode ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                            <span className="material-icons !text-2xl">{isCreateMode ? (initialData ? 'content_copy' : 'add_circle') : 'edit_note'}</span>
                         </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                                {isCreateMode ? (initialData ? 'Duplicar Registro' : 'Nuevo Registro') : 'Editar Registro'}
                            </h3>
                            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 block">{tableConfig.label}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <span className="material-icons">close</span>
                    </button>
                </header>
                
                <main className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30 flex-grow">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                        {tableConfig.fieldConfig.map(field => (
                            <React.Fragment key={field.key}>
                                {renderField(field)}
                            </React.Fragment>
                        ))}
                    </div>
                </main>
                
                <footer className="p-5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 safe-area-bottom">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95 transform"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"/>
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <>
                                <span className="material-icons !text-lg">save</span>
                                <span>{isCreateMode ? 'Crear' : 'Guardar'}</span>
                            </>
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default RecordEditModal;