import React, { useState, useMemo } from "react";
import type { FlatCorreccionStudent } from "../types";
import EmptyState from "./EmptyState";
import { formatDate } from "../utils/formatters";

interface CorreccionRapidaViewProps {
  students: FlatCorreccionStudent[];
  onNotaChange: (student: FlatCorreccionStudent, newNota: string) => Promise<void>;
  updatingNotaId: string | null;
  searchTerm: string;
}

const NOTA_OPTIONS = [
  "Sin calificar",
  "Entregado (sin corregir)",
  "No Entregado",
  "Desaprobado",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

const HighlightedText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-400/50 dark:text-yellow-900 rounded px-1"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const SortableHeader: React.FC<{
  label: string;
  sortKey: string;
  sortConfig: { key: string; direction: "ascending" | "descending" };
  requestSort: (key: string) => void;
  className?: string;
}> = ({ label, sortKey, sortConfig, requestSort, className = "text-left" }) => {
  const isActive = sortConfig.key === sortKey;
  const icon = isActive
    ? sortConfig.direction === "ascending"
      ? "arrow_upward"
      : "arrow_downward"
    : "unfold_more";

  return (
    <th
      className={`p-3 cursor-pointer select-none group transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-700/50 ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <span
          className={`material-icons !text-base transition-opacity ${isActive ? "opacity-90 text-slate-800 dark:text-slate-200" : "opacity-40 group-hover:opacity-70"}`}
        >
          {icon}
        </span>
      </div>
    </th>
  );
};

const CorreccionRapidaView: React.FC<CorreccionRapidaViewProps> = ({
  students,
  onNotaChange,
  updatingNotaId,
  searchTerm,
}) => {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  }>({ key: "correctionDeadline", direction: "ascending" });
  const [justUpdatedPracticaId, setJustUpdatedPracticaId] = useState<string | null>(null);

  const handleNotaChange = async (student: FlatCorreccionStudent, newNota: string) => {
    await onNotaChange(student, newNota);
    setJustUpdatedPracticaId(student.practicaId || null);
    setTimeout(() => setJustUpdatedPracticaId(null), 1500);
  };

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedStudents = useMemo(() => {
    const sortableItems = [...students];
    sortableItems.sort((a, b) => {
      const getVal = (item: FlatCorreccionStudent, key: string) => {
        switch (key) {
          case "correctionDeadline":
            return item.correctionDeadline ? new Date(item.correctionDeadline).getTime() : Infinity;
          case "studentName":
            return item.studentName.toLowerCase();
          case "ppsName":
            return (item.ppsName ?? "").toLowerCase();
          default:
            return 0;
        }
      };

      const aValue = getVal(a, sortConfig.key);
      const bValue = getVal(b, sortConfig.key);

      if (aValue < bValue) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
    return sortableItems;
  }, [students, sortConfig]);

  const getDeadlineVisuals = (deadlineString?: string) => {
    if (!deadlineString)
      return { text: "Sin fecha de fin", className: "text-slate-500 dark:text-slate-400 italic" };

    const deadline = new Date(deadlineString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 3600 * 24));

    let className = "text-slate-700 dark:text-slate-300";
    if (diffDays < 0) {
      className = "font-bold text-red-600 dark:text-red-400";
    } else if (diffDays <= 7) {
      className = "font-semibold text-amber-600 dark:text-amber-400";
    }
    return { text: formatDate(deadlineString), className };
  };

  if (students.length === 0) {
    return (
      <EmptyState
        icon="task_alt"
        title="Todo Corregido"
        message="No hay informes pendientes de corrección que coincidan con los filtros actuales."
      />
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden animate-fade-in-up">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50/70 dark:bg-slate-900/50">
            <tr>
              <SortableHeader
                label="Alumno"
                sortKey="studentName"
                sortConfig={sortConfig}
                requestSort={requestSort}
              />
              <SortableHeader
                label="Institución"
                sortKey="ppsName"
                sortConfig={sortConfig}
                requestSort={requestSort}
              />
              <SortableHeader
                label="Límite Corrección"
                sortKey="correctionDeadline"
                sortConfig={sortConfig}
                requestSort={requestSort}
              />
              <th className="p-3 text-left font-semibold text-slate-500 dark:text-slate-400 w-56">
                Nota
              </th>
              <th className="p-3 text-center font-semibold text-slate-500 dark:text-slate-400">
                Campus
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700">
            {sortedStudents.map((student) => {
              const deadlineVisuals = getDeadlineVisuals(student.correctionDeadline);
              const isSaving =
                updatingNotaId === student.practicaId ||
                (!student.practicaId && updatingNotaId === `creating-${student.studentId}`);
              return (
                <tr
                  key={student.convocatoriaId}
                  className={`transition-colors duration-1000 ${justUpdatedPracticaId === student.practicaId ? "bg-green-100 dark:bg-green-900/30" : "hover:bg-slate-50/50 dark:hover:bg-slate-700/50"}`}
                >
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-100">
                    <HighlightedText text={student.studentName} highlight={searchTerm} />
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">
                    <HighlightedText text={student.ppsName ?? ""} highlight={searchTerm} />
                  </td>
                  <td className={`p-3 ${deadlineVisuals.className}`}>{deadlineVisuals.text}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="relative w-full max-w-[150px]">
                        <select
                          value={student.nota || "Sin calificar"}
                          onChange={(e) => handleNotaChange(student, e.target.value)}
                          disabled={isSaving}
                          className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 p-2 bg-white dark:bg-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 text-slate-800 dark:text-slate-200 cursor-pointer appearance-none pr-8"
                          aria-label={`Nota para ${student.studentName} en ${student.ppsName}`}
                        >
                          {NOTA_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
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
                        <span
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in-up"
                          style={{ animationDuration: "300ms" }}
                        >
                          Guardado ✓
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {student.informeLink && (
                      <a
                        href={student.informeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center p-2 rounded-full text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                        title="Ir a la tarea en el campus"
                      >
                        <span className="material-icons !text-base">launch</span>
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CorreccionRapidaView;
