import React, { lazy, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import AppModals from "../components/AppModals";
import { AdminDashboardSkeleton } from "../components/Skeletons";
import { type TabItem } from "../components/UnifiedTabs";
import AdminTopBar from "../components/layout/AdminTopBar";
import { useAdminPreferences } from "../contexts/AdminPreferencesContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

// Components for Testing Mode
const AdminDashboard = lazy(() => import("../components/admin/AdminDashboard"));
const LanzadorView = lazy(() => import("./admin/LanzadorView"));
const GestionView = lazy(() => import("./admin/GestionView"));
const SolicitudesManager = lazy(() => import("../components/admin/SolicitudesManager"));
const TallerView = lazy(() => import("./admin/TallerView"));
const MetricsView = lazy(() => import("./admin/MetricsView"));

interface AdminViewProps {
  isTestingMode?: boolean;
}

/** Hook to detect mobile viewport */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

/** Mobile-only tabs (Inicio, Lanzador, Gestión) */
const MOBILE_TAB_IDS = new Set(["dashboard", "lanzador", "gestion"]);

const AdminView: React.FC<AdminViewProps> = ({ isTestingMode = false }) => {
  const { preferences } = useAdminPreferences();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const isMobile = useIsMobile();

  const [localTab, setLocalTab] = useState("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine current active tab ID logic
  let currentTabId = isTestingMode ? localTab : "";
  if (!isTestingMode) {
    if (location.pathname.includes("/estudiantes/")) {
      currentTabId = "student-profile";
    } else if (location.pathname.includes("/admin/lanzador")) {
      currentTabId = "lanzador";
    } else if (location.pathname.includes("/admin/gestion")) {
      currentTabId = "gestion";
    } else if (location.pathname.includes("/admin/solicitudes")) {
      currentTabId = "solicitudes";
    } else if (location.pathname.includes("/admin/metrics")) {
      currentTabId = "metrics";
    } else if (location.pathname.includes("/admin/herramientas")) {
      currentTabId = "herramientas";
    } else {
      currentTabId = "dashboard";
    }
  }

  // On mobile, if navigating to a non-mobile tab, redirect to dashboard
  useEffect(() => {
    if (
      isMobile &&
      !isTestingMode &&
      !MOBILE_TAB_IDS.has(currentTabId) &&
      currentTabId !== "student-profile"
    ) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isMobile, currentTabId, isTestingMode, navigate]);

  // Build tabs list dynamically
  const navItems = useMemo<TabItem[]>(() => {
    const baseTabs: TabItem[] = [
      { id: "dashboard", label: "Inicio", icon: "dashboard", path: "/admin/dashboard" },
      { id: "lanzador", label: "Lanzador", icon: "rocket_launch", path: "/admin/lanzador" },
    ];

    // Gestión always visible (required on mobile)
    baseTabs.push({ id: "gestion", label: "Gestión", icon: "tune", path: "/admin/gestion" });

    // Desktop-only tabs
    if (!isMobile) {
      baseTabs.push(
        { id: "solicitudes", label: "Solicitudes", icon: "list_alt", path: "/admin/solicitudes" },
        { id: "metrics", label: "Métricas", icon: "analytics", path: "/admin/metrics" },
        {
          id: "herramientas",
          label: "Taller",
          icon: "construction",
          path: "/admin/herramientas",
        }
      );
    }

    // Dynamic Student Tab (desktop only)
    if (!isMobile && !isTestingMode && currentTabId === "student-profile") {
      baseTabs.push({
        id: "student-profile",
        label: `Alumno ${params.legajo}`,
        icon: "school",
        path: location.pathname,
      });
    }

    return baseTabs;
  }, [isTestingMode, currentTabId, params.legajo, location.pathname, isMobile]);

  const handleTabChange = (tabId: string, path?: string) => {
    if (isTestingMode) {
      setLocalTab(tabId);
    } else if (path) {
      navigate(path);
    }
  };

  const handleCloseStudentTab = (_id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("/admin/herramientas");
  };

  const handleTestStudentSelect = (student: any) => {
    alert("Navegación simulada al perfil de: " + student.nombre + " (" + student.legajo + ")");
  };

  const renderContent = () => {
    if (!isTestingMode) {
      return (
        <React.Suspense fallback={<AdminDashboardSkeleton />}>
          <Outlet />
        </React.Suspense>
      );
    }

    // Mock routing for testing mode
    return (
      <React.Suspense fallback={<AdminDashboardSkeleton />}>
        <div className="animate-fade-in-up">
          {localTab === "dashboard" && <AdminDashboard />}
          {localTab === "lanzador" && <LanzadorView isTestingMode={true} />}
          {localTab === "gestion" &&
            (preferences.showManagementTab ? (
              <GestionView isTestingMode={true} />
            ) : (
              <div className="p-8 text-center text-slate-500">Módulo desactivado</div>
            ))}
          {localTab === "solicitudes" && <SolicitudesManager isTestingMode={true} />}
          {localTab === "metrics" && (
            <MetricsView
              onStudentSelect={handleTestStudentSelect}
              isTestingMode={true}
              onModalOpen={setIsModalOpen}
            />
          )}
          {localTab === "herramientas" && (
            <TallerView onStudentSelect={handleTestStudentSelect} isTestingMode={true} />
          )}
        </div>
      </React.Suspense>
    );
  };

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    return (
      <div className="admin-mobile-shell app-role-shell pb-[72px]">
        <header className="app-mobile-topbar no-print">
          <div className="app-brand">
            <div className="app-brand__mark" aria-hidden="true">
              ψ
            </div>
            <span className="app-brand__name">Mi Panel</span>
          </div>

          <div className="app-mobile-actions">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="app-icon-button"
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            >
              <span className="material-icons !text-[19px]" aria-hidden="true">
                {theme === "dark" ? "dark_mode" : "light_mode"}
              </span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="app-icon-button"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <span className="material-icons !text-[19px]" aria-hidden="true">
                logout
              </span>
            </button>
          </div>
        </header>

        <main className="relative z-10">{renderContent()}</main>

        <nav className="app-bottom-nav no-print" aria-label="Navegación de administración">
          <div className="app-bottom-nav__track">
            {navItems
              .filter((tab) => MOBILE_TAB_IDS.has(tab.id))
              .map((tab) => {
                const isActive = currentTabId === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id, tab.path)}
                    className={`app-bottom-nav__item${isActive ? " is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`Ir a ${tab.label}`}
                  >
                    <span className="material-icons app-bottom-nav__icon" aria-hidden="true">
                      {tab.icon}
                    </span>
                    <span className="app-bottom-nav__label">{tab.label}</span>
                    {isActive && <span className="app-bottom-nav__indicator" aria-hidden="true" />}
                  </button>
                );
              })}
          </div>
        </nav>

        <AppModals />
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───
  return (
    <div className="app-role-shell relative">
      <div className={isModalOpen ? "hidden" : ""}>
        <AdminTopBar
          navItems={navItems}
          currentTabId={currentTabId}
          onTabChange={handleTabChange}
          onTabClose={currentTabId === "student-profile" ? handleCloseStudentTab : undefined}
        />
      </div>

      <main className="relative z-10 w-full">{renderContent()}</main>

      <AppModals />
    </div>
  );
};

export default AdminView;
