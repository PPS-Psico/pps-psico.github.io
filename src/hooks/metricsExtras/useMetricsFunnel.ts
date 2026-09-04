import { useQuery } from "@tanstack/react-query";
import { FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS, TABLE_NAME_CONVOCATORIAS } from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { normalizeStringForComparison } from "../../utils/formatters";
import { range, ESTADOS_SELECCIONADO } from "./shared";
import type { FunnelStage } from "./types";

// ════════════════════════════════════════════════════════════════════════════
// EMBUDO DEL CICLO (legacy — reemplazado por useMetricsDinamica)
// Se conserva el tipo FunnelStage por compatibilidad, pero la vista ya no lo usa.
// ════════════════════════════════════════════════════════════════════════════
export const useMetricsFunnel = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsFunnel", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<FunnelStage[]> => {
      const { start, end } = range(year);
      // Embudo en PERSONAS (alumnos distintos), acotado al año y ACUMULATIVO:
      // cada etapa cuenta "cuántos llegaron al menos hasta acá".
      //   se postularon → seleccionados → hicieron PPS → finalizados
      // Contar postulaciones mezclaba unidades (un alumno se postula a varias);
      // en personas el embudo cuenta una historia real y decrece de forma sana.
      const postulados = new Set<string>();
      const seleccionadosConv = new Set<string>();
      try {
        const { data } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(`estudiante_id, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`)
          .gte("created_at", start)
          .lt("created_at", end);
        const rows = (data || []) as Array<Record<string, unknown>>;
        rows.forEach((r) => {
          const sid = r.estudiante_id ? String(r.estudiante_id) : "";
          if (!sid) return;
          postulados.add(sid);
          const e = normalizeStringForComparison(
            String(r[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          if (ESTADOS_SELECCIONADO.includes(e)) seleccionadosConv.add(sid);
        });
      } catch {
        /* tabla/permiso ausente → embudo parcial */
      }

      // Prácticas del año: quién llegó a hacerla (en curso o finalizada) y quién
      // finalizó. El estado es un snapshot, por eso "hicieron" = tiene práctica.
      const hicieron = new Set<string>();
      const finalizados = new Set<string>();
      try {
        const { data } = await supabase
          .from("practicas")
          .select("estudiante_id, estado, fecha_inicio")
          .gte("fecha_inicio", start.slice(0, 10))
          .lt("fecha_inicio", end.slice(0, 10));
        const rows = (data || []) as Array<Record<string, unknown>>;
        rows.forEach((r) => {
          const sid = r.estudiante_id ? String(r.estudiante_id) : "";
          if (!sid) return;
          hicieron.add(sid);
          const estado = normalizeStringForComparison(String(r.estado || ""));
          if (estado === "finalizada") finalizados.add(sid);
        });
      } catch {
        /* sin prácticas accesibles → etapas finales en 0 */
      }

      // "Seleccionados" = quedó seleccionado en convocatoria O ya tiene práctica
      // del año (no todos pasan por el estado 'Seleccionado'). La unión mantiene
      // el embudo monótono decreciente.
      const seleccionados = new Set<string>([...seleccionadosConv, ...hicieron]);

      const stages: FunnelStage[] = [
        {
          key: "postulados",
          label: "Se postularon",
          value: postulados.size,
          note: "Alumnos que se inscribieron a alguna PPS",
          tone: "accent",
        },
        {
          key: "seleccionados",
          label: "Seleccionados",
          value: seleccionados.size,
          note: "Quedaron asignados a un cupo",
          tone: "ai",
        },
        {
          key: "activas",
          label: "Hicieron PPS",
          value: hicieron.size,
          note: "Iniciaron la práctica este año",
          tone: "ok",
        },
        {
          key: "finalizadas",
          label: "Finalizados",
          value: finalizados.size,
          note: "Ya acreditaron en el ciclo",
          tone: "ok",
        },
      ];
      return stages;
    },
  });
};
