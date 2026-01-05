import React from 'react';
import type { EstudianteFields, CriteriosCalculados, Practica } from '../../types';
import { 
  FIELD_NOMBRE_ESTUDIANTES, 
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
} from '../../constants';
import { formatDate } from '../../utils/formatters';

interface PrintableReportProps {
  studentDetails: EstudianteFields | null;
  criterios: CriteriosCalculados;
  practicas: Practica[];
}

const PrintableReport: React.FC<PrintableReportProps> = ({ studentDetails, criterios, practicas }) => {
  if (!studentDetails) {
    return (
      <div className="p-8 font-sans text-center">
        <p>Cargando datos del estudiante para el reporte...</p>
      </div>
    );
  }

  return (
    <div className="p-8 font-sans bg-white text-black">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .printable-section { break-inside: avoid; }
        }
      `}</style>
      <header className="mb-8 text-center border-b-2 border-gray-300 pb-4 printable-section">
        <h1 className="text-3xl font-bold text-gray-800">Reporte de Prácticas Profesionales Supervisadas</h1>
        <h2 className="text-xl mt-2 text-gray-700">{studentDetails[FIELD_NOMBRE_ESTUDIANTES]}</h2>
        <p className="text-sm text-gray-600">Legajo: {studentDetails[FIELD_LEGAJO_ESTUDIANTES]}</p>
      </header>

      <section className="mb-8 printable-section">
        <h3 className="text-xl font-bold mb-4 border-b border-gray-200 pb-2">Resumen de Criterios</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-4xl font-extrabold text-blue-600">{Math.round(criterios.horasTotales)}</p>
            <p className="text-sm text-gray-600">Horas Totales (de 250)</p>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-blue-600">{criterios.orientacionesCursadasCount}</p>
            <p className="text-sm text-gray-600">Rotaciones (de 3)</p>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-blue-600">{Math.round(criterios.horasOrientacionElegida)}</p>
            <p className="text-sm text-gray-600">Horas en Orientación (de 70)</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">Orientaciones cursadas: {criterios.orientacionesUnicas.join(', ') || 'N/A'}</p>
      </section>

      <section className="printable-section">
        <h3 className="text-xl font-bold mb-4 border-b border-gray-200 pb-2">Historial de Prácticas</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border border-gray-300">Institución</th>
              <th className="p-2 border border-gray-300">Especialidad</th>
              <th className="p-2 border border-gray-300">Período</th>
              <th className="p-2 border border-gray-300 text-right">Horas</th>
            </tr>
          </thead>
          <tbody>
            {practicas.length > 0 ? practicas.map((practica, index) => {
              const institucionRaw = practica[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
              const institucion = Array.isArray(institucionRaw) ? institucionRaw.join(', ') : institucionRaw;
              return (
                <tr key={practica.id || index} className="border-b border-gray-200">
                  <td className="p-2 border border-gray-300">{institucion || 'N/A'}</td>
                  <td className="p-2 border border-gray-300">{practica[FIELD_ESPECIALIDAD_PRACTICAS] || 'N/A'}</td>
                  <td className="p-2 border border-gray-300">{formatDate(practica[FIELD_FECHA_INICIO_PRACTICAS])} - {formatDate(practica[FIELD_FECHA_FIN_PRACTICAS])}</td>
                  <td className="p-2 border border-gray-300 text-right font-semibold">{practica[FIELD_HORAS_PRACTICAS] || 0}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500 border border-gray-300">No hay prácticas registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      
      <footer className="mt-12 text-center text-xs text-gray-500">
          <p>Reporte generado el {new Date().toLocaleDateString('es-ES')}. Este es un documento no oficial para seguimiento interno.</p>
      </footer>
    </div>
  );
};

export default PrintableReport;
