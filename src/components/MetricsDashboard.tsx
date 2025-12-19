
import React, { useState, useCallback, useMemo } from 'react';
import { useMetricsData } from '../hooks/useMetricsData';
import type { StudentInfo } from '../types';
import EmptyState from './EmptyState';
import StudentListModal from './StudentListModal';
import Card from './Card';
import MetricCard from './MetricCard';
import HeroMetric from './MetricHero';
import FunnelRow from './MetricFunnel';
import { MetricsSkeleton } from './Skeletons';
import EnrollmentTrendChart from './Charts/EnrollmentTrendChart';
import OrientationDistributionChart from './Charts/OrientationDistributionChart';

type ModalData = {
  title: string;
  students: StudentInfo[];
  headers?: { key: string; label: string }[];
  description?: React.ReactNode;
};

const Tabs: React.FC<{ active: string; onChange: (t: string) => void }> = ({ active, onChange }) => {
  const tabs = [
    { key: 'overview', label: 'Resumen', icon: 'dashboard' },
    { key: 'students', label: 'Estudiantes', icon: 'groups' },
    { key: 'institutions', label: 'Instituciones', icon: 'apartment' },
  ];
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const activeTabInfo = tabs.find(t => t.key === active) || tabs[0];

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (key: string) => {
    onChange(key);
    setIsDropdownOpen(false);
  };
  
  return (
    <div className="mt-4">
      <div ref={dropdownRef} className="relative lg:hidden">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-800/50 dark:border-slate-700 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="material-icons !text-xl text-blue-600 dark:text-blue-400">{activeTabInfo.icon}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{activeTabInfo.label}</span>
          </div>
          <span className={`material-icons text-slate-500 dark:text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </button>
        {isDropdownOpen && (
          <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 z-10 animate-fade-in-up">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => handleSelect(t.key)}
                className="w-full text-left flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 first:rounded-t-xl last:rounded-b-xl"
              >
                <span className="material-icons !text-xl text-slate-500 dark:text-slate-400">{t.icon}</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="hidden lg:inline-flex p-1 rounded-xl border bg-white dark:bg-slate-800/50 dark:border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-800 ${
              active === t.key ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <span className="material-icons !text-base">{t.icon}</span>
            <span className="whitespace-nowrap">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface MetricsDashboardProps {
  onStudentSelect?: (student: { legajo: string; nombre: string }) => void;
  isTestingMode?: boolean;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ onStudentSelect, isTestingMode = false }) => {
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear()); 
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'institutions'>('overview');

  const openModal = useCallback((payload: ModalData) => setModalData(payload), []);
  const closeModal = useCallback(() => setModalData(null), []);

  const { data: metrics, isLoading, error, refetch, isFetching } = useMetricsData({ targetYear, isTestingMode });

  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const chartsData = useMemo(() => {
    if (!metrics || !metrics.rawStudents) return { trend: [], distribution: [] };

    // 1. Distribución por Orientación
    const orientationCounts: Record<string, number> = {};
    metrics.rawStudents.forEach((s: any) => {
        const orientation = s.orientacion_elegida || 'Sin definir';
        const label = orientation.charAt(0).toUpperCase() + orientation.slice(1);
        orientationCounts[label] = (orientationCounts[label] || 0) + 1;
    });
    
    const distribution = Object.entries(orientationCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // 2. Gráfico de Evolución Acumulada (Stock Activo)
    // Stock en Mes M = Stock en Mes M-1 + Entradas(M) - Salidas(M)
    const trendData: { month: string, value: number }[] = [];
    const maxMonth = targetYear === new Date().getFullYear() ? new Date().getMonth() : 11;
    
    // Arrays auxiliares para conteo mes a mes
    const entriesPerMonth = new Array(12).fill(0);
    const exitsPerMonth = new Array(12).fill(0);

    metrics.rawStudents.forEach((s: any) => {
        if (s.startMonth >= 0 && s.startMonth <= 11) {
            entriesPerMonth[s.startMonth]++;
        }
        if (s.endMonth !== undefined && s.endMonth >= 0 && s.endMonth <= 11) {
            exitsPerMonth[s.endMonth]++;
        }
    });

    let currentStock = 0;
    for (let m = 0; m <= maxMonth; m++) {
        currentStock += entriesPerMonth[m]; // Sumamos los que entraron este mes
        currentStock -= exitsPerMonth[m];   // Restamos los que se acreditaron este mes
        
        // Evitar números negativos por inconsistencias de datos (ej: fecha fin anterior a inicio)
        if (currentStock < 0) currentStock = 0;

        trendData.push({ month: MONTH_NAMES[m], value: currentStock });
    }

    return { distribution, trend: trendData };
  }, [metrics, targetYear]);


  if (isLoading) return <MetricsSkeleton />;

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <EmptyState
          icon="error"
          title="Error al cargar métricas"
          message={(error as any).message}
          action={
            <button onClick={() => refetch()} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
              <span className="material-icons">refresh</span>
              Reintentar
            </button>
          }
        />
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <>
      <StudentListModal
        isOpen={!!modalData}
        onClose={closeModal}
        title={modalData?.title || ''}
        students={modalData?.students || []}
        headers={modalData?.headers}
        description={modalData?.description}
      />
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            Métricas Académicas
          </h2>
          
          <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  {[2024, 2025].map(year => (
                      <button
                        key={year}
                        onClick={() => setTargetYear(year)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${targetYear === year ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-50 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                      >
                          Ciclo {year}
                      </button>
                  ))}
              </div>
              {isFetching && (
                <span className="material-icons !text-base animate-spin text-blue-500">autorenew</span>
              )}
          </div>
      </div>

      <Tabs active={activeTab} onChange={(t) => setActiveTab(t as any)} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <HeroMetric
            title="Oferta PPS"
            value={metrics.ppsLanzadas.value}
            icon="rocket_launch"
            description={`Comisiones únicas abiertas en ${targetYear}.`}
            onClick={() =>
            openModal({
                title: `PPS Lanzadas (${targetYear})`,
                students: metrics.ppsLanzadas.list as StudentInfo[],
                headers: [
                    { key: 'nombre', label: 'Institución' },
                    { key: 'legajo', label: 'Orientación' },
                    { key: 'cupos', label: 'Cupos' },
                ],
            })
            }
            color="indigo"
        />
        <HeroMetric
            title="Matrícula Activa"
            value={metrics.alumnosActivos.value}
            icon="school"
            description={`Estudiantes inscriptos en el ciclo ${targetYear}.`}
            onClick={() => openModal({ title: `Estudiantes Activos (${targetYear})`, students: metrics.alumnosActivos.list as StudentInfo[] })}
            color="blue"
        />
        <HeroMetric
            title="Finalizados"
            value={metrics.alumnosFinalizados.value}
            icon="military_tech"
            description={`Egresados registrados durante el ciclo ${targetYear}.`}
            onClick={() => openModal({ 
                title: `Alumnos Finalizados (${targetYear})`, 
                students: metrics.alumnosFinalizados.list as StudentInfo[],
                headers: [
                    { key: 'nombre', label: 'Nombre' },
                    { key: 'legajo', label: 'Legajo' },
                    { key: 'fechaFin', label: 'Fecha' },
                ]
            })}
            color="emerald"
        />
      </div>

      {activeTab === 'overview' && (
        <div className="mt-8 space-y-8 animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <EnrollmentTrendChart data={chartsData.trend} />
                 <OrientationDistributionChart data={chartsData.distribution} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card icon="filter_alt" title="Desglose del Ciclo" description={`Estado de los ${metrics.alumnosActivos.value} alumnos del año.`}>
                <div className="mt-4 space-y-2 divide-y divide-slate-200/60 dark:divide-slate-700/60">
                    <FunnelRow
                    label="Cursando PPS"
                    value={metrics.alumnosEnPPS.value}
                    total={metrics.alumnosActivos.value}
                    color="bg-emerald-500"
                    description="Alumnos con al menos una práctica vinculada a este año."
                    onClick={() =>
                        openModal({
                        title: 'Alumnos en PPS',
                        students: metrics.alumnosEnPPS.list as StudentInfo[],
                        })
                    }
                    />
                    <FunnelRow
                    label="Sin PPS Registrada"
                    value={metrics.alumnosActivosSinPpsEsteAno.value}
                    total={metrics.alumnosActivos.value}
                    color="bg-rose-500"
                    description={`Inscriptos a convocatoria pero sin práctica asignada.`}
                    onClick={() =>
                        openModal({
                        title: `Activos Sin PPS en ${targetYear}`,
                        students: metrics.alumnosActivosSinPpsEsteAno.list as StudentInfo[],
                        })
                    }
                    />
                </div>
                </Card>

                <Card icon="campaign" title="Capacidad Instalada" description={`Distribución de cupos en el ciclo ${targetYear}.`}>
                    <div className="mt-4 grid grid-cols-2 gap-4 divide-x divide-slate-200/70 dark:divide-slate-700/70 border-b border-slate-200/70 dark:border-slate-700/70 pb-4">
                        <div className="text-center px-2">
                            <p className="text-5xl font-black text-slate-800 dark:text-slate-100">{metrics.activeInstitutions.value}</p>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">Instituciones</p>
                        </div>
                        <div className="text-center px-2">
                            <p className="text-5xl font-black text-slate-800 dark:text-slate-100">{metrics.cuposOfrecidos.value}</p>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">Cupos Totales</p>
                        </div>
                    </div>
                    <div className="mt-4 text-center">
                         <p className="text-xs text-slate-500 font-medium italic">Datos basados en lanzamientos oficiales del ciclo.</p>
                    </div>
                </Card>
            </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
            <MetricCard
                title={`Matrícula Activa ${targetYear}`}
                value={metrics.alumnosActivos.value}
                icon="school"
                description={`Total de alumnos con inscripción a convocatorias del año.`}
                isLoading={false}
                onClick={() => openModal({ title: `Activos en ${targetYear}`, students: metrics.alumnosActivos.list as StudentInfo[] })}
            />
            <MetricCard
                title="En Curso / Con Práctica"
                value={metrics.alumnosEnPPS.value}
                icon="work"
                description="Alumnos con práctica asignada este año."
                isLoading={false}
                onClick={() => openModal({ title: 'Alumnos en PPS', students: metrics.alumnosEnPPS.list as StudentInfo[] })}
            />
             <MetricCard
                title={`Finalizados ${targetYear}`}
                value={metrics.alumnosFinalizados.value}
                icon="military_tech"
                description={`Alumnos que acreditaron en el ciclo.`}
                isLoading={false}
                onClick={() => openModal({ 
                    title: `Finalizados en ${targetYear}`, 
                    students: metrics.alumnosFinalizados.list as StudentInfo[],
                    headers: [
                        { key: 'nombre', label: 'Nombre' },
                        { key: 'legajo', label: 'Legajo' },
                        { key: 'fechaFin', label: 'Fecha' },
                    ]
                })}
            />
        </div>
      )}

      {activeTab === 'institutions' && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
            <MetricCard
                title="PPS Lanzadas"
                value={metrics.ppsLanzadas.value}
                icon="rocket_launch"
                description={`Instituciones con aperturas en ${targetYear}.`}
                isLoading={false}
                onClick={() => openModal({ title: `PPS Lanzadas (${targetYear})`, students: metrics.ppsLanzadas.list as StudentInfo[] })}
            />
            <MetricCard
                title="Cupos Ofrecidos"
                value={metrics.cuposOfrecidos.value}
                icon="groups"
                description={`Total de vacantes puestas a disposición.`}
                isLoading={false}
            />
        </div>
      )}
    </>
  );
};
