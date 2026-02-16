import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "../../lib/db";
import {
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_TELEFONO_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
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
        FIELD_FECHA_FIN_LANZAMIENTOS,
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
  const [isImporting, setIsImporting] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["gestionRelanzamientoReportData", isTestingMode],
    queryFn: () => fetchReportData(isTestingMode),
  });

  const reportData = useMemo((): ReportData[] => {
    if (!data) return [];

    // Incluir TODOS los lanzamientos del año pasado (2025) que hayan finalizado
    // Esto corresponde a lo que se ve en la sección de Gestión
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    const lanzamientosDelAnoPasado = data.lanzamientos.filter((l) => {
      const fechaFin = l[FIELD_FECHA_FIN_LANZAMIENTOS];
      if (!fechaFin) return false;
      const year = new Date(fechaFin).getFullYear();
      return year === lastYear || year === currentYear;
    });

    const reportMap = new Map<string, ReportData>();

    lanzamientosDelAnoPasado.forEach((launch) => {
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
      const lastYear = new Date().getFullYear() - 1;
      const titleRow = worksheet.addRow([`Listado de Instituciones Activas ${lastYear}`]);
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

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());

      const worksheet = workbook.getWorksheet("Gestión Relanzamiento");
      if (!worksheet) {
        setToastInfo({ message: "No se encontró la hoja 'Gestión Relanzamiento'", type: "error" });
        return;
      }

      const updates: { id: string; telefono: string }[] = [];
      let rowCount = 0;

      // Empezar desde la fila 6 (después del header)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < 6) return; // Skip headers

        const institucionName = row.getCell(1).value as string;
        const telefono = row.getCell(3).value as string;

        if (institucionName && telefono) {
          // Buscar la institución por nombre
          const normalizedName = normalizeStringForComparison(institucionName);
          const institucion = data?.instituciones.find(
            (inst) =>
              normalizeStringForComparison(inst[FIELD_NOMBRE_INSTITUCIONES] || "") ===
              normalizedName
          );

          if (institucion && institucion.id) {
            updates.push({ id: institucion.id, telefono: String(telefono) });
            rowCount++;
          }
        }
      });

      if (updates.length === 0) {
        setToastInfo({ message: "No se encontraron teléfonos para actualizar", type: "error" });
        return;
      }

      // Actualizar instituciones una por una
      let successCount = 0;
      for (const update of updates) {
        try {
          await db.instituciones.update(update.id, {
            [FIELD_TELEFONO_INSTITUCIONES]: update.telefono,
          });
          successCount++;
        } catch (err) {
          console.error(`Error updating institution ${update.id}:`, err);
        }
      }

      setToastInfo({
        message: `¡${successCount} de ${updates.length} teléfonos actualizados correctamente!`,
        type: "success",
      });
      refetch(); // Recargar datos
    } catch (e: any) {
      console.error("Error importing:", e);
      setToastInfo({ message: `Error al importar: ${e.message}`, type: "error" });
    } finally {
      setIsImporting(false);
      event.target.value = ""; // Reset input
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
            <h2 className="text-2xl font-bold">Todas las Instituciones</h2>
            <p className="text-blue-100">
              Listado completo de instituciones activas del año pasado
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Instituciones Activas</h3>
            <p className="text-slate-500 text-sm mt-1">
              Total: {reportData.length} instituciones del año {new Date().getFullYear() - 1}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
              id="import-phones"
              disabled={isImporting}
            />
            <label
              htmlFor="import-phones"
              className={`flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200 transition-all transform hover:scale-105 active:scale-95 cursor-pointer ${isImporting ? "opacity-50" : ""}`}
            >
              {isImporting ? (
                <>
                  <span className="material-icons animate-spin">refresh</span>
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <span className="material-icons">upload_file</span>
                  <span>Importar Excel</span>
                </>
              )}
            </label>
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
            message="No se encontraron instituciones del año pasado."
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
