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
import {
  fetchJefeDashboard,
  fetchJefeDashboardPreview,
  updateJefeReportGrade,
} from "../features/jefe/jefeService";
import type { JefeMoodleSyncState, JefeReport, JefeViewId } from "../features/jefe/types";
import { useJefeMoodleSync } from "../features/jefe/useJefeMoodleSync";
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

type JefeViewProps = {
  previewKey?: string;
};

const JefeMoodleSyncNotice: React.FC<{ sync: JefeMoodleSyncState }> = ({ sync }) => {
  if (sync.status === "idle") return null;

  const observedLabel = sync.lastObservedAt
    ? new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(sync.lastObservedAt))
    : null;

  let icon = "sync";
  let title = "Preparando la actualización de informes";
  let detail = "Buscando las tareas del año para tu orientación.";
  if (sync.status === "syncing") {
    icon = "sync";
    title = "Actualizando informes desde Campus";
    detail = `${sync.taskCount} ${sync.taskCount === 1 ? "tarea" : "tareas"} únicas del año, sin repetir relanzamientos.`;
  } else if (sync.status === "synced") {
    icon = "cloud_done";
    title = "Informes actualizados";
    detail = `${sync.taskCount} ${sync.taskCount === 1 ? "tarea revisada" : "tareas revisadas"}${sync.accepted > 0 ? ` · ${sync.accepted} entregas vinculadas` : ""}${sync.deduplicated > 0 ? ` · ${sync.deduplicated} asignadas a la práctica más reciente` : ""}${sync.unmatchedInternal > 0 ? " · las filas ajenas al área o sin correspondencia se aislaron sin modificar ninguna PPS" : ""}${observedLabel ? ` · ${observedLabel}` : ""}.`;
  } else if (sync.status === "partial") {
    icon = "rule";
    title = "Actualización parcial";
    const issues = [
      sync.failedTasks > 0 ? `${sync.failedTasks} tareas no se pudieron leer` : null,
      sync.ambiguous > 0 ? `${sync.ambiguous} entregas con prácticas duplicadas` : null,
    ].filter(Boolean);
    detail = issues.join(" · ") || "Algunas filas requieren revisión.";
  } else if (sync.status === "complete") {
    icon = "task_alt";
    title = "No hay tareas Moodle para sincronizar este año";
    detail = "La orientación no tiene vínculos confirmados pendientes de lectura.";
  } else if (sync.status === "unavailable") {
    icon = "cloud_off";
    title = "Mostrando el último estado guardado";
    detail = "La actualización automática se ejecuta al abrir este panel dentro del Campus.";
  } else if (sync.status === "error") {
    icon = "sync_problem";
    title = "No pudimos actualizar los informes";
    detail = sync.errorMessage || "Conservamos el último estado confirmado.";
  }

  const canRetry = sync.status === "error" || sync.status === "partial";
  return (
    <div className={`jefe-sync-notice jefe-sync-notice--${sync.status}`} role="status">
      <span className="material-icons" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      {canRetry && (
        <button type="button" onClick={() => void sync.retry()}>
          Reintentar
        </button>
      )}
    </div>
  );
};

const JefeView: React.FC<JefeViewProps> = ({ previewKey }) => {
  const { authenticatedUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState(new Date().getFullYear());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);
  const isPreview = previewKey != null;
  const moodleSync = useJefeMoodleSync(true, previewKey);

  const rawView = searchParams.get("view") as JefeViewId | null;
  const currentView: JefeViewId = rawView && VALID_VIEWS.has(rawView) ? rawView : "inicio";

  const dashboardQuery = useQuery({
    queryKey: ["jefe-dashboard-v1", isPreview ? "preview" : "self", previewKey ?? null, year],
    queryFn: () =>
      previewKey != null ? fetchJefeDashboardPreview(previewKey, year) : fetchJefeDashboard(year),
    staleTime: 60_000,
    placeholderData: isPreview ? undefined : keepPreviousData,
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
      if (isPreview) {
        setToast("Modo de previsualización: no se guardó ningún cambio.");
        return;
      }
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
    [isPreview, queryClient]
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
          readOnly={isPreview}
          onGrade={handleGrade}
          onNavigate={navigateTo}
        />
      );
    }
    if (currentView === "informes") {
      return (
        <JefeReportsPanel
          data={data}
          savingId={savingId}
          readOnly={isPreview}
          onGrade={handleGrade}
        />
      );
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
    if (isPreview && currentView === "practicas" && !dashboardQuery.data) {
      return <main className="jefe-main">{renderCoreContent()}</main>;
    }

    if (currentView === "practicas") {
      const orientations = isPreview
        ? dashboardQuery.data?.profile.areas.map((area) => area.label) || []
        : authenticatedUser?.orientaciones || [];

      return (
        <div className="jefe-main">
          <ConvocatoriaManager forcedOrientations={orientations} />
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
          previewMode={isPreview}
        />
      </div>

      <header className="jefe-mobile-topbar">
        <div className="jefe-mobile-brand">
          <i>ψ</i>
          <strong>Mi Panel</strong>
        </div>
        <span>{mobileLabel}</span>
      </header>

      {isPreview && (
        <div className="jefe-preview-notice" role="status">
          <span className="material-icons" aria-hidden="true">
            visibility
          </span>
          <strong>Vista previa de {dashboardQuery.data?.profile.name || "jefatura"}</strong>
          <span>Datos reales · calificaciones en consulta · conservás tus permisos de Admin</span>
        </div>
      )}

      <JefeMoodleSyncNotice sync={moodleSync} />

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
      {!isPreview && <AppModals />}
    </div>
  );
};

export default JefeView;
