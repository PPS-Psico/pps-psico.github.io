import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import AdminView from "./AdminView";
import JefeView from "./JefeView";
import StudentDashboard from "./StudentDashboard";
import MobileBottomNav from "../components/layout/MobileBottomNav";

import AppModals from "../components/AppModals";

import { AuthUser } from "../contexts/AuthContext";
import { StudentPanelProvider } from "../contexts/StudentPanelContext";
import { listJefePreviewProfiles } from "../features/jefe/jefeService";
import type { TabId } from "../types";

type TestingSurface = "student" | "admin" | "jefe";

const AdminTestingView: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<TestingSurface>("student");
  const [studentTabId, setStudentTabId] = useState<TabId>("inicio");
  const [jefePreviewKey, setJefePreviewKey] = useState("");

  const jefeProfilesQuery = useQuery({
    queryKey: ["jefe-preview-profiles-v1"],
    queryFn: listJefePreviewProfiles,
    enabled: activeTabId === "jefe",
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const profiles = jefeProfilesQuery.data || [];
    if (
      profiles.length > 0 &&
      !profiles.some((profile) => profile.preview_key === jefePreviewKey)
    ) {
      setJefePreviewKey(profiles[0].preview_key);
    }
  }, [jefePreviewKey, jefeProfilesQuery.data]);

  // Usuario simulado para la vista de estudiante
  const testingUser: AuthUser = {
    legajo: "99999",
    nombre: "Usuario de Prueba",
    role: "AdminTester",
  };

  const mobileNavTabs = [
    { id: "inicio" as TabId, label: "Inicio", icon: "home", path: "#" },
    { id: "entregas" as TabId, label: "Entregas", icon: "upload", path: "#" },
    { id: "practicas" as TabId, label: "Prácticas", icon: "work_history", path: "#" },
    { id: "solicitudes" as TabId, label: "Solicitudes", icon: "list_alt", path: "#" },
    { id: "profile" as TabId, label: "Perfil", icon: "person", path: "#" },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up pb-20">
      {/* Header Sticky para cambiar de rol fácilmente */}
      <div className="sticky top-20 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-400">
            <span className="material-icons">science</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
              Entorno de Simulación
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeTabId === "jefe"
                ? "Datos reales protegidos en modo sólo lectura."
                : "Datos aislados de producción."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTabId("student")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition duration-200 ${
              activeTabId === "student"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="material-icons !text-lg">school</span>
            Vista Alumno
          </button>
          <button
            onClick={() => setActiveTabId("admin")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition duration-200 ${
              activeTabId === "admin"
                ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="material-icons !text-lg">admin_panel_settings</span>
            Vista Admin
          </button>
          <button
            onClick={() => setActiveTabId("jefe")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition duration-200 ${
              activeTabId === "jefe"
                ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="material-icons !text-lg">supervisor_account</span>
            Vista Jefe
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTabId === "student" ? (
          <div className="bg-slate-50 dark:bg-black/20 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 ring-4 ring-slate-100 dark:ring-slate-900 pb-24 md:pb-6 relative overflow-hidden">
            {/* Envolvemos en el Provider con el legajo mock (99999) que activa el modo test en los hooks */}
            <StudentPanelProvider legajo={testingUser.legajo}>
              <StudentDashboard
                user={testingUser}
                showExportButton={false}
                activeTab={studentTabId}
                onTabChange={setStudentTabId}
              />
            </StudentPanelProvider>

            <MobileBottomNav
              tabs={mobileNavTabs}
              activeTabId={studentTabId}
              onTabChange={setStudentTabId}
            />
          </div>
        ) : activeTabId === "admin" ? (
          <div className="bg-slate-50 dark:bg-black/20 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 ring-4 ring-slate-100 dark:ring-slate-900">
            <AdminView isTestingMode={true} />
          </div>
        ) : (
          <div className="overflow-hidden border-y border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-800 dark:text-white">
                  Previsualizar una jefatura
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Usa datos reales del área, pero bloquea calificaciones y acciones operativas.
                </p>
              </div>
              <label className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>Jefatura</span>
                <select
                  value={jefePreviewKey}
                  onChange={(event) => setJefePreviewKey(event.target.value)}
                  disabled={jefeProfilesQuery.isLoading || jefeProfilesQuery.isError}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-bold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  aria-label="Elegir jefatura para previsualizar"
                >
                  {jefeProfilesQuery.data?.map((jefe) => (
                    <option key={jefe.preview_key} value={jefe.preview_key}>
                      {jefe.name} · {jefe.area_labels.join(" + ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {jefeProfilesQuery.isError ? (
              <div className="border-t border-slate-200 px-5 py-12 text-center dark:border-slate-700">
                <p className="text-sm font-bold text-red-700 dark:text-red-300">
                  No se pudo cargar la lista de jefaturas.
                </p>
                <button
                  type="button"
                  onClick={() => void jefeProfilesQuery.refetch()}
                  className="mt-3 text-xs font-bold text-blue-700 underline underline-offset-4 dark:text-blue-300"
                >
                  Volver a intentar
                </button>
              </div>
            ) : jefePreviewKey ? (
              <JefeView key={jefePreviewKey} previewKey={jefePreviewKey} />
            ) : (
              <div className="border-t border-slate-200 px-5 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Cargando jefaturas disponibles…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modales globales para que funcionen las interacciones dentro de las simulaciones */}
      <AppModals />
    </div>
  );
};

export default AdminTestingView;
