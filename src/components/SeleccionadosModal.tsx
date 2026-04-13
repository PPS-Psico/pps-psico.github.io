import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { GroupedSeleccionados, SelectedStudent } from "../types";
import EmptyState from "./EmptyState";

interface SeleccionadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  seleccionados: GroupedSeleccionados | null;
  convocatoriaName: string;
  simpleMode?: boolean;
}

type StatusFilter = "all" | "confirmed" | "pending";

const isConfirmed = (student: SelectedStudent) =>
  (student.compromisoEstado || "").toLowerCase() === "aceptado";

const formatAcceptedAt = (acceptedAt?: string | null) => {
  if (!acceptedAt) return "";

  const date = new Date(acceptedAt);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CommitmentBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  if ((status || "").toLowerCase() === "aceptado") {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        Confirmado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
      Pendiente
    </span>
  );
};

const FilterChip: React.FC<{
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}> = ({ active, label, count, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all ${
      active
        ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
    }`}
  >
    <span>{label}</span>
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
        active
          ? "bg-white/20 text-white dark:bg-slate-200 dark:text-slate-900"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {count}
    </span>
  </button>
);

const StudentListItem: React.FC<{ student: SelectedStudent; simpleMode?: boolean }> = ({
  student,
  simpleMode,
}) => (
  <motion.li
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
  >
    <div className="flex items-center gap-4 min-w-0">
      <div
        className={`
            w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shadow-sm transform transition-transform group-hover:scale-110
            ${
              student.nombre === "Nombre Desconocido"
                ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30"
            }
        `}
      >
        {student.nombre.charAt(0).toUpperCase()}
      </div>
      <div className="flex flex-col min-w-0">
        <span
          className={`font-bold text-sm truncate ${student.nombre === "Nombre Desconocido" ? "text-slate-400 italic" : "text-slate-800 dark:text-slate-100"}`}
        >
          {student.nombre}
        </span>
        {!simpleMode && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 sm:hidden">
              {student.legajo}
            </span>
            <CommitmentBadge status={student.compromisoEstado} />
            {isConfirmed(student) && student.compromisoFecha && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                <span className="material-icons !text-[12px]">schedule</span>
                {formatAcceptedAt(student.compromisoFecha)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>

    {!simpleMode ? (
      <div className="hidden sm:flex items-center gap-3">
        {isConfirmed(student) && student.compromisoFecha && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <span className="material-icons !text-[12px]">schedule</span>
            {formatAcceptedAt(student.compromisoFecha)}
          </span>
        )}
        <CommitmentBadge status={student.compromisoEstado} />
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
          {student.legajo}
        </span>
      </div>
    ) : (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
        {student.legajo}
      </span>
    )}
  </motion.li>
);

const SeleccionadosModal: React.FC<SeleccionadosModalProps> = ({
  isOpen,
  onClose,
  seleccionados,
  convocatoriaName,
  simpleMode = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setSearchTerm("");
      setStatusFilter("all");
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const totalCount: number = seleccionados
    ? (Object.values(seleccionados) as SelectedStudent[][]).reduce(
        (acc, curr) => acc + curr.length,
        0
      )
    : 0;

  const confirmationStats = useMemo(() => {
    const allStudents = seleccionados
      ? (Object.values(seleccionados) as SelectedStudent[][]).flat()
      : [];

    const confirmed = allStudents.filter(isConfirmed).length;

    return {
      confirmed,
      pending: Math.max(totalCount - confirmed, 0),
    };
  }, [seleccionados, totalCount]);

  const filteredData = useMemo(() => {
    if (!seleccionados) return null;

    const lowerTerm = searchTerm.toLowerCase();
    const filtered: GroupedSeleccionados = {};
    let hasResults = false;

    Object.entries(seleccionados).forEach(([horario, students]) => {
      const matchingStudents = (students as SelectedStudent[]).filter((student) => {
        const matchesSearch =
          !searchTerm ||
          student.nombre.toLowerCase().includes(lowerTerm) ||
          student.legajo.toLowerCase().includes(lowerTerm);

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "confirmed" && isConfirmed(student)) ||
          (statusFilter === "pending" && !isConfirmed(student));

        return matchesSearch && matchesStatus;
      });

      if (matchingStudents.length > 0) {
        filtered[horario] = matchingStudents;
        hasResults = true;
      }
    });

    return hasResults ? filtered : null;
  }, [seleccionados, searchTerm, statusFilter]);

  const visibleCount = filteredData
    ? (Object.values(filteredData) as SelectedStudent[][]).reduce(
        (acc, curr) => acc + curr.length,
        0
      )
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
            className="relative w-[95vw] max-h-[85dvh] sm:w-full sm:max-w-2xl sm:max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <div className="flex-shrink-0 px-6 py-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 z-10">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                      Resultados Oficiales
                    </p>
                    {totalCount > 0 && (
                      <span className="inline-flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
                        {totalCount}
                      </span>
                    )}
                  </div>
                  <h2
                    className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate"
                    title={convocatoriaName}
                  >
                    {convocatoriaName}
                  </h2>
                  {totalCount > 0 && !simpleMode && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900">
                        <span className="material-icons !text-sm">verified</span>
                        {confirmationStats.confirmed} confirmados
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900">
                        <span className="material-icons !text-sm">pending_actions</span>
                        {confirmationStats.pending} pendientes
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border ${
                          confirmationStats.pending === 0
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900"
                            : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700"
                        }`}
                      >
                        <span className="material-icons !text-sm">
                          {confirmationStats.pending === 0 ? "task_alt" : "hourglass_top"}
                        </span>
                        {confirmationStats.pending === 0
                          ? "Lista para iniciar"
                          : `Faltan ${confirmationStats.pending}`}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <span className="material-icons !text-xl">close</span>
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {!simpleMode && (
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      active={statusFilter === "all"}
                      label="Todos"
                      count={totalCount}
                      onClick={() => setStatusFilter("all")}
                    />
                    <FilterChip
                      active={statusFilter === "confirmed"}
                      label="Confirmados"
                      count={confirmationStats.confirmed}
                      onClick={() => setStatusFilter("confirmed")}
                    />
                    <FilterChip
                      active={statusFilter === "pending"}
                      label="Pendientes"
                      count={confirmationStats.pending}
                      onClick={() => setStatusFilter("pending")}
                    />
                  </div>
                )}

                {!simpleMode && (totalCount >= 20 || statusFilter !== "all") && (
                  <div className="relative animate-fade-in">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 !text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar por alumno o legajo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                )}

                {!simpleMode && statusFilter !== "all" && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mostrando {visibleCount} alumno{visibleCount === 1 ? "" : "s"} con filtro{" "}
                    {statusFilter === "confirmed" ? "confirmados" : "pendientes"}.
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-grow custom-scrollbar bg-slate-50/30 dark:bg-black/20">
              {!filteredData ? (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-60">
                  <span className="material-icons !text-4xl text-slate-300 mb-2">
                    person_search
                  </span>
                  <p className="text-sm font-medium text-slate-500">
                    No se encontraron resultados para tu búsqueda.
                  </p>
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
                      {horario !== "No especificado" && (
                        <div className="flex items-center gap-2 mb-3 py-1 z-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            {horario}
                          </h3>
                          <div className="flex-grow border-b border-slate-200 dark:border-slate-800 ml-2"></div>
                          <span className="text-[10px] font-bold text-slate-400">
                            {(students as SelectedStudent[]).length}
                          </span>
                        </div>
                      )}
                      <ul className="space-y-3">
                        <AnimatePresence>
                          {(students as SelectedStudent[]).map((student) => (
                            <StudentListItem
                              key={`${student.legajo}-${horario}`}
                              student={student}
                              simpleMode={simpleMode}
                            />
                          ))}
                        </AnimatePresence>
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
