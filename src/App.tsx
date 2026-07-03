import React, { lazy, Suspense, useState, useEffect } from "react";
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
  useLocation,
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
// Aula pública: lazy — no forma parte del flujo logueado y así no pesa en el bundle inicial.
const StudentAulaView = React.lazy(() => import("./views/student/StudentAulaView"));
import StudentConvocatoriaDetailView from "./views/student/StudentConvocatoriaDetailView";
import DataCompletionModal from "./components/student/DataCompletionModal";
import { useRenderTrace } from "./hooks/useRenderTrace";

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

// Resetea el scroll al tope cuando cambia la ruta. React Router no restaura el
// scroll por defecto: al abrir el detalle de una convocatoria (u otra ruta) se
// conservaba la posición de la lista anterior y había que subir a mano. Se monta
// dentro del Router. 'auto' evita el salto animado.
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
};

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

  useRenderTrace("StudentWrapper", {
    needsDataCompletion: authenticatedUser?.needsDataCompletion,
    role: authenticatedUser?.role,
    legajo: authenticatedUser?.legajo,
    dataCompleted,
  });

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
        path="/aula"
        element={
          <React.Suspense fallback={null}>
            <StudentAulaView mode="public" />
          </React.Suspense>
        }
      />

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
        <Route path="aula" element={<StudentHome />} />
        <Route path="entregas" element={<StudentHome />} />
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

// (CampusReturnBar removido: los accesos "Volver al campus" y "Pantalla completa"
// ahora viven dentro de la topbar del panel — ver AtlasTopbar.)

const App: React.FC = () => {
  // Cuando el panel corre embebido (iframe del campus Moodle), le avisa al
  // contenedor que debe expandirse a pantalla completa para sentirse como una
  // sola app integrada. El label de Moodle escucha el mensaje { ppsPanel: true }.
  useEffect(() => {
    console.log("[React App] Componente principal App montado exitosamente en el DOM.");
    let isEmbedded = false;
    try {
      isEmbedded = window.self !== window.top;
    } catch {
      isEmbedded = true; // cross-origin ⇒ embebidos
    }
    if (!isEmbedded) return;

    document.documentElement.classList.add("pps-embedded");

    // Reporta el alto real del contenido para que el iframe del campus crezca a
    // su medida (scroll en la página de Moodle, sin barra interna ni recorte).
    // OJO: medimos un wrapper de contenido, NO body/documentElement: dentro de
    // un iframe el body se estira al alto del iframe y realimenta el cálculo
    // (crece sin parar). El wrapper mide solo el contenido y es estable.
    const measureHeight = () => {
      const wrap = document.getElementById("pps-embed-root");
      if (wrap) return Math.ceil(wrap.getBoundingClientRect().height);
      return document.body?.offsetHeight || 0;
    };

    const notifyParent = () => {
      try {
        window.parent.postMessage({ ppsPanel: true, height: measureHeight() }, "*");
      } catch {
        /* noop */
      }
    };

    notifyParent();
    const t1 = setTimeout(notifyParent, 300);
    const t2 = setTimeout(notifyParent, 1200);
    window.addEventListener("resize", notifyParent);

    // El panel es una SPA: el alto cambia al navegar tabs o cargar datos.
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(notifyParent);
      ro.observe(document.body);
    }
    // Re-mide los primeros segundos (datos async, fuentes, imágenes).
    let n = 0;
    const iv = setInterval(() => {
      notifyParent();
      if (++n > 15) clearInterval(iv);
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(iv);
      window.removeEventListener("resize", notifyParent);
      if (ro) ro.disconnect();
    };
  }, []);

  return (
    <ErrorProvider>
      <Router>
        <ScrollToTop />
        <ConfigProvider>
          <AdminPreferencesProvider>
            <NotificationProvider>
              <PwaInstallProvider>
                <ThemeProvider>
                  <ModalProvider>
                    <ErrorBoundary>
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
