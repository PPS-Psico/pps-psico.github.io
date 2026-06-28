import React from "react";
import type {
  AnyReportData,
  ExecutiveReportData,
  ComparativeExecutiveReportData,
  TimelineMonthData,
  PPSRequestSummary,
  NewAgreementDetail,
} from "../types";
import DOMPurify from "dompurify";
import { normalizeStringForComparison } from "../utils/formatters";

const PrintableTimeline: React.FC<{ launchesByMonth: TimelineMonthData[]; year: number }> = ({
  launchesByMonth,
  year,
}) => {
  if (launchesByMonth.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic dark:text-slate-400">
        No hay lanzamientos registrados para este período.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {launchesByMonth.map((month) => (
        <div key={month.monthName} className="printable-section">
          <h4 className="font-bold text-base bg-slate-100 dark:bg-slate-800 dark:text-slate-200 p-3 border border-slate-300 dark:border-slate-700 rounded-t-lg">
            {month.monthName} ({month.ppsCount} Inst. - {month.cuposTotal} Cupos)
          </h4>
          {year === 2024 && month.monthName === "Agosto" && (
            <div className="p-2 border-x border-slate-200 dark:border-slate-700 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-semibold text-center">
              -- Ingreso del nuevo coordinador --
            </div>
          )}
          <div className="border border-t-0 border-slate-300 dark:border-slate-700 p-3 rounded-b-md">
            <ul className="space-y-1 text-xs">
              {month.institutions.map((inst) => (
                <li key={inst.name} className="flex justify-between items-start">
                  <span className="flex-1 pr-2 text-slate-700 dark:text-slate-300">
                    {inst.name}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {inst.cupos}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
};

const SimpleRequestTable: React.FC<{ requests: PPSRequestSummary[]; statusLabel?: string }> = ({
  requests,
  statusLabel,
}) => {
  if (requests.length === 0)
    return <p className="text-xs text-slate-500 italic">No hay registros.</p>;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-4">
      <table className="w-full text-xs">
        <thead className="bg-slate-100 dark:bg-slate-800">
          <tr>
            <th className="p-2 text-left font-bold text-slate-700 dark:text-slate-300 w-1/3">
              Alumno
            </th>
            <th className="p-2 text-left font-bold text-slate-700 dark:text-slate-300 w-2/3">
              Institución Solicitada
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="p-2 text-slate-600 dark:text-slate-400 font-medium">
                {r.studentName}
                <span className="block text-[10px] text-slate-400 font-mono">
                  {r.studentLegajo}
                </span>
              </td>
              <td className="p-2 text-slate-800 dark:text-slate-200">{r.institutionName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SolicitudesBreakdown: React.FC<{ requests: PPSRequestSummary[] }> = ({ requests }) => {
  // Filtrar realizadas
  const realizadas = requests.filter((r) => {
    const status = normalizeStringForComparison(r.status);
    return status === "realizada" || status === "finalizada" || status === "aprobada";
  });

  // Filtramos no concretadas pero NO LAS MOSTRAMOS (según pedido del usuario)
  // const noConcretadas = ...

  const enGestion = requests.filter((r) => {
    const status = normalizeStringForComparison(r.status);
    // Excluimos las que son realizadas, no concretadas o archivadas
    const isRealizada = status === "realizada" || status === "finalizada" || status === "aprobada";
    const isNoConcretada =
      status === "no se pudo concretar" || status === "rechazada" || status === "cancelada";

    return !isRealizada && !isNoConcretada && status !== "archivado";
  });

  return (
    <div className="space-y-6">
      {/* Realizadas */}
      <div>
        <h3 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 mb-2 border-b border-emerald-200 pb-1 flex justify-between">
          <span>Solicitudes Realizadas y Concretadas</span>
          <span className="bg-emerald-100 px-2 rounded-full text-xs flex items-center">
            {realizadas.length}
          </span>
        </h3>
        <SimpleRequestTable requests={realizadas} />
      </div>

      {/* En Gestión (Opcional, para que cuadren los números) */}
      {enGestion.length > 0 && (
        <div>
          <h3 className="font-bold text-sm text-blue-700 dark:text-blue-400 mb-2 border-b border-blue-200 pb-1 flex justify-between">
            <span>En Gestión / Pendientes</span>
            <span className="bg-blue-100 px-2 rounded-full text-xs flex items-center">
              {enGestion.length}
            </span>
          </h3>
          <SimpleRequestTable requests={enGestion} />
        </div>
      )}
    </div>
  );
};

const NewAgreementsDetailSection: React.FC<{ details: NewAgreementDetail[] }> = ({ details }) => {
  if (!details || details.length === 0) {
    return <p className="text-sm text-slate-500 italic dark:text-slate-400">No hay datos.</p>;
  }
  return (
    <div className="space-y-4">
      {details.map((d) => (
        <div
          key={d.institucion}
          className="printable-section border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden"
        >
          <div className="bg-slate-100 dark:bg-slate-800 p-3 flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                {d.institucion}
              </h4>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Convenio {d.anioConvenio ?? "—"}
                {d.orientaciones.length > 0 && <> · {d.orientaciones.join(" · ")}</>}
              </div>
            </div>
            <div className="text-right text-xs text-slate-700 dark:text-slate-300 shrink-0">
              <div className="font-semibold">
                {d.totalRotaciones} PPS · {d.totalCupos} cupos
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {d.totalEstudiantes} estudiantes
              </div>
            </div>
          </div>
          {d.porAnio.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-2 text-left font-bold text-slate-600 dark:text-slate-300">
                    Año
                  </th>
                  <th className="p-2 text-center font-bold text-slate-600 dark:text-slate-300">
                    PPS lanzadas
                  </th>
                  <th className="p-2 text-center font-bold text-slate-600 dark:text-slate-300">
                    Cupos ofertados
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {d.porAnio.map((y) => (
                  <tr key={y.year}>
                    <td className="p-2 text-slate-700 dark:text-slate-300 font-medium">{y.year}</td>
                    <td className="p-2 text-center text-slate-800 dark:text-slate-100">
                      {y.rotaciones}
                    </td>
                    <td className="p-2 text-center text-slate-800 dark:text-slate-100">
                      {y.cupos}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
};

const SingleYearReport: React.FC<{ data: ExecutiveReportData }> = ({ data }) => {
  const kpiRows = [
    { label: "Estudiantes Activos", key: "activeStudents" },
    { label: "Estudiantes sin Ninguna PPS (Total)", key: "studentsWithoutAnyPps" },
    { label: "Estudiantes Nuevos (Ingresos)", key: "newStudents" },
    { label: "Estudiantes Finalizados (Ciclo)", key: "finishedStudents" },
    { label: "PPS Nuevas Lanzadas", key: "newPpsLaunches" },
    { label: "Cupos Totales Ofrecidos", key: "totalOfferedSpots" },
    { label: "Convenios Nuevos Firmados", key: "newAgreements" },
  ];

  const sanitizedSummary = DOMPurify.sanitize(data.summary);

  return (
    <>
      <header className="mb-10 printable-section text-center">
        <h1 className="text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          Balance de Prácticas Profesionales
        </h1>
        <p className="text-xl font-semibold text-slate-700 dark:text-slate-300 mt-2">
          Resumen Anual del Ciclo {data.year}
        </p>
      </header>

      <section className="mb-8 printable-section p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/60 rounded-lg text-blue-800 dark:text-blue-200">
        <div className="flex items-start gap-4">
          <span className="material-icons mt-1 text-blue-600 dark:text-blue-400">info</span>
          <div>
            <h3 className="font-bold mb-1 text-base">Cómo funciona este reporte</h3>
            <div className="text-xs leading-relaxed">
              Este panel compara dos momentos para mostrar la evolución durante el ciclo {data.year}
              .
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <strong>Total Acumulado ({data.year}):</strong> Muestra el estado actual al{" "}
                  <strong>{data.period.current.end}</strong>.
                </li>
                <li>
                  <strong>Cierre Ciclo Anterior:</strong> Muestra el estado al finalizar el ciclo
                  anterior (<strong>{data.period.previous.end}</strong>).
                </li>
                <li>
                  <strong>Evolución ({data.year}):</strong> Es la diferencia neta, reflejando la
                  actividad ocurrida exclusivamente durante el ciclo {data.year}.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Resumen Ejecutivo
        </h2>
        <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizedSummary }} />
      </section>

      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Panel de Indicadores Clave (KPIs)
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="p-3 text-left font-bold text-slate-600 dark:text-slate-300">
                Indicador
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Total Acumulado ({data.year})
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Cierre Ciclo Anterior
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Evolución ({data.year})
              </th>
            </tr>
          </thead>
          <tbody>
            {kpiRows.map((row) => {
              const kpiData = data.kpis[row.key as keyof typeof data.kpis];
              const evolution = kpiData.current - kpiData.previous;
              const percentageChange =
                kpiData.previous > 0
                  ? (evolution / kpiData.previous) * 100
                  : evolution > 0
                    ? 100
                    : 0;

              // Neutral check for 'activeStudents'
              const isNeutral = row.key === "activeStudents";

              const isPositive = evolution > 0;
              const isNegative = evolution < 0;

              let evolutionColor = isPositive
                ? "text-emerald-700 dark:text-emerald-400"
                : isNegative
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-400";
              let evolutionIcon = isPositive
                ? "arrow_upward"
                : isNegative
                  ? "arrow_downward"
                  : "remove";

              if (isNeutral && evolution !== 0) {
                evolutionColor = "text-slate-600 dark:text-slate-400";
                evolutionIcon = isPositive ? "trending_up" : "trending_down"; // Neutral trending icon
              }

              return (
                <tr key={row.key} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                    {row.label}
                  </td>
                  <td className="p-3 text-center font-bold text-2xl text-slate-900 dark:text-slate-50">
                    {kpiData.current}
                  </td>
                  <td className="p-3 text-center text-slate-600 dark:text-slate-400">
                    {kpiData.previous}
                  </td>
                  <td className={`p-3 text-center font-semibold ${evolutionColor}`}>
                    {evolution !== 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="material-icons !text-base">{evolutionIcon}</span>
                        <span>
                          {evolution > 0 ? "+" : ""}
                          {evolution} ({percentageChange.toFixed(0)}%)
                        </span>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Gestión de Solicitudes de PPS
        </h2>
        <SolicitudesBreakdown requests={data.ppsRequests} />
      </section>

      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Convenios Nuevos · Ficha por Institución ({data.newAgreementsDetail.length})
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Detalle de cada convenio nuevo del ciclo: orientación, rotaciones (PPS lanzadas) y cupos
          ofertados por año, y estudiantes que ocuparon un cupo (seleccionados).
        </p>
        <NewAgreementsDetailSection details={data.newAgreementsDetail} />
      </section>
    </>
  );
};

const ComparativeReport: React.FC<{ data: ComparativeExecutiveReportData }> = ({ data }) => {
  const kpiRows = [
    { label: "Estudiantes Activos", key: "activeStudents" },
    { label: "Estudiantes Finalizados (Ciclo)", key: "finishedStudents" },
    { label: "PPS Nuevas Lanzadas", key: "newPpsLaunches" },
    { label: "Cupos Totales Ofrecidos", key: "totalOfferedSpots" },
    { label: "Convenios Nuevos Firmados", key: "newAgreements" },
  ];

  const sanitizedSummary = DOMPurify.sanitize(data.summary);

  return (
    <>
      <header className="mb-10 printable-section">
        <h1 className="text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          Reporte Comparativo de Prácticas Profesionales
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 mt-2 tracking-wide">
          Análisis Comparativo Anual: {data.yearA} vs. {data.yearB}
        </p>
      </header>
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Resumen Ejecutivo
        </h2>
        <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizedSummary }} />
      </section>
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Panel Comparativo de KPIs
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="p-3 text-left font-bold text-slate-600 dark:text-slate-300">
                Indicador
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Balance {data.yearA}
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Balance {data.yearB}
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Evolución
              </th>
            </tr>
          </thead>
          <tbody>
            {kpiRows.map((row) => {
              const kpiData = data.kpis[row.key as keyof typeof data.kpis];
              const evolution = kpiData.yearB - kpiData.yearA;
              const percentageChange =
                kpiData.yearA > 0 ? (evolution / kpiData.yearA) * 100 : evolution > 0 ? 100 : 0;

              // Neutral check for 'activeStudents'
              const isNeutral = row.key === "activeStudents";

              const isPositive = evolution > 0;
              const isNegative = evolution < 0;

              let evolutionColor = isPositive
                ? "text-emerald-700 dark:text-emerald-400"
                : isNegative
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-400";
              let evolutionIcon = isPositive
                ? "arrow_upward"
                : isNegative
                  ? "arrow_downward"
                  : "remove";

              if (isNeutral && evolution !== 0) {
                evolutionColor = "text-slate-600 dark:text-slate-400";
                evolutionIcon = isPositive ? "trending_up" : "trending_down";
              }

              return (
                <tr key={row.key} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                    {row.label}
                  </td>
                  <td className="p-3 text-center font-bold text-2xl text-slate-700 dark:text-slate-300">
                    {kpiData.yearA}
                  </td>
                  <td className="p-3 text-center font-bold text-2xl text-slate-900 dark:text-slate-50">
                    {kpiData.yearB}
                  </td>
                  <td className={`p-3 text-center font-semibold ${evolutionColor}`}>
                    {evolution !== 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="material-icons !text-base">{evolutionIcon}</span>
                        <span>
                          {evolution > 0 ? "+" : ""}
                          {evolution} ({percentageChange.toFixed(0)}%)
                        </span>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Gestión de Solicitudes de PPS (Ciclo {data.yearB})
        </h2>
        <SolicitudesBreakdown requests={data.ppsRequests.yearB} />
      </section>
    </>
  );
};

interface PrintableExecutiveReportProps {
  data: AnyReportData;
}

const PrintableExecutiveReport: React.FC<PrintableExecutiveReportProps> = ({ data }) => {
  return (
    <div className="printable-executive-report bg-white dark:bg-slate-900 p-8 font-sans">
      <style>{`
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  .printable-section { break-inside: avoid; }
                }
            `}</style>

      {data.reportType === "comparative" ? (
        <ComparativeReport data={data} />
      ) : (
        <SingleYearReport data={data} />
      )}

      {/* Shared Sections for both report types */}
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Nuevos Convenios
        </h2>
        {data.reportType === "comparative" ? (
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
                {data.yearA} ({data.newAgreements.yearA.length})
              </h3>
              {data.newAgreements.yearA.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {data.newAgreements.yearA.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">No hay datos.</p>
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
                {data.yearB} ({data.newAgreements.yearB.length})
              </h3>
              {data.newAgreements.yearB.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {data.newAgreements.yearB.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">No hay datos.</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
              {data.year} ({data.newAgreementsList.length})
            </h3>
            {data.newAgreementsList.length > 0 ? (
              <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 columns-2">
                {data.newAgreementsList.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">No hay datos.</p>
            )}
          </div>
        )}
      </section>

      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Línea de Tiempo de PPS Lanzadas
        </h2>
        {data.reportType === "comparative" ? (
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
                {data.yearA}
              </h3>
              <PrintableTimeline year={data.yearA} launchesByMonth={data.launchesByMonth.yearA} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
                {data.yearB}
              </h3>
              <PrintableTimeline year={data.yearB} launchesByMonth={data.launchesByMonth.yearB} />
            </div>
          </div>
        ) : (
          <PrintableTimeline year={data.year} launchesByMonth={data.launchesByMonth} />
        )}
      </section>

      <footer className="mt-12 text-center text-xs text-gray-500 dark:text-slate-400">
        <p>
          Reporte generado desde Mi Panel Académico el {new Date().toLocaleDateString("es-ES")}.
        </p>
      </footer>
    </div>
  );
};

export default PrintableExecutiveReport;
