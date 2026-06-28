import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  FIELD_HISTORIAL_GESTION_LANZAMIENTOS,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS,
  TABLE_NAME_INSTITUCIONES,
  TABLE_NAME_LANZAMIENTOS_PPS,
} from "../constants";
import { db } from "../lib/db";
import { mockDb } from "../services/mockDb";
import { fetchPaginatedData } from "../services/supabaseService";
import type { LanzamientoPPS } from "../types";
import { normalizeStringForComparison, parseToUTCDate, getGroupName } from "../utils/formatters";
import { mapLanzamiento } from "../utils/mappers";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";
import { POR_FINALIZAR_THRESHOLD_DAYS } from "../views/admin/gestion/gestionTypes";

type LoadingState = "initial" | "loading" | "loaded" | "error";
export type FilterType = "all" | "vencidas" | "enGestion" | "confirmadas" | "demoradas";

const MS_PER_DAY = 1000 * 3600 * 24;

// Lista de estados de gestión que el flujo reconoce explícitamente. Cualquier
// otro valor en una PPS finalizada es un estado "no clasificado": lo seguimos
// mostrando para no perderlo, pero marcado aparte para no inflar "Por contactar"
// con casos que en realidad nadie revisó nunca.
const KNOWN_FINISHED_STATUSES = new Set([
  "pendiente de gestion",
  "esperando respuesta",
  "en conversacion",
  "seguimiento exhaustivo",
  "relanzamiento confirmado",
  "relanzada",
  "archivado",
  "no se relanza",
]);

// Intenta leer la fecha de la última entrada del historial de gestión
// (`historial_gestion`), que se guarda con la entrada más reciente arriba y un
// prefijo "dd/mm:". Es una señal de "último contacto real" más fiable que
// `updated_at`, que se mueve con cualquier edición o migración masiva.
// Devuelve un timestamp (ms) o null si no se puede inferir.
const lastHistoryContactTs = (raw: string | null | undefined, reference: Date): number | null => {
  if (!raw) return null;
  const firstLine = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (!firstLine) return null;
  // Prefijo de fecha "dd/mm" o "dd/mm/aaaa" antes del primer ":".
  const prefix = firstLine.split(":")[0].trim();
  const parts = prefix.split("/");
  if (parts.length < 2 || parts.length > 3) return null;
  const day = parseInt(parts[0], 10);
  const monthRaw = parseInt(parts[1], 10);
  if (!Number.isInteger(day) || !Number.isInteger(monthRaw)) return null;
  if (day < 1 || day > 31 || monthRaw < 1 || monthRaw > 12) return null;
  const month = monthRaw - 1;
  const hasYear = parts.length === 3 && parts[2] !== "";
  let year: number;
  if (hasYear) {
    year = parseInt(parts[2], 10);
    if (!Number.isInteger(year)) return null;
    if (year < 100) year += 2000;
  } else {
    // Sin año explícito: asumimos el año de referencia y, si la fecha queda en
    // el futuro (p. ej. entrada de diciembre vista en enero), restamos un año.
    year = reference.getFullYear();
  }
  let ts = new Date(year, month, day).getTime();
  if (Number.isNaN(ts)) return null;
  if (!hasYear && ts > reference.getTime()) {
    ts = new Date(year - 1, month, day).getTime();
  }
  return ts;
};

// Días de espera desde el último contacto registrado. Prioriza el historial de
// gestión; si no hay, cae a updated_at / created_at.
const daysWaitingSince = (pps: LanzamientoPPS, now: Date): number => {
  const historyTs = lastHistoryContactTs(
    pps[FIELD_HISTORIAL_GESTION_LANZAMIENTOS] as string | null,
    now
  );
  const fallbackRaw = pps.updated_at || pps.created_at || now.toISOString();
  const ts = historyTs ?? new Date(fallbackRaw).getTime();
  return Math.max(0, Math.floor((now.getTime() - ts) / MS_PER_DAY));
};

