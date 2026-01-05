import React, { useState } from 'react';
import useExecutiveReportData from '../../hooks/useExecutiveReportData';
import PrintableExecutiveReport from '../PrintableExecutiveReport';
import Loader from '../Loader';
import EmptyState from '../EmptyState';
import type { ReportType } from '../../types';

interface ExecutiveReportGeneratorProps {
  isTestingMode?: boolean;
}

const ExecutiveReportGenerator: React.FC<ExecutiveReportGeneratorProps> = ({ isTestingMode = false }) => {
    const [reportType, setReportType] = useState<ReportType | null>(null);
    const [isReportGenerated, setIsReportGenerated] = useState(false);

    const { data: reportData, isLoading, error } = useExecutiveReportData({ reportType, enabled: isReportGenerated, isTestingMode });

    const handleGenerateReport = (type: ReportType) => {
        setReportType(type);
        setIsReportGenerated(true);
    };
    
    return (
        <div className="space-y-6">
            <div className="no-print p-6 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-grow">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Seleccionar Reporte</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Elige el tipo de balance que deseas generar.</p>
                </div>
                <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                    <button onClick={() => handleGenerateReport('2024')} disabled={isLoading} className="w-full sm:w-auto bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold py-2.5 px-5 rounded-lg text-sm transition-colors shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-600">
                        Balance 2024
                    </button>
                    <button onClick={() => handleGenerateReport('2025')} disabled={isLoading} className="w-full sm:w-auto bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold py-2.5 px-5 rounded-lg text-sm transition-colors shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-600">
                        Balance 2025
                    </button>
                    <button onClick={() => handleGenerateReport('comparative')} disabled={isLoading} className="w-full sm:w-auto bg-blue-600 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition-colors shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-blue-700">
                        Comparativo 2024 vs 2025
                    </button>
                </div>
            </div>
            
            {isLoading && (
                 <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Loader />
                    <p className="mt-4 font-semibold text-slate-600 dark:text-slate-300">Generando reporte, esto puede tardar un momento...</p>
                 </div>
            )}

            {error && <EmptyState icon="error" title="Error al Generar Reporte" message={error.message} />}

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
