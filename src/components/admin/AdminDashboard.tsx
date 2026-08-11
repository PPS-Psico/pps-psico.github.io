import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { useInicioData } from "../../hooks/useInicioData";
import { callHermes, HermesError } from "../../services/hermesClient";
import { logger } from "../../utils/logger";
import { AdminDashboardSkeleton } from "../Skeletons";
import { Briefing } from "./dashboard/Briefing";
import { DashboardDataStatus } from "./dashboard/DashboardDataStatus";
import { DetectionBand } from "./dashboard/DetectionBand";
import { DraftsPreview } from "./dashboard/DraftsPreview";
import { PageHead } from "./dashboard/PageHead";
import { PrioritiesList } from "./dashboard/PrioritiesList";
import { SolicitudesBand } from "./dashboard/SolicitudesBand";
import HermesStatus from "./HermesStatus";

const AdminDashboard: React.FC = () => {
  const { authenticatedUser } = useAuth();
  const { showModal } = useModal();
  const navigate = useNavigate();
  const data = useInicioData();
  const queryClient = useQueryClient();
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const refreshInicioData = () =>
    queryClient.invalidateQueries({
      predicate: ({ queryKey }) => {
        const rootKey = queryKey[0];
        return (
          typeof rootKey === "string" && (rootKey.startsWith("inicio_") || rootKey === "gmailHilos")
        );
      },
    });

  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    try {
      // Sale por la Edge Function `hermes-proxy`: el token vive en el servidor.
      await callHermes("daily_brief_from_db", {}, 60000);
      await refreshInicioData();
      showModal(
        "Análisis actualizado",
        "Hermes terminó el análisis y los datos de Inicio se actualizaron.",
        "success"
      );
    } catch (err) {
      logger.error("[Reanalizar] Error calling Hermes daily brief:", err);
      showModal(
        "No se pudo reanalizar",
        err instanceof HermesError
          ? err.message
          : "No se pudo contactar a Hermes en este momento. Probá de nuevo en un rato.",
        "error"
      );
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
        <PageHead userName={authenticatedUser?.nombre ?? ""} />
        <DashboardDataStatus status={data.status} onRetry={() => void refreshInicioData()} />

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
            onClick: () => (m.href ? navigate(m.href) : navigate("/admin/gestion?view=mails")),
          }))}
          onOpenHermes={() => navigate("/admin/gestion?view=mails")}
        />

        <SolicitudesBand
          metrics={data.solicitudesMetrics.map((m) => ({
            ...m,
            onClick: () => (m.href ? navigate(m.href) : navigate("/admin/solicitudes")),
          }))}
          onOpenSolicitudes={() => navigate("/admin/solicitudes")}
        />

        <DraftsPreview
          drafts={data.drafts}
          total={data.totalDrafts}
          onOpenHermes={() => navigate("/admin/gestion?view=mails")}
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
          <HermesStatus showVersion className="meta mono" />
        </footer>
      </main>
    </div>
  );
};

export default AdminDashboard;
