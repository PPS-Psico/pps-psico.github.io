import React, { useMemo, useState } from 'react';
import type { InformeCorreccionPPS, InformeCorreccionStudent } from '../types';
import Checkbox from './ui/Checkbox';
import { formatDate, parseToUTCDate } from '../utils/formatters';

const NOTA_OPTIONS = ['Sin calificar', 'Entregado (sin corregir)', 'No Entregado', 'Desaprobado', '4', '5', '6', '7', '8', '9', '10'];

interface InformeCorreccionCardProps {
  ppsGroup: InformeCorreccionPPS;
  onNotaChange: (student: InformeCorreccionStudent, newNota: string) => Promise<void>;
  updatingNotaId: string | null;
  // Batch update props
  selectedStudents: Set<string>;
  onSelectionChange: (practicaId: string) => void;
  onSelectAll: (practicaIds: string[], select: boolean) => void;
  onBatchUpdate: (newNota: string) => Promise<void>;
  isBatchUpdating: boolean;
  searchTerm: string;
}

const HighlightedName: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-400/50 dark:text-yellow-900 rounded px-1">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const InformeCorreccionCard: React.FC<InformeCorreccionCardProps> = ({
  ppsGroup,
  onNotaChange,
  updatingNotaId,
  selectedStudents,
  onSelectionChange,
  onSelectAll,
  onBatchUpdate,
  isBatchUpdating,
  searchTerm,
}) => {
  const { ppsName, orientacion, students, informeLink } = ppsGroup;
  const [batchNota, setBatchNota] = useState('10');
  const [justUpdatedPracticaId, setJustUpdatedPracticaId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const qualifiableStudents = students.filter(s => !!s.practicaId);
    const totalStudents = students.length;
    const corregidos = students.filter(s => s.nota && s.nota !== 'Sin calificar' && s.nota !== 'Entregado (sin corregir)').length;
    const isAllSelected = qualifiableStudents.length > 0 && qualifiableStudents.every(s => s.practicaId && selectedStudents.has(s.practicaId));
    return { totalStudents, corregidos, isAllSelected, qualifiableStudents };
  }, [students, selectedStudents]);

  const correctionDeadlineInfo = useMemo(() => {
    const studentWithEarliestDeadline = students
      .filter(s => s.informeSubido && (s.nota === 'Sin calificar' || s.nota === 'Entregado (sin corregir)'))
      .map(s => {
        const baseDateString = s.fechaEntregaInforme || s.fechaFinalizacionPPS;
        if (!baseDateString) return null;
        const baseDate = parseToUTCDate(baseDateString);
        if (!baseDate) return null;
        const deadline = new Date(baseDate);
        deadline.setDate(deadline.getDate() + 30);
        return deadline;
      })
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (!studentWithEarliestDeadline) return null;

    const deadline = studentWithEarliestDeadline;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 3600 * 24));

    let className = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    if (diffDays < 0) {
      className = 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200';
    } else if (diffDays <= 7) {
      className = 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200';
    }
    return { date: deadline, className, icon: 'alarm' };
  }, [students]);


  const handleNotaChange = async (student: InformeCorreccionStudent, newNota: string) => {
    await onNotaChange(student, newNota);
    setJustUpdatedPracticaId(student.practicaId || null);
    setTimeout(() => setJustUpdatedPracticaId(null), 1500);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    const allPracticaIds = stats.qualifiableStudents.map(s => s.practicaId).filter((id): id is string => !!id);
    onSelectAll(allPracticaIds, isChecked);
  };

  const handleBatchUpdateClick = async () => {
    if (selectedStudents.size > 0) {
      await onBatchUpdate(batchNota);
    }
  };

  return (
    <details className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all duration-300 open:shadow-lg open:border-blue-200 dark:open:border-blue-900 group" open>
      <summary className="p-4 cursor-pointer flex justify-between items-center list-none hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-t-xl transition-colors">
        <div className="flex-grow">
          <h4 className="font-bold text-slate-800 dark:text-slate-100 group-open:text-blue-700 dark:group-open:text-blue-300">{ppsName}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">{orientacion}</p>
          {correctionDeadlineInfo && (
            <p className={`text-xs font-semibold px-2 py-1 rounded-md inline-flex items-center gap-1 mt-2 ${correctionDeadlineInfo.className}`}>
              <span className="material-icons !text-sm">{correctionDeadlineInfo.icon}</span>
              <span>
                Límite de corrección: {formatDate(correctionDeadlineInfo.date.toISOString())}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {informeLink && (
            <a
              href={informeLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hidden sm:inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold text-xs py-2 px-3 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              aria-label={`Ir a la tarea del campus para ${ppsName}`}
            >
              <span className="material-icons !text-base">launch</span>
              <span>Ir al Campus</span>
            </a>
          )}
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
            {stats.corregidos} / {stats.totalStudents} Corregidos
          </div>
          <div className="text-slate-400 dark:text-slate-500 transition-transform duration-300 group-open:rotate-180">
            <span className="material-icons">expand_more</span>
          </div>
        </div>
      </summary>

      {/* Batch Actions */}
      {selectedStudents.size > 0 && (
        <div className="border-t border-b border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/20 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in-up">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            {selectedStudents.size} alumno{selectedStudents.size > 1 ? 's' : ''} seleccionado{selectedStudents.size > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={batchNota}
              onChange={(e) => setBatchNota(e.target.value)}
              className="text-sm rounded-lg border border-slate-300/80 dark:border-slate-600 p-2 bg-white dark:bg-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              aria-label="Seleccionar nota para el lote"
            >
              {NOTA_OPTIONS.filter(o => o !== 'Sin calificar' && o !== 'No Entregado' && o !== 'Entregado (sin corregir)').map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button
              onClick={handleBatchUpdateClick}
              disabled={isBatchUpdating}
              className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-md hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2"
            >
              {isBatchUpdating ? (
                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-icons !text-base">done_all</span>
              )}
              <span>Aplicar</span>
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50">
              <tr>
                <th className="p-3 w-12 text-center">
                  <Checkbox
                    id={`select-all-${ppsGroup.lanzamientoId}`}
                    name="selectAll"
                    checked={stats.isAllSelected}
                    onChange={handleSelectAll}
                    label=""
                    disabled={stats.qualifiableStudents.length === 0}
                  />
                </th>
                <th className="p-3 text-left font-semibold text-slate-500 dark:text-slate-400">Alumno</th>
                <th className="p-3 text-left font-semibold text-slate-500 dark:text-slate-400 w-56">Nota</th>
                <th className="p-3 text-center font-semibold text-slate-500 dark:text-slate-400">Informe Subido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700">
              {students.map(student => {
                const isSelected = student.practicaId ? selectedStudents.has(student.practicaId) : false;
                const isSaving = updatingNotaId === student.practicaId || (!student.practicaId && updatingNotaId === `creating-${student.studentId}`);
                return (
                  <tr key={student.studentId} className={`transition-colors duration-1000 ${justUpdatedPracticaId === student.practicaId ? 'bg-green-100 dark:bg-green-900/30' : (isSelected ? 'bg-blue-50/50 dark:bg-blue-900/30' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50')}`}>
                    <td className="p-3 text-center">
                      {student.practicaId && (
                        <Checkbox
                          id={`select-${student.practicaId}`}
                          name="selectStudent"
                          checked={isSelected}
                          onChange={() => onSelectionChange(student.practicaId!)}
                          label=""
                        />
                      )}
                    </td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-100">
                      <HighlightedName text={student.studentName} highlight={searchTerm} />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-full max-w-[150px]">
                          <select
                            value={student.nota || 'Sin calificar'}
                            onChange={(e) => handleNotaChange(student, e.target.value)}
                            disabled={isSaving}
                            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 p-2 bg-white dark:bg-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 text-slate-800 dark:text-slate-200 cursor-pointer appearance-none pr-8"
                            aria-label={`Nota para ${student.studentName}`}
                          >
                            {NOTA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500 dark:text-slate-400">
                            {isSaving ? (
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <span className="material-icons !text-lg">expand_more</span>
                            )}
                          </div>
                        </div>
                        {justUpdatedPracticaId === student.practicaId && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in-up" style={{ animationDuration: '300ms' }}>
                            Guardado ✓
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {student.informeSubido ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full" title="Informe subido por el alumno">
                          <span className="material-icons !text-sm">check</span>
                          <span>Sí</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 text-xs font-semibold px-2.5 py-1 rounded-full" title="Informe no subido o marcado como 'No Entregado'">
                          <span className="material-icons !text-sm">close</span>
                          <span>No</span>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
};

export default InformeCorreccionCard;
