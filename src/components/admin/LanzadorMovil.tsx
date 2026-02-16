import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
} from "../../constants";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

interface Lanzamiento {
  id: string;
  [FIELD_NOMBRE_PPS_LANZAMIENTOS]: string;
  [FIELD_ORIENTACION_LANZAMIENTOS]?: string;
  [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]?: number;
  [FIELD_FECHA_INICIO_LANZAMIENTOS]?: string;
  [FIELD_FECHA_FIN_LANZAMIENTOS]?: string;
  [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]?: string;
  created_at?: string;
}

interface Institucion {
  id: string;
  nombre_instituciones: string;
}

const LanzadorMovil: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"nuevo" | "seleccionador" | "seguro" | "historial">(
    "nuevo"
  );
  const [lanzamientos, setLanzamientos] = useState<Lanzamiento[]>([]);
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nombre: "",
    orientacion: "Psicología",
    cupos: "",
    institucionId: "",
    fechaInicio: "",
    fechaFin: "",
  });

  useEffect(() => {
    if (activeTab === "historial") {
      loadLanzamientos();
    }
    if (activeTab === "nuevo") {
      loadInstituciones();
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

  const loadInstituciones = async () => {
    const { data } = await supabase
      .from("instituciones")
      .select("id, nombre_instituciones")
      .order("nombre_instituciones");

    if (data) {
      setInstituciones(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.institucionId) {
      setToast({ message: "Nombre e institución son requeridos", type: "error" });
      return;
    }

    setSaving(true);

    const newLaunch = {
      [FIELD_NOMBRE_PPS_LANZAMIENTOS]: formData.nombre,
      [FIELD_ORIENTACION_LANZAMIENTOS]: formData.orientacion,
      [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: parseInt(formData.cupos) || 1,
      institucion_id: formData.institucionId,
      [FIELD_FECHA_INICIO_LANZAMIENTOS]:
        formData.fechaInicio || new Date().toISOString().split("T")[0],
      [FIELD_FECHA_FIN_LANZAMIENTOS]: formData.fechaFin || null,
      [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta",
      [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Pendiente",
    };

    const { error } = await supabase.from("pps_lanzamientos").insert([newLaunch]);

    setSaving(false);

    if (error) {
      setToast({ message: `Error: ${error.message}`, type: "error" });
    } else {
      setToast({ message: "Lanzamiento creado exitosamente", type: "success" });
      setFormData({
        nombre: "",
        orientacion: "Psicología",
        cupos: "",
        institucionId: "",
        fechaInicio: "",
        fechaFin: "",
      });
      setActiveTab("historial");
    }
  };

  const renderNuevo = () => (
    <div className="p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="material-icons text-blue-600">add_circle</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Nuevo Lanzamiento</h3>
            <p className="text-xs text-slate-500">Crear convocatoria básica</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre PPS *</label>
          <input
            type="text"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Ej: PPS Hospital de Niños"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Institución *</label>
          <select
            value={formData.institucionId}
            onChange={(e) => setFormData({ ...formData, institucionId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            required
          >
            <option value="">Seleccionar institución</option>
            {instituciones.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.nombre_instituciones}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cupos</label>
            <input
              type="number"
              value={formData.cupos}
              onChange={(e) => setFormData({ ...formData, cupos: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="1"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Orientación</label>
            <select
              value={formData.orientacion}
              onChange={(e) => setFormData({ ...formData, orientacion: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option>Psicología</option>
              <option>Psicopedagogía</option>
              <option>Psicomotricidad</option>
              <option>Terapia Ocupacional</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={formData.fechaInicio}
              onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={formData.fechaFin}
              onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {toast && (
          <div
            className={`p-3 rounded-lg text-sm ${toast.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {toast.message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="material-icons animate-spin">refresh</span>
              Guardando...
            </>
          ) : (
            <>
              <span className="material-icons">save</span>
              Crear Lanzamiento
            </>
          )}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Para opciones avanzadas usa la versión web
        </p>
      </form>
    </div>
  );

  const renderSeleccionador = () => (
    <div className="p-4 text-center">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <span className="material-icons text-5xl text-slate-300 mb-4">computer</span>
        <h3 className="font-bold text-slate-800 mb-2">Seleccionador</h3>
        <p className="text-sm text-slate-600 mb-4">
          La gestión de postulantes requiere una interfaz más compleja.
        </p>
        <button
          onClick={() => window.open("/#/admin/lanzador?tab=seleccionador", "_blank")}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm"
        >
          Abrir en versión web
        </button>
      </div>
    </div>
  );

  const renderSeguro = () => (
    <div className="p-4 text-center">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <span className="material-icons text-5xl text-slate-300 mb-4">security</span>
        <h3 className="font-bold text-slate-800 mb-2">Seguro</h3>
        <p className="text-sm text-slate-600 mb-4">
          La generación de seguros requiere una interfaz más compleja.
        </p>
        <button
          onClick={() => window.open("/#/admin/lanzador?tab=seguro", "_blank")}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm"
        >
          Abrir en versión web
        </button>
      </div>
    </div>
  );

  const renderHistorial = () => (
    <div className="p-4">
      {loading ? (
        <div className="text-center py-8">
          <span className="material-icons animate-spin text-blue-600 text-3xl">refresh</span>
          <p className="text-sm text-slate-500 mt-2">Cargando...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lanzamientos.map((lanz) => (
            <div
              key={lanz.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-slate-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    {lanz[FIELD_NOMBRE_PPS_LANZAMIENTOS]}
                  </h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                      {lanz[FIELD_ORIENTACION_LANZAMIENTOS] || "Sin orientación"}
                    </span>
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                      {lanz[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0} cupos
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    lanz[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] === "Abierta"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {lanz[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] || "Cerrada"}
                </span>
              </div>
              {lanz.created_at && (
                <p className="text-xs text-slate-400 mt-2">
                  Creado: {new Date(lanz.created_at).toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
          ))}
          {lanzamientos.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <span className="material-icons text-4xl mb-2">inbox</span>
              <p className="text-sm">No hay lanzamientos</p>
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
