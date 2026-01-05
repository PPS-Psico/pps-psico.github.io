
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../lib/db';
import { 
    FIELD_LEGAJO_ESTUDIANTES, 
    FIELD_NOMBRE_ESTUDIANTES, 
} from '../../constants';
import type { EstudianteFields, AirtableRecord } from '../../types';

const MOCK_STUDENTS_FOR_SEARCH: any[] = [
    { id: 'recTest1', createdTime: '', [FIELD_LEGAJO_ESTUDIANTES]: 'T0001', [FIELD_NOMBRE_ESTUDIANTES]: 'Tester Alfa' },
    { id: 'recTest2', createdTime: '', [FIELD_LEGAJO_ESTUDIANTES]: 'T0002', [FIELD_NOMBRE_ESTUDIANTES]: 'Beta Tester' },
    { id: 'recTest3', createdTime: '', [FIELD_LEGAJO_ESTUDIANTES]: 'T0003', [FIELD_NOMBRE_ESTUDIANTES]: 'Gama Tester' },
];

interface AdminSearchProps {
  onStudentSelect: (student: AirtableRecord<EstudianteFields>) => void;
  onSearchChange?: (term: string) => Promise<void>;
  isTestingMode?: boolean;
}

const AdminSearch: React.FC<AdminSearchProps> = ({ onStudentSelect, onSearchChange, isTestingMode = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<AirtableRecord<EstudianteFields>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const fetchMatches = useCallback(async (term: string) => {
    if (onSearchChange) {
        await onSearchChange(term);
        return;
    }

    if (term.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    
    if (isTestingMode) {
        setTimeout(() => {
            const lowerTerm = term.toLowerCase();
            const filtered = MOCK_STUDENTS_FOR_SEARCH.filter(s => 
                (s[FIELD_NOMBRE_ESTUDIANTES] as string)?.toLowerCase().includes(lowerTerm) || 
                (s[FIELD_LEGAJO_ESTUDIANTES] as string)?.toLowerCase().includes(lowerTerm)
            );
            setResults(filtered as unknown as AirtableRecord<EstudianteFields>[]);
            setIsLoading(false);
        }, 300);
        return;
    }
    
    const { records, error } = await db.estudiantes.getPage(1, 20, {
        searchTerm: term,
        searchFields: [FIELD_NOMBRE_ESTUDIANTES, FIELD_LEGAJO_ESTUDIANTES]
    });
    
    if (!error) {
      setResults(records as unknown as AirtableRecord<EstudianteFields>[]);
    }
    setIsLoading(false);
  }, [onSearchChange, isTestingMode]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchMatches(searchTerm);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, fetchMatches]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (student: AirtableRecord<EstudianteFields>) => {
    onStudentSelect(student);
    setSearchTerm('');
    setResults([]);
    setIsDropdownOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isDropdownOpen) {
      setIsDropdownOpen(true);
    }
  };

  const showDropdown = isDropdownOpen && searchTerm.length > 0 && !onSearchChange;

  const placeholderText = isTestingMode
    ? "Buscar (ej: Tester Alfa, T0001)"
    : "Buscar por Legajo o Nombre...";

  return (
    <div ref={searchContainerRef} className={`relative w-full h-full ${showDropdown ? 'z-[100]' : 'z-auto'}`}>
        {/* Input Styled to match parent container requirements - Removed border to fit inside wrapper */}
        <div className="relative group h-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 transition-colors duration-300 text-slate-400 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400">
                <span className="material-icons !text-lg">search</span>
            </div>
            <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder={placeholderText}
                className="w-full h-full pl-10 pr-4 text-sm font-medium bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0"
                autoComplete="off"
            />
        </div>

        {showDropdown && (
            <div className="absolute top-full left-0 z-[100] mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-700 overflow-hidden max-h-80 overflow-y-auto animate-fade-in-up" style={{ animationDuration: '200ms' }}>
                {isLoading ? (
                    <div className="p-4 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                        <div className="border-2 border-slate-200 dark:border-slate-600 border-t-blue-500 rounded-full w-4 h-4 animate-spin mr-2"></div>
                        Buscando...
                    </div>
                ) : results.length > 0 ? (
                    <ul>
                        {results.map((student) => (
                            <li key={student.id}>
                                <button
                                    onClick={() => handleSelect(student)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors flex justify-between items-center group"
                                >
                                    <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm group-hover:text-blue-700 dark:group-hover:text-blue-200">{student[FIELD_NOMBRE_ESTUDIANTES]}</span>
                                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/50 group-hover:border-blue-200 dark:group-hover:border-blue-800">{student[FIELD_LEGAJO_ESTUDIANTES]}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                     <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 italic">
                        No se encontraron resultados.
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default AdminSearch;
