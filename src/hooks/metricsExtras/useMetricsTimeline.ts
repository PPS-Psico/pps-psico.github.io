import { useQuery } from "@tanstack/react-query";
import {
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_FECHA_FINALIZACION_ESTUDIANTES,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  TABLE_NAME_ESTUDIANTES,
  TABLE_NAME_INSTITUCIONES,
  TABLE_NAME_LANZAMIENTOS_PPS,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { getGroupName, parseToUTCDate } from "../../utils/formatters";
import { range } from "./shared";
import type { TimelineEvent } from "./types";

// ════════════════════════════════════════════════════════════════════════════
// LÍNEA DE TIEMPO · hitos del ciclo derivados de datos reales
// ════════════════════════════════════════════════════════════════════════════
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")} ${MESES[d.getUTCMonth()]}`;

export const useMetricsTimeline = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["metricsTimeline", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<TimelineEvent[]> => {
      const { start, end } = range(year);
      const events: TimelineEvent[] = [];

      // — Lanzamientos agrupados por mes → "N PPS lanzadas" —
      try {
        const { data } = await supabase
          .from(TABLE_NAME_LANZAMIENTOS_PPS)
          .select(`${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_FECHA_INICIO_LANZAMIENTOS}`)
          .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
          .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
          .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10));
        const byMonth = new Map<number, { nombres: Set<string>; first: Date }>();
        (data || []).forEach((l: Record<string, unknown>) => {
          const d = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string);
          if (!d) return;
          const m = d.getUTCMonth();
          const nombre = getGroupName(String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || ""));
          const e = byMonth.get(m) || { nombres: new Set<string>(), first: d };
          if (nombre) e.nombres.add(nombre);
          if (d < e.first) e.first = d;
          byMonth.set(m, e);
        });
        byMonth.forEach((e, m) => {
          const items = Array.from(e.nombres).sort((a, b) => a.localeCompare(b, "es"));
          events.push({
            fecha: fechaCorta(e.first),
            orden: m * 100 + 1,
            tipo: "lanzamiento",
            titulo: `${items.length} ${items.length === 1 ? "PPS lanzada" : "PPS lanzadas"}`,
            detalle: items.length
              ? "Convocatorias publicadas en el mes."
              : "Convocatorias publicadas.",
            tone: "accent",
            items,
          });
        });
      } catch {
        /* ignore */
      }

      // — Finalizaciones efectivas agrupadas por mes → "N acreditaciones" —
      try {
        const { data } = await supabase
          .from(TABLE_NAME_ESTUDIANTES)
          .select(`id, ${FIELD_FECHA_FINALIZACION_ESTUDIANTES}`)
          .eq(FIELD_ESTADO_ESTUDIANTES, "Finalizado")
          .gte(FIELD_FECHA_FINALIZACION_ESTUDIANTES, start.slice(0, 10))
          .lt(FIELD_FECHA_FINALIZACION_ESTUDIANTES, end.slice(0, 10));
        const byMonth = new Map<number, { n: number; first: Date }>();
        (data || []).forEach((student: Record<string, unknown>) => {
          const d = parseToUTCDate(student[FIELD_FECHA_FINALIZACION_ESTUDIANTES] as string);
          if (!d || d.getUTCFullYear() !== year) return;
          const m = d.getUTCMonth();
          const e = byMonth.get(m) || { n: 0, first: d };
          e.n += 1;
          if (d < e.first) e.first = d;
          byMonth.set(m, e);
        });
        byMonth.forEach((e, m) => {
          events.push({
            fecha: fechaCorta(e.first),
            orden: m * 100 + 5,
            tipo: "cierre",
            titulo: `${e.n} ${e.n === 1 ? "acreditación" : "acreditaciones"}`,
            detalle: "Finalizaciones efectivas registradas en el mes.",
            tone: "ok",
          });
        });
      } catch {
        /* ignore */
      }

      // — Convenios nuevos del año —
      try {
        const { data } = await supabase
          .from(TABLE_NAME_INSTITUCIONES)
          .select(FIELD_NOMBRE_INSTITUCIONES)
          // convenio_nuevo es smallint (año): comparamos con el número.
          .eq(FIELD_CONVENIO_NUEVO_INSTITUCIONES, year);
        const nombres = Array.from(
          new Set(
            (data || []).map((i: Record<string, unknown>) =>
              getGroupName(String(i[FIELD_NOMBRE_INSTITUCIONES] || ""))
            )
          )
        ).filter(Boolean);
        if (nombres.length) {
          events.push({
            fecha: `${year}`,
            orden: 9999,
            tipo: "convenio",
            titulo: `${nombres.length} ${nombres.length === 1 ? "convenio nuevo" : "convenios nuevos"}`,
            detalle: nombres.slice(0, 4).join(", "),
            tone: "ok",
          });
        }
      } catch {
        /* ignore */
      }

      return events.sort((a, b) => a.orden - b.orden);
    },
  });
};
