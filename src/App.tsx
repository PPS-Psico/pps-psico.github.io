import React, { lazy, Suspense, useState, useEffect } from "react";
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import Auth from "./components/Auth";
import ErrorBoundary from "./components/ErrorBoundary";
import InstallPWA from "./components/InstallPWA";
import Layout from "./components/layout/Layout";
import Loader from "./components/Loader";
import ProtectedRoute from "./components/ProtectedRoute";
import { FIELD_LEGAJO_ESTUDIANTES } from "./constants";
import { AdminPreferencesProvider } from "./contexts/AdminPreferencesContext";
import { useAuth } from "./contexts/AuthContext";
import { ConfigProvider } from "./contexts/ConfigContext";
import { ErrorProvider } from "./contexts/ErrorContext";
import { ModalProvider } from "./contexts/ModalContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { PwaInstallProvider } from "./contexts/PwaInstallContext";
import { StudentPanelProvider } from "./contexts/StudentPanelContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import PracticasView from "./views/student/PracticasView";
import StudentConvocatoriaDetailView from "./views/student/StudentConvocatoriaDetailView";
import DataCompletionModal from "./components/student/DataCompletionModal";
import { logger } from "./utils/logger";

// Views
const StudentView = lazy(() => import("./views/StudentView"));
const StudentDashboard = lazy(() => import("./views/StudentDashboard"));
const StudentHome = lazy(() =>
  import("./views/StudentDashboard").then((module) => ({ default: module.StudentHome }))
);
const SolicitudesView = lazy(() => import("./views/student/SolicitudesView"));
const StudentProfileView = lazy(() => import("./views/student/StudentProfileView"));
const StudentConvocatoriasView = lazy(() => import("./views/student/StudentConvocatoriasView"));

const AdminView = lazy(() => import("./views/AdminView"));
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard"));
const LanzadorView = lazy(() => import("./views/admin/LanzadorView"));
const GestionView = lazy(() => import("./views/admin/GestionView"));
const TallerView = lazy(() => import("./views/admin/TallerView"));
const MetricsView = lazy(() => import("./views/admin/MetricsView"));
const SolicitudesManager = lazy(() => import("./components/admin/SolicitudesManager"));
const JefeView = lazy(() => import("./views/JefeView"));
const DirectivoView = lazy(() => import("./views/DirectivoView"));
const ReporteroView = lazy(() => import("./views/ReporteroView"));
const AdminTestingView = lazy(() => import("./views/AdminTestingView"));

const AdminStudentWrapper = () => {
  const { legajo } = useParams();
  if (!legajo) return null;
  return (
    <StudentPanelProvider legajo={legajo}>
      <StudentDashboard key={legajo} showExportButton />
    </StudentPanelProvider>
  );
};

