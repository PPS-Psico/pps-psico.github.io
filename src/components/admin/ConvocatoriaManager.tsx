import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS,
} from "../../constants";
import { FilterType, useGestionConvocatorias } from "../../hooks/useGestionConvocatorias";
import { getGroupName, normalizeStringForComparison, parseToUTCDate } from "../../utils/formatters";
import CollapsibleSection from "../CollapsibleSection";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import GestionCard from "./GestionCard";
import type { LanzamientoPPS } from "../../types";

/** Lanzamiento enriquecido por el hook de gestión con métricas de días. */
type GestionItem = LanzamientoPPS & {
  daysLeft?: number;
  daysSinceEnd?: number;
  daysWaiting?: number;
  daysSinceResponse?: number;
  urgency?: "high" | "normal";
};

interface ConvocatoriaManagerProps {
  forcedOrientations?: string[];
  isTestingMode?: boolean;
}

const PHONE_DIRECTORY = [
  { name: "ACUCADES", phone: "2996232713" },
  { name: "Asociación Civil Programa Aser", phone: "2993247492" },
  { name: "Asociación Civil Pensar Programa Aser", phone: "2993247492" },
  { name: "Centro de Inclusión Social y Laboral APASIDO", phone: "2984617520" },
  { name: "Centro Evaluador Camioneros", phone: "2994569610" },
  { name: "Centro Salud Parque Industrial", phone: "2994587083" },
  { name: "Centro de Salud Parque Industrial", phone: "2994587083" },
  { name: "Centro SENSUS", phone: "2995160061" },
  { name: "Cita Salud", phone: "2995274960" },
  { name: "Clínica Fava", phone: "2995467311" },
  { name: "Colegio Nuestra Señora de Fátima", phone: "2994771182" },
  { name: "Colegio Psicólogos CPAVZO", phone: "2994092421" },
  { name: "Colegio San José Obrero de Neuquén", phone: "2942508177" },
  { name: "Colegio Virgen de Luján", phone: "2994047602" },
  { name: "Consultorios Las Lilas", phone: "2995353419" },
  { name: "Corporate Resources", phone: "2996100984" },
  { name: "Dige Espacio Terapéutico", phone: "1168733671" },
  { name: "Escuela Cristiana Vida", phone: "2994680666" },
  { name: "Escuela de Formación Cooperativa y Laboral N8", phone: "2604310174" },
  {
    name: "Escuela Integral de Adolescentes y Jóvenes con Discapacidad N7",
    phone: "2994193469",
  },
  { name: "Fundación Austral de Salud Integral", phone: "2995551529" },
  { name: "Fundación Kano", phone: "2984199042" },
  { name: "Fundación Lanna", phone: "2994118855" },
  { name: "Fundación Tiempo", phone: "1154152586" },
  { name: "Institución Fernando Ulloa", phone: "1127470681" },
  { name: "Instituto de Formación Docente N6", phone: "2994163682" },
  { name: "Instituto Liens", phone: "2994281417" },
  { name: "Instituto Ruca Suyay", phone: "2994769427" },
  { name: "ISI College", phone: "2994484812" },
  { name: "Ministerio de Trabajo y Desarrollo Laboral", phone: "2994523457" },
  { name: "Municipalidad de General Fernandez Oro", phone: "2994838857" },
  { name: "Randstad", phone: "3417434859" },
  { name: "Sanatorio Juan XXIII", phone: "2984775371" },
  {
    name: "Subsecretaria de Ciudades Saludables y Prevención de Consumos problemáticos Neuquén",
    phone: "2994194673",
  },
  { name: "Supervisión Educación Primaria", phone: "2984228687" },
].sort((a, b) => b.name.length - a.name.length);

