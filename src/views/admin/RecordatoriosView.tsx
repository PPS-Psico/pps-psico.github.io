import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS,
} from "../../constants";
import { useReminders } from "../../hooks/useReminders";
import { useGestionConvocatorias } from "../../hooks/useGestionConvocatorias";
import { useAuth } from "../../contexts/AuthContext";
import { StatusBadge, ActionButton, AdminCard } from "../../components/ui/admin";
import { SearchBar, FilterTabs } from "../../components/admin/SearchAndFilter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Loader from "../../components/Loader";
import EmptyState from "../../components/EmptyState";
import { getGroupName, normalizeStringForComparison, parseToUTCDate } from "../../utils/formatters";
import type { LanzamientoPPS } from "../../types";

type FilterType = "all" | "today" | "overdue" | "upcoming" | "completed";

interface RecordatoriosViewProps {
  isTestingMode?: boolean;
  embedded?: boolean;
}

interface GestionReminder {
  id: string;
  title: string;
  description: string;
  ppsName: string;
  dueDate: Date;
  type: "contactar" | "seguimiento" | "vencimiento";
  status: "overdue" | "today" | "upcoming";
  phone?: string;
  daysLeft?: number;
}

const RecordatoriosView: React.FC<RecordatoriosViewProps> = ({
  isTestingMode = false,
  embedded = false,
}) => {
  const { authenticatedUser } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const {
    reminders,
    todayReminders,
    overdueReminders,
    weekReminders,
    counts,
    isLoading,
    completeReminder,
    snoozeReminder,
  } = useReminders(authenticatedUser?.id);
  const {
    filteredData,
    institutionsMap,
    loadingState: gestionLoadingState,
  } = useGestionConvocatorias({
    isTestingMode,
  });

  const gestionReminders = React.useMemo<GestionReminder[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const unique = new Map<string, LanzamientoPPS & Record<string, any>>();
    [
      ...filteredData.porContactar,
      ...filteredData.contactadasEsperandoRespuesta,
      ...filteredData.respondidasPendienteDecision,
      ...filteredData.activasPorFinalizar,
      ...filteredData.relanzamientosConfirmados.filter(
        (pps: any) => typeof pps.daysLeft === "number" && pps.daysLeft >= 0 && pps.daysLeft <= 45
      ),
    ].forEach((pps) => unique.set(pps.id, pps as LanzamientoPPS & Record<string, any>));

    return Array.from(unique.values())
      .map((pps): GestionReminder | null => {
        const name = pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "PPS sin nombre";
        const groupName = getGroupName(name);
        const institution = institutionsMap.get(normalizeStringForComparison(groupName));
        const status = normalizeStringForComparison(pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] || "");
        const scheduledDate = parseToUTCDate(pps[FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS]);

        let dueDate = scheduledDate;
        let title = `Seguimiento: ${groupName}`;
        let description = "Revisar el próximo paso de gestión institucional.";
        let type: GestionReminder["type"] = "seguimiento";

        if (!dueDate && status === "pendiente de gestion") {
          dueDate = today;
          title = `Contactar: ${groupName}`;
          description = "Institución finalizada sin gestión iniciada.";
          type = "contactar";
        }

        if (!dueDate && status === "esperando respuesta" && (pps.daysWaiting || 0) >= 2) {
          dueDate = today;
          title = `Reinsistir: ${groupName}`;
          description = `Sin respuesta hace ${pps.daysWaiting} días.`;
        }

        if (!dueDate && status === "en conversacion" && (pps.daysSinceResponse || 0) >= 2) {
          dueDate = today;
          title = `Definir avance: ${groupName}`;
          description = `Conversación sin actualización hace ${pps.daysSinceResponse} días.`;
        }

        if (!dueDate && typeof pps.daysLeft === "number") {
          dueDate = today;
          dueDate.setDate(today.getDate() + Math.max(pps.daysLeft, 0));
          title = `Por finalizar: ${groupName}`;
          description = `La PPS finaliza en ${pps.daysLeft} días. Preparar contacto o relanzamiento.`;
          type = "vencimiento";
        }

        if (!dueDate) return null;

        dueDate.setHours(0, 0, 0, 0);
        const itemStatus = dueDate < today ? "overdue" : dueDate < tomorrow ? "today" : "upcoming";

        return {
          id: pps.id,
          title,
          description,
          ppsName: name,
          dueDate,
          type,
          status: itemStatus,
          phone: institution?.phone,
          daysLeft: typeof pps.daysLeft === "number" ? pps.daysLeft : undefined,
        };
      })
      .filter((item): item is GestionReminder => Boolean(item))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [filteredData, institutionsMap]);

  const filteredGestionReminders = React.useMemo(() => {
    let filtered = gestionReminders;

    switch (filter) {
      case "today":
        filtered = filtered.filter((item) => item.status === "today");
        break;
      case "overdue":
        filtered = filtered.filter((item) => item.status === "overdue");
        break;
      case "upcoming":
        filtered = filtered.filter((item) => item.status === "upcoming");
        break;
      case "completed":
        filtered = [];
        break;
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(searchLower) ||
          item.ppsName.toLowerCase().includes(searchLower) ||
          item.description.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [filter, gestionReminders, searchTerm]);

  const upcomingEndingReminders = React.useMemo(
    () =>
      filteredGestionReminders
        .filter((item) => item.type === "vencimiento")
        .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)),
    [filteredGestionReminders]
  );

  const followUpReminders = React.useMemo(
    () => filteredGestionReminders.filter((item) => item.type !== "vencimiento"),
    [filteredGestionReminders]
  );

  const gestionCounts = React.useMemo(
    () => ({
      total: gestionReminders.length,
      today: gestionReminders.filter((item) => item.status === "today").length,
      overdue: gestionReminders.filter((item) => item.status === "overdue").length,
      week: gestionReminders.filter((item) => item.status !== "overdue").length,
    }),
    [gestionReminders]
  );

  const combinedCounts = {
    total: counts.total + gestionCounts.total,
    today: counts.today + gestionCounts.today,
    overdue: counts.overdue + gestionCounts.overdue,
    week: counts.week + gestionCounts.week,
  };

  const getFilteredReminders = () => {
    let filtered = reminders;

    // Aplicar filtro por estado
    switch (filter) {
      case "today":
        filtered = todayReminders;
        break;
      case "overdue":
        filtered = overdueReminders;
        break;
      case "upcoming":
        filtered = weekReminders.filter((r) => !todayReminders.find((t) => t.id === r.id));
        break;
      case "completed":
        filtered = reminders.filter((r) => r.completed);
        break;
    }

    // Aplicar búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(searchLower) ||
          r.pps_name?.toLowerCase().includes(searchLower) ||
          r.description?.toLowerCase().includes(searchLower)
      );
    }

    // Ordenar: primero no completados, luego por fecha
    return filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  };

  const filteredReminders = getFilteredReminders();

  const getStatusBadge = (reminder: any) => {
    if (reminder.completed) {
      return <StatusBadge status="success">Completado</StatusBadge>;
    }

    const dueDate = new Date(reminder.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      return <StatusBadge status="error">Vencido</StatusBadge>;
    }

    if (dueDate.toDateString() === today.toDateString()) {
      return <StatusBadge status="warning">Hoy</StatusBadge>;
    }

    return <StatusBadge status="info">Próximo</StatusBadge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "contactar":
        return "phone";
      case "seguimiento":
        return "follow_the_signs";
      case "lanzamiento":
        return "rocket_launch";
      case "vencimiento":
        return "event_busy";
      case "acreditacion":
        return "verified";
      default:
        return "notifications";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "contactar":
        return "Contactar";
      case "seguimiento":
        return "Seguimiento";
      case "lanzamiento":
        return "Lanzamiento";
      case "vencimiento":
        return "Vencimiento";
      case "acreditacion":
        return "Acreditación";
      default:
        return type;
    }
  };

  if (isLoading || gestionLoadingState === "initial" || gestionLoadingState === "loading") {
    return (
      <div className="flex justify-center p-20">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {embedded ? "Agenda de Gestión" : "Mis Recordatorios"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {embedded
              ? "Tareas de contacto, seguimientos y recordatorios en un solo lugar"
              : "Gestiona tus tareas pendientes y seguimientos"}
          </p>
        </div>
        {!embedded && (
          <div className="flex gap-3">
            <ActionButton
              variant="secondary"
              icon="dashboard"
              onClick={() => navigate("/admin/dashboard")}
            >
              Volver al Dashboard
            </ActionButton>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminCard
          variant="elevated"
          className="border-purple-200 dark:border-purple-800"
          padding="sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <span className="material-icons text-purple-600 dark:text-purple-400">
                notifications
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {combinedCounts.total}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
            </div>
          </div>
        </AdminCard>

        <AdminCard
          variant="elevated"
          className="border-amber-200 dark:border-amber-800"
          padding="sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <span className="material-icons text-amber-600 dark:text-amber-400">today</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {combinedCounts.today}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Hoy</p>
            </div>
          </div>
        </AdminCard>

        <AdminCard variant="elevated" className="border-rose-200 dark:border-rose-800" padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
              <span className="material-icons text-rose-600 dark:text-rose-400">warning</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {combinedCounts.overdue}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Vencidos</p>
            </div>
          </div>
        </AdminCard>

        <AdminCard variant="elevated" className="border-blue-200 dark:border-blue-800" padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="material-icons text-blue-600 dark:text-blue-400">
                calendar_view_week
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {combinedCounts.week}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Esta semana</p>
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar recordatorios..."
          className="w-full md:w-96"
        />

        <FilterTabs
          options={[
            { value: "all", label: "Todos", count: combinedCounts.total },
            { value: "today", label: "Hoy", count: combinedCounts.today },
            { value: "overdue", label: "Vencidos", count: combinedCounts.overdue },
            {
              value: "upcoming",
              label: "Próximos",
              count: combinedCounts.week - combinedCounts.today,
            },
            {
              value: "completed",
              label: "Completados",
              count: reminders.filter((r) => r.completed).length,
            },
          ]}
          value={filter}
          onChange={(value) => setFilter(value as FilterType)}
        />
      </div>

      {upcomingEndingReminders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-icons text-emerald-600 dark:text-emerald-400">
                event_upcoming
              </span>
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                Próximas PPS a finalizar
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Próximos 45 días
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {upcomingEndingReminders.map((item) => (
              <AdminCard
                key={item.id}
                variant="elevated"
                className={
                  (item.daysLeft ?? 999) <= 7
                    ? "border-rose-200 dark:border-rose-800"
                    : "border-emerald-200 dark:border-emerald-800"
                }
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className={`p-3 rounded-xl ${
                        (item.daysLeft ?? 999) <= 7
                          ? "bg-rose-50 dark:bg-rose-900/20"
                          : "bg-emerald-50 dark:bg-emerald-900/20"
                      }`}
                    >
                      <span
                        className={`material-icons ${
                          (item.daysLeft ?? 999) <= 7
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        event_busy
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">
                          {item.ppsName}
                        </h3>
                        <StatusBadge status={(item.daysLeft ?? 999) <= 7 ? "error" : "warning"}>
                          {item.daysLeft === 0 ? "Finaliza hoy" : `Faltan ${item.daysLeft} días`}
                        </StatusBadge>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Contactar a la institución antes del cierre para evaluar continuidad o
                        relanzamiento.
                      </p>
                      <div className="flex items-center gap-4 text-sm mt-2">
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <span className="material-icons text-sm">event</span>
                          {format(item.dueDate, "dd/MM/yyyy", { locale: es })}
                        </span>
                        {item.phone && (
                          <a
                            href={`https://wa.me/${item.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            <span className="material-icons text-sm">whatsapp</span>
                            Contactar
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <ActionButton
                    variant="primary"
                    size="sm"
                    icon="arrow_forward"
                    onClick={() => navigate("/admin/gestion?filter=confirmadas")}
                  >
                    Ver PPS
                  </ActionButton>
                </div>
              </AdminCard>
            ))}
          </div>
        </div>
      )}

      {followUpReminders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-icons text-blue-600 dark:text-blue-400">tune</span>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Seguimientos de gestión
            </h2>
          </div>
          {followUpReminders.map((item) => (
            <AdminCard key={item.id} variant="elevated">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <span className="material-icons text-blue-600 dark:text-blue-400">
                      {getTypeIcon(item.type)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <StatusBadge
                        status={
                          item.status === "overdue"
                            ? "error"
                            : item.status === "today"
                              ? "warning"
                              : "info"
                        }
                      >
                        {item.status === "overdue"
                          ? "Vencido"
                          : item.status === "today"
                            ? "Hoy"
                            : "Próximo"}
                      </StatusBadge>
                      <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full font-bold">
                        Gestión
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                      <span className="font-medium">PPS:</span> {item.ppsName}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <span className="material-icons text-sm">event</span>
                        {format(item.dueDate, "dd/MM/yyyy", { locale: es })}
                      </span>
                      {item.phone && (
                        <a
                          href={`https://wa.me/${item.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                          <span className="material-icons text-sm">whatsapp</span>
                          Contactar
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <ActionButton
                  variant="primary"
                  size="sm"
                  icon="arrow_forward"
                  onClick={() => navigate("/admin/gestion?filter=demoradas")}
                >
                  Ir a gestión
                </ActionButton>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* Reminders List */}
      <div className="space-y-4">
        {filteredReminders.length > 0 ? (
          filteredReminders.map((reminder) => (
            <AdminCard
              key={reminder.id}
              variant={reminder.completed ? "default" : "elevated"}
              className={`transition-all ${reminder.completed ? "opacity-60" : ""}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${
                      reminder.completed
                        ? "bg-slate-100 dark:bg-slate-800"
                        : "bg-blue-50 dark:bg-blue-900/20"
                    }`}
                  >
                    <span
                      className={`material-icons ${
                        reminder.completed ? "text-slate-400" : "text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {getTypeIcon(reminder.type)}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3
                        className={`font-bold text-lg ${
                          reminder.completed
                            ? "text-slate-500 line-through"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {reminder.title}
                      </h3>
                      {getStatusBadge(reminder)}
                      <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                        {getTypeLabel(reminder.type)}
                      </span>
                    </div>

                    {reminder.pps_name && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        <span className="font-medium">PPS:</span> {reminder.pps_name}
                      </p>
                    )}

                    {reminder.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                        {reminder.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      <span
                        className={`flex items-center gap-1 ${
                          new Date(reminder.due_date) < new Date() && !reminder.completed
                            ? "text-rose-600 dark:text-rose-400 font-medium"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <span className="material-icons text-sm">event</span>
                        {format(new Date(reminder.due_date), "dd/MM/yyyy", {
                          locale: es,
                        })}
                      </span>

                      {reminder.institution_phone && (
                        <a
                          href={`https://wa.me/${reminder.institution_phone.replace(
                            /[^0-9]/g,
                            ""
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="material-icons text-sm">whatsapp</span>
                          Contactar
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!reminder.completed && (
                    <>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        icon="snooze"
                        title="Posponer 24 horas"
                        onClick={() => snoozeReminder(reminder.id, 24)}
                      >
                        Posponer
                      </ActionButton>
                      <ActionButton
                        variant="primary"
                        size="sm"
                        icon="check"
                        onClick={() => completeReminder(reminder.id)}
                      >
                        Completar
                      </ActionButton>
                    </>
                  )}
                  {reminder.completed && (
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span className="material-icons text-emerald-500">check_circle</span>
                      Completado
                    </span>
                  )}
                </div>
              </div>
            </AdminCard>
          ))
        ) : filteredGestionReminders.length === 0 ? (
          <EmptyState
            icon="notifications_none"
            title="Sin recordatorios"
            message="No hay recordatorios que coincidan con los filtros seleccionados."
          />
        ) : null}
      </div>
    </div>
  );
};

export default RecordatoriosView;
