import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  TABLE_NAME_INSTITUCIONES,
  TABLE_NAME_LANZAMIENTOS_PPS,
} from "../constants";
import { db } from "../lib/db";
import { mockDb } from "../services/mockDb";
import { fetchPaginatedData } from "../services/supabaseService";
import type { LanzamientoPPS } from "../types";
import { normalizeStringForComparison, parseToUTCDate } from "../utils/formatters";
import { mapLanzamiento } from "../utils/mappers";

type LoadingState = "initial" | "loading" | "loaded" | "error";
export type FilterType = "all" | "vencidas" | "enGestion" | "confirmadas" | "demoradas";

const getGroupName = (name: unknown): string => {
  const strName = String(name || "");
  if (!strName) return "Sin Nombre";
  return strName.split(/ [-–] /)[0].trim();
};

interface UseGestionConvocatoriasProps {
  forcedOrientations?: string[];
  isTestingMode?: boolean;
  initialFilter?: FilterType;
}

export const useGestionConvocatorias = ({
  isTestingMode = false,
  initialFilter = "all",
}: UseGestionConvocatoriasProps) => {
  const [lanzamientos, setLanzamientos] = useState<LanzamientoPPS[]>([]);
  const [institutionsMap, setInstitutionsMap] = useState<
    Map<string, { id: string; phone?: string }>
  >(new Map());
  const [loadingState, setLoadingState] = useState<LoadingState>("initial");
  const [error, setError] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>(initialFilter);

  useEffect(() => {
    if (initialFilter) setFilterType(initialFilter);
  }, [initialFilter]);

  // Debounced search: we keep a ref to avoid refetching on every keystroke
  const debouncedSearchRef = useRef("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    debouncedSearchRef.current = searchTerm;
    const timer = setTimeout(() => {
      setDebouncedSearch(debouncedSearchRef.current);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = useCallback(async () => {
    setLoadingState("loading");
    setError(null);

    try {
      if (isTestingMode) {
        const records = await mockDb.getAll(TABLE_NAME_LANZAMIENTOS_PPS);
        setLanzamientos(records as unknown as LanzamientoPPS[]);
        setLoadingState("loaded");
        return;
      }

      const now = new Date();
      // FILTERS: Now we fetch all for better client-side categorization
      const filters: Record<string, unknown> = {};

      // Fetch Data WITHOUT searchTerm in the server query
      // Search filtering is done client-side to avoid re-fetching on every keystroke
      const { records: lanzRecords, error: lanzError } = await fetchPaginatedData(
        TABLE_NAME_LANZAMIENTOS_PPS,
        1,
        1000,
        [],
        undefined, // No server-side search
        [FIELD_NOMBRE_PPS_LANZAMIENTOS],
        { field: FIELD_FECHA_INICIO_LANZAMIENTOS, direction: "desc" }, // Order by newest first
        filters
      );

      const { records: instRecords } = await fetchPaginatedData(TABLE_NAME_INSTITUCIONES, 1, 1000, [
        "nombre",
        "telefono",
      ]);

      if (lanzError) throw new Error(lanzError.error as string);

      // Process Institutions Map
      const newInstitutionsMap = new Map<string, { id: string; phone?: string }>();
      instRecords.forEach((r) => {
        if (r.nombre) {
          newInstitutionsMap.set(normalizeStringForComparison(r.nombre), {
            id: String(r.id),
            phone: r.telefono || undefined,
          });
        }
      });
      setInstitutionsMap(newInstitutionsMap);

      // Client-side refinement
      const mappedRecords = lanzRecords.map(mapLanzamiento);

      // Basic filtering: exclude Conclusive statuses for the main management view if not in "all"
      const filteredRecords = mappedRecords.filter((pps) => {
        const status = pps[FIELD_ESTADO_GESTION_LANZAMIENTOS];
        // Archivados y Rechazados siempre ocultos de aca
        if (status === "Archivado" || status === "No se Relanza") return false;

        return true;
      });

      setLanzamientos(filteredRecords);
      setLoadingState("loaded");
    } catch (err: any) {
      console.error("CRITICAL ERROR in useGestionConvocatorias:", err);
      setToastInfo({ message: `Error crítico al cargar datos: ${err.message}`, type: "error" });
      setError(err.message || "Error al cargar datos");
      setLoadingState("error");
    }
  }, [isTestingMode]); // Remove filterType dependency since we fetch all now

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = useCallback(
    async (id: string, updates: Partial<LanzamientoPPS>): Promise<boolean> => {
      setUpdatingIds((prev) => new Set(prev).add(id));
      try {
        if (isTestingMode) {
          await mockDb.update(TABLE_NAME_LANZAMIENTOS_PPS, id, updates);
          setLanzamientos((prev) =>
            prev.map((pps) => (pps.id === id ? { ...pps, ...updates } : pps))
          );
        } else {
          await db.lanzamientos.update(id, updates);
          fetchData(); // Refresh to ensure sync
        }
        setToastInfo({ message: "Guardado correctamente.", type: "success" });
        return true;
      } catch (e) {
        setToastInfo({ message: "Error al guardar.", type: "error" });
        return false;
      } finally {
        setUpdatingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    },
    [fetchData, isTestingMode]
  );

  const handleUpdateInstitutionPhone = useCallback(
    async (institutionId: string, phone: string): Promise<boolean> => {
      if (isTestingMode) return true;
      try {
        await db.instituciones.update(institutionId, { telefono: phone });
        setToastInfo({ message: "Teléfono actualizado.", type: "success" });
        return true;
      } catch (e) {
        setToastInfo({ message: "Error al actualizar teléfono.", type: "error" });
        return false;
      }
    },
    [isTestingMode]
  );

  const filteredData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Client-side search filtering (replaces server-side)
    const searchNormalized = normalizeStringForComparison(debouncedSearch);
    const searchFiltered = searchNormalized
      ? lanzamientos.filter((pps) => {
          const name = normalizeStringForComparison(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "");
          return name.includes(searchNormalized);
        })
      : lanzamientos;

    // Nuevas categorías basadas en flujo de contacto
    const porContactar: (LanzamientoPPS & {
      daysSinceEnd: number;
      urgency?: "high" | "normal";
    })[] = [];
    const contactadasEsperandoRespuesta: (LanzamientoPPS & {
      daysSinceEnd: number;
      daysWaiting: number;
    })[] = [];
    const respondidasPendienteDecision: (LanzamientoPPS & {
      daysSinceEnd: number;
      daysSinceResponse?: number;
    })[] = [];
    const relanzamientosConfirmados: LanzamientoPPS[] = [];
    const activasYPorFinalizar: (LanzamientoPPS & {
      daysLeft?: number;
      urgency?: "high" | "normal";
    })[] = [];
    const activasIndefinidas: LanzamientoPPS[] = [];

    // 1. Group by Institution Base Name to process lifecycle
    const groups = new Map<string, LanzamientoPPS[]>();
    searchFiltered.forEach((pps) => {
      const name = getGroupName(pps[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(pps);
    });

    // 2. Analyze each Group based on contact flow
    groups.forEach((history) => {
      // Sort by Date Descending (Newest first)
      history.sort((a, b) => {
        const dateA = new Date(a[FIELD_FECHA_INICIO_LANZAMIENTOS] || "1900-01-01").getTime();
        const dateB = new Date(b[FIELD_FECHA_INICIO_LANZAMIENTOS] || "1900-01-01").getTime();
        return dateB - dateA;
      });

      // Check if there is ALREADY a confirmed future relaunch for current year
      const futureLaunch = history.find((pps) => {
        const status = normalizeStringForComparison(pps[FIELD_ESTADO_GESTION_LANZAMIENTOS]);
        const relaunchDate = pps[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS];

        return (
          status === "relanzamiento confirmado" ||
          status === "relanzada" ||
          (relaunchDate && new Date(relaunchDate).getFullYear() >= currentYear)
        );
      });

      if (futureLaunch) {
        relanzamientosConfirmados.push(futureLaunch);
        return; // Already managed this year
      }

      // Find the most relevant PPS (not archived or explicitly rejected)
      const relevantPPS =
        history.find((pps) => {
          const status = normalizeStringForComparison(pps[FIELD_ESTADO_GESTION_LANZAMIENTOS]);
          return status !== "archivado" && status !== "no se relanza";
        }) || history[0];

      if (!relevantPPS) return;

      const status = normalizeStringForComparison(relevantPPS[FIELD_ESTADO_GESTION_LANZAMIENTOS]);
      if (status === "archivado" || status === "no se relanza") return;

      const startDate = parseToUTCDate(relevantPPS[FIELD_FECHA_INICIO_LANZAMIENTOS]);
      const endDate = parseToUTCDate(relevantPPS[FIELD_FECHA_FIN_LANZAMIENTOS]);

      // Case A: No dates (Indefinite)
      if (!startDate || !endDate) {
        activasIndefinidas.push(relevantPPS);
        return;
      }

      // Case B: Active or Finished?
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (daysLeft >= 0) {
        // STILL ACTIVE - Not finished yet
        const urgency = daysLeft <= 5 ? "high" : "normal";
        activasYPorFinalizar.push({
          ...relevantPPS,
          daysLeft,
          urgency,
        });
        return;
      }

      // FINISHED - Now categorize by contact status
      const daysSinceEnd = Math.abs(daysLeft);

      // FLUJO DE CONTACTO:
      // 1. Pendiente de Gestión → Por Contactar
      if (status === "pendiente de gestion") {
        const urgency = daysSinceEnd <= 30 ? "high" : "normal";
        porContactar.push({
          ...relevantPPS,
          daysSinceEnd,
          urgency,
        });
        return;
      }

      // 2. Esperando Respuesta → Contactadas - Esperando Respuesta
      if (status === "esperando respuesta") {
        const lastUpdate = relevantPPS.updated_at || relevantPPS.created_at || now.toISOString();
        const daysWaiting = Math.max(
          0,
          Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 3600 * 24))
        );

        contactadasEsperandoRespuesta.push({
          ...relevantPPS,
          daysSinceEnd,
          daysWaiting,
        });
        return;
      }

      // 3. En Conversación / Seguimiento Exhaustivo → Respondidas - Pendiente de Decisión
      if (status === "en conversacion" || status === "seguimiento exhaustivo") {
        const lastUpdate = relevantPPS.updated_at || relevantPPS.created_at || now.toISOString();
        const daysWaiting = Math.max(
          0,
          Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 3600 * 24))
        );

        respondidasPendienteDecision.push({
          ...relevantPPS,
          daysSinceEnd,
          daysSinceResponse: daysWaiting,
        });
        return;
      }

      // Any other status for finished PPS goes to "Por Contactar" for manual review
      porContactar.push({
        ...relevantPPS,
        daysSinceEnd,
        urgency: "normal",
      });
    });

    // Sort each category by urgency/elapsed time
    return {
      // Categorías de contacto (nuevo flujo)
      porContactar: porContactar.sort((a, b) => {
        if (a.urgency === "high" && b.urgency !== "high") return -1;
        if (a.urgency !== "high" && b.urgency === "high") return 1;
        return a.daysSinceEnd - b.daysSinceEnd;
      }),
      contactadasEsperandoRespuesta: contactadasEsperandoRespuesta.sort(
        (a, b) => b.daysWaiting - a.daysWaiting
      ),
      respondidasPendienteDecision: respondidasPendienteDecision.sort(
        (a, b) => (a.daysSinceResponse || 0) - (b.daysSinceResponse || 0)
      ),

      // Categorías existentes
      relanzamientosConfirmados,
      activasYPorFinalizar: activasYPorFinalizar.sort(
        (a, b) => (a.daysLeft || 999) - (b.daysLeft || 999)
      ),
      activasIndefinidas,
    };
  }, [lanzamientos, debouncedSearch]);

  return {
    institutionsMap,
    loadingState,
    error,
    toastInfo,
    setToastInfo,
    updatingIds,
    searchTerm,
    setSearchTerm,
    orientationFilter: "all",
    setOrientationFilter: () => {},
    filterType,
    setFilterType,
    handleSave,
    handleUpdateInstitutionPhone,
    handleSync: async () => {},
    handleLinkOrphans: async () => {},
    filteredData,
  };
};
