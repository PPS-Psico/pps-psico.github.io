/**
 * LanzadorView — Rediseño v4 (Paper & Ink editorial — nueva capa visual)
 *
 * Layout: sidebar colapsable izquierdo + canvas central por estado.
 *
 * Estados mapeados desde la DB:
 *   'Oculto'    → borrador
 *   'Abierta'   → abierta
 *   'Cerrado'   → cerrada (sin seleccionados) | seleccionada (con seleccionados en convocatorias)
 *   'Activa'    → activa
 *   'Archivado' → archivada
 *
 * NOTA: Los sub-componentes internos (SeleccionadorConvocatorias,
 * SeguroGenerator, LanzadorConvocatorias) no se modifican. Solo cambia la
 * capa visual que los envuelve.
 */
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useLocation } from "react-router-dom";
import { db } from "../../lib/db";
import { supabase } from "../../lib/supabaseClient";
import { useModal } from "../../contexts/ModalContext";
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_DESCRIPCION_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
} from "../../constants";
import { notifySelectedStudents, fetchSelectedCandidatesForLaunch } from "../../services";
import { normalizeStringForComparison } from "../../utils/formatters";
import { logger } from "../../utils/logger";
import type { LanzamientoPPS } from "../../types";
// Estilos scoped (.lv4) — importar este módulo inyecta el CSS una sola vez.
import "./lanzador/lanzadorStyles";
import ConfirmModal from "../../components/ConfirmModal";
import { launchKeys, invalidateLaunchData } from "../../lib/launchQueryKeys";
import { type UIState, buildSidebarEntries } from "./lanzador/lanzadorState";
import { Loader, LanzadorSidebar, type RowAction, type SidebarEntry } from "./lanzador/shared";
import {
  BorradorView,
  SeleccionView,
  SeguroView,
  ConfirmacionView,
  ActivaView,
  ArchivadaView,
} from "./lanzador/stepViews";

const LanzadorConvocatorias = lazy(() => import("../../components/admin/LanzadorConvocatorias"));

// ─── Main component ───────────────────────────────────────────────────────────

interface LanzadorViewProps {
  isTestingMode?: boolean;
}

