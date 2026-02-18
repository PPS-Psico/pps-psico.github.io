import { differenceInDays } from "date-fns";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FIELD_FECHA_FIN_LANZAMIENTOS, FIELD_NOMBRE_PPS_LANZAMIENTOS } from "../../constants";
import { useAuth } from "../../contexts/AuthContext";
import { useOperationalData } from "../../hooks/useOperationalData";
import { useReminders } from "../../hooks/useReminders";
import { formatDate, normalizeStringForComparison, parseToUTCDate } from "../../utils/formatters";
import EmptyState from "../EmptyState";
import { AdminDashboardSkeleton } from "../Skeletons";
import { ActionButton, AdminCard, StatusBadge } from "../ui/admin";
import Toast from "../ui/Toast";
import ActivityFeed from "./ActivityFeed";

interface AdminDashboardProps {
  isTestingMode?: boolean;
}

const ManagementCard: React.FC<{
  title: string;
  count: number;
  icon: string;
  color: "red" | "amber" | "emerald" | "blue";
  onClick: () => void;
  label: string;
  subCount?: number;
  subLabel?: string;
}> = ({ title, count, icon, color, onClick, label, subCount, subLabel }) => {
  const styles = {
    red: {
      hoverBorder: "group-hover:border-rose-300 dark:group-hover:border-rose-700",
      iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
      countText: "text-rose-700 dark:text-rose-400",
      hoverBg: "hover:bg-rose-50/50 dark:hover:bg-rose-900/10",
      gradient: "from-white to-rose-50/30 dark:from-slate-800 dark:to-rose-900/10",
      glow: "group-hover:shadow-rose-500/10",
    },
    amber: {
      hoverBorder: "group-hover:border-amber-300 dark:group-hover:border-amber-700",
      iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
      countText: "text-amber-700 dark:text-amber-400",
      hoverBg: "hover:bg-amber-50/50 dark:hover:bg-amber-900/10",
      gradient: "from-white to-amber-50/30 dark:from-slate-800 dark:to-amber-900/10",
      glow: "group-hover:shadow-amber-500/10",
    },
    emerald: {
      hoverBorder: "group-hover:border-emerald-300 dark:group-hover:border-emerald-700",
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
      countText: "text-emerald-700 dark:text-emerald-400",
      hoverBg: "hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10",
      gradient: "from-white to-emerald-50/30 dark:from-slate-800 dark:to-emerald-900/10",
      glow: "group-hover:shadow-emerald-500/10",
    },
    blue: {
      hoverBorder: "group-hover:border-blue-300 dark:group-hover:border-blue-700",
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
      countText: "text-blue-700 dark:text-blue-400",
      hoverBg: "hover:bg-blue-50/50 dark:hover:bg-blue-900/10",
      gradient: "from-white to-blue-50/30 dark:from-slate-800 dark:to-blue-900/10",
      glow: "group-hover:shadow-blue-500/10",
    },
  };

  const style = styles[color];

  return (
    <button
      onClick={onClick}
      className={`flex flex-col p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-gradient-to-br ${style.gradient} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${style.glow} text-left group ${style.hoverBorder}`}
    >
      <div className="flex justify-between items-start w-full mb-4">
        <div className={`p-3 rounded-xl shadow-sm transition-colors ${style.iconBg}`}>
          <span className="material-icons !text-2xl">{icon}</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 text-slate-400 dark:text-slate-500">
          <span className="material-icons !text-xl">arrow_forward</span>
        </div>
      </div>

      <div className="mt-auto w-full">
        <div className="flex justify-between items-end mb-1">
          <span className={`text-4xl font-black tracking-tight ${style.countText}`}>{count}</span>
          {subCount !== undefined && subCount > 0 && (
            <span className="text-[10px] font-bold bg-white/50 dark:bg-black/20 backdrop-blur-sm text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full mb-1 border border-slate-200/50 dark:border-slate-700/50">
              {subCount} {subLabel}
            </span>
          )}
        </div>
        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">{title}</h4>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      </div>
    </button>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isTestingMode = false }) => {
  const { authenticatedUser } = useAuth();
  const navigate = useNavigate();
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const {
    data: opData,
    isLoading: isOpLoading,
    error: opError,
  } = useOperationalData(isTestingMode);

  // Hook de recordatorios
  const {
    todayReminders,
    overdueReminders,
    weekReminders,
    counts,
    isLoading: isRemindersLoading,
    completeReminder,
  } = useReminders(authenticatedUser?.id);

  if (isOpLoading) return <AdminDashboardSkeleton />;

  if (opError) {
    return <EmptyState icon="error" title="Error" message={(opError as any)?.message} />;
  }

  const now = new Date();

  // --- ESTADOS CONCLUSIVOS ---
  const conclusiveStatuses = [
    "relanzamiento confirmado",
    "relanzada",
    "archivado",
    "no se relanza",
  ];

  // --- INSTITUCIONES VENCIDAS ---
  // PPS que finalizaron (daysLeft < 0) y NO tienen estado conclusivo → necesitan gestión
  const allLaunches = opData?.endingLaunches || [];
  const overdueLaunches = allLaunches.filter((l: any) => {
    const endDate = parseToUTCDate(l[FIELD_FECHA_FIN_LANZAMIENTOS]);
    if (!endDate) return false;
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    if (daysLeft >= 0) return false;
    const status = normalizeStringForComparison(l.estado_gestion || "");
    return !conclusiveStatuses.includes(status);
  });

  const uniqueOverdueInstitutions = new Set(
    overdueLaunches.map((l: any) => {
      const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "";
      return name.split(" - ")[0].trim();
    })
  );
  const overdueCount = uniqueOverdueInstitutions.size;

  // --- DEMORADAS (2+ días sin actualización a estado conclusivo) ---
  // Gestiones en estados activos (Esperando Respuesta, En Conversación, Pendiente de Gestión)
  // que no se actualizaron en más de 2 días
  let stagnantCount = 0;
  const stagnantLaunches = allLaunches.filter((l: any) => {
    const status = normalizeStringForComparison(l.estado_gestion || "");
    // Solo contar estados no conclusivos (activos en gestión)
    if (conclusiveStatuses.includes(status)) return false;
    // Must have an update timestamp
    const lastUpdate = l.updated_at || l.created_at;
    if (!lastUpdate) return false;
    const daysSinceUpdate = differenceInDays(now, new Date(lastUpdate));
    return daysSinceUpdate >= 2;
  });
  stagnantCount = new Set(
    stagnantLaunches.map((l: any) => {
      const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "";
      return name.split(" - ")[0].trim();
    })
  ).size;

  const accreditationCount = (opData?.pendingFinalizations || []).length;

  // --- PRÓXIMAS A VENCER ---
  // PPS activas (daysLeft >= 0 && <= 30) que necesitan seguimiento para relanzamiento
  const upcomingCount = allLaunches.filter((l: any) => l.daysLeft >= 0 && l.daysLeft <= 30).length;

  return (
    <div className="space-y-12 animate-fade-in-up pb-10">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {/* --- ALERTAS DE ACCIÓN REQUERIDA (Cierre de Convocatorias) --- */}
      {opData?.closingAlerts && opData.closingAlerts.length > 0 && (
        <div className="mx-4 md:mx-0 p-5 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 border-l-4 border-orange-500 dark:border-orange-400 rounded-r-xl shadow-lg animate-fade-in-up">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-800/30 rounded-lg border border-orange-200 dark:border-orange-600 text-orange-700 dark:text-orange-300 shadow-sm">
              <span className="material-icons !text-2xl">warning_amber</span>
            </div>
            <div className="flex-1 w-full">
              <h4 className="font-black text-orange-900 dark:text-orange-100 text-base uppercase tracking-wide mb-2 flex items-center gap-2">
                Acción Requerida: Cierre de Inscripciones
                {opData.closingAlerts.length > 1 && (
                  <button
                    onClick={() => {
                      // Dismiss all alerts at once
                      setToastInfo({
                        message: `Se han descartado todas las alertas de cierre`,
                        type: "success",
                      });
                    }}
                    className="ml-auto text-xs text-orange-600/60 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-200 transition-colors"
                    title="Descartar todas las alertas"
                  >
                    <span className="material-icons !text-base">close</span>
                  </button>
                )}
              </h4>
              <p className="text-sm text-orange-800/90 dark:text-orange-200/80 mb-4 leading-relaxed">
                Las siguientes convocatorias inician pronto y deben cerrarse para seleccionar
                estudiantes.
              </p>
              <div className="space-y-3">
                {opData.closingAlerts.map((alert: any, idx: number) => (
                  <div
                    key={alert.id}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/95 dark:bg-slate-800/90 p-4 rounded-xl border border-orange-200/50 dark:border-orange-800/40 shadow-md hover:shadow-lg hover:border-orange-300/50 dark:hover:border-orange-600/50 transition-all duration-300 gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-2 flex items-center gap-2">
                        <span>{alert.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300 font-medium">
                          {alert.isClosingToday
                            ? "¡HOY!"
                            : alert.daysRemaining < 0
                              ? "VENCIDA"
                              : `${alert.daysRemaining} días`}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Cierre:
                        </span>
                        <span
                          className={`text-sm font-mono font-semibold ${alert.daysRemaining <= 0 ? "text-rose-600 dark:text-rose-400" : alert.isClosingToday ? "text-orange-600 dark:text-orange-400" : "text-amber-700 dark:text-amber-400"}`}
                        >
                          {formatDate(alert.closingDate)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        navigate(
                          `/admin/lanzador?tab=seleccionador&launchId=${alert.lanzamientoId}`
                        )
                      }
                      className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl transition-all duration-200 shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 min-w-[180px] md:min-w-[200px]"
                    >
                      <span className="material-icons !text-lg">list_alt</span>
                      <span>VER INSCRIPTOS</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SECCIÓN RECORDATORIOS (desktop only) --- */}
      {!isMobile && (counts.today > 0 || counts.overdue > 0) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1 bg-purple-600 rounded-full"></div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                Mis Recordatorios
                {(counts.today > 0 || counts.overdue > 0) && (
                  <StatusBadge status="info" size="sm">
                    {counts.today + counts.overdue} pendientes
                  </StatusBadge>
                )}
              </h3>
            </div>
            <ActionButton
              variant="ghost"
              size="sm"
              icon="arrow_forward"
              iconPosition="right"
              onClick={() => navigate("/admin/recordatorios")}
            >
              Ver todos
            </ActionButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4">
            {/* Recordatorios de hoy */}
            {todayReminders.length > 0 && (
              <AdminCard
                variant="elevated"
                className="border-purple-200 dark:border-purple-800"
                header={
                  <div className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                    <span className="material-icons text-purple-600">today</span>
                    <h4 className="font-bold">Hoy ({todayReminders.length})</h4>
                  </div>
                }
              >
                <div className="space-y-2">
                  {todayReminders.slice(0, 3).map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                          {reminder.title}
                        </p>
                        {reminder.pps_name && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {reminder.pps_name}
                          </p>
                        )}
                      </div>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        icon="check_circle"
                        onClick={() => completeReminder(reminder.id)}
                        className="text-emerald-600 hover:text-emerald-700"
                      />
                    </div>
                  ))}
                  {todayReminders.length > 3 && (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      icon="arrow_forward"
                      iconPosition="right"
                      onClick={() => navigate("/admin/recordatorios")}
                      className="w-full text-purple-600 hover:text-purple-700"
                    >
                      Ver {todayReminders.length - 3} más
                    </ActionButton>
                  )}
                </div>
              </AdminCard>
            )}

            {/* Recordatorios vencidos */}
            {overdueReminders.length > 0 && (
              <AdminCard
                variant="elevated"
                className="border-rose-200 dark:border-rose-800"
                header={
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
                    <span className="material-icons text-rose-600">warning</span>
                    <h4 className="font-bold">Vencidos ({overdueReminders.length})</h4>
                  </div>
                }
              >
                <div className="space-y-2">
                  {overdueReminders.slice(0, 3).map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                          {reminder.title}
                        </p>
                        <StatusBadge status="error" size="sm" dot>
                          Venció hace{" "}
                          {Math.abs(
                            Math.floor(
                              (new Date().getTime() - new Date(reminder.due_date).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          )}{" "}
                          días
                        </StatusBadge>
                      </div>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        icon="check_circle"
                        onClick={() => completeReminder(reminder.id)}
                        className="text-emerald-600 hover:text-emerald-700"
                      />
                    </div>
                  ))}
                  {overdueReminders.length > 3 && (
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      icon="arrow_forward"
                      iconPosition="right"
                      onClick={() => navigate("/admin/recordatorios")}
                      className="w-full text-rose-600 hover:text-rose-700"
                    >
                      Ver {overdueReminders.length - 3} más
                    </ActionButton>
                  )}
                </div>
              </AdminCard>
            )}
          </div>
        </section>
      )}

      {/* --- SECCIÓN GESTIÓN: GRID DE TARJETAS --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-4">
          <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">
            Estado Operativo
          </h3>
        </div>
        <div
          className={`grid gap-6 ${isMobile ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}
        >
          <ManagementCard
            title="Instituciones Vencidas"
            count={overdueCount}
            label="Finalizadas sin relanzar"
            icon="event_busy"
            color="red"
            onClick={() => navigate("/admin/gestion?filter=vencidas")}
          />
          {!isMobile && (
            <ManagementCard
              title="Demoradas"
              count={stagnantCount}
              label="Sin cambio +2 días"
              icon="hourglass_empty"
              color="amber"
              onClick={() => navigate("/admin/gestion?filter=demoradas")}
            />
          )}
          {!isMobile && (
            <ManagementCard
              title="Acreditaciones"
              count={accreditationCount}
              label="Pendientes de carga"
              icon="verified"
              color="emerald"
              onClick={() => navigate("/admin/solicitudes?tab=egreso")}
            />
          )}
          <ManagementCard
            title="Próximas a Vencer"
            count={upcomingCount}
            label="Vencen en 30 días"
            icon="update"
            color="blue"
            onClick={() => navigate("/admin/gestion?filter=proximas")}
          />
        </div>
      </section>

      {/* --- SECCIÓN FEED: ACTIVIDAD RECIENTE --- */}
      <section className="pt-4">
        <ActivityFeed isTestingMode={isTestingMode} />
      </section>
    </div>
  );
};

export default AdminDashboard;
