import React, { useState, useCallback, useMemo } from "react";
import { useMetricsData, useMetricsYears } from "../../hooks/useMetricsData";
import { fetchMetricList, fetchOrientationList } from "../../services/metricsLists";
import type { StudentInfo } from "../../types";
import EmptyState from "../EmptyState";
import StudentListModal from "../StudentListModal";
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
  const [loadingModal, setLoadingModal] = useState(false);
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "institutions">("overview");

  const { data: years } = useMetricsYears(isTestingMode);
  const { data: metrics, isLoading, error } = useMetricsData({ targetYear, isTestingMode });

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
    setLoadingModal(false);
    onModalOpen?.(false);
    document.body.classList.remove("metrics-modal-open");
  }, [onModalOpen]);

  const openListModal = useCallback(
    async (key: string, title: string) => {
      setLoadingModal(true);
      openModal({ title, students: [] });
      try {
        const result = await fetchMetricList(key, targetYear);
        setModalData({ title, ...result });
      } catch {
        setModalData({ title, students: [], description: "Error al cargar los datos." });
      } finally {
        setLoadingModal(false);
      }
    },
    [openModal, targetYear]
  );

  const openOrientationModal = useCallback(
    async (orientation: string) => {
      setLoadingModal(true);
      openModal({ title: `Alumnos en Area: ${orientation}`, students: [] });
      try {
        const result = await fetchOrientationList(
          targetYear,
          orientation,
          metrics?.orientation_distribution || {}
        );
        setModalData({ title: `Alumnos en Area: ${orientation}`, ...result });
      } catch {
        setModalData({
          title: `Alumnos en Area: ${orientation}`,
          students: [],
          description: "Error al cargar los datos.",
        });
      } finally {
        setLoadingModal(false);
      }
    },
    [openModal, targetYear, metrics?.orientation_distribution]
  );

  const distributionData = useMemo(() => {
    if (!metrics?.orientation_distribution) return [];
    return Object.entries(metrics.orientation_distribution)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [metrics]);

  const enrollmentChartData = useMemo(() => {
    if (!metrics?.enrollment_evolution) return [];
    return metrics.enrollment_evolution.map((e) => ({
      ...e,
      label: "Nuevos Inscriptos",
    }));
  }, [metrics]);

  if (isLoading && !metrics) return <MetricsSkeleton />;
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
            {(years || [2024, 2025, 2026]).map((year) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <HeroMetric
          title="Matricula Generada"
          value={metrics.matricula_generada}
          icon="group_add"
          description={`Total historico en ${targetYear}`}
          onClick={() => openListModal("matricula_generada", `Matricula Generada ${targetYear}`)}
          color="indigo"
          trend={
            metrics.trends
              ? { value: metrics.trends.matricula_generada, label: `vs ${targetYear - 1}` }
              : undefined
          }
        />
        <HeroMetric
          title="Finalizados"
          value={metrics.alumnos_finalizados}
          icon="military_tech"
          description={`Completaron PPS en ${targetYear}`}
          onClick={() => openListModal("alumnos_finalizados", `Finalizados en ${targetYear}`)}
          color="emerald"
          trend={
            metrics.trends
              ? { value: metrics.trends.acreditados, label: `vs ${targetYear - 1}` }
              : undefined
          }
        />
        <HeroMetric
          title="Matricula Activa"
          value={metrics.matricula_activa}
          icon="play_circle"
          description={
            targetYear === new Date().getFullYear()
              ? "Alumnos activos hoy"
              : "Activos a fin de ciclo"
          }
          onClick={() => openListModal("matricula_activa", `Matricula Activa ${targetYear}`)}
          color="blue"
          trend={
            metrics.trends
              ? { value: metrics.trends.activos, label: `vs ${targetYear - 1}` }
              : undefined
          }
        />
      </div>

      <Tabs
        active={activeTab}
        onChange={(t) => setActiveTab(t as any)}
        counts={{
          students:
            metrics.matricula_generada +
            metrics.sin_pps +
            metrics.proximos_finalizar +
            metrics.haciendo_pps,
          institutions:
            metrics.pps_lanzadas +
            metrics.instituciones_activas +
            metrics.cupos_ofrecidos +
            metrics.nuevos_convenios,
        }}
      />

      <div className="mt-8 animate-fade-in-up">
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                {targetYear >= 2025 && (
                  <EnrollmentEvolutionChart
                    data={enrollmentChartData}
                    onBarClick={(item) =>
                      openListModal("nuevosIngresantes", `Estudiantes ${item.year}`)
                    }
                  />
                )}
                {targetYear !== 2024 && <OrientationDistributionChart data={distributionData} />}
              </div>
              <div className="space-y-6">
                <EnrollmentTrendChart data={metrics.trend_data || []} />
                {targetYear !== 2024 && (
                  <div className="bg-white dark:bg-slate-900/80 p-6 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-icons text-blue-600 !text-lg">list</span>
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Cupos Ocupados por Area
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Distribucion de vacantes segun el area de la PPS.
                    </p>
                    <div className="space-y-2">
                      {distributionData.map((item) => (
                        <button
                          key={item.name}
                          onClick={() => openOrientationModal(item.name)}
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
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title={`Ingresantes ${targetYear}`}
              value={metrics.matricula_generada}
              icon="person_add"
              description={`Nuevos matriculados en ${targetYear}`}
              onClick={() => openListModal("nuevosIngresantes", `Nuevos Ingresantes ${targetYear}`)}
              isLoading={false}
              className="bg-blue-50/50 border-blue-200"
            />
            <MetricCard
              title="Sin Ninguna PPS"
              value={metrics.sin_pps}
              icon="person_off"
              description="Alumnos activos sin actividad registrada"
              onClick={() => openListModal("sin_pps", "Alumnos Activos Sin PPS")}
              isLoading={false}
              className="bg-rose-50/30 border-rose-200"
            />
            <MetricCard
              title="Proximos a Finalizar"
              value={metrics.proximos_finalizar}
              icon="hourglass_top"
              description=">=230hs sin solicitud de acreditacion"
              onClick={() => openListModal("proximos_finalizar", "Alumnos Proximos a Finalizar")}
              isLoading={false}
              className="bg-amber-50/30 border-amber-200"
            />
            <MetricCard
              title="Haciendo PPS"
              value={metrics.haciendo_pps}
              icon="engineering"
              description="Alumnos con practicas en curso ahora"
              onClick={() => openListModal("haciendo_pps", "Alumnos Cursando PPS")}
              isLoading={false}
              className="bg-emerald-50/30 border-emerald-200"
            />
          </div>
        )}

        {activeTab === "institutions" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="PPS Lanzadas"
              value={metrics.pps_lanzadas}
              icon="rocket_launch"
              description={`Convocatorias publicadas en ${targetYear}`}
              onClick={() => openListModal("pps_lanzadas", `PPS Lanzadas en ${targetYear}`)}
              isLoading={false}
            />
            <MetricCard
              title="Instituciones Activas"
              value={metrics.instituciones_activas}
              icon="apartment"
              description={`Sedes con actividad en ${targetYear}`}
              onClick={() =>
                openListModal("instituciones_activas", `Instituciones Activas ${targetYear}`)
              }
              isLoading={false}
            />
            <MetricCard
              title="Cupos Ofrecidos"
              value={metrics.cupos_ofrecidos}
              icon="groups"
              description="Total de vacantes disponibles."
              onClick={() => openListModal("cupos_ofrecidos", `Cupos por PPS en ${targetYear}`)}
              isLoading={false}
            />
            <MetricCard
              title="Nuevos Convenios"
              value={metrics.nuevos_convenios}
              icon="handshake"
              description="Instituciones incorporadas este ciclo."
              onClick={() => openListModal("nuevos_convenios", "Nuevos Convenios")}
              isLoading={false}
              className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
            />
          </div>
        )}
      </div>
    </>
  );
};
