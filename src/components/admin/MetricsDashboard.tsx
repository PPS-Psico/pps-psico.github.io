import React, { useState, useCallback, useMemo } from "react";
import { useMetricsData } from "../../hooks/useMetricsData";
import type { StudentInfo } from "../../types";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
} from "../../constants";
import EmptyState from "../EmptyState";
import StudentListModal from "../StudentListModal";
import Card from "../ui/Card";
import MetricCard from "../MetricCard";
import HeroMetric from "../MetricHero";
import { MetricsSkeleton } from "../Skeletons";
import OrientationDistributionChart from "../Charts/OrientationDistributionChart";
import EnrollmentTrendChart from "../Charts/EnrollmentTrendChart";
import EnrollmentEvolutionChart from "../Charts/EnrollmentEvolutionChart";

type ModalData = {
  title: string;
  students: StudentInfo[];
  headers?: { key: string; label: string }[];
  description?: React.ReactNode;
};

type TabCount = {
  overview?: number;
  students?: number;
  institutions?: number;
};

const Tabs: React.FC<{ active: string; onChange: (t: string) => void; counts?: TabCount }> = ({
  active,
  onChange,
  counts = {},
}) => {
  const tabs = [
    { key: "overview", label: "Resumen", icon: "dashboard" },
    { key: "students", label: "Estudiantes", icon: "groups", count: counts.students },
    { key: "institutions", label: "Instituciones", icon: "apartment", count: counts.institutions },
  ];
  return (
    <div className="mt-4 inline-flex p-1 rounded-xl border bg-white dark:bg-slate-800/50 dark:border-slate-700">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            active === t.key
              ? "bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          <span className="material-icons !text-base">{t.icon}</span>
          <span className="whitespace-nowrap">{t.label}</span>
          {t.count !== undefined && t.count > 0 && (
            <span
              className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                active === t.key
                  ? "bg-white/20 dark:bg-slate-800/20"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

interface MetricsDashboardProps {
  onStudentSelect?: (student: { legajo: string; nombre: string }) => void;
  isTestingMode?: boolean;
  onModalOpen?: (isOpen: boolean) => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  onStudentSelect,
  isTestingMode = false,
  onModalOpen,
}) => {
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "institutions">("overview");

  const openModal = useCallback(
    (payload: ModalData) => {
      setModalData(payload);
      onModalOpen?.(true);
      document.body.classList.add("metrics-modal-open");
    },
    [onModalOpen]
  );

  const closeModal = useCallback(() => {
    setModalData(null);
    onModalOpen?.(false);
    document.body.classList.remove("metrics-modal-open");
  }, [onModalOpen]);

  const { data: metrics, isLoading, error } = useMetricsData({ targetYear, isTestingMode });

  const distributionData = useMemo(() => {
    if (!metrics?.occupancyDistribution) return [];

    return (Object.entries(metrics.occupancyDistribution) as [string, any[]][])
      .map(([name, list]) => ({ name, value: list.length }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [metrics]);

  if (isLoading) return <MetricsSkeleton />;
  if (error) return <EmptyState icon="error" title="Error" message={(error as any).message} />;
  if (!metrics) return null;

  return (
    <>
      <StudentListModal
        isOpen={!!modalData}
        onClose={closeModal}
        title={modalData?.title || ""}
        students={modalData?.students || []}
        headers={modalData?.headers}
        description={modalData?.description}
        onStudentClick={(s) => {
          // Permitir clic solo si tiene legajo válido para navegar
          if (
            s.legajo &&
            s.legajo !== "Confirmado" &&
            s.legajo !== "Activa" &&
            s.legajo !== "---"
          ) {
            onStudentSelect?.({ legajo: s.legajo, nombre: s.nombre });
            closeModal();
          }
        }}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          Metricas Academicas
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {[2024, 2025, 2026].map((year) => (
              <button
                key={year}
                onClick={() => {
                  setTargetYear(year);
                  setActiveTab("overview");
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${targetYear === year ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hero Cards: Grid de 3 (Solicitudes en curso eliminada) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <HeroMetric
          title="Matricula Generada"
          value={metrics.matriculaGenerada.value}
          icon="group_add"
          description={`Total histórico en ${targetYear}`}
          onClick={() =>
            openModal({
              title: `Matricula Generada ${targetYear}`,
              students: metrics.matriculaGenerada.list as StudentInfo[],
            })
          }
          color="indigo"
          trend={
            metrics.trends
              ? {
                  value: metrics.trends.matriculaGenerada,
                  label: `vs ${targetYear - 1}`,
                }
              : undefined
          }
        />
        <HeroMetric
          title="Finalizados"
          value={metrics.alumnosFinalizados.value}
          icon="military_tech"
          description={`Completaron PPS en ${targetYear}`}
          onClick={() =>
            openModal({
              title: `Finalizados en ${targetYear}`,
              students: metrics.alumnosFinalizados.list as StudentInfo[],
            })
          }
          color="emerald"
          trend={
            metrics.trends
              ? {
                  value: metrics.trends.acreditados,
                  label: `vs ${targetYear - 1}`,
                }
              : undefined
          }
        />
        <HeroMetric
          title="Matricula Activa"
          value={metrics.matriculaActiva.value}
          icon="play_circle"
          description={targetYear === 2025 ? "Alumnos activos hoy" : "Activos a fin de ciclo"}
          onClick={() =>
            openModal({
              title: `Matricula Activa ${targetYear}`,
              students: metrics.matriculaActiva.list as StudentInfo[],
            })
          }
          color="blue"
          trend={
            metrics.trends
              ? {
                  value: metrics.trends.activos,
                  label: `vs ${targetYear - 1}`,
                }
              : undefined
          }
        />
      </div>

      <Tabs
        active={activeTab}
        onChange={(t) => setActiveTab(t as any)}
        counts={{
          students:
            (metrics.nuevosIngresantes?.value || 0) +
            (metrics.alumnosSinPPS?.value || 0) +
            (metrics.proximosAFinalizar?.value || 0) +
            (metrics.haciendoPPS?.value || 0),
          institutions:
            (metrics.ppsLanzadas?.value || 0) +
            (metrics.institucionesActivas?.value || 0) +
            (metrics.cuposOfrecidos?.value || 0) +
            (metrics.conveniosNuevos?.value || 0),
        }}
      />

      <div className="mt-8 animate-fade-in-up">
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                {/* Nuevos Inscriptos: Solo mostrar para 2025 o superior */}
                {targetYear >= 2025 && (
                  <EnrollmentEvolutionChart
                    data={metrics.enrollmentEvolution}
                    onBarClick={(item) =>
                      item.year !== "2024" &&
                      openModal({
                        title: `Estudiantes ${item.year}`,
                        students: item.list as StudentInfo[],
                        description: item.isProjection
                          ? 'Alumnos detectados con estado "Nuevo" pendientes de matriculacion completa.'
                          : "Alumnos que iniciaron su recorrido en este ciclo.",
                      })
                    }
                  />
                )}

                {/* Distribución por Área: Ocultar en 2024 */}
                {targetYear !== 2024 && <OrientationDistributionChart data={distributionData} />}
              </div>

              <div className="space-y-6">
                {/* Gráfico de Tendencia Restaurado */}
                <EnrollmentTrendChart data={metrics.trendData} />

                {/* Cupos Ocupados por Área: Ocultar en 2024 */}
                {targetYear !== 2024 && (
                  <Card
                    title="Cupos Ocupados por Area"
                    icon="list"
                    description="Distribucion de vacantes segun el area de la PPS."
                  >
                    <div className="mt-4 space-y-2">
                      {distributionData.map((item) => (
                        <button
                          key={item.name}
                          onClick={() =>
                            openModal({
                              title: `Alumnos en Area: ${item.name}`,
                              students: metrics.occupancyDistribution[item.name] as StudentInfo[],
                              headers: [
                                { key: "nombre", label: "Nombre" },
                                { key: "legajo", label: "Legajo" },
                                { key: "institucion", label: "Institucion" },
                                ...(item.name === "Sin definir"
                                  ? [{ key: "raw_value", label: "Valor en DB" }]
                                  : []),
                              ],
                              description:
                                item.name === "Sin definir"
                                  ? "Estos registros tienen orientaciones no reconocidas en el lanzamiento de origen. Revisa la columna 'Valor en DB'."
                                  : `Estudiantes seleccionados en vacantes de ${item.name} durante el ciclo ${targetYear}.`,
                            })
                          }
                          className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${item.name === "Sin definir" ? "bg-rose-500" : "bg-blue-500"}`}
                            ></span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {item.value} cupos
                            </span>
                            <span className="material-icons text-slate-300 group-hover:text-blue-500 transition-colors !text-base">
                              arrow_forward
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Ingresantes */}
            <MetricCard
              title={`Ingresantes ${targetYear}`}
              value={metrics.nuevosIngresantes.value}
              icon="person_add"
              description={`Nuevos matriculados en ${targetYear}`}
              onClick={() =>
                openModal({
                  title: `Nuevos Ingresantes ${targetYear}`,
                  students: metrics.nuevosIngresantes.list as any,
                  headers: [
                    { key: "nombre", label: "Nombre" },
                    { key: "legajo", label: "Legajo" },
                  ],
                })
              }
              isLoading={false}
              className="bg-blue-50/50 border-blue-200"
            />

            {/* 2. Sin PPS */}
            <MetricCard
              title="Sin Ninguna PPS"
              value={metrics.alumnosSinPPS.value}
              icon="person_off"
              description="Alumnos activos sin actividad registrada"
              onClick={() =>
                openModal({
                  title: "Alumnos Activos Sin PPS",
                  students: metrics.alumnosSinPPS.list as any,
                  headers: [
                    { key: "nombre", label: "Nombre" },
                    { key: "legajo", label: "Legajo" },
                    { key: "correo", label: "Email" },
                  ],
                })
              }
              isLoading={false}
              className="bg-rose-50/30 border-rose-200"
            />

            {/* 3. Próximos a Finalizar */}
            <MetricCard
              title="Próximos a Finalizar"
              value={metrics.proximosAFinalizar.value}
              icon="hourglass_top"
              description=">=230hs o Completos con Práctica Activa"
              onClick={() =>
                openModal({
                  title: "Alumnos Próximos a Finalizar",
                  students: metrics.proximosAFinalizar.list as any,
                  headers: [
                    { key: "nombre", label: "Nombre" },
                    { key: "legajo", label: "Legajo" },
                  ],
                  description:
                    "Listado de alumnos con más de 230 horas acumuladas o que ya cumplen los requisitos pero tienen prácticas 'En curso' impidiendo el cierre.",
                })
              }
              isLoading={false}
              className="bg-amber-50/30 border-amber-200"
            />

            {/* 4. Haciendo PPS */}
            <MetricCard
              title="Haciendo PPS"
              value={metrics.haciendoPPS.value}
              icon="engineering"
              description="Alumnos con prácticas en curso ahora"
              onClick={() =>
                openModal({
                  title: "Alumnos Cursando PPS",
                  students: metrics.haciendoPPS.list as any,
                  headers: [
                    { key: "nombre", label: "Nombre" },
                    { key: "legajo", label: "Legajo" },
                  ],
                })
              }
              isLoading={false}
              className="bg-emerald-50/30 border-emerald-200"
            />
          </div>
        )}

        {activeTab === "institutions" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="PPS Lanzadas"
              value={metrics.ppsLanzadas.value}
              icon="rocket_launch"
              description={`Convocatorias publicadas en ${targetYear}`}
              onClick={() =>
                openModal({
                  title: `PPS Lanzadas en ${targetYear}`,
                  students: metrics.ppsLanzadasList || [],
                  headers: [
                    { key: "nombre", label: "PPS" },
                    { key: "legajo", label: "Cupos" },
                  ],
                })
              }
              isLoading={false}
            />
            <MetricCard
              title="Instituciones Activas"
              value={metrics.institucionesActivas?.value || 0}
              icon="apartment"
              description={`Sedes con actividad en ${targetYear}`}
              onClick={() =>
                openModal({
                  title: `Instituciones Activas ${targetYear}`,
                  students: metrics.institucionesActivas?.list as any,
                })
              }
              isLoading={false}
            />
            <MetricCard
              title="Cupos Ofrecidos"
              value={metrics.cuposOfrecidos.value}
              icon="groups"
              description="Total de vacantes disponibles."
              onClick={() =>
                openModal({
                  title: `Cupos por PPS en ${targetYear}`,
                  students: (metrics.cuposOfrecidos.list || []).map((l: any) => ({
                    nombre:
                      l.nombre_pps_lanzamientos || l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin nombre",
                    legajo: l.cupos_disponibles || l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0,
                  })),
                  headers: [
                    { key: "nombre", label: "PPS" },
                    { key: "legajo", label: "Cupos" },
                  ],
                })
              }
              isLoading={false}
            />
            <MetricCard
              title="Nuevos Convenios"
              value={metrics.conveniosNuevos.value}
              icon="handshake"
              description="Instituciones incorporadas este ciclo."
              onClick={() =>
                openModal({
                  title: "Nuevos Convenios",
                  students: metrics.conveniosNuevos.list as any,
                })
              }
              isLoading={false}
              className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
            />
          </div>
        )}
      </div>
    </>
  );
};
