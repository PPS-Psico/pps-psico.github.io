
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/db';
import {
    FIELD_NOMBRE_INSTITUCIONES,
    FIELD_CONVENIO_NUEVO_INSTITUCIONES,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
    FIELD_TUTOR_INSTITUCIONES,
} from '../constants';
import { normalizeStringForComparison, parseToUTCDate } from '../utils/formatters';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Toast from './ui/Toast';

const getGroupName = (name: string | undefined): string => {
    if (!name) return 'Sin Nombre';
    return name.split(/\s*[-–—]\s*/)[0].trim();
};

interface ReportData {
    institucion: string;
    anioConvenio: string | number;
    orientaciones: string;
    tutor: string;
    lanzamientosCount: number;
    cuposTotal: number;
}

const fetchReportData = async (isTestingMode: boolean) => {
    if (isTestingMode) {
        return { instituciones: [], lanzamientos: [] };
    }
    const [institucionesRes, lanzamientosRes] = await Promise.all([
        db.instituciones.getAll({ fields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_CONVENIO_NUEVO_INSTITUCIONES, FIELD_TUTOR_INSTITUCIONES] }),
        db.lanzamientos.getAll({ fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS, FIELD_FECHA_INICIO_LANZAMIENTOS, FIELD_ORIENTACION_LANZAMIENTOS, FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] })
    ]);
    return { instituciones: institucionesRes, lanzamientos: lanzamientosRes };
};

