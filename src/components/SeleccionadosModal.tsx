
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { GroupedSeleccionados, SelectedStudent } from '../types';
import EmptyState from './EmptyState';

interface SeleccionadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  seleccionados: GroupedSeleccionados | null;
  convocatoriaName: string;
}

const StudentListItem: React.FC<{ student: SelectedStudent }> = ({ student }) => (
  <motion.li 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
  >
    <div className="flex items-center gap-4">
        <div className={`
            w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shadow-sm transform transition-transform group-hover:scale-110
            ${student.nombre === 'Nombre Desconocido' 
                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' 
                : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30'
            }
        `}>
            {student.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col">
            <span className={`font-bold text-sm ${student.nombre === 'Nombre Desconocido' ? 'text-slate-400 italic' : 'text-slate-800 dark:text-slate-100'}`}>
                {student.nombre}
            </span>
             <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 sm:hidden">
                {student.legajo}
            </span>
        </div>
    </div>
    
    <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
      {student.legajo}
    </span>
  </motion.li>
);

const SeleccionadosModal: React.FC<SeleccionadosModalProps> = ({
  isOpen,
  onClose,
  seleccionados,
  convocatoriaName,
}) => {
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
        setSearchTerm(''); // Reset search on open
    } else {
        document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const filteredData = useMemo(() => {
      if (!seleccionados) return null;
      if (!searchTerm) return seleccionados;

      const lowerTerm = searchTerm.toLowerCase();
      const filtered: GroupedSeleccionados = {};
      let hasResults = false;

      // Fix: Cast students as SelectedStudent[] to resolve property 'filter' on type 'unknown'
      Object.entries(seleccionados).forEach(([horario, students]) => {
          const matchingStudents = (students as SelectedStudent[]).filter(s => 
              s.nombre.toLowerCase().includes(lowerTerm) || 
              s.legajo.toLowerCase().includes(lowerTerm)
          );
          if (matchingStudents.length > 0) {
              filtered[horario] = matchingStudents;
              hasResults = true;
          }
      });

      return hasResults ? filtered : null;
  }, [seleccionados, searchTerm]);

  const totalCount: number = seleccionados 
    ? (Object.values(seleccionados) as SelectedStudent[][]).reduce((acc, curr) => acc + curr.length, 0)
    : 0;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-[95vw] max-h-[85dvh] sm:w-full sm:max-w-lg sm:max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
                >
                    {/* Header */}
                    <div className="flex-shrink-0 px-6 py-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 z-10">
                        {/* Fix: totalCount is correctly inferred as number, enabling valid comparison */}
                        <div className={`flex justify-between items-start ${totalCount >= 20 ? 'mb-4' : ''}`}>
                             <div className="min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Resultados Oficiales</p>
                                    {/* Fix: totalCount is number, direct comparison is safe */}
                                    {totalCount > 0 && (
                                        <span className="inline-flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
                                            {totalCount}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate" title={convocatoriaName}>
                                    {convocatoriaName}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <span className="material-icons !text-xl">close</span>
                            </button>
                        </div>

                        {/* Search Bar - Conditional Rendering */}
                        {/* Fix: totalCount is number, direct comparison is safe */}
                        {totalCount >= 20 && (
                            <div className="relative animate-fade-in">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 !text-lg">search</span>
                                <input 
                                    type="text"
                                    placeholder="Buscar por alumno o legajo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-grow custom-scrollbar bg-slate-50/30 dark:bg-black/20">
                        {!filteredData ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center opacity-60">
                                <span className="material-icons !text-4xl text-slate-300 mb-2">person_search</span>
                                <p className="text-sm font-medium text-slate-500">No se encontraron resultados para tu búsqueda.</p>
                            </div>
                        ) : !seleccionados || Object.keys(seleccionados).length === 0 ? (
                             <EmptyState
                                icon="person_off"
                                title="Lista no disponible"
                                message="Aún no se ha publicado la lista de seleccionados."
                                className="bg-transparent border-none shadow-none mt-4"
                            />
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(filteredData).map(([horario, students]) => (
                                    <div key={horario} className="relative">
                                        {horario !== 'No especificado' && (
                                            /* Static Header (No Sticky) */
                                            <div className="flex items-center gap-2 mb-3 py-1 z-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                    {horario}
                                                </h3>
                                                <div className="flex-grow border-b border-slate-200 dark:border-slate-800 ml-2"></div>
                                                {/* Fix: Cast students as SelectedStudent[] to resolve property 'length' on type 'unknown' */}
                                                <span className="text-[10px] font-bold text-slate-400">{(students as SelectedStudent[]).length}</span>
                                            </div>
                                        )}
                                        <ul className="space-y-3">
                                            <AnimatePresence>
                                                {/* Fix: Cast students as SelectedStudent[] to resolve property 'map' on type 'unknown' */}
                                                {(students as SelectedStudent[]).map((student) => (
                                                    <StudentListItem key={`${student.legajo}-${horario}`} student={student} />
                                                ))}
                                            </AnimatePresence>
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                         <button 
                            onClick={onClose} 
                            className="w-full px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                             Entendido
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>,
    document.body
  );
};

export default SeleccionadosModal;