const LanzadorView: React.FC<LanzadorViewProps> = ({ isTestingMode = false }) => {
  const { showModal } = useModal();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("lv4-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    return (
      ((location.state as Record<string, unknown>)?.launchId as string | null) ||
      searchParams.get("launchId") ||
      null
    );
  });
  const [isCreating, setIsCreating] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Confirmación unificada (reemplaza window.confirm) — una sola instancia de
  // ConfirmModal manejada por este estado. `onConfirm` ejecuta la acción pendiente.
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    type?: "warning" | "info" | "danger";
    onConfirm: () => void;
  } | null>(null);

  const handleSelect = useCallback((id: string) => {
    setIsCreating(false);
    setSelectedId(id);
    setMobileSidebarOpen(false);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lv4-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [sidebarCollapsed]);

  // ── Fetch launches ────────────────────────────────────────────────────────
  const { data: launches = [], isLoading } = useQuery<LanzamientoPPS[]>({
    queryKey: launchKeys.history(isTestingMode),
    queryFn: async () => {
      if (isTestingMode) return [];
      return db.lanzamientos.getAll({
        sort: [{ field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }],
      });
    },
  });

  // ── Conteos por lanzamiento (inscriptos totales + seleccionados) ──────────
  // Se cuenta en la base vía RPC (get_convocatoria_counts_by_launch), no en el
  // cliente: evita traer miles de filas y el límite de 1000 de PostgREST.
  const launchIds = launches.map((l) => l.id);
  const { data: countsByLaunch = {} } = useQuery<
    Record<string, { inscriptos: number; seleccionados: number }>
  >({
    queryKey: launchKeys.convCounts(launchIds),
    queryFn: async () => {
      if (launchIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_convocatoria_counts_by_launch", {
        p_launch_ids: launchIds,
      });
      if (error) throw error;
      return (data || {}) as Record<string, { inscriptos: number; seleccionados: number }>;
    },
    enabled: launchIds.length > 0,
  });

  // ── Consentimientos digitales (compromisos) por lanzamiento ───────────────
  // Para la categoría "A asegurar": cuántos seleccionados aceptaron el
  // consentimiento digital vs. cuántos siguen pendientes. También vía RPC.
  const { data: consentByLaunch = {} } = useQuery<
    Record<string, { aceptados: number; total: number }>
  >({
    queryKey: launchKeys.consentCounts(launchIds),
    queryFn: async () => {
      if (launchIds.length === 0) return {};
      const { data, error } = await supabase.rpc("get_consent_counts_by_launch", {
        p_launch_ids: launchIds,
      });
      if (error) throw error;
      return (data || {}) as Record<string, { aceptados: number; total: number }>;
    },
    enabled: launchIds.length > 0,
  });

  // ── Build sidebar entries ─────────────────────────────────────────────────
  const entries: SidebarEntry[] = useMemo(
    () => buildSidebarEntries(launches, countsByLaunch, consentByLaunch),
    [launches, countsByLaunch, consentByLaunch]
  );

  const selectedLaunch = useMemo(
    () => launches.find((l) => l.id === selectedId) || null,
    [launches, selectedId]
  );

  const selectedUiState = useMemo<UIState | null>(() => {
    if (!selectedId) return null;
    // Reutilizamos el uiState ya calculado en `entries` (incluye la regla de
    // "archivada efectiva"), así el canvas y el sidebar nunca divergen.
    return entries.find((e) => e.id === selectedId)?.uiState ?? null;
  }, [entries, selectedId]);

  const handleNew = useCallback(() => {
    setSelectedId(null);
    setIsCreating(true);
    setMobileSidebarOpen(false);
  }, []);

  const refreshLaunches = useCallback(() => {
    // Invalida TODO lo derivado de lanzamientos (lista, conteos, consentimientos,
    // roster, prácticas y las queries del seleccionador) desde un único helper,
    // para que sidebar, canvas y seleccionador reconcilien siempre.
    invalidateLaunchData(queryClient);
  }, [queryClient]);

  // ── Estado mutations ──────────────────────────────────────────────────────
  const changeEstadoMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      await db.lanzamientos.update(id, {
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: estado,
      } as Record<string, unknown>);

      // Al cerrar la inscripción notificamos a los seleccionados, pero en
      // SEGUNDO PLANO: enviar emails + push tarda varios segundos y no debe
      // bloquear el avance del pipeline ni la actualización de la vista. Si
      // algo falla, se registra sin frenar el cierre.
      if (estado === "Cerrado") {
        const launch = launches.find((l) => l.id === id);
        if (launch) {
          void fetchSelectedCandidatesForLaunch(id)
            .then((candidates) => {
              if (candidates.length > 0) return notifySelectedStudents(launch, candidates);
            })
            .catch((e) => logger.error("[Lanzador] Error notificando seleccionados:", e));
        }
      }
    },
    // Update optimista: avanzamos el estado del lanzamiento en la cache para que
    // el pipeline y el canvas cambien al instante, sin esperar el refetch.
    onMutate: async ({ id, estado }) => {
      const key = launchKeys.history(isTestingMode);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LanzamientoPPS[]>(key);
      queryClient.setQueryData<LanzamientoPPS[]>(key, (old) =>
        (old || []).map((l) =>
          l.id === id
            ? ({ ...l, [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: estado } as LanzamientoPPS)
            : l
        )
      );
      return { previous };
    },
    onError: (e: unknown, _vars, context) => {
      // Revertimos el update optimista si la escritura en DB falló.
      if (context?.previous)
        queryClient.setQueryData(launchKeys.history(isTestingMode), context.previous);
      showModal(
        "No se pudo actualizar",
        (e as Error)?.message || "Ocurrió un error al cambiar el estado."
      );
    },
    onSettled: () => refreshLaunches(),
  });

  type ConfirmOpts = {
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    type?: "warning" | "info" | "danger";
  };

  const handleChangeEstado = useCallback(
    (id: string, estado: string, confirm?: ConfirmOpts) => {
      if (confirm) {
        setConfirmState({
          ...confirm,
          onConfirm: () => changeEstadoMutation.mutate({ id, estado }),
        });
        return;
      }
      changeEstadoMutation.mutate({ id, estado });
    },
    [changeEstadoMutation]
  );

  // ── Acciones de estado libres (menú inline del sidebar) ───────────────────
  // Permiten cambiar el estado de cualquier convocatoria sin seguir el pipeline
  // lineal. Escriben `estado_convocatoria` y/o `estado_gestion` según el caso.
  const rowActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: RowAction }) => {
      const launch = launches.find((l) => l.id === id);
      const updates: Record<string, unknown> = {};
      switch (action) {
        case "abrir":
          updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Abierta";
          updates[FIELD_ESTADO_GESTION_LANZAMIENTOS] = "Relanzamiento Confirmado";
          break;
        case "cerrar":
          updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Cerrado";
          break;
        case "ocultar":
          updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Oculto";
          break;
        case "archivar":
          updates[FIELD_ESTADO_GESTION_LANZAMIENTOS] = "Archivado";
          break;
        case "desarchivar": {
          updates[FIELD_ESTADO_GESTION_LANZAMIENTOS] = "Relanzamiento Confirmado";
          // Si quedó oculta/archivada por `estado_convocatoria`, la normalizamos a
          // "Cerrado" para que vuelva a ser visible (cerrada) para los estudiantes.
          const ec = normalizeStringForComparison(
            (launch?.[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] as string) || ""
          );
          if (ec === "archivado" || ec === "archivada" || ec === "oculto") {
            updates[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] = "Cerrado";
          }
          break;
        }
      }
      await db.lanzamientos.update(id, updates as Record<string, unknown>);
    },
    onSuccess: () => refreshLaunches(),
    onError: (e: unknown) =>
      showModal(
        "No se pudo actualizar",
        (e as Error)?.message || "Ocurrió un error al cambiar el estado."
      ),
  });

  const handleRowAction = useCallback(
    (id: string, action: RowAction) => {
      if (action === "archivar") {
        setConfirmState({
          title: "¿Archivar convocatoria?",
          message: "Dejará de verse para los estudiantes y pasará a «Archivadas».",
          confirmText: "Archivar",
          type: "warning",
          onConfirm: () => rowActionMutation.mutate({ id, action }),
        });
        return;
      }
      rowActionMutation.mutate({ id, action });
    },
    [rowActionMutation]
  );

  const duplicateMutation = useMutation({
    mutationFn: async (launch: LanzamientoPPS) => {
      const copy: Record<string, unknown> = {
        [FIELD_NOMBRE_PPS_LANZAMIENTOS]: `${(launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Convocatoria"} (copia)`,
        [FIELD_ORIENTACION_LANZAMIENTOS]: launch[FIELD_ORIENTACION_LANZAMIENTOS],
        [FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS]: launch[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS],
        [FIELD_DESCRIPCION_LANZAMIENTOS]: launch[FIELD_DESCRIPCION_LANZAMIENTOS],
        [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: launch[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS],
        [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Oculto",
      };
      return db.lanzamientos.create(copy as LanzamientoPPS);
    },
    onSuccess: (created: unknown) => {
      refreshLaunches();
      const id = (created as { id?: string })?.id;
      if (id) setSelectedId(id);
      showModal("Borrador creado", "Se creó un nuevo borrador con los datos de la convocatoria.");
    },
    onError: (e: unknown) =>
      showModal(
        "No se pudo duplicar",
        (e as Error)?.message || "Ocurrió un error al duplicar la convocatoria."
      ),
  });

  // ── Canvas renderer ───────────────────────────────────────────────────────
  const renderCanvas = () => {
    if (isLoading) {
      return (
        <div className="lv4-canvas">
          <div className="lv4-empty">
            <span className="material-icons" style={{ animation: "lv4-spin 1s linear infinite" }}>
              refresh
            </span>
            <p>Cargando convocatorias…</p>
          </div>
        </div>
      );
    }

    if (!selectedId || !selectedLaunch) {
      return (
        <div className="lv4-canvas">
          <div className="lv4-empty">
            {entries.length === 0 ? (
              <>
                <span className="material-icons">rocket_launch</span>
                <p>Aún no hay convocatorias. ¡Creá la primera!</p>
                <button className="lv4-btn lv4-btn-primary" onClick={handleNew}>
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    add
                  </span>
                  Nueva convocatoria
                </button>
              </>
            ) : (
              <>
                <span className="material-icons">arrow_back</span>
                <p>Seleccioná una convocatoria de la lista para ver sus detalles.</p>
              </>
            )}
          </div>
        </div>
      );
    }

    switch (selectedUiState) {
      case "borrador":
        return (
          <div className="lv4-canvas">
            <BorradorView
              launch={selectedLaunch}
              onPublish={() =>
                handleChangeEstado(selectedLaunch.id, "Abierta", {
                  title: "¿Publicar convocatoria?",
                  message:
                    "Pasará a estado «Abierta» y será visible para inscripción de los estudiantes.",
                  confirmText: "Publicar",
                  type: "info",
                })
              }
              onRefresh={refreshLaunches}
            />
          </div>
        );
      case "seleccion":
        return (
          <div className="lv4-canvas">
            <SeleccionView
              launch={selectedLaunch}
              onCerrarInscripcion={() =>
                handleChangeEstado(selectedLaunch.id, "Cerrado", {
                  title: "¿Cerrar la mesa de inscripción?",
                  message:
                    "Ya no se podrán anotar más estudiantes ni modificar las selecciones actuales, y se enviarán automáticamente los correos de confirmación a los estudiantes seleccionados.",
                  confirmText: "Cerrar y notificar",
                  type: "warning",
                })
              }
            />
          </div>
        );
      case "seguro":
        return (
          <div className="lv4-canvas">
            <SeguroView launch={selectedLaunch} showModal={showModal} />
          </div>
        );
      case "confirmacion":
        return (
          <div className="lv4-canvas">
            <ConfirmacionView
              launch={selectedLaunch}
              showModal={showModal}
              onActivar={() =>
                handleChangeEstado(selectedLaunch.id, "Activa", {
                  title: "¿Activar esta PPS?",
                  message:
                    "Pasará a estado «Activa» (en curso). Los estudiantes con el compromiso aún pendiente quedarán como reemplazos.",
                  confirmText: "Activar PPS",
                  type: "info",
                })
              }
            />
          </div>
        );
      case "activa":
        return (
          <div className="lv4-canvas">
            <ActivaView
              launch={selectedLaunch}
              onArchivar={() =>
                handleChangeEstado(selectedLaunch.id, "Archivado", {
                  title: "¿Archivar esta convocatoria?",
                  message: "Quedará como referencia histórica.",
                  confirmText: "Archivar",
                  type: "warning",
                })
              }
            />
          </div>
        );
      case "archivada":
        return (
          <div className="lv4-canvas">
            <ArchivadaView
              launch={selectedLaunch}
              onDuplicar={() => duplicateMutation.mutate(selectedLaunch)}
              onReabrir={() =>
                handleChangeEstado(selectedLaunch.id, "Abierta", {
                  title: "¿Reabrir la inscripción?",
                  message:
                    "La convocatoria archivada volverá a estado «Abierta» para recibir nuevos postulantes.",
                  confirmText: "Reabrir",
                  type: "info",
                })
              }
            />
          </div>
        );
      default:
        return null;
    }
  };

  // ── Nueva convocatoria ────────────────────────────────────────────────────
  const renderNewConvocatoria = () => (
    <div className="lv4-canvas">
      <div className="lv4-canvas-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span className="lv4-chip lv4-chip-borrador">
            <span className="lv4-dot lv4-dot-borrador" />
            Nueva
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 33,
              fontWeight: 400,
              letterSpacing: "-0.015em",
              fontFamily: "'Instrument Serif', Georgia, serif",
            }}
          >
            Nueva convocatoria
          </h1>
          <button className="lv4-btn" onClick={() => setIsCreating(false)}>
            <span className="material-icons" style={{ fontSize: 14 }}>
              arrow_back
            </span>
            Volver
          </button>
        </div>
      </div>
      <div className="lv4-canvas-body">
        <Suspense fallback={<Loader />}>
          <LanzadorConvocatorias forcedTab="new" isTestingMode={isTestingMode} />
        </Suspense>
      </div>
    </div>
  );

  return (
    <>
      <div className="lv4">
        <LanzadorSidebar
          entries={entries}
          selectedId={selectedId}
          collapsed={sidebarCollapsed}
          onSelect={handleSelect}
          onNew={handleNew}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          onAction={handleRowAction}
          mobileOpen={mobileSidebarOpen}
        />
        {/* Backdrop del drawer (solo mobile, via CSS) */}
        <div
          className={`lv4-aside-backdrop${mobileSidebarOpen ? " open" : ""}`}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {isCreating ? renderNewConvocatoria() : renderCanvas()}
        </main>
      </div>
      {/* Botón flotante para abrir la lista en mobile (oculto en desktop via CSS) */}
      <button
        className="lv4-mobile-menu-btn"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Abrir lista de convocatorias"
      >
        <span className="material-icons">menu</span>
        Convocatorias
      </button>
      <ConfirmModal
        isOpen={!!confirmState}
        title={confirmState?.title || ""}
        message={confirmState?.message || ""}
        confirmText={confirmState?.confirmText}
        type={confirmState?.type}
        onConfirm={() => confirmState?.onConfirm()}
        onClose={() => setConfirmState(null)}
      />
    </>
  );
};

export default LanzadorView;
