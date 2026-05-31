import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useInicioData } from "../../hooks/useInicioData";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageHead } from "./dashboard/PageHead";
import { Briefing } from "./dashboard/Briefing";
import { DetectionBand } from "./dashboard/DetectionBand";
import { SolicitudesBand } from "./dashboard/SolicitudesBand";
import { DraftsPreview } from "./dashboard/DraftsPreview";
import { PrioritiesList } from "./dashboard/PrioritiesList";
import { AdminDashboardSkeleton } from "../Skeletons";
import { logger } from "../../utils/logger";

const AdminDashboard: React.FC = () => {
  const { authenticatedUser } = useAuth();
  const navigate = useNavigate();
  const data = useInicioData();
  const queryClient = useQueryClient();
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    try {
      const apiUrl = import.meta.env.VITE_HERMES_API_URL || "https://pps-hermes.n8n-blas.com.ar";
      const token =
        import.meta.env.VITE_HERMES_INTERNAL_TOKEN ||
        "8KqNm3vR7tYxL2pH9wJ4sZ6bF1cA5dG0eU8iO3kP4qX7vN2mL9";

      const response = await fetch(`${apiUrl}/tasks/daily_brief_from_db`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hermes-Token": token,
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      await queryClient.invalidateQueries();
    } catch (err) {
      logger.error("[Reanalizar] Error calling Hermes daily brief:", err);
      alert("No se pudo reanalizar en este momento. Por favor verificá la conexión con Hermes.");
    } finally {
      setIsReanalyzing(false);
    }
  };

  if (!data.loaded) return <AdminDashboardSkeleton />;

  return (
    <div
      className="admin-mobile-shell"
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        color: "var(--ink)",
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
      }}
    >
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px 64px" }}>
        <PageHead userName={authenticatedUser?.nombre || "Luis"} />

        {data.briefing && (
          <Briefing
            data={data.briefing}
            totalChats={data.briefing.totalChats}
            onReanalyze={handleReanalyze}
            isReanalyzing={isReanalyzing}
          />
        )}

        <DetectionBand
          metrics={data.detectionMetrics.map((m) => ({
            ...m,
            onClick: () => (m.href ? navigate(m.href) : navigate("/admin/gestion?view=hermes")),
          }))}
          onOpenHermes={() => navigate("/admin/gestion?view=hermes")}
        />

        <SolicitudesBand
          metrics={data.solicitudesMetrics.map((m) => ({
            ...m,
            onClick: () => (m.href ? navigate(m.href) : navigate("/admin/solicitudes")),
          }))}
          onOpenSolicitudes={() => navigate("/admin/solicitudes")}
        />

        {/* DraftsPreview now expects DraftPreview[] mapped to what it needs. We'll pass it. Wait, we should adapt DraftsPreview to take DraftPreview type. */}
        <DraftsPreview
          drafts={data.drafts as any}
          total={data.totalDrafts}
          onOpenHermes={() => navigate("/admin/gestion?view=hermes")}
          onOpenDraft={(d) => {
            // Deep-link al borrador puntual: si es mail con hilo conocido, abrimos
            // ese hilo; si es WhatsApp/seguimiento, la bandeja de contactos.
            if (d.canal === "mail" && d.threadId) {
              navigate(`/admin/gestion?view=mails&thread=${encodeURIComponent(d.threadId)}`);
            } else if (d.canal === "whatsapp") {
              navigate("/admin/gestion?view=contactos");
            } else {
              navigate("/admin/gestion?view=mails&filter=esperando");
            }
          }}
        />

        <PrioritiesList
          items={data.priorities.map((p) => ({
            ...p,
            onClick: () => navigate(p.href || "/admin/gestion?view=contactos"),
          }))}
        />

        <footer
          style={{
            marginTop: 8,
            paddingTop: 24,
            borderTop: "1px solid var(--rule-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div className="meta">Mi Panel Académico · PPS · UFLO Psicología</div>
          <div
            className="meta mono"
            style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11 }}
          >
            <span>v3.2 · build 2026.05.26</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="dot dot-ok dot-live" style={{ color: "var(--ok)" }}></span> Hermes
              online
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default AdminDashboard;