export interface InstitutionInfo {
  id: string;
  nombre: string;
  phone?: string;
  referente?: string;
  localidad?: string;
  convenio?: string;
  orientaciones?: string[];
}

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
  const [institutionsMap, setInstitutionsMap] = useState<Map<string, InstitutionInfo>>(new Map());
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
        "direccion",
        "convenio_nuevo",
        "tutor",
        "orientaciones",
      ]);

      if (lanzError) throw new Error(lanzError.error as string);

      // Process Institutions Map
      const newInstitutionsMap = new Map<string, InstitutionInfo>();
      instRecords.forEach((r) => {
        if (r.nombre) {
          const orientaciones = Array.isArray(r.orientaciones)
            ? (r.orientaciones as string[])
            : typeof r.orientaciones === "string" && r.orientaciones
              ? String(r.orientaciones)
                  .split(/[,;]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
          newInstitutionsMap.set(normalizeStringForComparison(r.nombre), {
            id: String(r.id),
            nombre: String(r.nombre),
            phone: r.telefono || undefined,
            referente: r.tutor || undefined,
            localidad: r.direccion || undefined,
            convenio: r.convenio_nuevo != null ? String(r.convenio_nuevo) : undefined,
            orientaciones,
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
    } catch (err) {
      logger.error("CRITICAL ERROR in useGestionConvocatorias:", err);
      const msg = getErrorMessage(err, "Error al cargar datos");
      setToastInfo({ message: `Error crítico al cargar datos: ${msg}`, type: "error" });
      setError(msg);
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

  const handleUpdateInstitution = useCallback(
    async (
      institutionId: string,
      patch: Partial<{
        telefono: string;
        tutor: string;
        direccion: string;
        convenio_nuevo: string;
      }>
    ): Promise<boolean> => {
      if (isTestingMode) return true;
      try {
        // convenio_nuevo es smallint en DB: convertir antes de enviar.
        const cleanPatch: Record<string, unknown> = { ...patch };
        if ("convenio_nuevo" in cleanPatch) {
          const raw = cleanPatch.convenio_nuevo;
          const n = raw !== "" && raw != null ? Number(raw) : NaN;
          cleanPatch.convenio_nuevo = Number.isNaN(n) ? null : n;
        }
        await db.instituciones.update(institutionId, cleanPatch as never);
        setToastInfo({ message: "Institución actualizada.", type: "success" });
        await fetchData();
        return true;
      } catch (e) {
        setToastInfo({ message: "Error al actualizar la institución.", type: "error" });
        return false;
      }
    },
    [isTestingMode, fetchData]
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
      noClasificada?: boolean;
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
    const activasPorFinalizar: (LanzamientoPPS & {
      daysLeft?: number;
      urgency?: "high" | "normal";
    })[] = [];
    const activasEnCurso: (LanzamientoPPS & {
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
        const startDate = parseToUTCDate(futureLaunch[FIELD_FECHA_INICIO_LANZAMIENTOS]);
        const endDate = parseToUTCDate(futureLaunch[FIELD_FECHA_FIN_LANZAMIENTOS]);
        const daysLeft = endDate
          ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
          : undefined;
        const hasStarted = startDate ? startDate.getTime() <= now.getTime() : false;
        const hasFinished = daysLeft != null && daysLeft < 0;

        // Un relanzamiento confirmado que YA está en curso (empezó y no terminó)
        // debe contarse como "Activa / Por finalizar", no quedar escondido en
        // "Confirmadas". "Confirmadas" queda para lo que está confirmado pero
        // todavía no arrancó (esperando fecha de inicio) o sin fechas cargadas.
        if (hasStarted && !hasFinished && daysLeft != null) {
          const urgency: "high" | "normal" = daysLeft <= 15 ? "high" : "normal";
          const activeItem = { ...futureLaunch, daysLeft, urgency };
          activasYPorFinalizar.push(activeItem);
          if (daysLeft <= POR_FINALIZAR_THRESHOLD_DAYS) {
            activasPorFinalizar.push(activeItem);
          } else {
            activasEnCurso.push(activeItem);
          }
          return;
        }

        relanzamientosConfirmados.push(
          daysLeft != null
            ? ({
                ...futureLaunch,
                daysLeft,
                urgency: daysLeft <= 15 ? "high" : "normal",
              } as LanzamientoPPS)
            : futureLaunch
        );
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
        const urgency: "high" | "normal" = daysLeft <= 15 ? "high" : "normal";
        const activeItem = {
          ...relevantPPS,
          daysLeft,
          urgency,
        };
        activasYPorFinalizar.push(activeItem);
        if (daysLeft <= POR_FINALIZAR_THRESHOLD_DAYS) {
          activasPorFinalizar.push(activeItem);
        } else {
          activasEnCurso.push(activeItem);
        }
        return;
      }

      // FINISHED - Now categorize by contact status
      const daysSinceEnd = Math.abs(daysLeft);

      // Función para verificar si tiene recordatorio activo (futuro)
      const tieneRecordatorioActivo = (pps: LanzamientoPPS): boolean => {
        const reminderDate = pps[FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS];
        if (!reminderDate) return false;
        const d = parseToUTCDate(reminderDate);
        if (!d) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d > today;
      };

      // FLUJO DE CONTACTO:
      // 1. Pendiente de Gestión → Por Contactar (excluir si tiene recordatorio activo)
      if (status === "pendiente de gestion") {
        // Si tiene recordatorio activo, no mostrar en vencidas
        if (tieneRecordatorioActivo(relevantPPS)) {
          return;
        }
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
        const daysWaiting = daysWaitingSince(relevantPPS, now);

        contactadasEsperandoRespuesta.push({
          ...relevantPPS,
          daysSinceEnd,
          daysWaiting,
        });
        return;
      }

      // 3. En Conversación / Seguimiento Exhaustivo → Respondidas - Pendiente de Decisión
      if (status === "en conversacion" || status === "seguimiento exhaustivo") {
        const daysWaiting = daysWaitingSince(relevantPPS, now);

        respondidasPendienteDecision.push({
          ...relevantPPS,
          daysSinceEnd,
          daysSinceResponse: daysWaiting,
        });
        return;
      }

      // Cualquier otro estado en una PPS finalizada cae acá para revisión manual
      // (salvo que tenga recordatorio activo). Lo marcamos como `noClasificada`
      // para distinguir el caso real "pendiente de gestión" de un estado que el
      // flujo no reconoce y que conviene revisar / normalizar.
      if (!tieneRecordatorioActivo(relevantPPS)) {
        porContactar.push({
          ...relevantPPS,
          daysSinceEnd,
          urgency: "normal",
          noClasificada: !KNOWN_FINISHED_STATUSES.has(status),
        });
      }
    });

    // Sort each category by urgency/elapsed time
    return {
      // Categorías de contacto (nuevo flujo)
      porContactar: porContactar.sort((a, b) => {
        if (a.urgency === "high" && b.urgency !== "high") return -1;
        if (a.urgency !== "high" && b.urgency === "high") return 1;
        return b.daysSinceEnd - a.daysSinceEnd;
      }),
      contactadasEsperandoRespuesta: contactadasEsperandoRespuesta.sort(
        (a, b) => b.daysWaiting - a.daysWaiting
      ),
      respondidasPendienteDecision: respondidasPendienteDecision.sort(
        (a, b) => (b.daysSinceResponse || 0) - (a.daysSinceResponse || 0)
      ),

      // Categorías existentes
      relanzamientosConfirmados,
      activasYPorFinalizar: activasYPorFinalizar.sort(
        (a, b) => (a.daysLeft || 999) - (b.daysLeft || 999)
      ),
      activasPorFinalizar: activasPorFinalizar.sort(
        (a, b) => (a.daysLeft || 999) - (b.daysLeft || 999)
      ),
      activasEnCurso: activasEnCurso.sort((a, b) => (a.daysLeft || 999) - (b.daysLeft || 999)),
      activasIndefinidas,
    };
  }, [lanzamientos, debouncedSearch]);

  return {
    lanzamientos,
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
    handleUpdateInstitution,
    handleSync: async () => {},
    handleLinkOrphans: async () => {},
    filteredData,
  };
};
