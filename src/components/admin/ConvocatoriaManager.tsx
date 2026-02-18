import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FIELD_NOMBRE_PPS_LANZAMIENTOS } from "../../constants";
import { FilterType, useGestionConvocatorias } from "../../hooks/useGestionConvocatorias";
import { normalizeStringForComparison } from "../../utils/formatters";
import CollapsibleSection from "../CollapsibleSection";
import EmptyState from "../EmptyState";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import GestionCard from "./GestionCard";

interface ConvocatoriaManagerProps {
  forcedOrientations?: string[];
  isTestingMode?: boolean;
}

const ConvocatoriaManager: React.FC<ConvocatoriaManagerProps> = ({
  forcedOrientations,
  isTestingMode = false,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get("filter") as FilterType) || "all";

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
                <span className="material-icons !text-xs">priority_high</span> Vencidas
              </button>
              <button
                onClick={() => setFilterType("proximas")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterType === "proximas" ? "bg-white dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 shadow-sm border border-transparent dark:border-amber-800/50" : "text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400"}`}
              >
                <span className="material-icons !text-xs">schedule</span> Próximas
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
            ...filteredData.porContactar,
          ].filter((pps: any) => {
            const lastUpdate = pps.updated_at || pps.created_at;
            if (!lastUpdate) return true; // No update = stagnant
            const daysSince = Math.floor(
              (now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 3600 * 24)
            );
            return daysSince >= 2;
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
                {allStagnant.map((pps: any) => (
                  <GestionCard
                    key={pps.id}
                    pps={pps}
                    onSave={handleSave}
                    isUpdating={updatingIds.has(pps.id)}
                    cardType="demoradas"
                    institution={institutionsMap.get(
                      normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
                    )}
                    onSavePhone={handleUpdateInstitutionPhone}
                    daysLeft={-(pps.daysSinceEnd || 0)}
                  />
                ))}
              </div>
            </CollapsibleSection>
          );
        })()}

      {/* ==================== NUEVO FLUJO DE CONTACTO ==================== */}

      {/* SECCIÓN 1: POR CONTACTAR (PRIORIDAD MÁXIMA) */}
      {filteredData.porContactar &&
        filteredData.porContactar.length > 0 &&
        (filterType === "all" || filterType === "demoradas") && (
          <CollapsibleSection
            title="🔔 Por Contactar"
            count={filteredData.porContactar.length}
            icon="campaign"
            iconBgColor="bg-red-100 dark:bg-red-900/30"
            iconColor="text-red-600 dark:text-red-400"
            borderColor="border-red-300 dark:border-red-800"
            defaultOpen={true}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-red-300 dark:border-red-700">
              Instituciones finalizadas que aún no han sido contactadas para el relanzamiento 2026.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
              {filteredData.porContactar.map((pps: any) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="porContactar"
                  institution={institutionsMap.get(
                    normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
                  )}
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
        filterType !== "vencidas" &&
        filterType !== "proximas" && (
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
              {filteredData.contactadasEsperandoRespuesta.map((pps: any) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="contactadas"
                  institution={institutionsMap.get(
                    normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
                  )}
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
        filterType !== "vencidas" &&
        filterType !== "proximas" && (
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
              {filteredData.respondidasPendienteDecision.map((pps: any) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="respondidas"
                  institution={institutionsMap.get(
                    normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
                  )}
                  onSavePhone={handleUpdateInstitutionPhone}
                  daysLeft={-(pps.daysSinceEnd || 0)}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

      {/* ==================== CATEGORÍAS EXISTENTES ==================== */}

      {/* SECCIÓN: ACTIVAS Y POR FINALIZAR */}
      {filteredData.activasYPorFinalizar &&
        filteredData.activasYPorFinalizar.length > 0 &&
        filterType === "all" && (
          <CollapsibleSection
            title="📅 Activas y Por Finalizar"
            count={filteredData.activasYPorFinalizar.length}
            icon="notifications_active"
            iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
            borderColor="border-emerald-300 dark:border-emerald-800"
            defaultOpen={false}
          >
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-4 border-l-4 border-emerald-300 dark:border-emerald-700">
              Prácticas que aún están activas o por finalizar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4 items-start">
              {filteredData.activasYPorFinalizar.map((pps: any) => (
                <GestionCard
                  key={pps.id}
                  pps={pps}
                  onSave={handleSave}
                  isUpdating={updatingIds.has(pps.id)}
                  cardType="activas"
                  institution={institutionsMap.get(
                    normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
                  )}
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
        filterType === "all" && (
          <CollapsibleSection
            title="✅ Relanzamientos Confirmados 2026"
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
                  institution={institutionsMap.get(
                    normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
                  )}
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
                  institution={institutionsMap.get(
                    normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "")
                  )}
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
        !filteredData.activasYPorFinalizar?.length &&
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
