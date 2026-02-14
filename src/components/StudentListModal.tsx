import React, { useState, useMemo } from "react";
import { getEspecialidadClasses } from "../utils/formatters";

interface StudentInfo {
  legajo: string;
  nombre: string;
  institucion?: string;
  fechaFin?: string;
  ppsId?: string;
  [key: string]: any; // Allow other properties
}

interface StudentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  students: StudentInfo[];
  headers?: { key: string; label: string }[];
  description?: React.ReactNode;
  onStudentClick?: (student: StudentInfo) => void;
}

const StudentListModal: React.FC<StudentListModalProps> = ({
  isOpen,
  onClose,
  title,
  students,
  headers,
  description,
  onStudentClick,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) {
      return students;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return students.filter((student) =>
      Object.values(student).some((value) => String(value).toLowerCase().includes(lowercasedFilter))
    );
  }, [students, searchTerm]);

  if (!isOpen) return null;

  const renderTable = () => (
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-xs text-slate-500 dark:text-slate-400 uppercase">
        <tr>
          {headers!.map((header) => (
            <th key={header.key} scope="col" className="px-4 py-3 font-semibold tracking-wider">
              {header.label}
            </th>
          ))}
          {onStudentClick && (
            <th scope="col" className="px-4 py-3 font-semibold tracking-wider text-right">
              Acciones
            </th>
          )}
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200/70 dark:divide-slate-700/70">
        {filteredStudents.map((student, index) => (
          <tr
            key={student.ppsId || `${student.legajo}-${index}`}
            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
          >
            {headers!.map((header) => (
              <td key={header.key} className="px-4 py-3 text-slate-700 dark:text-slate-300">
                {student[header.key]}
              </td>
            ))}
            {onStudentClick && (
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onStudentClick(student)}
                  className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold text-xs py-2 px-3 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  aria-label={`Ver panel de ${student.nombre}`}
                >
                  <span className="material-icons !text-base">visibility</span>
                  <span>Ver Panel</span>
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const isInstitutionList = headers?.some((h) => h.key === "legajo" && h.label === "Orientaciones");

  const renderList = () => (
    <ul className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
      {filteredStudents.map((student, index) => {
        const key = student.ppsId || `${student.nombre}-${student.legajo}-${index}`;
        return (
          <li
            key={key}
            className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p
                  className="font-bold text-slate-800 dark:text-slate-100 truncate"
                  title={student.nombre}
                >
                  {student.nombre}
                </p>

                {isInstitutionList && student.legajo && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {student.legajo
                      .split(",")
                      .map((o) => o.trim())
                      .filter(Boolean)
                      .map((o) => {
                        const especialidadVisuals = getEspecialidadClasses(o);
                        return (
                          <span key={o} className={`${especialidadVisuals.tag} shadow-sm`}>
                            {o}
                          </span>
                        );
                      })}
                  </div>
                )}

                {student.institucion && !isInstitutionList && (
                  <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="material-icons !text-base text-slate-400">business</span>
                    <span className="truncate" title={student.institucion}>
                      {student.institucion}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 flex flex-row sm:flex-row items-center gap-x-6 gap-y-1.5 self-start sm:self-center">
                {!isInstitutionList && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="material-icons !text-base text-slate-400">badge</span>
                    <span className="font-mono">{student.legajo}</span>
                  </div>
                )}

                {student.fechaFin && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="material-icons !text-base text-slate-400">event_busy</span>
                    <span>{student.fechaFin}</span>
                  </div>
                )}

                {student.totalHoras !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-semibold">
                    <span className="material-icons !text-base text-slate-400">functions</span>
                    <span>{student.totalHoras} hs</span>
                  </div>
                )}

                {onStudentClick && !isInstitutionList && (
                  <button
                    onClick={() => onStudentClick(student)}
                    className="ml-auto sm:ml-4 inline-flex items-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold text-xs py-2 px-3 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    aria-label={`Ver panel de ${student.nombre}`}
                  >
                    <span className="material-icons !text-base">visibility</span>
                    <span>Ver Panel</span>
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
      style={{ zIndex: 99999 }}
      aria-labelledby="student-list-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[95vw] sm:w-full max-w-3xl max-h-[calc(100dvh-140px)] sm:max-h-[calc(100vh-140px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/70 dark:border-slate-800 animate-scale-in mt-16 sm:mt-20"
        style={{ zIndex: 99999 }}
      >
        <div className="p-6 flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="student-list-modal-title"
                className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight"
              >
                {title}
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                {filteredStudents.length} de {students.length} resultados
              </p>
              {description && (
                <div className="mt-2 text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 font-medium">
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Cerrar modal"
            >
              <span className="material-icons !text-xl">close</span>
            </button>
          </div>
          <div className="relative mt-4">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition-all shadow-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 dark:text-slate-500 !text-lg pointer-events-none">
              search
            </span>
          </div>
        </div>
        <div className="overflow-y-auto flex-grow bg-slate-50/30 dark:bg-slate-900/30 custom-scrollbar">
          {filteredStudents.length > 0 ? (
            <div className={headers ? "p-0" : "p-2 sm:p-4"}>
              {headers ? renderTable() : renderList()}
            </div>
          ) : (
            <div className="text-center py-12 px-6">
              <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
                <span className="material-icons !text-2xl">search_off</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                No se encontraron resultados que coincidan con la búsqueda.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentListModal;
