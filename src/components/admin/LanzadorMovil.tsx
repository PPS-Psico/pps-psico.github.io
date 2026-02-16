import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

interface Lanzamiento {
  id: string;
  nombre_pps_lanzamientos: string;
  orientacion_pps_lanzamientos: string;
  cupos_disponibles: number;
  fecha_inicio_pps_lanzamientos: string;
  fecha_fin_pps_lanzamientos: string;
  estado_pps_lanzamientos: string;
}

const LanzadorMovil: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"nuevo" | "seleccionador" | "seguro" | "historial">(
    "nuevo"
  );
  const [lanzamientos, setLanzamientos] = useState<Lanzamiento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "historial") {
      loadLanzamientos();
    }
  }, [activeTab]);

  const loadLanzamientos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pps_lanzamientos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setLanzamientos(data);
    }
    setLoading(false);
  };

  const renderNuevo = () => (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="material-icons text-blue-600">add_circle</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Nuevo Lanzamiento</h3>
            <p className="text-xs text-slate-500">Crear convocatoria PPS</p>
          </div>
        </div>
        <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
          <span className="material-icons">add</span>
          Crear Lanzamiento
        </button>
      </div>

      <div className="text-center text-sm text-slate-500 py-8">
        <span className="material-icons text-4xl text-slate-300 mb-2">info</span>
        <p>Usa la versión web para crear lanzamientos completos</p>
      </div>
    </div>
  );

  const renderSeleccionador = () => (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <span className="material-icons text-green-600">how_to_reg</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Seleccionador</h3>
            <p className="text-xs text-slate-500">Gestionar postulantes</p>
          </div>
        </div>
        <button className="w-full py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
          <span className="material-icons">people</span>
          Ver Postulantes
        </button>
      </div>

      <div className="text-center text-sm text-slate-500 py-8">
        <span className="material-icons text-4xl text-slate-300 mb-2">info</span>
        <p>Usa la versión web para gestionar selecciones</p>
      </div>
    </div>
  );

  const renderSeguro = () => (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <span className="material-icons text-purple-600">shield</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Seguro</h3>
            <p className="text-xs text-slate-500">Validaciones y controles</p>
          </div>
        </div>
        <button className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
          <span className="material-icons">verified_user</span>
          Validar Datos
        </button>
      </div>

      <div className="text-center text-sm text-slate-500 py-8">
        <span className="material-icons text-4xl text-slate-300 mb-2">info</span>
        <p>Usa la versión web para validaciones completas</p>
      </div>
    </div>
  );

  const renderHistorial = () => (
    <div className="p-4">
      {loading ? (
        <div className="text-center py-8">
          <span className="material-icons animate-spin">refresh</span>
          <p className="text-sm text-slate-500 mt-2">Cargando...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lanzamientos.map((lanz) => (
            <div
              key={lanz.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-slate-200"
            >
              <h4 className="font-bold text-slate-800">{lanz.nombre_pps_lanzamientos}</h4>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {lanz.orientacion_pps_lanzamientos}
                </span>
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                  {lanz.cupos_disponibles} cupos
                </span>
              </div>
            </div>
          ))}
          {lanzamientos.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <span className="material-icons text-4xl">history</span>
              <p className="text-sm mt-2">No hay lanzamientos recientes</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: "nuevo", label: "Nuevo", icon: "add_circle" },
    { id: "seleccionador", label: "Seleccionar", icon: "how_to_reg" },
    { id: "seguro", label: "Seguro", icon: "shield" },
    { id: "historial", label: "Historial", icon: "history" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      {/* Sub-navegación del lanzador */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex overflow-x-auto no-scrollbar p-2 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className="material-icons !text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="pt-4">
        {activeTab === "nuevo" && renderNuevo()}
        {activeTab === "seleccionador" && renderSeleccionador()}
        {activeTab === "seguro" && renderSeguro()}
        {activeTab === "historial" && renderHistorial()}
      </div>
    </div>
  );
};

export default LanzadorMovil;
