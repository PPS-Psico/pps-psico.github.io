import { useQuery } from "@tanstack/react-query";
import {
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_ESTADO_PPS,
  FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS,
  FIELD_FECHA_FIN_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_ULTIMA_ACTUALIZACION_PPS,
  TABLE_NAME_FINALIZACION,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PPS,
} from "../constants";
import { supabase } from "../lib/supabaseClient";
import { mockDb } from "../services/mockDb";
import { normalizeStringForComparison, parseToUTCDate } from "../utils/formatters";

export interface OperationalData {
  endingLaunches: any[];
  pendingRequests: any[];
  pendingFinalizations: any[];
  closingAlerts: {
    id: string;
    name: string;
    daysRemaining: number;
    closingDate: string;
    isClosingToday: boolean;
  }[];
}

export const useOperationalData = (isTestingMode = false) => {
  return useQuery({
    queryKey: ["operationalData", isTestingMode],
    queryFn: async (): Promise<OperationalData> => {
      const now = new Date();
      const currentYear = now.getFullYear();
      now.setHours(0, 0, 0, 0);

      let launches: any[] = [];
      let requests: any[] = [];
      let finals: any[] = [];

      if (isTestingMode) {
        // Fetch from Mock DB to allow dynamic updates within the session
        launches = await mockDb.getAll("lanzamientos_pps");
        requests = await mockDb.getAll("solicitudes_pps");
        finals = await mockDb.getAll("finalizacion_pps");
      } else {
        // Fetch from Supabase
        const [launchesRes, requestsRes, finalsRes] = await Promise.all([
          supabase
            .from(TABLE_NAME_LANZAMIENTOS_PPS)
            .select(`*, ${FIELD_NOTAS_GESTION_LANZAMIENTOS}`),
          supabase.from(TABLE_NAME_PPS).select("*"),
          supabase
            .from(TABLE_NAME_FINALIZACION)
            .select("*")
            .eq(FIELD_ESTADO_FINALIZACION, "Pendiente"),
        ]);
        launches = launchesRes.data || [];
        requests = requestsRes.data || [];
        finals = finalsRes.data || [];
      }

      // 1. Process Launches
      const endingLaunches = launches
        .map((l: any) => {
          const endDate = parseToUTCDate(l[FIELD_FECHA_FIN_LANZAMIENTOS]);

          const daysLeft = endDate
            ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
            : 999;

          return {
            ...l,
            daysLeft,
            estado_gestion: l[FIELD_ESTADO_GESTION_LANZAMIENTOS] || "Pendiente de Gestión",
            notas_gestion: l[FIELD_NOTAS_GESTION_LANZAMIENTOS],
          };
        })
        .filter((l: any) => {
          // Filter by year: only current year launches
          const startDate = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
          if (!startDate || startDate.getUTCFullYear() < currentYear) {
            return false;
          }

          const status = normalizeStringForComparison(l.estado_gestion || "");
          if (status === "archivado" || status === "no se relanza") {
            return false;
          }

          // Past (overdue) or soon (within 60 days to be safer)
          if (l.daysLeft < 0) return true;
          if (l.daysLeft <= 60) return true;

          return false;
        });

      // 2. Process Requests
      const terminalStatuses = [
        "finalizada",
        "cancelada",
        "rechazada",
        "archivado",
        "pps realizada",
        "realizada",
        "no se pudo concretar",
      ];

      const pendingRequests = requests
        .map((r: any) => ({
          ...r,
          updated: r[FIELD_ULTIMA_ACTUALIZACION_PPS] || r.created_at,
          estado_seguimiento: r[FIELD_ESTADO_PPS],
        }))
        .filter((r: any) => {
          const status = normalizeStringForComparison(r.estado_seguimiento);
          if (terminalStatuses.includes(status)) return false;
          return true;
        });

      // 3. Process Finalizations (Already filtered in SQL, filter again for mock)
      const pendingFinalizations = finals.filter(
        (f: any) => f[FIELD_ESTADO_FINALIZACION] === "Pendiente"
      );

      // 4. Alerts for Closing Convocatorias (Using Inscription Date or Start Date fallback)
      const closingAlerts = launches
        .filter((l: any) => {
          const status = normalizeStringForComparison(l.estado_convocatoria);
          if (status !== "abierta" && status !== "abierto") return false;

          // Priority: Inscription End Date
          let targetDate = parseToUTCDate(l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]);

          // Fallback: Start Date
          if (!targetDate) {
            targetDate = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
          }

          if (!targetDate) return false;

          // Days until target date
          const daysLeft = Math.ceil(
            (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Alert condition: Today (0), Past (<0), or very soon (<= 2)
          return daysLeft <= 2;
        })
        .map((l: any) => {
          const closingDate =
            parseToUTCDate(l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS]) ||
            parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
          const daysRemaining = closingDate
            ? Math.ceil((closingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          return {
            id: l.id,
            name: l.nombre_pps || "Convocatoria sin nombre",
            daysRemaining,
            closingDate:
              l[FIELD_FECHA_FIN_INSCRIPCION_LANZAMIENTOS] || l[FIELD_FECHA_INICIO_LANZAMIENTOS],
            isClosingToday: daysRemaining === 0,
          };
        });

      return {
        endingLaunches,
        pendingRequests,
        pendingFinalizations,
        closingAlerts,
      };
    },
  });
};
