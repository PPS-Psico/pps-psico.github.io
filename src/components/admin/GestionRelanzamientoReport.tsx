import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "../../lib/db";
import {
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_TELEFONO_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
} from "../../constants";
import { normalizeStringForComparison } from "../../utils/formatters";
import Loader from "../Loader";
import EmptyState from "../EmptyState";
import Toast from "../ui/Toast";

interface ReportData {
  institucion: string;
  orientacion: string;
  telefono: string;
}

const fetchReportData = async (isTestingMode: boolean) => {
  if (isTestingMode) {
    return { instituciones: [], lanzamientos: [] };
  }
  const [institucionesRes, lanzamientosRes] = await Promise.all([
    db.instituciones.getAll({
      fields: [FIELD_NOMBRE_INSTITUCIONES, FIELD_TELEFONO_INSTITUCIONES],
    }),
    db.lanzamientos.getAll({
      fields: [
        FIELD_NOMBRE_PPS_LANZAMIENTOS,
        FIELD_ORIENTACION_LANZAMIENTOS,
        FIELD_ESTADO_GESTION_LANZAMIENTOS,
        "institucion_id",
      ],
    }),
  ]);
  return { instituciones: institucionesRes, lanzamientos: lanzamientosRes };
};

const GestionRelanzamientoReport: React.FC<{ isTestingMode?: boolean }> = ({
  isTestingMode = false,
}) => {
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["gestionRelanzamientoReportData", isTestingMode],
    queryFn: () => fetchReportData(isTestingMode),
  });

  const reportData = useMemo((): ReportData[] => {
    if (!data) return [];

    // Filtrar lanzamientos que están en gestión de relanzamiento
    const lanzamientosEnGestion = data.lanzamientos.filter((l) => {
      const estadoGestion = l[FIELD_ESTADO_GESTION_LANZAMIENTOS];
      return estadoGestion && estadoGestion !== "Archivado" && estadoGestion !== "No se relanza";
    });

    const reportMap = new Map<string, ReportData>();

    lanzamientosEnGestion.forEach((launch) => {
      const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
      if (!ppsName) return;

      const groupName = ppsName.split(/\s*[-–—]\s*/)[0].trim();

      // Buscar el teléfono de la institución
      const institucionId = launch.institucion_id;
      let telefono = "";

      if (institucionId) {
        const inst = data.instituciones.find((i) => i.id === institucionId);
        if (inst) {
          telefono = inst[FIELD_TELEFONO_INSTITUCIONES] || "";
        }
      }

      // Si no encontramos por ID, buscar por nombre
      if (!telefono) {
        const normalizedBaseName = normalizeStringForComparison(groupName);
        for (const inst of data.instituciones) {
          const instName = inst[FIELD_NOMBRE_INSTITUCIONES];
          if (instName && normalizeStringForComparison(instName).includes(normalizedBaseName)) {
            telefono = inst[FIELD_TELEFONO_INSTITUCIONES] || "";
            break;
          }
        }
      }

      if (!reportMap.has(groupName)) {
        reportMap.set(groupName, {
          institucion: groupName,
          orientacion: launch[FIELD_ORIENTACION_LANZAMIENTOS] || "",
          telefono: telefono,
        });
      }
    });

    return Array.from(reportMap.values()).sort((a, b) =>
      a.institucion.localeCompare(b.institucion)
    );
  }, [data]);

  const handleDownload = async () => {
    if (reportData.length === 0) {
      setToastInfo({ message: "No hay datos para exportar.", type: "error" });
      return;
    }

    setIsGenerating(true);

    try {
      const ExcelJS = (await import("exceljs")).default;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Gestión Relanzamiento");

      // Título
      const titleRow = worksheet.addRow([
        "Listado de Instituciones - Gestión de Relanzamiento 2026",
      ]);
      worksheet.mergeCells("A1:C1");
      titleRow.font = { name: "Calibri", size: 24, bold: true, color: { argb: "FF1E40AF" } };
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 50;

      // Spacer
      worksheet.addRow([]);

      // Instrucciones
      const instrRow = worksheet.addRow(["Completar los teléfonos faltantes para contacto"]);
      worksheet.mergeCells("A3:C3");
      instrRow.font = { name: "Calibri", size: 12, italic: true, color: { argb: "FF64748B" } };
      instrRow.alignment = { horizontal: "center" };

      // Spacer
      worksheet.addRow([]);

      // Header
      const header = ["Institución", "Orientación", "Teléfono de Contacto"];
      const headerRow = worksheet.addRow(header);
      headerRow.height = 40;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFBFDBFE" } },
          left: { style: "thin", color: { argb: "FFBFDBFE" } },
          bottom: { style: "thin", color: { argb: "FFBFDBFE" } },
          right: { style: "thin", color: { argb: "FFBFDBFE" } },
        };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      });

      // Datos
      reportData.forEach((row, index) => {
        const dataRow = worksheet.addRow([row.institucion, row.orientacion, row.telefono]);

        dataRow.height = 30;

        dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: "Calibri", size: 13 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
          cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };

          if (index % 2 !== 0) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          }

          // Si no hay teléfono, resaltar en amarillo
          if (colNumber === 3 && !row.telefono) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          }
        });
      });

      worksheet.columns = [
        { key: "institucion", width: 50 },
        { key: "orientacion", width: 30 },
        { key: "telefono", width: 25 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Instituciones_Gestion_Relanzamiento_${new Date().getFullYear()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToastInfo({ message: "Reporte descargado exitosamente.", type: "success" });
    } catch (e: any) {
      console.error("Failed to generate Excel file:", e);
      setToastInfo({ message: "Ocurrió un error al generar el archivo Excel.", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) return <Loader />;

  if (error) {
    return (
      <EmptyState
        icon="error"
        title="Error al cargar datos"
        message="No se pudieron cargar los datos para el reporte."
      />
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center gap-3">
          <span className="material-icons text-4xl">phone_in_talk</span>
          <div>
            <h2 className="text-2xl font-bold">Gestión de Relanzamiento</h2>
            <p className="text-blue-100">Listado de instituciones con teléfonos de contacto</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Instituciones en Gestión</h3>
            <p className="text-slate-500 text-sm mt-1">
              Total: {reportData.length} instituciones para relanzamiento 2026
            </p>
          </div>
          <button
            onClick={handleDownload}
            disabled={isGenerating || reportData.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all transform hover:scale-105 active:scale-95 disabled:transform-none"
          >
            {isGenerating ? (
              <>
                <span className="material-icons animate-spin">refresh</span>
                <span>Generando...</span>
              </>
            ) : (
              <>
                <span className="material-icons">download</span>
                <span>Descargar Excel</span>
              </>
            )}
          </button>
        </div>

        {reportData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Institución</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Orientación</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {reportData.slice(0, 10).map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-800 font-medium">{row.institucion}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {row.orientacion || "N/A"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {row.telefono ? (
                        <span className="text-slate-700">{row.telefono}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                          <span className="material-icons !text-xs">warning</span>
                          Falta completar
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {reportData.length > 10 && (
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-center text-slate-400 text-sm">
                      ... y {reportData.length - 10} instituciones más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="inbox"
            title="No hay instituciones"
            message="No se encontraron instituciones en gestión de relanzamiento."
          />
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-start gap-3">
            <span className="material-icons text-blue-600">info</span>
            <div>
              <h4 className="font-bold text-blue-900 text-sm">Instrucciones</h4>
              <p className="text-blue-700 text-sm mt-1">
                Descarga el Excel y compártelo con los jefes de área para que completen los
                teléfonos faltantes. Las celdas vacías están resaltadas en amarillo para facilitar
                la identificación.
              </p>
            </div>
          </div>
        </div>
      </div>

      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}
    </div>
  );
};

export default GestionRelanzamientoReport;