const StudentWrapper = ({ children }: { children: React.ReactNode }) => {
  const { authenticatedUser } = useAuth();
  const [dataCompleted, setDataCompleted] = useState(false);

  logger.info(
    "[StudentWrapper] needsDataCompletion:",
    authenticatedUser?.needsDataCompletion,
    "role:",
    authenticatedUser?.role
  );

  const role = authenticatedUser?.role as string | undefined;
  const isStudent = !role || role === "Alumno";

  if (authenticatedUser?.needsDataCompletion && !dataCompleted && isStudent) {
    return (
      <DataCompletionModal
        studentId={authenticatedUser.studentId || ""}
        legajo={authenticatedUser.legajo}
        onComplete={() => setDataCompleted(true)}
      />
    );
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { authenticatedUser } = useAuth();
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/login" element={!authenticatedUser ? <Auth /> : <Navigate to="/" />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            {authenticatedUser?.role === "AdminTester" ? (
              <Navigate to="/testing" replace />
            ) : authenticatedUser?.role === "SuperUser" ? (
              <Navigate to="/admin" replace />
            ) : authenticatedUser?.role === "Jefe" ? (
              <Navigate to="/jefe" replace />
            ) : authenticatedUser?.role === "Directivo" ? (
              <Navigate to="/directivo" replace />
            ) : authenticatedUser?.role === "Reportero" ? (
              <Navigate to="/reportero" replace />
            ) : (
              <Navigate to="/student" replace />
            )}
          </ProtectedRoute>
        }
      />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["Student"]}>
            <StudentWrapper>
              <StudentView />
            </StudentWrapper>
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentHome />} />
        <Route path="convocatorias" element={<StudentConvocatoriasView />} />
        <Route path="practicas" element={<PracticasView />} />
        <Route path="solicitudes" element={<SolicitudesView />} />
        <Route path="perfil" element={<StudentProfileView />} />
      </Route>

      <Route
        path="/student/convocatoria/:id"
        element={
          <ProtectedRoute allowedRoles={["Student"]}>
            <StudentWrapper>
              <StudentConvocatoriaDetailView />
            </StudentWrapper>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["SuperUser", "AdminTester"]}>
            <AdminView />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route
          path="metrics"
          element={
            <MetricsView onStudentSelect={(s) => navigate(`/admin/estudiantes/${s.legajo}`)} />
          }
        />
        <Route path="lanzador" element={<LanzadorView />} />
        <Route path="gestion" element={<GestionView />} />
        <Route path="solicitudes" element={<SolicitudesManager />} />
        <Route
          path="recordatorios"
          element={<Navigate to="/admin/gestion?view=agenda" replace />}
        />
        <Route
          path="herramientas"
          element={
            <TallerView
              onStudentSelect={(s) => navigate(`/admin/estudiantes/${s[FIELD_LEGAJO_ESTUDIANTES]}`)}
            />
          }
        />
        <Route path="estudiantes/:legajo" element={<AdminStudentWrapper />} />
      </Route>

      <Route
        path="/jefe"
        element={
          <ProtectedRoute allowedRoles={["Jefe"]}>
            <JefeView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/directivo"
        element={
          <ProtectedRoute allowedRoles={["Directivo"]}>
            <DirectivoView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportero"
        element={
          <ProtectedRoute allowedRoles={["Reportero"]}>
            <ReporteroView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/testing"
        element={
          <ProtectedRoute allowedRoles={["SuperUser", "AdminTester"]}>
            <AdminTestingView />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

/**
 * Barra "Volver al campus": solo aparece cuando el panel corre embebido dentro
 * del iframe del campus (Moodle). Permite volver al aula sin abrir otra ventana.
 * Si el estudiante abrió el panel por URL directa, no se muestra (pantalla completa).
 */
const CampusReturnBar: React.FC = () => {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    let e = false;
    try {
      e = window.self !== window.top;
    } catch {
      e = true; // cross-origin ⇒ embebidos
    }
    setEmbedded(e);
  }, []);

  if (!embedded) return null;

  return (
    <div
      role="navigation"
      aria-label="Volver al campus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: "var(--bg-elevated, #ffffff)",
        borderBottom: "1px solid var(--border, #e8e6de)",
        position: "relative",
        zIndex: 50,
      }}
    >
      <button
        type="button"
        onClick={() => {
          window.location.href = "aula.html";
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 13px",
          borderRadius: 999,
          border: "1px solid var(--border-strong, #d6d3c8)",
          background: "transparent",
          color: "var(--fg, #141310)",
          font: "inherit",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M19 12H5" />
          <path d="M11 19l-7-7 7-7" />
        </svg>
        Volver al campus
      </button>
      <button
        type="button"
        onClick={() => {
          // Abre el panel en una ventana nueva a pantalla completa.
          // Mismo origen ⇒ comparte la sesión, así entra ya logueado.
          window.open(window.location.href, "_blank", "noopener");
        }}
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 13px",
          borderRadius: 999,
          border: "1px solid var(--border-strong, #d6d3c8)",
          background: "transparent",
          color: "var(--fg, #141310)",
          font: "inherit",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 3h6v6" />
          <path d="M9 21H3v-6" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
        </svg>
        Pantalla completa
      </button>
      <span
        style={{
          marginLeft: 12,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--fg-muted, #6a7081)",
        }}
      >
        PPS 2026
      </span>
    </div>
  );
};

const App: React.FC = () => {
  // Cuando el panel corre embebido (iframe del campus Moodle), le avisa al
  // contenedor que debe expandirse a pantalla completa para sentirse como una
  // sola app integrada. El label de Moodle escucha el mensaje { ppsPanel: true }.
  useEffect(() => {
    let isEmbedded = false;
    try {
      isEmbedded = window.self !== window.top;
    } catch {
      isEmbedded = true; // cross-origin ⇒ embebidos
    }
    if (!isEmbedded) return;

    const notifyParent = () => {
      try {
        window.parent.postMessage({ ppsPanel: true }, "*");
      } catch {
        /* noop */
      }
    };

    notifyParent();
    const t1 = setTimeout(notifyParent, 300);
    const t2 = setTimeout(notifyParent, 1200);
    window.addEventListener("resize", notifyParent);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", notifyParent);
    };
  }, []);

  return (
    <ErrorProvider>
      <Router>
        <ConfigProvider>
          <AdminPreferencesProvider>
            <NotificationProvider>
              <PwaInstallProvider>
                <ThemeProvider>
                  <ModalProvider>
                    <ErrorBoundary>
                      <CampusReturnBar />
                      <Layout>
                        <InstallPWA />
                        <Suspense fallback={<Loader />}>
                          <AppRoutes />
                        </Suspense>
                      </Layout>
                    </ErrorBoundary>
                  </ModalProvider>
                </ThemeProvider>
              </PwaInstallProvider>
            </NotificationProvider>
          </AdminPreferencesProvider>
        </ConfigProvider>
      </Router>
    </ErrorProvider>
  );
};

export default App;
