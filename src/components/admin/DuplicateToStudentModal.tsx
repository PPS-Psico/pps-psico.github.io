
import React, { useState } from 'react';
import AdminSearch from './AdminSearch';
import { AirtableRecord, EstudianteFields } from '../../types';
import { FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES } from '../../constants';
import Button from '../ui/Button';

interface DuplicateToStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (studentId: string) => void;
    sourceRecordLabel: string;
    isSaving: boolean;
}

const DuplicateToStudentModal: React.FC<DuplicateToStudentModalProps> = ({
    isOpen, onClose, onConfirm, sourceRecordLabel, isSaving
}) => {
    const [selectedStudent, setSelectedStudent] = useState<AirtableRecord<EstudianteFields> | null>(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in"
            >
                <div className="p-8 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                            <span className="material-icons">content_copy</span>
                        </span>
                        Duplicar Práctica
                    </h3>
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Se creará una copia idéntica de <strong>{sourceRecordLabel}</strong> para el estudiante que selecciones a continuación.
                    </p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Destinatario</label>
                        <div className="h-12">
                            <AdminSearch onStudentSelect={(s) => setSelectedStudent(s)} />
                        </div>
                    </div>

                    {selectedStudent && (
                        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex items-center justify-between animate-fade-in">
                            <div>
                                <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{selectedStudent[FIELD_NOMBRE_ESTUDIANTES]}</p>
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Legajo: {selectedStudent[FIELD_LEGAJO_ESTUDIANTES]}</p>
                            </div>
                            <span className="material-icons text-blue-500">check_circle</span>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                        Cancelar
                    </button>
                    <Button
                        onClick={() => selectedStudent && onConfirm(selectedStudent.id)}
                        disabled={!selectedStudent || isSaving}
                        isLoading={isSaving}
                        className="px-8"
                    >
                        Duplicar Ahora
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DuplicateToStudentModal;
