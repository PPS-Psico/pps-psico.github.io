/**
 * DIRECTION — Paper & Ink para jefaturas.
 * Intent: que la próxima corrección sea obvia y el estado del área se lea en segundos.
 * Hierarchy: saludo y riesgo → cola ordenada → panorama anual; una sola acción dominante por fila.
 * Geometry: lienzo editorial amplio, reglas finas, filas planas y una columna lateral de estado.
 * Typography: Manrope con cifras mono; color reservado para urgencia, plazo y confirmación.
 * Avoid: dashboards de tarjetas repetidas, métricas sin corte, plazos grupales y decoración sin función.
 */
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminSearch from "../components/admin/AdminSearch";
import ConvocatoriaManager from "../components/admin/ConvocatoriaManager";
import AdminTopBar from "../components/layout/AdminTopBar";
import AppModals from "../components/AppModals";
import { FIELD_LEGAJO_ESTUDIANTES, FIELD_NOMBRE_ESTUDIANTES } from "../constants";
import { useAuth, type AuthUser } from "../contexts/AuthContext";
import { StudentPanelProvider } from "../contexts/StudentPanelContext";
import {
  JefeHomePanel,
  JefePanoramaPanel,
  JefeReportsPanel,
} from "../features/jefe/JefeDashboardPanels";
import "../features/jefe/jefePanel.css";
import { fetchJefeDashboard, updateJefeReportGrade } from "../features/jefe/jefeService";
import type { JefeReport, JefeViewId } from "../features/jefe/types";
import type { AirtableRecord, EstudianteFields } from "../types";
import StudentDashboard from "./StudentDashboard";

const VALID_VIEWS = new Set<JefeViewId>([
  "inicio",
  "informes",
  "panorama",
  "practicas",
  "estudiantes",
]);

const NAV_ITEMS = [
  { id: "inicio", label: "Inicio", icon: "home" },
  { id: "informes", label: "Informes", icon: "fact_check" },
  { id: "panorama", label: "Panorama", icon: "monitoring" },
  { id: "practicas", label: "Prácticas", icon: "work_outline" },
  { id: "estudiantes", label: "Estudiantes", icon: "person_search" },
];

type SelectedStudent = { legajo: string; nombre: string };

const JefeView: React.FC = () => {
  const { authenticatedUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState(new Date().getFullYear());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);

  const rawView = searchParams.get("view") as JefeViewId | null;
  const currentView: JefeViewId = rawView && VALID_VIEWS.has(rawView) ? rawView : "inicio";

  const dashboardQuery = useQuery({
    queryKey: ["jefe-dashboard-v1", year],
    queryFn: () => fetchJefeDashboard(year),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const navItems = useMemo(
    () =>
      NAV_ITEMS.map((item) =>
        item.id === "informes" && dashboardQuery.data?.queue.pending
          ? { ...item, badge: dashboardQuery.data.queue.pending }
          : item
      ),
    [dashboardQuery.data?.queue.pending]
  );

  const navigateTo = useCallback(
    (view: JefeViewId) => {
      setSearchParams(view === "inicio" ? {} : { view });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setSearchParams]
  );

  const handleGrade = useCallback(
    async (report: JefeReport, grade: string) => {
      setSavingId(report.practica_id);
      setToast(null);
      try {
        await updateJefeReportGrade(report.practica_id, grade);
        await queryClient.invalidateQueries({ queryKey: ["jefe-dashboard-v1"] });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo guardar la calificación.";
        setToast(message);
      } finally {
        setSavingId(null);
      }
    },
    [queryClient]
  );

  const openStudent = useCallback((student: AirtableRecord<EstudianteFields>) => {
    const legajo = student[FIELD_LEGAJO_ESTUDIANTES];
    const nombre = student[FIELD_NOMBRE_ESTUDIANTES];
    if (!legajo || !nombre) {
      setToast("El registro seleccionado no tiene nombre o legajo.");
      return;
    }
    setSelectedStudent({ legajo: String(legajo), nombre: String(nombre) });
  }, []);

  const mobileLabel =
    dashboardQuery.data?.profile.areas.map((area) => area.label).join(" + ") || "Jefatura";

  const renderCoreContent = () => {
    if (dashboardQuery.isLoading) {
      return (
        <div className="jefe-loading" aria-label="Cargando panel de jefatura">
          <div>
            <span />
            <span />
            <span />
          </div>
        </div>
      );
    }

    if (dashboardQuery.error) {
      return (
        <div className="jefe-error">
          <span className="material-icons">error_outline</span>
          <h1>No pudimos cargar tu panel</h1>
          <p>
            {dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : "Ocurrió un error inesperado."}
          </p>
          <button onClick={() => void dashboardQuery.refetch()}>Volver a intentar</button>
        </div>
      );
    }

    if (!dashboardQuery.data) {
      return (
        <div className="jefe-error">
          <span className="material-icons">data_alert</span>
          <h1>El panel no devolvió datos</h1>
          <p>Volvé a intentar para actualizar la información de tu orientación.</p>
          <button onClick={() => void dashboardQuery.refetch()}>Volver a intentar</button>
        </div>
      );
    }

    const data = dashboardQuery.data;
    if (currentView === "inicio") {
      return (
        <JefeHomePanel
          data={data}
          savingId={savingId}
          onGrade={handleGrade}
          onNavigate={navigateTo}
        />
      );
    }
    if (currentView === "informes") {
      return <JefeReportsPanel data={data} savingId={savingId} onGrade={handleGrade} />;
    }
    if (currentView === "panorama") {
      return (
        <JefePanoramaPanel
          data={data}
          year={year}
          onYearChange={setYear}
          loading={dashboardQuery.isFetching}
        />
      );
    }
    return null;
  };

  const renderContent = () => {
    if (currentView === "practicas") {
      return (
        <div className="jefe-main">
          <ConvocatoriaManager forcedOrientations={authenticatedUser?.orientaciones || []} />
        </div>
      );
    }

    if (currentView === "estudiantes") {
      return (
        <div className="jefe-main">
          {selectedStudent ? (
            <>
              <button className="jefe-text-action" onClick={() => setSelectedStudent(null)}>
                <span className="material-icons">arrow_back</span> Volver a la búsqueda
              </button>
              <StudentPanelProvider legajo={selectedStudent.legajo}>
                <StudentDashboard user={selectedStudent as AuthUser} showExportButton />
              </StudentPanelProvider>
            </>
          ) : (
            <AdminSearch onStudentSelect={openStudent} />
          )}
        </div>
      );
    }

    return <main className="jefe-main">{renderCoreContent()}</main>;
  };

  return (
    <div className="jefe-shell">
      <div className="jefe-desktop-topbar">
        <AdminTopBar
          navItems={navItems}
          currentTabId={currentView}
          onTabChange={(id) => navigateTo(id as JefeViewId)}
          showMoodleTemplate={false}
        />
      </div>

      <header className="jefe-mobile-topbar">
        <div className="jefe-mobile-brand">
          <i>ψ</i>
          <strong>Mi Panel</strong>
        </div>
        <span>{mobileLabel}</span>
      </header>

      {renderContent()}

      <nav className="jefe-mobile-nav" aria-label="Navegación de jefatura">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={currentView === item.id ? "is-active" : ""}
            onClick={() => navigateTo(item.id as JefeViewId)}
            aria-current={currentView === item.id ? "page" : undefined}
          >
            <span className="material-icons">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div className="jefe-toast" role="alert">
          {toast}
        </div>
      )}
      <AppModals />
    </div>
  );
};

export default JefeView;
