import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FIELD_NOMBRE_PPS_LANZAMIENTOS } from "../../constants";
import type { LanzamientoPPS } from "../../types";
import { getGroupName } from "../../utils/formatters";
import { getPpsInstitutionContact, type InstitutionContact } from "../../utils/institutionContacts";

type ActionTone = "rose" | "amber" | "blue" | "emerald" | "slate" | "purple";

interface AdminActionCenterProps {
  filteredData: any;
  institutionsMap?: Map<string, InstitutionContact>;
  isLoading?: boolean;
  pendingRequestsCount?: number;
  pendingFinalizationsCount?: number;
  pendingCorrectionsCount?: number;
  pendingClassificationsCount?: number;
  compact?: boolean;
}

const toneStyles: Record<
  ActionTone,
  { icon: string; badge: string; button: string; border: string; text: string }
> = {
  rose: {
    icon: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300",
    button: "bg-rose-600 hover:bg-rose-700 text-white",
    border: "border-rose-200 dark:border-rose-900/50",
    text: "text-rose-700 dark:text-rose-300",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    button: "bg-amber-600 hover:bg-amber-700 text-white",
    border: "border-amber-200 dark:border-amber-900/50",
    text: "text-amber-700 dark:text-amber-300",
  },
  blue: {
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    button: "bg-blue-600 hover:bg-blue-700 text-white",
    border: "border-blue-200 dark:border-blue-900/50",
    text: "text-blue-700 dark:text-blue-300",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    border: "border-emerald-200 dark:border-emerald-900/50",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    button: "bg-slate-900 hover:bg-slate-700 text-white dark:bg-white dark:text-slate-900",
    border: "border-slate-200 dark:border-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  },
  purple: {
    icon: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300",
    badge: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
    button: "bg-purple-600 hover:bg-purple-700 text-white",
    border: "border-purple-200 dark:border-purple-900/50",
    text: "text-purple-700 dark:text-purple-300",
  },
};

const getPpsName = (pps?: LanzamientoPPS) =>
  String(pps?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Sin institucion asignada");

const firstNameFrom = (items: LanzamientoPPS[]) => {
  const first = items[0];
  if (!first) return "Sin casos pendientes";
  return getGroupName(getPpsName(first));
};

const AdminActionCenter: React.FC<AdminActionCenterProps> = ({
  filteredData,
  institutionsMap,
  isLoading = false,
  pendingRequestsCount = 0,
  pendingFinalizationsCount = 0,
  pendingCorrectionsCount = 0,
  pendingClassificationsCount = 0,
  compact = false,
}) => {
  const navigate = useNavigate();

  const insight = useMemo(() => {
    const porContactar = filteredData?.porContactar || [];
    const esperando = filteredData?.contactadasEsperandoRespuesta || [];
    const porFinalizar = filteredData?.activasPorFinalizar || [];
    const porDefinir = filteredData?.respondidasPendienteDecision || [];
    const solicitudesCount =
      pendingRequestsCount + pendingFinalizationsCount + pendingCorrectionsCount;

    const reinsistir = esperando.filter((pps: any) => (pps.daysWaiting || 0) >= 5);
    const finalizanPronto = porFinalizar.filter((pps: any) => (pps.daysLeft || 999) <= 30);
    const missingContactItems = [
      ...porContactar,
      ...esperando,
      ...porFinalizar,
      ...porDefinir,
    ].filter((pps: any) => !getPpsInstitutionContact(pps, institutionsMap)?.phone);

    const actions = [
      {
        id: "contactar",
        title: "Contactar ahora",
        count: porContactar.length,
        detail: firstNameFrom(porContactar),
        hint: "Finalizadas sin gestion inicial",
        icon: "campaign",
        tone: "rose" as ActionTone,
        route: "/admin/gestion?filter=vencidas",
      },
      {
        id: "reinsistir",
        title: "Reinsistir",
        count: reinsistir.length,
        detail: firstNameFrom(reinsistir),
        hint: "5+ dias esperando respuesta",
        icon: "mark_email_unread",
        tone: "amber" as ActionTone,
        route: "/admin/gestion?filter=demoradas",
      },
      {
        id: "finalizar",
        title: "PPS por finalizar",
        count: finalizanPronto.length,
        detail: firstNameFrom(finalizanPronto),
        hint: "Terminan en 30 dias o menos",
        icon: "event_busy",
        tone: "blue" as ActionTone,
        route: "/admin/gestion?view=agenda",
      },
      {
        id: "solicitudes",
        title: "Solicitudes pendientes",
        count: solicitudesCount,
        detail:
          pendingRequestsCount > 0
            ? `${pendingRequestsCount} solicitudes PPS`
            : pendingFinalizationsCount > 0
              ? `${pendingFinalizationsCount} finalizaciones`
              : `${pendingCorrectionsCount} correcciones`,
        hint: "Requieren revision administrativa",
        icon: "pending_actions",
        tone: "emerald" as ActionTone,
        route: "/admin/solicitudes",
      },
      {
        id: "faltan-datos",
        title: "Falta dato clave",
        count: missingContactItems.length,
        detail: firstNameFrom(missingContactItems),
        hint: "Sin telefono institucional",
        icon: "add_call",
        tone: "slate" as ActionTone,
        route: "/admin/gestion",
      },
      {
        id: "clasificaciones",
        title: "Clasificación WhatsApp",
        count: pendingClassificationsCount,
        detail:
          pendingClassificationsCount > 0
            ? `${pendingClassificationsCount} contactos nuevos`
            : "Sin sugerencias",
        hint: "Hermes detectó contactos sin clasificar",
        icon: "chat",
        tone: "purple" as ActionTone,
        route: "/admin/gestion?view=contactos",
      },
    ].sort((a, b) => b.count - a.count);

    const total = actions.reduce((sum, action) => sum + action.count, 0);
    const lead = actions.find((action) => action.count > 0);

    return { actions, total, lead };
  }, [
    filteredData,
    institutionsMap,
    pendingCorrectionsCount,
    pendingFinalizationsCount,
    pendingRequestsCount,
    pendingClassificationsCount,
  ]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <span className="material-icons animate-spin">progress_activity</span>
          Preparando prioridades del dia...
        </div>
      </section>
    );
  }

  const leadText = insight.lead
    ? `Primero: ${insight.lead.title.toLowerCase()} (${insight.lead.count}).`
    : "No hay acciones urgentes detectadas.";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <span className="material-icons">auto_awesome</span>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Centro de accion unico
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
              Que hacer ahora
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {insight.total > 0
                ? `Hoy hay ${insight.total} señales operativas. ${leadText}`
                : "La bandeja esta limpia: no hay contactos urgentes, reinsistencias ni cierres proximos."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(insight.lead?.route || "/admin/gestion")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          <span className="material-icons !text-lg">play_arrow</span>
          Empezar por prioridad
        </button>
      </div>

      <div
        className={`grid gap-3 p-4 ${
          compact
            ? "grid-cols-1 md:grid-cols-3 xl:grid-cols-5"
            : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
        }`}
      >
        {insight.actions.map((action) => {
          const style = toneStyles[action.tone];

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => navigate(action.route)}
              className={`rounded-xl border ${style.border} bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md dark:bg-slate-950/30 dark:hover:bg-slate-800/70`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.icon}`}
                >
                  <span className="material-icons !text-xl">{action.icon}</span>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${style.badge}`}>
                  {action.count}
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{action.title}</h3>
              <p className={`mt-1 truncate text-xs font-bold ${style.text}`}>{action.detail}</p>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {action.hint}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default AdminActionCenter;
