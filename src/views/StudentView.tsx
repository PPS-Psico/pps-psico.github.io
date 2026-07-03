import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import Footer from "../components/layout/Footer";
import AppModals from "../components/AppModals";
import MobileBottomNav from "../components/layout/MobileBottomNav";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { StudentPanelProvider, useStudentPanel } from "../contexts/StudentPanelContext";
import type { TabId } from "../types";
import StudentDashboard from "./StudentDashboard";
import { PullToRefresh, TabTransitionWrapper } from "../components/layout/MobileTransitions";
import { useTabSwipe } from "../hooks/useSwipe";
import { useIsMobile } from "../hooks/useIsMobile";
import { isEmbedded } from "../utils/isEmbedded";

// Inner component to consume Context
const StudentLayout: React.FC = () => {
  const { authenticatedUser } = useAuth();
  const { finalizacionRequest } = useStudentPanel(); // Consume finalizationRequest
  const { resolvedTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Determine active tab from URL
  let activeTab: TabId = "inicio";
  if (location.pathname.includes("/convocatorias")) activeTab = "convocatorias";
  else if (location.pathname.includes("/aula")) activeTab = "aula";
  else if (location.pathname.includes("/practicas")) activeTab = "practicas";
  else if (location.pathname.includes("/solicitudes")) activeTab = "solicitudes";
  else if (location.pathname.includes("/perfil")) activeTab = "profile";

  const handleTabChange = (tabId: TabId) => {
    // Scroll to top on mobile when changing tabs
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (tabId === "inicio") navigate("/student");
    else if (tabId === "profile") navigate("/student/perfil");
    else navigate(`/student/${tabId}`);
  };

  const mobileNavTabs = [
    { id: "inicio" as TabId, label: "Inicio", icon: "home", path: "/student" },
    { id: "aula" as TabId, label: "Aula", icon: "book", path: "/student/aula" },
    {
      id: "practicas" as TabId,
      label: "Prácticas",
      icon: "work_history",
      path: "/student/practicas",
    },
    {
      id: "solicitudes" as TabId,
      label: "Solicitudes",
      icon: "list_alt",
      path: "/student/solicitudes",
    },
    { id: "profile" as TabId, label: "Perfil", icon: "person", path: "/student/perfil" },
  ];

  // Swipe gesture handling for mobile tab navigation
  const tabIds = mobileNavTabs.map((tab) => tab.id);
  const { swipeHandlers, style } = useTabSwipe({
    tabs: tabIds,
    activeTab: activeTab,
    onTabChange: handleTabChange,
    enabled: isMobile,
  });

  return (
    <div
      className="pb-28 md:pb-8 min-h-screen flex flex-col"
      style={{
        background: isEmbedded() ? "transparent" : resolvedTheme === "dark" ? "#0a0e1a" : "#fafaf7",
      }}
    >
      <main className="flex-grow md:block">
        {/* Montamos SOLO la rama del viewport actual (no las dos ocultas por CSS)
            para no duplicar el dashboard del estudiante en el DOM. */}
        {isMobile ? (
          // Mobile: pull-to-refresh y swipe, sin transiciones de página
          <div className="touch-pan-y animate-fade-in" {...swipeHandlers} style={style}>
            <PullToRefresh
              onRefresh={async () => {
                // Refresca los datos sin recargar la página: conserva scroll,
                // pestaña y sesión, y reusa el bundle ya cargado. invalidateQueries
                // refetchea todas las queries activas (datos del alumno) y la
                // promesa resuelve cuando terminan.
                await queryClient.invalidateQueries();
              }}
            >
              <StudentDashboard
                user={authenticatedUser as any}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </PullToRefresh>
          </div>
        ) : (
          // Desktop: sin transiciones
          <StudentDashboard
            user={authenticatedUser as any}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        )}
      </main>

      {/* Nota al pie por sección: solo escritorio. En mobile no se muestra, y se
          oculta también si hay una finalización en curso (tabs/info irrelevantes). */}
      {!finalizacionRequest && !isMobile && <Footer activeTab={activeTab} />}

      <AppModals />

      {/* Mobile Nav is also irrelevant if fully locked in finalization view, but for now we keep it or can hide it too */}
      {!finalizacionRequest && <MobileBottomNav tabs={mobileNavTabs} activeTabId={activeTab} />}
    </div>
  );
};

const StudentView: React.FC = () => {
  const { authenticatedUser } = useAuth();
  if (!authenticatedUser) return null;

  return (
    <StudentPanelProvider legajo={authenticatedUser.legajo}>
      <StudentLayout />
    </StudentPanelProvider>
  );
};

export default StudentView;
