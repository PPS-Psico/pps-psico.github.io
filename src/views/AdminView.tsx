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
      <div className="admin-mobile-shell min-h-screen bg-[var(--paper)] text-[var(--ink)] transition-colors duration-300 pb-[72px]">
        {/* ── COMPACT TOP BAR (mobile) ── */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b no-print"
          style={{
            background: "color-mix(in oklab, var(--paper) 90%, transparent)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderColor: "var(--rule-2)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "var(--ink)",
                color: "var(--paper)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              ψ
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Mi Panel
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ color: "var(--ink-3)" }}
              aria-label="Cambiar tema"
            >
              <span className="material-icons" style={{ fontSize: 19 }}>
                {theme === "dark" ? "dark_mode" : "light_mode"}
              </span>
            </button>
            <button
              onClick={logout}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ color: "var(--ink-3)" }}
              aria-label="Cerrar sesión"
            >
              <span className="material-icons" style={{ fontSize: 19 }}>
                logout
              </span>
            </button>
          </div>
        </header>

        {/* Mobile content area — full bleed */}
        <main className="relative z-10">{renderContent()}</main>

        {/* ── BOTTOM NAV BAR (mobile only) ── */}
        <nav
          className="fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex justify-around items-stretch">
            {navItems
              .filter((t) => MOBILE_TAB_IDS.has(t.id))
              .map((tab) => {
                const isActive = currentTabId === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id, tab.path)}
                    className={`
                    flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition duration-200
                    ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 dark:text-slate-500 active:text-slate-600"
                    }
                  `}
                  >
                    <span
                      className={`material-icons transition-transform duration-200 ${isActive ? "!text-[26px] scale-110" : "!text-[24px]"}`}
                    >
                      {tab.icon}
                    </span>
                    <span
                      className={`text-[10px] font-bold tracking-wide ${isActive ? "opacity-100" : "opacity-70"}`}
                    >
                      {tab.label}
                    </span>
                    {isActive && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-b-full bg-blue-600 dark:bg-blue-400" />
                    )}
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
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] relative transition-colors duration-300">
      {/* --- BARRA SUPERIOR UNIFICADA v3 --- */}
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
