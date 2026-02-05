import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";

interface ExcelViewerProps {
  url: string;
  onLoad?: () => void;
}

interface SheetData {
  name: string;
  data: string; // HTML table
  rowCount: number;
  colCount: number;
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({ url, onLoad }) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExcel = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch el archivo
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("No se pudo descargar el archivo");
        }

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        // Parsear con xlsx
        const workbook = XLSX.read(data, { type: "array" });

        const parsedSheets: SheetData[] = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          // Convertir a HTML table
          let html = '<table class="excel-table">';

          jsonData.forEach((row, rowIndex) => {
            html += "<tr>";
            row.forEach((cell) => {
              const tag = rowIndex === 0 ? "th" : "td";
              const value = cell !== undefined && cell !== null ? String(cell) : "";
              html += `<${tag}>${escapeHtml(value)}</${tag}>`;
            });
            html += "</tr>";
          });

          html += "</table>";

          return {
            name: sheetName,
            data: html,
            rowCount: jsonData.length,
            colCount: jsonData.length > 0 ? jsonData[0].length : 0,
          };
        });

        setSheets(parsedSheets);
        setIsLoading(false);
        onLoad?.();
      } catch (err: any) {
        setError(err.message || "Error al cargar el archivo Excel");
        setIsLoading(false);
      }
    };

    loadExcel();
  }, [url, onLoad]);

  function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white p-8">
        <span className="material-icons !text-6xl mb-4 text-red-400">error</span>
        <p className="text-lg mb-4">{error}</p>
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-bold transition-colors"
        >
          Descargar Excel
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {sheets.length > 1 && (
            <div className="flex gap-1">
              {sheets.map((sheet, index) => (
                <button
                  key={sheet.name}
                  onClick={() => setActiveSheet(index)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeSheet === index
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {sheets[activeSheet] && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {sheets[activeSheet].rowCount} filas × {sheets[activeSheet].colCount} columnas
          </div>
        )}
      </div>

      {/* Excel Content */}
      <div className="flex-grow overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-slate-300 dark:border-slate-600 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div
            className="excel-container p-4"
            dangerouslySetInnerHTML={{
              __html: sheets[activeSheet]?.data || "",
            }}
          />
        )}
      </div>

      <style>{`
        .excel-container table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .excel-container th,
        .excel-container td {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          text-align: left;
          white-space: nowrap;
        }
        .excel-container th {
          background-color: #f3f4f6;
          font-weight: 600;
          color: #374151;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .excel-container tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .excel-container tr:hover {
          background-color: #e5e7eb;
        }
        .dark .excel-container th {
          background-color: #1f2937;
          color: #f3f4f6;
          border-color: #374151;
        }
        .dark .excel-container td {
          border-color: #374151;
          color: #e5e7eb;
        }
        .dark .excel-container tr:nth-child(even) {
          background-color: #111827;
        }
        .dark .excel-container tr:hover {
          background-color: #1f2937;
        }
      `}</style>
    </div>
  );
};

export default ExcelViewer;
