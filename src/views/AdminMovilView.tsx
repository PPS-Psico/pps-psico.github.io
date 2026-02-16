import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useGestionConvocatorias, FilterType } from "../hooks/useGestionConvocatorias";
import { FIELD_NOMBRE_PPS_LANZAMIENTOS } from "../constants";
import { normalizeStringForComparison } from "../utils/formatters";
import Loader from "../components/Loader";
import GestionCard from "../components/admin/GestionCard";
import InstallAdminPWA from "../components/InstallAdminPWA";
import LanzadorMovil from "../components/admin/LanzadorMovil";

type MobileView = "inicio" | "gestion" | "lanzador";

const AdminMovilView: React.FC = () => {
  const [currentView, setCurrentView] = useState<MobileView>("inicio");
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
  } = useGestionConvocatorias({ initialFilter });

  React.useEffect(() => {
    if (filterType !== "all") {
      setSearchParams({ filter: filterType });
    } else {
      setSearchParams({});
    }
  }, [filterType, setSearchParams]);

  if (loadingState === "loading" || loadingState === "initial") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <span className="material-icons text-red-500 text-5xl mb-4">error</span>
          <h2 className="text-xl font-bold text-slate-800">Error de carga</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  // Calcular métricas para la vista de inicio
  const totalVencidas = filteredData.porContactar?.length || 0;
  const totalDemoradas = filteredData.contactadasEsperandoRespuesta?.length || 0;
  const totalPendientes =
    (filteredData.porContactar?.length || 0) +
    (filteredData.contactadasEsperandoRespuesta?.length || 0);
  const totalProximas = filteredData.activasYPorFinalizar?.length || 0;

  const renderInicio = () => (
    <div className="p-4 space-y-4">
      {/* Tarjeta de resumen principal */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black">{totalPendientes}</h2>
            <p className="text-blue-100 text-sm">Instituciones pendientes</p>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="material-icons text-3xl">business</span>
          </div>
        </div>
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setCurrentView("gestion")}
          className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-left active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons text-rose-500">hourglass_empty</span>
            <span className="material-icons text-xs text-slate-400">arrow_forward</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{totalVencidas}</div>
          <div className="text-xs text-slate-500">Vencidas</div>
          <div className="text-[10px] text-rose-500 mt-1">Gestión requerida</div>
        </button>

        <button
          onClick={() => setCurrentView("gestion")}
          className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-left active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons text-amber-500">update</span>
            <span className="material-icons text-xs text-slate-400">arrow_forward</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{totalDemoradas}</div>
          <div className="text-xs text-slate-500">Demoradas</div>
          <div className="text-[10px] text-amber-500 mt-1">Sin cambio +5 días</div>
        </button>

        <button
          onClick={() => setCurrentView("gestion")}
          className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-left active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons text-emerald-500">verified</span>
            <span className="material-icons text-xs text-slate-400">arrow_forward</span>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {filteredData.relanzamientosConfirmados?.length || 0}
          </div>
          <div className="text-xs text-slate-500">Confirmados</div>
          <div className="text-[10px] text-emerald-500 mt-1">Relanzamiento 2026</div>
        </button>

        <button
          onClick={() => setCurrentView("gestion")}
          className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-left active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons text-blue-500">schedule</span>
            <span className="material-icons text-xs text-slate-400">arrow_forward</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{totalProximas}</div>
          <div className="text-xs text-slate-500">Próximas</div>
          <div className="text-[10px] text-blue-500 mt-1">A vencer</div>
        </button>
      </div>

      {/* Actividad reciente */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span className="material-icons text-slate-400">history</span>
          Actividad Reciente
        </h3>
        <div className="space-y-3">
          {filteredData.porContactar?.slice(0, 3).map((pps: any) => (
            <div
              key={pps.id}
              className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-700 line-clamp-1">
                  {pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                </p>
                <p className="text-xs text-rose-500">Por contactar</p>
              </div>
              <span className="text-xs bg-rose-100 text-rose-600 px-2 py-1 rounded-full">
                {Math.abs(pps.daysSinceEnd || 0)}d
              </span>
            </div>
          ))}
          {(!filteredData.porContactar || filteredData.porContactar.length === 0) && (
            <div className="text-center py-4 text-slate-400 text-sm">
              <span className="material-icons text-2xl mb-1">check_circle</span>
              <p>No hay actividad pendiente</p>
            </div>
          )}
        </div>
      </div>

      {/* Botón ir a gestión */}
      <button
        onClick={() => setCurrentView("gestion")}
        className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
      >
        <span className="material-icons">list_alt</span>
        Ver Listado Completo
      </button>
    </div>
  );

  const renderGestion = () => (
    <div className="pb-20">
      <header className="bg-blue-600 text-white p-4 sticky top-0 z-50 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentView("inicio")} className="p-1">
              <span className="material-icons">arrow_back</span>
            </button>
            <h1 className="text-lg font-bold">Gestión</h1>
          </div>
          <div className="bg-white/20 px-3 py-1 rounded-full">
            <span className="text-sm font-bold">{totalPendientes} pendientes</span>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setFilterType("all")}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
              filterType === "all"
                ? "bg-white text-blue-600 shadow"
                : "bg-white/20 hover:bg-white/30"
            }`}
          >
            Todo
          </button>
          <button
            onClick={() => setFilterType("vencidas")}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
              filterType === "vencidas"
                ? "bg-white text-rose-600 shadow"
                : "bg-white/20 hover:bg-white/30"
            }`}
          >
            <span className="material-icons !text-sm">priority_high</span>
            Vencidas
          </button>
          <button
            onClick={() => setFilterType("proximas")}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
              filterType === "proximas"
                ? "bg-white text-amber-600 shadow"
                : "bg-white/20 hover:bg-white/30"
            }`}
          >
            <span className="material-icons !text-sm">schedule</span>
            Próximas
          </button>
        </div>

        <div className="relative mt-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar institución..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-white text-slate-800 placeholder-slate-400 border-0 outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400">
            search
          </span>
        </div>
      </header>

      <main className="p-3 space-y-4">
        {toastInfo && (
          <div
            className={`p-3 rounded-lg text-sm font-medium mb-3 ${
              toastInfo.type === "success"
                ? "bg-green-100 text-green-800"
                : toastInfo.type === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
            }`}
          >
            {toastInfo.message}
            <button onClick={() => setToastInfo(null)} className="ml-2 underline">
              Cerrar
            </button>
          </div>
        )}

        {filterType === "all" &&
          filteredData.porContactar &&
          filteredData.porContactar.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-red-100 text-red-600 p-1.5 rounded-lg">
                  <span className="material-icons text-lg">campaign</span>
                </span>
                <h2 className="font-bold text-slate-800">Por Contactar</h2>
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                  {filteredData.porContactar.length}
                </span>
              </div>
              <div className="space-y-3">
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
            </section>
          )}

        {filterType === "all" &&
          filteredData.contactadasEsperandoRespuesta &&
          filteredData.contactadasEsperandoRespuesta.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-amber-100 text-amber-600 p-1.5 rounded-lg">
                  <span className="material-icons text-lg">pending</span>
                </span>
                <h2 className="font-bold text-slate-800">Esperando Respuesta</h2>
                <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                  {filteredData.contactadasEsperandoRespuesta.length}
                </span>
              </div>
              <div className="space-y-3">
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
            </section>
          )}

        {filterType === "all" &&
          filteredData.relanzamientosConfirmados &&
          filteredData.relanzamientosConfirmados.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
                  <span className="material-icons text-lg">flight_takeoff</span>
                </span>
                <h2 className="font-bold text-slate-800">Confirmados 2026</h2>
                <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                  {filteredData.relanzamientosConfirmados.length}
                </span>
              </div>
              <div className="space-y-3">
                {filteredData.relanzamientosConfirmados.map((pps: any) => (
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
            </section>
          )}

        {!filteredData.porContactar?.length &&
          !filteredData.contactadasEsperandoRespuesta?.length &&
          !filteredData.relanzamientosConfirmados?.length && (
            <div className="text-center py-12">
              <span className="material-icons text-green-500 text-5xl mb-4">task_alt</span>
              <h2 className="text-xl font-bold text-slate-800">¡Excelente!</h2>
              <p className="text-slate-600">Todas las instituciones están gestionadas.</p>
            </div>
          )}
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Contenido principal */}
      {currentView === "inicio" && renderInicio()}
      {currentView === "gestion" && renderGestion()}
      {currentView === "lanzador" && <LanzadorMovil />}

      {/* Navegación inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-around items-center z-50">
        <button
          onClick={() => setCurrentView("inicio")}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg ${currentView === "inicio" ? "text-blue-600" : "text-slate-400"}`}
        >
          <span className="material-icons">home</span>
          <span className="text-xs font-medium">Inicio</span>
        </button>
        <button
          onClick={() => setCurrentView("gestion")}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg ${currentView === "gestion" ? "text-blue-600" : "text-slate-400"}`}
        >
          <span className="material-icons">list_alt</span>
          <span className="text-xs font-medium">Gestión</span>
        </button>
        <button
          onClick={() => setCurrentView("lanzador")}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg ${currentView === "lanzador" ? "text-blue-600" : "text-slate-400"}`}
        >
          <span className="material-icons">rocket_launch</span>
          <span className="text-xs font-medium">Lanzador</span>
        </button>
      </nav>

      <InstallAdminPWA />
    </div>
  );
};

export default AdminMovilView;