const ActiveInstitutionsReport: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const { data, isLoading, error } = useQuery({
        queryKey: ['activeInstitutionsReportData', isTestingMode],
        queryFn: () => fetchReportData(isTestingMode),
    });

    const reportData = useMemo((): ReportData[] => {
        if (!data) return [];

        const currentYear = new Date().getFullYear();

        const launchesThisYearRaw = data.lanzamientos.filter(l => {
            const date = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            return date && date.getUTCFullYear() === currentYear;
        });

        const excludedInstitutions = [
            "relevamiento del ejercicio profesional",
            "jornada universitaria de salud mental"
        ];

        const launchesThisYear = launchesThisYearRaw.filter(launch => {
            const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (!ppsName) return true;
            const normalizedPpsName = normalizeStringForComparison(ppsName);
            return !excludedInstitutions.some(excluded => normalizedPpsName.includes(excluded));
        });

        const reportMap = new Map<string, ReportData>();

        launchesThisYear.forEach(launch => {
            const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            if (!ppsName) return;

            const groupName = getGroupName(ppsName);

            if (!reportMap.has(groupName)) {
                reportMap.set(groupName, {
                    institucion: groupName,
                    anioConvenio: '',
                    orientaciones: '',
                    tutor: 'No disponible',
                    lanzamientosCount: 0,
                    cuposTotal: 0,
                });
            }

            const entry = reportMap.get(groupName)!;
            entry.lanzamientosCount++;
            entry.cuposTotal += launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0;

            const orientacion = launch[FIELD_ORIENTACION_LANZAMIENTOS];
            if (orientacion && !entry.orientaciones.includes(orientacion)) {
                entry.orientaciones = entry.orientaciones ? `${entry.orientaciones}, ${orientacion}` : orientacion;
            }
        });

        reportMap.forEach(entry => {
            const normalizedBaseName = normalizeStringForComparison(entry.institucion);
            let foundTutor: string | undefined;
            let foundYear: string | number = '';

            for (const inst of data.instituciones) {
                const instName = inst[FIELD_NOMBRE_INSTITUCIONES];
                // Buscamos coincidencia flexible
                if (instName && normalizeStringForComparison(instName).startsWith(normalizedBaseName)) {
                    if (!foundTutor && inst[FIELD_TUTOR_INSTITUCIONES]) {
                        foundTutor = inst[FIELD_TUTOR_INSTITUCIONES];
                    }
                    // Si existe el valor y es numérico o string válido (no false/null)
                    if (inst[FIELD_CONVENIO_NUEVO_INSTITUCIONES]) {
                        foundYear = inst[FIELD_CONVENIO_NUEVO_INSTITUCIONES];
                    }
                }
            }

            entry.tutor = foundTutor || 'No disponible';
            entry.anioConvenio = foundYear || '-';
        });

        return Array.from(reportMap.values()).sort((a, b) => a.institucion.localeCompare(b.institucion));
    }, [data]);

    const handleDownload = async () => {
        if (reportData.length === 0) {
            setToastInfo({ message: 'No hay datos para exportar.', type: 'error' });
            return;
        }

        setIsGenerating(true);

        try {
            // Lazy load ExcelJS only when user clicks download
            const ExcelJS = (await import('exceljs')).default;

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Instituciones Activas');

            // Main Title
            const titleRow = worksheet.addRow([`Reporte de Instituciones Activas ${new Date().getFullYear()}`]);
            worksheet.mergeCells('A1:F1');
            titleRow.font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FF1E40AF' } };
            titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
            worksheet.getRow(1).height = 50;

            // Spacer
            worksheet.addRow([]);

            // Header Row
            const header = [
                'Institución',
                'Año del Convenio',
                'Orientación(es)',
                'Tutor Institucional',
                'Nº de Lanzamientos (año)',
                'Cupos Totales (año)',
            ];
            const headerRow = worksheet.addRow(header);
            headerRow.height = 45;
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF2563EB' }
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
                    left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
                    bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
                    right: { style: 'thin', color: { argb: 'FFBFDBFE' } }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            });

            // Data Rows
            reportData.forEach((row, index) => {
                const dataRow = worksheet.addRow([
                    row.institucion,
                    row.anioConvenio,
                    row.orientaciones,
                    row.tutor,
                    row.lanzamientosCount,
                    row.cuposTotal,
                ]);

                dataRow.height = 35;

                dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.font = { name: 'Calibri', size: 13 };
                    cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
                    cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };

                    if (index % 2 !== 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    }

                    // Colorear si el año es reciente (ej: actual o anterior)
                    if (colNumber === 2 && row.anioConvenio) {
                        const year = Number(row.anioConvenio);
                        if (!isNaN(year) && year >= 2024) {
                            cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF15803D' } };
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                        }
                    }

                    if ([2, 5, 6].includes(colNumber)) {
                        cell.alignment.horizontal = 'center';
                    }
                });
            });

            worksheet.columns = [
                { key: 'institucion', width: 60 },
                { key: 'anioConvenio', width: 25 },
                { key: 'orientaciones', width: 40 },
                { key: 'tutor', width: 35 },
                { key: 'lanzamientos', width: 22 },
                { key: 'cupos', width: 22 },
            ];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Reporte Instituciones Activas ${new Date().getFullYear()}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setToastInfo({ message: 'Reporte descargado exitosamente.', type: 'success' });
        } catch (e: any) {
            console.error('Failed to generate Excel file:', e);
            setToastInfo({ message: 'Ocurrió un error al generar el archivo Excel.', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader /></div>;
    if (error) return <EmptyState icon="error" title="Error" message={error.message} />;

    return (
        <div className="space-y-6">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Reporte de Instituciones Activas</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Instituciones con actividad durante {new Date().getFullYear()}.</p>
                </div>
                <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white font-bold text-sm py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    {isGenerating ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <span className="material-icons !text-base">download</span>}
                    Descargar Excel
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-bold">Institución</th>
                                <th className="px-6 py-3 font-bold text-center">Año Convenio</th>
                                <th className="px-6 py-3 font-bold">Orientación(es)</th>
                                <th className="px-6 py-3 font-bold">Tutor</th>
                                <th className="px-6 py-3 font-bold text-center">Lanzamientos</th>
                                <th className="px-6 py-3 font-bold text-center">Cupos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {reportData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{row.institucion}</td>
                                    <td className="px-6 py-3 text-center">
                                        {row.anioConvenio ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                {row.anioConvenio}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{row.orientaciones}</td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{row.tutor}</td>
                                    <td className="px-6 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{row.lanzamientosCount}</td>
                                    <td className="px-6 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{row.cuposTotal}</td>
                                </tr>
                            ))}
                            {reportData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                        No se encontraron datos para mostrar.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ActiveInstitutionsReport;