const ConvocatoriaManager: React.FC<ConvocatoriaManagerProps> = ({
  forcedOrientations,
  isTestingMode = false,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get("filter") as FilterType) || "all";
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const {
    institutionsMap,
    loadingState,
    error,
    toastInfo,
    setToastInfo,
    updatingIds,
    searchTerm,
    setSearchTerm,
    handleSave,
    handleUpdateInstitutionPhone,
    filteredData,
    filterType,
    setFilterType,
  } = useGestionConvocatorias({ forcedOrientations, isTestingMode, initialFilter });

  const getInstitutionForPpsName = (ppsName?: string | null) => {
    const normalizedFullName = normalizeStringForComparison(ppsName || "");
    const normalizedGroupName = normalizeStringForComparison(getGroupName(ppsName || ""));

    const dbMatch =
      institutionsMap.get(normalizedFullName) ||
      institutionsMap.get(normalizedGroupName) ||
      Array.from(institutionsMap.entries()).find(([name]) => {
        if (!normalizedGroupName) return false;
        return name.includes(normalizedGroupName) || normalizedGroupName.includes(name);
      })?.[1];

    if (dbMatch?.phone) return dbMatch;

    const directoryMatch = PHONE_DIRECTORY.find((entry) => {
      const normalizedEntry = normalizeStringForComparison(entry.name);
      if (!normalizedEntry) return false;
      if (
        normalizedGroupName.includes("fundacion tiempo de ninos") &&
        normalizedEntry === "fundacion tiempo"
      ) {
        return false;
      }
      return (
        normalizedFullName.includes(normalizedEntry) ||
        normalizedGroupName.includes(normalizedEntry) ||
        normalizedEntry.includes(normalizedGroupName)
      );
    });

    if (directoryMatch) {
      return {
        id: dbMatch?.id || `phone-directory-${normalizeStringForComparison(directoryMatch.name)}`,
        phone: directoryMatch.phone,
      };
    }

    return dbMatch;
  };

  const managementBrief = useMemo(() => {
    const endingSoon = filteredData.activasPorFinalizar || [];
    const overdue = filteredData.porContactar || [];
    const waiting = filteredData.contactadasEsperandoRespuesta || [];
    const decision = filteredData.respondidasPendienteDecision || [];

    const missingPhoneCount = [...endingSoon, ...overdue, ...waiting, ...decision].filter(
      (pps: GestionItem) => !getInstitutionForPpsName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS])?.phone
    ).length;

    const baseActionItems = [
      ...endingSoon.map((pps: GestionItem) => ({
        id: `ending-${pps.id}`,
        pps,
        priority: (pps.daysLeft ?? 0) <= 7 ? "Alta" : "Media",
        label: "Contactar antes del cierre",
        detail:
          pps.daysLeft === 0
            ? "finaliza hoy"
            : `finaliza en ${pps.daysLeft} dia${pps.daysLeft === 1 ? "" : "s"}`,
        nextStep: "Confirmar continuidad",
        targetStatus: "Esperando Respuesta",
        icon: "event_busy",
        tone:
          (pps.daysLeft ?? 0) <= 7
            ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-100"
            : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100",
        rank: (pps.daysLeft ?? 0) <= 7 ? 0 : 1,
        sortDays: pps.daysLeft || 0,
      })),
      ...overdue.map((pps: GestionItem) => ({
        id: `overdue-${pps.id}`,
        pps,
        priority: "Alta",
        label: "Contactar para relanzamiento",
        detail: `finalizada hace ${pps.daysSinceEnd} dia${pps.daysSinceEnd === 1 ? "" : "s"}`,
        nextStep: "Enviar consulta",
        targetStatus: "Esperando Respuesta",
        icon: "campaign",
        tone: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100",
        rank: 2,
        sortDays: -(pps.daysSinceEnd || 0),
      })),
      ...waiting
        .filter((pps: GestionItem) => (pps.daysWaiting || 0) >= 3)
        .map((pps: GestionItem) => ({
          id: `waiting-${pps.id}`,
          pps,
          priority: (pps.daysWaiting || 0) >= 7 ? "Alta" : "Media",
          label: "Reinsistir",
          detail: `sin respuesta hace ${pps.daysWaiting} dia${pps.daysWaiting === 1 ? "" : "s"}`,
          nextStep: "Reenviar mensaje",
          targetStatus: "Esperando Respuesta",
          icon: "mark_email_unread",
          tone: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-100",
          rank: 3,
          sortDays: -(pps.daysWaiting || 0),
        })),
      ...decision.map((pps: GestionItem) => ({
        id: `decision-${pps.id}`,
        pps,
        priority: "Media",
        label: "Definir continuidad",
        detail: `conversacion abierta hace ${pps.daysSinceResponse || 0} dia${
          (pps.daysSinceResponse || 0) === 1 ? "" : "s"
        }`,
        nextStep: "Cerrar decisión",
        targetStatus: "En Conversación",
        icon: "forum",
        tone: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100",
        rank: 4,
        sortDays: -(pps.daysSinceResponse || 0),
      })),
    ];

    const actionItems = baseActionItems
      .map((item) => {
        const ppsName = item.pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "";
        const institution = getInstitutionForPpsName(ppsName);

        if (!institution?.phone) {
          return {
            ...item,
            priority: "Alta",
            label: "Completar contacto",
            nextStep: "Cargar telefono",
            targetStatus: item.pps[FIELD_ESTADO_GESTION_LANZAMIENTOS] || "Pendiente de Gestión",
            icon: "add_call",
            rank: Math.min(item.rank, 1.5),
            tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100",
          };
        }

        return item;
      })
      .sort((a, b) => (a.rank === b.rank ? a.sortDays - b.sortDays : a.rank - b.rank));

    return {
      endingSoon,
      overdue,
      waiting,
      decision,
      missingPhoneCount,
      actionItems,
      totalActionItems: actionItems.length,
    };
    // getInstitutionForPpsName solo depende de institutionsMap (ya en deps);
    // no se agrega para no recalcular el brief en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, institutionsMap]);

  const selectedAction =
    managementBrief.actionItems.find((item) => item.id === selectedActionId) ||
    managementBrief.actionItems[0] ||
    null;

  // Sync state with URL when it changes manually
  useEffect(() => {
    if (filterType !== "all") {
      setSearchParams({ filter: filterType });
    } else {
      setSearchParams({});
    }
  }, [filterType, setSearchParams]);

  if (loadingState === "loading" || loadingState === "initial")
    return (
      <div className="flex justify-center p-10">
        <Loader />
      </div>
    );
  if (error) return <EmptyState icon="error" title="Error" message={error} />;

  return (
    <div className="animate-fade-in-up space-y-8">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {/* HEADER: Estilo Premium Dark */}
      <div className="p-4 bg-white dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm z-30 backdrop-blur-md bg-white/90 dark:bg-[#0F172A]/90">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 whitespace-nowrap">
              <span className="material-icons text-blue-600 dark:text-blue-400">tune</span>
              Panel de Gestión
            </h2>

            {/* Filter Tabs - Darker Backgrounds */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-black/40 p-1 rounded-lg border border-transparent dark:border-white/5">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === "all" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
              >
                Todo
              </button>
              <button
                onClick={() => setFilterType("vencidas")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterType === "vencidas" ? "bg-white dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 shadow-sm border border-transparent dark:border-rose-800/50" : "text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400"}`}
              >
                <span className="material-icons !text-xs">event_busy</span> Vencidas
              </button>
              <button
                onClick={() => setFilterType("enGestion")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterType === "enGestion" ? "bg-white dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 shadow-sm border border-transparent dark:border-blue-800/50" : "text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400"}`}
              >
                <span className="material-icons !text-xs">sync_alt</span> En gestión
              </button>
              <button
                onClick={() => setFilterType("confirmadas")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterType === "confirmadas" ? "bg-white dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 shadow-sm border border-transparent dark:border-emerald-800/50" : "text-slate-500 hover:text-emerald-500 dark:text-slate-400 dark:hover:text-emerald-400"}`}
              >
                <span className="material-icons !text-xs">verified</span> Confirmadas / Lanzadas
              </button>
              <button
                onClick={() => setFilterType("demoradas")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterType === "demoradas" ? "bg-white dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 shadow-sm border border-transparent dark:border-orange-800/50" : "text-slate-500 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400"}`}
              >
                <span className="material-icons !text-xs">hourglass_empty</span> Demoradas
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-80 group">
            <input
              id="pps-filter"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por nombre de PPS..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-slate-50 dark:bg-black/20 focus:border-blue-500 focus:bg-white dark:focus:bg-black/40 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors">
              search
            </span>
          </div>
        </div>
      </div>

      {/* ==================== AGENDA OPERATIVA ==================== */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons text-blue-600 dark:text-blue-400">inbox</span>
                  Bandeja de gestión institucional
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Acciones ordenadas por impacto operativo: completar contacto, escribir, reinsistir
                  o cerrar decisión.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  {
                    label: "Terminan",
                    value: managementBrief.endingSoon.length,
                    filter: "confirmadas" as FilterType,
                    color: "text-emerald-600 dark:text-emerald-400",
                  },
                  {
                    label: "Vencidas",
                    value: managementBrief.overdue.length,
                    filter: "vencidas" as FilterType,
                    color: "text-red-600 dark:text-red-400",
                  },
                  {
                    label: "Reinsistir",
                    value: managementBrief.waiting.filter(
                      (pps: GestionItem) => (pps.daysWaiting || 0) >= 3
                    ).length,
                    filter: "demoradas" as FilterType,
                    color: "text-orange-600 dark:text-orange-400",
                  },
                  {
                    label: "Sin tel.",
                    value: managementBrief.missingPhoneCount,
                    filter: "all" as FilterType,
                    color: "text-amber-600 dark:text-amber-400",
                  },
                ].map((metric) => (
                  <button
                    key={metric.label}
                    type="button"
                    onClick={() => setFilterType(metric.filter)}
                    className="min-w-[72px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-2 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  >
                    <p className={`text-lg font-black leading-none ${metric.color}`}>
                      {metric.value}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                      {metric.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {managementBrief.actionItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/40 text-[11px] uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="text-left font-bold px-4 py-3">Prioridad</th>
                    <th className="text-left font-bold px-4 py-3">Institución</th>
                    <th className="text-left font-bold px-4 py-3">Motivo</th>
                    <th className="text-left font-bold px-4 py-3">Próximo paso</th>
                    <th className="text-right font-bold px-4 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {managementBrief.actionItems.slice(0, 12).map((item) => {
                    const ppsName = item.pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "PPS sin nombre";
                    const institution = getInstitutionForPpsName(ppsName);
                    const groupName = getGroupName(ppsName);
                    const isSelected = selectedAction?.id === item.id;
                    const priorityClass =
                      item.priority === "Alta"
                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800";

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedActionId(item.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50/80 dark:bg-blue-900/20"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${priorityClass}`}
                          >
                            <span className="material-icons !text-xs">{item.icon}</span>
                            {item.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top min-w-[220px]">
                          <p className="font-bold text-slate-900 dark:text-white">{groupName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[320px]">
                            {ppsName}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top min-w-[180px]">
                          <p className="font-semibold text-slate-700 dark:text-slate-200">
                            {item.label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.detail}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {institution?.phone ? item.nextStep : "Completar teléfono"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center justify-end gap-2">
                            {institution?.phone ? (
                              <a
                                href={`https://wa.me/${String(institution.phone).replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300"
                                title="Abrir WhatsApp"
                              >
                                <span className="material-icons !text-base">chat</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedActionId(item.id);
                                }}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300"
                                title="Completar contacto"
                              >
                                <span className="material-icons !text-base">add_call</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSearchTerm(groupName === "Sin Nombre" ? ppsName : groupName);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                              title="Ver tarjetas relacionadas"
                            >
                              <span className="material-icons !text-base">visibility</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-slate-500 dark:text-slate-400">
              No hay contactos urgentes para gestionar hoy.
            </div>
          )}
        </div>

        <aside className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {selectedAction ? (
            (() => {
              const ppsName = selectedAction.pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "PPS sin nombre";
              const institution = getInstitutionForPpsName(ppsName);
              const groupName = getGroupName(ppsName);
              const cleanPhone = String(institution?.phone || "").replace(/[^0-9]/g, "");

              return (
                <div className="p-5 space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500">
                      Foco actual
                    </p>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {groupName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ppsName}</p>
                  </div>

                  <div className={`rounded-lg border p-3 ${selectedAction.tone}`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <span className="material-icons !text-base">{selectedAction.icon}</span>
                      {selectedAction.label}
                    </div>
                    <p className="text-xs mt-1 opacity-80">{selectedAction.detail}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-950/40 p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Próximo paso</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 mt-1">
                        {institution?.phone ? selectedAction.nextStep : "Completar teléfono"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-950/40 p-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Contacto</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 mt-1 truncate">
                        {institution?.phone || "Sin teléfono"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {institution?.phone && (
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 transition-colors"
                      >
                        <span className="material-icons !text-base">chat</span>
                        Abrir WhatsApp
                      </a>
                    )}
                    {institution?.phone && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSave(selectedAction.pps.id, {
                            [FIELD_ESTADO_GESTION_LANZAMIENTOS]: selectedAction.targetStatus,
                          })
                        }
                        disabled={updatingIds.has(selectedAction.pps.id)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-2.5 transition-colors"
                      >
                        <span className="material-icons !text-base">done</span>
                        Marcar próximo paso
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setSearchTerm(groupName === "Sin Nombre" ? ppsName : groupName)
                      }
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2.5 transition-colors"
                    >
                      <span className="material-icons !text-base">manage_search</span>
                      Ver detalle abajo
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
              Seleccioná una institución para ver el próximo paso.
            </div>
          )}
        </aside>
      </section>

      {/* ==================== SECCIÓN: DEMORADAS (filter=demoradas or integrated in all) ==================== */}
      {filteredData.contactadasEsperandoRespuesta &&
        filteredData.respondidasPendienteDecision &&
        (filterType === "demoradas" || filterType === "all") &&
        (() => {
          // Calculate stagnant items: non-conclusive states with 2+ days without update
          const now = new Date();
          const allStagnant = [
            ...filteredData.contactadasEsperandoRespuesta,
            ...filteredData.respondidasPendienteDecision,
          ].filter((pps: GestionItem) => {
            const lastUpdate = pps.updated_at || pps.created_at;
            const daysSince = lastUpdate
              ? Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 3600 * 24))
              : 99; // Si no hay fecha, está demorada

            // Verificar si tiene un recordatorio futuro
            const reminderDate = pps[FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS];
            let isSnoozed = false;
            if (reminderDate) {
              const d = parseToUTCDate(reminderDate);
              if (d) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                isSnoozed = d > today;
              }
            }

            return daysSince >= 2 && !isSnoozed;
          });

          if (allStagnant.length === 0 && filterType === "demoradas") {
            return (
              <EmptyState
                icon="thumb_up"
                title="¡Todo al día!"
                message="No hay gestiones demoradas. Todas las instituciones se actualizaron en los últimos 2 días."
              />
            );
          }

          if (allStagnant.length === 0) return null;

          return (
            <CollapsibleSection
              title="⏳ Demoradas (2+ días sin cambios)"
              count={allStagnant.length}
              icon="hourglass_empty"
              iconBgColor="bg-orange-100 dark:bg-orange-900/30"
              iconColor="text-orange-600 dark:text-orange-400"
              borderColor="border-orange-300 dark:border-orange-800"
              defaultOpen={filterType === "demoradas"}
            >
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-orange-300 dark:border-orange-700">
                Gestiones que llevan 2 o más días sin actualizarse a un estado conclusivo
                (Relanzamiento Confirmado, Archivado o No se Relanza).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
                {allStagnant.map((pps: GestionItem) => (
                  <GestionCard
                    key={pps.id}
                    pps={pps}
                    onSave={handleSave}
                    isUpdating={updatingIds.has(pps.id)}
                    cardType="demoradas"
                    institution={getInstitutionForPpsName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                    onSavePhone={handleUpdateInstitutionPhone}
                    daysLeft={-(pps.daysSinceEnd || 0)}
                  />
                ))}
              </div>
            </CollapsibleSection>
          );
        })()}

      {/* ==================== NUEVO FLUJO DE CONTACTO ==================== */}

      {/* SECCIÓN 1: INSTITUCIONES VENCIDAS (PRIORIDAD MÁXIMA) */}
      {filteredData.porContactar &&
        filteredData.porContactar.length > 0 &&
        (filterType === "all" || filterType === "vencidas") && (
          <CollapsibleSection
            title="🔔 Instituciones Vencidas (Sin Gestión)"
            count={filteredData.porContactar.length}
            icon="campaign"
            iconBgColor="bg-red-100 dark:bg-red-900/30"
            iconColor="text-red-600 dark:text-red-400"
            borderColor="border-red-300 dark:border-red-800"
            defaultOpen={true}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-red-300 dark:border-red-700">
              Instituciones con PPS finalizadas que aún no han iniciado su ciclo de gestión para
              relanzamiento.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
              {filteredData.porContactar.map((pps: GestionItem) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="porContactar"
                  institution={getInstitutionForPpsName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                  onSavePhone={handleUpdateInstitutionPhone}
                  daysLeft={-(pps.daysSinceEnd || 0)}
                  urgency={pps.urgency}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* SECCIÓN 2: CONTACTADAS - ESPERANDO RESPUESTA */}
      {filteredData.contactadasEsperandoRespuesta &&
        filteredData.contactadasEsperandoRespuesta.length > 0 &&
        (filterType === "all" || filterType === "enGestion") && (
          <CollapsibleSection
            title="📧 Contactadas - Esperando Respuesta"
            count={filteredData.contactadasEsperandoRespuesta.length}
            icon="pending"
            iconBgColor="bg-amber-100 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
            borderColor="border-amber-300 dark:border-amber-800"
            defaultOpen={true}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-amber-300 dark:border-amber-700">
              Instituciones que ya fueron contactadas pero aún no han respondido.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
              {filteredData.contactadasEsperandoRespuesta.map((pps: GestionItem) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="contactadas"
                  institution={getInstitutionForPpsName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                  onSavePhone={handleUpdateInstitutionPhone}
                  daysLeft={-(pps.daysSinceEnd || 0)}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* SECCIÓN 3: RESPONDIDAS - PENDIENTE DE DECISIÓN */}
      {filteredData.respondidasPendienteDecision &&
        filteredData.respondidasPendienteDecision.length > 0 &&
        (filterType === "all" || filterType === "enGestion") && (
          <CollapsibleSection
            title="💬 Respondidas - Pendiente de Decisión"
            count={filteredData.respondidasPendienteDecision.length}
            icon="forum"
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            borderColor="border-blue-300 dark:border-blue-800"
            defaultOpen={false}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-blue-300 dark:border-blue-700">
              Instituciones que respondieron y están en conversación. Necesitan decisión final.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
              {filteredData.respondidasPendienteDecision.map((pps: GestionItem) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="respondidas"
                  institution={getInstitutionForPpsName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                  onSavePhone={handleUpdateInstitutionPhone}
                  daysLeft={-(pps.daysSinceEnd || 0)}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* ==================== CATEGORÍAS EXISTENTES ==================== */}

      {/* SECCIÓN: ACTIVAS Y POR FINALIZAR */}
      {filteredData.activasPorFinalizar &&
        filteredData.activasPorFinalizar.length > 0 &&
        (filterType === "all" || filterType === "confirmadas") && (
          <CollapsibleSection
            title="Lanzadas - Proximas a terminar"
            count={filteredData.activasPorFinalizar.length}
            icon="notifications_active"
            iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
            borderColor="border-emerald-300 dark:border-emerald-800"
            defaultOpen={true}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-emerald-300 dark:border-emerald-700">
              Prácticas que aún están activas o por finalizar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
              {filteredData.activasPorFinalizar.map((pps: GestionItem) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="activas"
                  institution={getInstitutionForPpsName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                  onSavePhone={handleUpdateInstitutionPhone}
                  daysLeft={pps.daysLeft}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* SECCIÓN: RELANZAMIENTOS CONFIRMADOS */}
      {filteredData.relanzamientosConfirmados &&
        filteredData.relanzamientosConfirmados.length > 0 &&
        (filterType === "all" || filterType === "confirmadas") && (
          <CollapsibleSection
            title="✅ Confirmadas - Relanzamientos 2026"
            count={filteredData.relanzamientosConfirmados.length}
            icon="flight_takeoff"
            iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
            borderColor="border-emerald-300 dark:border-emerald-800"
            defaultOpen={false}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-emerald-300 dark:border-emerald-700">
              Instituciones con relanzamiento confirmado para 2026. ¡Gestión completada!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
              {filteredData.relanzamientosConfirmados.map((pps) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="relanzamientosConfirmados"
                  institution={getInstitutionForPpsName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                  onSavePhone={handleUpdateInstitutionPhone}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* SECCIÓN: INDEFINIDAS */}
      {filteredData.activasIndefinidas &&
        filteredData.activasIndefinidas.length > 0 &&
        filterType === "all" && (
          <CollapsibleSection
            title="📝 Gestión Manual / Indefinidas"
            count={filteredData.activasIndefinidas.length}
            icon="edit_calendar"
            iconBgColor="bg-slate-100 dark:bg-slate-800"
            iconColor="text-slate-600 dark:text-slate-400"
            borderColor="border-slate-300 dark:border-slate-700"
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-slate-300 dark:border-slate-700">
              Prácticas sin fecha definida que requieren gestión manual.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
              {filteredData.activasIndefinidas.map((pps) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="indefinidas"
                  institution={getInstitutionForPpsName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS])}
                  onSavePhone={handleUpdateInstitutionPhone}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* EMPTY STATE */}
      {!filteredData.porContactar?.length &&
        !filteredData.contactadasEsperandoRespuesta?.length &&
        !filteredData.respondidasPendienteDecision?.length &&
        !filteredData.activasPorFinalizar?.length &&
        !filteredData.relanzamientosConfirmados?.length && (
          <EmptyState
            icon="task_alt"
            title="¡Excelente trabajo!"
            message="Todas las instituciones están gestionadas correctamente."
          />
        )}
    </div>
  );
};

export default ConvocatoriaManager;
