import { useQuery } from "@tanstack/react-query";
import {
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTADO_PPS,
  FIELD_FECHA_SOLICITUD_FINALIZACION,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_SOLICITUD_NOMBRE_ALUMNO,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_FINALIZACION,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PPS,
  TABLE_NAME_SOLICITUDES_MODIFICACION,
  TABLE_NAME_SOLICITUDES_NUEVA,
} from "../constants";
import { supabase } from "../lib/supabaseClient";
import { mockDb } from "../services/mockDb";

export interface ActivityItem {
  id: string;
  type: "request" | "finalization" | "launch";
  title: string;
  description: string;
  timestamp: Date;
  user: string;
  avatarLetter: string;
  statusColor: "blue" | "emerald" | "amber" | "rose" | "purple" | "indigo";
  rawStatus?: string;
  institution?: string;
  isNew?: boolean;
  metadata?: {
    count?: number; // Para inscriptos
  };
}

const normalizeStatus = (status: string): string => {
  if (!status) return "Pendiente";
  const lower = status.toLowerCase().trim();
  if (lower === "pendiente") return "Pendiente";
  return status;
};

export const useActivityFeed = (isTestingMode = false) => {
  return useQuery({
    queryKey: ["activityFeed", isTestingMode],
    queryFn: async (): Promise<ActivityItem[]> => {
      const items: ActivityItem[] = [];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      try {
        let requests: any[] = [];
        let finalizations: any[] = [];
        let launches: any[] = [];
        let correctionMods: any[] = [];
        let correctionNews: any[] = [];
        const enrollmentCounts: Record<string, number> = {};

        if (isTestingMode) {
          requests = await mockDb.getAll("solicitudes_pps");
          finalizations = await mockDb.getAll("finalizacion_pps");
          launches = await mockDb.getAll("lanzamientos_pps");

          // Simple mock counts
          launches.forEach((l: any) => {
            enrollmentCounts[l.id] = Math.floor(Math.random() * 5);
          });
        } else {
          // 1. Requests (Solicitudes de Inicio - Autogestión)
          const requestsRes = await supabase
            .from(TABLE_NAME_PPS)
            .select(
              `id, created_at, ${FIELD_SOLICITUD_NOMBRE_ALUMNO}, ${FIELD_EMPRESA_PPS_SOLICITUD}, ${FIELD_ESTADO_PPS}`
            )
            .neq(FIELD_ESTADO_PPS, "Archivado")
            .order("created_at", { ascending: false })
            .limit(10);
          requests = requestsRes.data || [];

          // 2. Finalizations (Solicitudes de Acreditación - Egreso)
          const finalsRes = await supabase
            .from(TABLE_NAME_FINALIZACION)
            .select(
              `
                            id,
                            created_at,
                            ${FIELD_FECHA_SOLICITUD_FINALIZACION},
                            ${FIELD_ESTADO_FINALIZACION},
                            estudiante:estudiantes!fk_finalizacion_estudiante (
                                ${FIELD_NOMBRE_ESTUDIANTES}
                            )
                        `
            )
            .order("created_at", { ascending: false })
            .limit(10);
          finalizations = finalsRes.data || [];

          // 3. Launches (Nuevas Convocatorias - Oferta)
          const launchesRes = await supabase
            .from(TABLE_NAME_LANZAMIENTOS_PPS)
            .select(
              `id, created_at, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS}`
            )
            .eq(FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS, "Abierta")
            .order("created_at", { ascending: false })
            .limit(5);
          launches = launchesRes.data || [];

          // 3b. Counts
          if (launches.length > 0) {
            const launchIds = launches.map((l) => l.id);
            const { data: enrollments } = await supabase
              .from(TABLE_NAME_CONVOCATORIAS)
              .select(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS)
              .in(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, launchIds);

            if (enrollments) {
              enrollments.forEach((e: any) => {
                let lId = e[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                if (Array.isArray(lId)) lId = lId[0];
                if (lId) enrollmentCounts[lId] = (enrollmentCounts[lId] || 0) + 1;
              });
            }
          }

          // 4. Correction Requests (Modificaciones)
          const modsRes = await supabase
            .from(TABLE_NAME_SOLICITUDES_MODIFICACION)
            .select(
              `
              id, created_at, tipo_modificacion, estado,
              estudiante:estudiantes(nombre)
            `
            )
            .order("created_at", { ascending: false })
            .limit(10);
          correctionMods = modsRes.data || [];

          // 5. Correction Requests (Nuevas PPS)
          const newsRes = await supabase
            .from(TABLE_NAME_SOLICITUDES_NUEVA)
            .select(
              `
              id, created_at, orientacion, estado, nombre_institucion_manual,
              estudiante:estudiantes(nombre),
              institucion:instituciones(nombre)
            `
            )
            .order("created_at", { ascending: false })
            .limit(10);
          correctionNews = newsRes.data || [];
        }

        // Mapper: Solicitudes (Ingreso)
        requests.forEach((r: any) => {
          let status = r[FIELD_ESTADO_PPS] || "Pendiente";
          status = normalizeStatus(status);
          if (status === "Archivado") return;

          const name = r[FIELD_SOLICITUD_NOMBRE_ALUMNO] || r.nombre_alumno || "Estudiante";
          const inst = r[FIELD_EMPRESA_PPS_SOLICITUD] || r.nombre_institucion || "Institución";

          // Fallback to current date if created_at is missing/null/invalid
          let date = new Date(r.created_at || Date.now());
          if (isNaN(date.getTime())) date = new Date();

          let color: ActivityItem["statusColor"] = "blue";
          if (status === "Pendiente") color = "amber";
          else if (status === "Realizada") color = "purple";
          else if (["Rechazada", "Cancelada", "No se pudo concretar"].includes(status))
            color = "rose";

          items.push({
            id: `req-${r.id}`,
            type: "request",
            title: "Solicitud de Inicio",
            description: status,
            timestamp: date,
            user: name,
            avatarLetter: name.charAt(0).toUpperCase(),
            statusColor: color,
            rawStatus: status,
            institution: inst,
            isNew: date > oneDayAgo && status === "Pendiente",
          });
        });

        // Mapper: Modificaciones
        correctionMods.forEach((m: any) => {
          const status = normalizeStatus(m.estado);
          const student = Array.isArray(m.estudiante) ? m.estudiante[0] : m.estudiante;
          const name = student?.nombre || "Estudiante";
          let date = new Date(m.created_at || Date.now());

          items.push({
            id: `mod-${m.id}`,
            type: "request",
            title: "Cambio de Práctica",
            description: `Solicita cambio de ${m.tipo_modificacion}`,
            timestamp: date,
            user: name,
            avatarLetter: name.charAt(0).toUpperCase(),
            statusColor: "purple",
            rawStatus: status,
            isNew: date > oneDayAgo && status === "Pendiente",
          });
        });

        // Mapper: Nuevas PPS
        correctionNews.forEach((n: any) => {
          const status = normalizeStatus(n.estado);
          const student = Array.isArray(n.estudiante) ? n.estudiante[0] : n.estudiante;
          const name = student?.nombre || "Estudiante";
          const inst =
            (Array.isArray(n.institucion) ? n.institucion[0]?.nombre : n.institucion?.nombre) ||
            n.nombre_institucion_manual;
          let date = new Date(n.created_at || Date.now());

          items.push({
            id: `newpps-${n.id}`,
            type: "request",
            title: "Práctica Autogestiva",
            description: `Nueva solicitud en ${inst || "Institución"}`,
            timestamp: date,
            user: name,
            avatarLetter: name.charAt(0).toUpperCase(),
            statusColor: "blue",
            rawStatus: status,
            institution: inst,
            isNew: date > oneDayAgo && status === "Pendiente",
          });
        });

        // Mapper: Acreditaciones (Egreso)
        finalizations.forEach((f: any) => {
          const studentData = Array.isArray(f.estudiante) ? f.estudiante[0] : f.estudiante;
          const name = studentData?.[FIELD_NOMBRE_ESTUDIANTES] || "Estudiante";

          let status = f[FIELD_ESTADO_FINALIZACION] || "Pendiente";
          status = normalizeStatus(status);
          const dateStr = f[FIELD_FECHA_SOLICITUD_FINALIZACION] || f.created_at;

          let date = new Date(dateStr || Date.now());
          if (isNaN(date.getTime())) date = new Date();

          const isPending = status === "Pendiente";

          items.push({
            id: `fin-${f.id}`,
            type: "finalization",
            title: "Solicita Acreditación",
            description: isPending ? "Documentación lista" : `Estado: ${status}`,
            timestamp: date,
            user: name,
            avatarLetter: name.charAt(0).toUpperCase(),
            statusColor: isPending ? "emerald" : "blue",
            rawStatus: status,
            isNew: date > oneDayAgo && isPending,
          });
        });

        // Mapper: Lanzamientos (Oferta)
        launches.forEach((l: any) => {
          const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Nueva Convocatoria";

          let date = new Date(l.created_at || Date.now());
          if (isNaN(date.getTime())) date = new Date();

          const count = enrollmentCounts[l.id] || 0;

          items.push({
            id: `lanz-${l.id}`,
            type: "launch",
            title: "Convocatoria Abierta",
            description: "Inscripciones habilitadas",
            timestamp: date,
            user: name,
            avatarLetter: name.charAt(0).toUpperCase(),
            statusColor: "indigo",
            rawStatus: "Abierta",
            isNew: date > oneDayAgo,
            metadata: { count },
          });
        });

        return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      } catch (error) {
        console.error("Activity Feed Critical Error:", error);
        return [];
      }
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
};
