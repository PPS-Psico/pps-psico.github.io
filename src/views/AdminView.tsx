import React, { lazy, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import AppModals from "../components/AppModals";
import Loader from "../components/Loader";
import UnifiedTabs, { TabItem } from "../components/UnifiedTabs";
import { useAdminPreferences } from "../contexts/AdminPreferencesContext";

// Components for Testing Mode
const AdminDashboard = lazy(() => import("../components/admin/AdminDashboard"));
const LanzadorView = lazy(() => import("./admin/LanzadorView"));
const GestionView = lazy(() => import("./admin/GestionView"));
const SolicitudesManager = lazy(() => import("../components/admin/SolicitudesManager"));
const HerramientasView = lazy(() => import("./admin/HerramientasView"));
const MetricsView = lazy(() => import("./admin/MetricsView"));
const RecordatoriosView = lazy(() => import("./admin/RecordatoriosView"));

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
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const isMobile = useIsMobile();

  const [localTab, setLocalTab] = useState("dashboard");
  const [scrolled, setScrolled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    } else if (location.pathname.includes("/admin/recordatorios")) {
      currentTabId = "recordatorios";
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
        {
          id: "recordatorios",
          label: "Recordatorios",
          icon: "notifications",
          path: "/admin/recordatorios",
        },
        { id: "metrics", label: "Métricas", icon: "analytics", path: "/admin/metrics" },
        {
          id: "herramientas",
          label: "Herramientas",
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
  }, [
    preferences.showManagementTab,
    isTestingMode,
    currentTabId,
    params.legajo,
    location.pathname,
    isMobile,
  ]);

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
        <React.Suspense
          fallback={
            <div className="flex justify-center p-20">
              <Loader />
            </div>
          }
        >
          <Outlet />
        </React.Suspense>
      );
    }

    // Mock routing for testing mode
    return (
      <React.Suspense
        fallback={
          <div className="flex justify-center p-20">
            <Loader />
          </div>
        }
      >
        <div className="animate-fade-in-up">
          {localTab === "dashboard" && <AdminDashboard isTestingMode={true} />}
          {localTab === "lanzador" && <LanzadorView isTestingMode={true} />}
          {localTab === "gestion" &&
            (preferences.showManagementTab ? (
              <GestionView isTestingMode={true} />
            ) : (
              <div className="p-8 text-center text-slate-500">Módulo desactivado</div>
            ))}
          {localTab === "solicitudes" && <SolicitudesManager isTestingMode={true} />}
          {localTab === "recordatorios" && <RecordatoriosView />}
          {localTab === "metrics" && (
            <MetricsView
              onStudentSelect={handleTestStudentSelect}
              isTestingMode={true}
              onModalOpen={setIsModalOpen}
            />
          )}
          {localTab === "herramientas" && (
            <HerramientasView onStudentSelect={handleTestStudentSelect} isTestingMode={true} />
          )}
        </div>
      </React.Suspense>
    );
  };

  // Estilos dinámicos para el header
  const headerClasses = scrolled
    ? "bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl border-slate-200/50 dark:border-white/5 shadow-sm py-3"
    : "bg-transparent border-transparent py-6";

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    return (
      <div className="admin-mobile-shell min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-[72px]">
        {/* Mobile content area — full bleed, no header capsule */}
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
                    flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition-all duration-200
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

  // ─── DESKTOP LAYOUT (unchanged) ───
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 relative transition-colors duration-300">
      {/* Background Ambient Glows (Subtle) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/5 dark:bg-blue-900/10 blur-[120px]"></div>
        <div className="absolute top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-400/5 dark:bg-indigo-900/10 blur-[120px]"></div>
      </div>

      {/* --- UNIFIED STICKY HEADER --- */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 border-b ${headerClasses} ${isModalOpen ? "hidden" : ""}`}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center relative">
            {/* Centered Navigation Capsule */}
            <div className="flex-1 flex justify-center w-full md:w-auto overflow-x-auto no-scrollbar">
              <UnifiedTabs
                tabs={navItems}
                activeTabId={currentTabId}
                onTabChange={handleTabChange}
                onTabClose={currentTabId === "student-profile" ? handleCloseStudentTab : undefined}
                layoutIdPrefix="admin-main-nav"
                className="shadow-lg shadow-slate-200/30 dark:shadow-black/20"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderContent()}
      </main>

      <AppModals />
    </div>
  );
};

export default AdminView;
