import React, { useMemo, useState } from "react";
import useExecutiveReportData from "../../hooks/useExecutiveReportData";
import { useMetricsYears } from "../../hooks/useMetricsData";
import PrintableExecutiveReport from "../PrintableExecutiveReport";
import Loader from "../Loader";
import EmptyState from "../EmptyState";
import type { ReportMode, ReportSelection } from "../../types";

interface ExecutiveReportGeneratorProps {
  isTestingMode?: boolean;
}

const ExecutiveReportGenerator: React.FC<ExecutiveReportGeneratorProps> = ({
  isTestingMode = false,
}) => {
  const currentYear = new Date().getFullYear();
  const { data: availableYears } = useMetricsYears(isTestingMode);

  // Conjunto de años elegibles: los que devuelve el RPC + el año actual como
  // mínimo, ordenados de más reciente a más antiguo.
  const years = useMemo(() => {
    const set = new Set<number>(availableYears && availableYears.length ? availableYears : []);
    set.add(currentYear);
    set.add(currentYear - 1);
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, currentYear]);

  const [mode, setMode] = useState<ReportMode>("single");
  const [year, setYear] = useState<number>(currentYear);
  const [compareYear, setCompareYear] = useState<number>(currentYear - 1);
  const [selection, setSelection] = useState<ReportSelection | null>(null);

  const {
    data: reportData,
    isLoading,
    error,
  } = useExecutiveReportData({ selection, enabled: !!selection, isTestingMode });

  const handleGenerate = () => {
    setSelection(
      mode === "single" ? { mode: "single", year } : { mode: "comparative", year, compareYear }
    );
  };

  const segBtn = (active: boolean) =>
    `flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
      active
        ? "bg-blue-600 text-white shadow-md"
        : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
    }`;

  const yearSelectClasses =
    "px-3 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    <div className="space-y-6">
      <div className="no-print p-6 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Balance de Prácticas Profesionales
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Estadísticas duras del ciclo. Elegí un año para el balance anual o compará dos ciclos.
          </p>
        </div>

        {/* Selector de modo */}
        <div className="flex gap-2">
          <button onClick={() => setMode("single")} className={segBtn(mode === "single")}>
            Balance anual
          </button>
          <button onClick={() => setMode("comparative")} className={segBtn(mode === "comparative")}>
            Comparativo
          </button>
        </div>

        {/* Selectores de año */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {mode === "single" ? "Año del balance" : "Año principal"}
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={yearSelectClasses}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {mode === "comparative" && (
            <>
              <span className="hidden sm:block pb-2.5 text-slate-400 font-bold">vs</span>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Comparar contra
                </label>
                <select
                  value={compareYear}
                  onChange={(e) => setCompareYear(Number(e.target.value))}
                  className={yearSelectClasses}
                >
                  {years
                    .filter((y) => y !== year)
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading || (mode === "comparative" && year === compareYear)}
            className="sm:ml-auto inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            <span className="material-icons !text-base">summarize</span>
            Generar reporte
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Loader />
          <p className="mt-4 font-semibold text-slate-600 dark:text-slate-300">
            Generando reporte, esto puede tardar un momento...
          </p>
        </div>
      )}

      {error && (
        <EmptyState icon="error" title="Error al Generar Reporte" message={error.message} />
      )}

      {reportData && !isLoading && (
        <>
          <div className="no-print flex justify-end">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-slate-700 text-white font-bold text-sm py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons !text-base">print</span>
              Imprimir / Guardar PDF
            </button>
          </div>
          <div className="print-only">
            <PrintableExecutiveReport data={reportData} />
          </div>
          <div className="no-print mt-4 border border-slate-200/60 rounded-xl shadow-lg p-1">
            <div className="h-[800px] overflow-auto">
              <PrintableExecutiveReport data={reportData} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExecutiveReportGenerator;
