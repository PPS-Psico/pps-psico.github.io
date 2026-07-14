import React from "react";
import type {
  AnyReportData,
  ExecutiveReportData,
  ComparativeExecutiveReportData,
  GestionReportData,
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
                    {inst.unlimited ? "Ilimitado" : inst.cupos}
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
                {d.totalRotaciones} PPS ·{" "}
                {d.cupoIlimitado ? "Cupo ilimitado" : `${d.totalCupos} cupos`}
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
                      {d.cupoIlimitado ? "Ilimitado" : y.cupos}
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

const NewAgreementsSummaryList: React.FC<{ details: NewAgreementDetail[]; year: number }> = ({
  details,
  year,
}) => {
  if (details.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 italic">No hay datos.</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-100 dark:bg-slate-800">
        <tr>
          <th className="p-2 text-left font-bold text-slate-600 dark:text-slate-300">
            Institución
          </th>
          <th className="p-2 text-left font-bold text-slate-600 dark:text-slate-300">
            Orientación
          </th>
          <th className="p-2 text-center font-bold text-slate-600 dark:text-slate-300">
            Cupos {year}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
        {details.map((d) => {
          const yearStat = d.porAnio.find((y) => y.year === year);
          return (
            <tr key={d.institucion}>
              <td className="p-2 font-semibold text-slate-800 dark:text-slate-100">
                {d.institucion}
              </td>
              <td className="p-2 text-slate-600 dark:text-slate-300">
                {d.orientaciones.length > 0 ? d.orientaciones.join(" · ") : "—"}
              </td>
              <td className="p-2 text-center text-slate-800 dark:text-slate-100 font-semibold">
                {d.cupoIlimitado
                  ? "Ilimitado"
                  : yearStat
                    ? yearStat.cupos
                    : d.totalCupos > 0
                      ? d.totalCupos
                      : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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

      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Convenios Nuevos · Ficha por Institución
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Detalle de cada convenio nuevo por ciclo: orientación, PPS lanzadas y cupos ofertados por
          año, y estudiantes que ocuparon un cupo (seleccionados).
        </p>
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
              {data.yearA} ({data.newAgreementsDetail.yearA.length})
            </h3>
            <NewAgreementsDetailSection details={data.newAgreementsDetail.yearA} />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
              {data.yearB} ({data.newAgreementsDetail.yearB.length})
            </h3>
            <NewAgreementsDetailSection details={data.newAgreementsDetail.yearB} />
          </div>
        </div>
      </section>
    </>
  );
};

const GestionStatCard: React.FC<{ value: React.ReactNode; label: string; icon: string }> = ({
  value,
  label,
  icon,
}) => (
  <div className="printable-section rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 flex flex-col gap-1">
    <span className="material-icons !text-xl text-blue-600 dark:text-blue-400">{icon}</span>
    <span className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
      {value}
    </span>
    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 leading-tight">
      {label}
    </span>
  </div>
);

const GestionReport: React.FC<{ data: GestionReportData }> = ({ data }) => {
  const { antes, despues, pctCupos } = data.comparativa12m;
  const maxCupos = Math.max(...data.yearlyStats.map((y) => y.cupos), 1);

  const kpiCards = [
    { label: "Cupos ofrecidos", value: data.totals.cupos, icon: "group_add" },
    { label: "Rotaciones de PPS lanzadas", value: data.totals.lanzamientos, icon: "rocket_launch" },
    { label: "Convenios nuevos firmados", value: data.totals.conveniosNuevos, icon: "handshake" },
    { label: "Instituciones activas", value: data.totals.institucionesActivas, icon: "apartment" },
    {
      label: "Estudiantes que ocuparon cupo",
      value: data.totals.estudiantesColocados,
      icon: "school",
    },
    { label: "Estudiantes finalizados", value: data.totals.finalizados, icon: "verified" },
    { label: "Ingresantes (cohortes nuevas)", value: data.totals.ingresantes, icon: "person_add" },
    {
      label: "Solicitudes concretadas",
      value: `${data.totals.solicitudesConcretadas} de ${data.totals.solicitudes}`,
      icon: "task_alt",
    },
  ];

  return (
    <>
      <header className="mb-10 printable-section text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700 dark:text-blue-400 mb-3">
          Coordinación de Prácticas Profesionales Supervisadas · UFLO
        </p>
        <h1 className="text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          Informe General de Gestión
        </h1>
        <p className="text-xl font-semibold text-slate-700 dark:text-slate-300 mt-2">
          {data.periodLabel}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Balance integral desde el inicio de la coordinación actual
        </p>
      </header>

      {/* KPIs de la gestión */}
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          La Gestión en Números
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpiCards.map((k) => (
            <GestionStatCard key={k.label} value={k.value} label={k.label} icon={k.icon} />
          ))}
        </div>
      </section>

      {/* Resumen cualitativo */}
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Resumen Ejecutivo
        </h2>
        <ul className="space-y-3">
          {data.highlights.map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
            >
              <span className="material-icons !text-lg text-emerald-600 dark:text-emerald-400 mt-0.5">
                check_circle
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Evolución anual */}
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Evolución Anual de la Gestión
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="p-3 text-left font-bold text-slate-600 dark:text-slate-300">
                Período
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                PPS lanzadas
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Cupos
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Convenios nuevos
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Ingresantes
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Finalizados
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Solicitudes
              </th>
            </tr>
          </thead>
          <tbody>
            {data.yearlyStats.map((y) => (
              <tr key={y.year} className="border-b border-slate-200 dark:border-slate-700">
                <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{y.label}</td>
                <td className="p-3 text-center text-slate-800 dark:text-slate-100">
                  {y.lanzamientos}
                </td>
                <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-50">
                  {y.cupos}
                </td>
                <td className="p-3 text-center text-slate-800 dark:text-slate-100">
                  {y.conveniosNuevos}
                </td>
                <td className="p-3 text-center text-slate-800 dark:text-slate-100">
                  {y.ingresantes}
                </td>
                <td className="p-3 text-center text-slate-800 dark:text-slate-100">
                  {y.finalizados}
                </td>
                <td className="p-3 text-center text-slate-800 dark:text-slate-100">
                  {y.solicitudesConcretadas}/{y.solicitudes}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 dark:bg-slate-800/60 font-bold">
              <td className="p-3 text-slate-900 dark:text-slate-50">Total gestión</td>
              <td className="p-3 text-center text-slate-900 dark:text-slate-50">
                {data.totals.lanzamientos}
              </td>
              <td className="p-3 text-center text-slate-900 dark:text-slate-50">
                {data.totals.cupos}
              </td>
              <td className="p-3 text-center text-slate-900 dark:text-slate-50">
                {data.totals.conveniosNuevos}
              </td>
              <td className="p-3 text-center text-slate-900 dark:text-slate-50">
                {data.totals.ingresantes}
              </td>
              <td className="p-3 text-center text-slate-900 dark:text-slate-50">
                {data.totals.finalizados}
              </td>
              <td className="p-3 text-center text-slate-900 dark:text-slate-50">
                {data.totals.solicitudesConcretadas}/{data.totals.solicitudes}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
          Los períodos marcados como parciales (2024 desde septiembre y el año en curso) no cubren
          el año calendario completo.
        </p>
      </section>

      {/* Crecimiento de la oferta de cupos */}
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Crecimiento de la Oferta de Cupos
        </h2>
        <div className="space-y-2 mb-6">
          {data.yearlyStats.map((y) => (
            <div key={y.year} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300 text-right">
                {y.label}
              </span>
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-6 overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${Math.max((y.cupos / maxCupos) * 100, 8)}%` }}
                >
                  <span className="text-[11px] font-bold text-white">{y.cupos}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {pctCupos !== null && (
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 flex items-start gap-3">
            <span className="material-icons text-emerald-600 dark:text-emerald-400 mt-0.5">
              {pctCupos >= 0 ? "trending_up" : "trending_down"}
            </span>
            <div className="text-sm text-emerald-900 dark:text-emerald-200">
              <p className="font-bold mb-0.5">
                {pctCupos >= 0 ? "+" : "−"}
                {Math.abs(pctCupos).toFixed(0)}% de cupos en los primeros 12 meses de gestión
              </p>
              <p className="text-xs leading-relaxed">
                Sept. 2023 – Ago. 2024: {antes.cupos} cupos en {antes.lanzamientos} lanzamientos ·
                Sept. 2024 – Ago. 2025: {despues.cupos} cupos en {despues.lanzamientos}{" "}
                lanzamientos.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Ingreso vs egreso */}
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Relación Ingreso / Egreso de Estudiantes
        </h2>
        <table className="w-full text-sm mb-3">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="p-3 text-left font-bold text-slate-600 dark:text-slate-300">
                Período
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Ingresantes
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Finalizados
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Balance neto
              </th>
              <th className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                Ratio ingreso/egreso
              </th>
            </tr>
          </thead>
          <tbody>
            {data.yearlyStats.map((y) => {
              const neto = y.ingresantes - y.finalizados;
              const ratio = y.finalizados > 0 ? y.ingresantes / y.finalizados : null;
              return (
                <tr key={y.year} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                    {y.label}
                  </td>
                  <td className="p-3 text-center text-slate-800 dark:text-slate-100">
                    {y.ingresantes}
                  </td>
                  <td className="p-3 text-center text-slate-800 dark:text-slate-100">
                    {y.finalizados}
                  </td>
                  <td
                    className={`p-3 text-center font-semibold ${
                      neto > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : neto < 0
                          ? "text-rose-700 dark:text-rose-400"
                          : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {neto > 0 ? "+" : ""}
                    {neto}
                  </td>
                  <td className="p-3 text-center text-slate-800 dark:text-slate-100">
                    {ratio !== null ? ratio.toFixed(1) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Ingresantes: estudiantes cuya primera PPS corresponde a ese año (cohorte). Finalizados:
          solicitudes de finalización presentadas en el período. Un ratio mayor a 1 indica que la
          demanda de prácticas crece más rápido de lo que egresa.
        </p>
      </section>

      {/* Convenios nuevos de toda la gestión */}
      <section className="mb-10 printable-section">
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 pb-3 mb-5 tracking-tight">
          Convenios Nuevos de la Gestión ({data.newAgreementsDetail.length})
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Listado completo de instituciones incorporadas desde el inicio de la gestión, con su
          orientación, las PPS lanzadas, los cupos ofertados por año y los estudiantes que ocuparon
          un cupo.
        </p>
        <NewAgreementsDetailSection details={data.newAgreementsDetail} />
      </section>

      {/* Nota metodológica */}
      <section className="mb-10 printable-section p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2">
          Nota metodológica
        </h3>
        <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-400 space-y-1 leading-relaxed">
          <li>
            El período de gestión abarca desde el 1 de septiembre de 2024 hasta la fecha de
            generación del informe.
          </li>
          <li>
            Los convenios nuevos se registran por año calendario de firma; los de 2024 incluyen todo
            ese año.
          </li>
          <li>
            Los estudiantes que ocuparon cupo se cuentan una sola vez aunque hayan participado de
            varias rotaciones, y solo si fueron seleccionados.
          </li>
          <li>
            Fundación Tiempo y Ulloa ofrecen cupo prácticamente ilimitado: se muestran como
            "Ilimitado" y sus cupos se excluyen de los totales y de las estadísticas de presión, que
            reflejan la competencia real por el resto de las convocatorias.
          </li>
        </ul>
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

      {data.reportType === "gestion" ? (
        <GestionReport data={data} />
      ) : (
        <NonGestionSections data={data} />
      )}

      <footer className="mt-12 text-center text-xs text-gray-500 dark:text-slate-400">
        <p>
          Reporte generado desde Mi Panel Académico el {new Date().toLocaleDateString("es-ES")}.
        </p>
      </footer>
    </div>
  );
};

const NonGestionSections: React.FC<{
  data: ExecutiveReportData | ComparativeExecutiveReportData;
}> = ({ data }) => {
  return (
    <>
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
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Instituciones con convenio nuevo, su orientación y los cupos ofrecidos en el ciclo.
        </p>
        {data.reportType === "comparative" ? (
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
                {data.yearA} ({data.newAgreementsDetail.yearA.length})
              </h3>
              <NewAgreementsSummaryList
                details={data.newAgreementsDetail.yearA}
                year={data.yearA}
              />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
                {data.yearB} ({data.newAgreementsDetail.yearB.length})
              </h3>
              <NewAgreementsSummaryList
                details={data.newAgreementsDetail.yearB}
                year={data.yearB}
              />
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
              {data.year} ({data.newAgreementsDetail.length})
            </h3>
            <NewAgreementsSummaryList details={data.newAgreementsDetail} year={data.year} />
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
    </>
  );
};

export default PrintableExecutiveReport;
