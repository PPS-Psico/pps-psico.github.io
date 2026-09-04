import { useQuery } from "@tanstack/react-query";
import {
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_FINALIZACION_ESTUDIANTES,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_HORAS_PRACTICAS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
  TABLE_NAME_ESTUDIANTES,
  TABLE_NAME_PRACTICAS,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { isPracticeStatusComputable } from "../../logic/studentRules";
import { parseToUTCDate } from "../../utils/formatters";
import { range, percentil } from "./shared";

// ════════════════════════════════════════════════════════════════════════════
// TRAYECTORIA DE FINALIZACIÓN (Reporte ejecutivo)
// Para los estudiantes que finalizaron efectivamente en el año: cuánto tardaron
// desde el inicio de su primera práctica hasta la fecha de finalización, cuántos
// registros de práctica tienen y cuántas horas se cargaron. La cifra principal es la
// MEDIANA (robusta frente a casos extremos, el estándar en métricas de tiempo
// a egreso), acompañada del promedio y el rango intercuartílico.
// ════════════════════════════════════════════════════════════════════════════
export interface TrayectoriaFinalizados {
  /** Total de estudiantes con finalización efectiva registrada en el año. */
  totalFinalizados: number;
  /** Finalizados del año con trayectoria calculable (práctica + fechas sanas). */
  n: number;
  /** Registros excluidos del tiempo por fecha negativa o mayor a seis años. */
  duracionesInvalidas: number;
  medianaMeses: number | null;
  promedioMeses: number | null;
  p25Meses: number | null;
  p75Meses: number | null;
  promedioRegistrosPractica: number | null;
  /** Promedio de horas cargadas, sobre finalizados con horas positivas. */
  promedioHorasCargadas: number | null;
  dist: { label: string; n: number }[];
}

const MESES_POR_DIA = 1 / 30.44; // mes promedio del calendario

export const useTrayectoriaFinalizados = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["trayectoriaFinalizados", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<TrayectoriaFinalizados> => {
      const empty: TrayectoriaFinalizados = {
        totalFinalizados: 0,
        n: 0,
        duracionesInvalidas: 0,
        medianaMeses: null,
        promedioMeses: null,
        p25Meses: null,
        p75Meses: null,
        promedioRegistrosPractica: null,
        promedioHorasCargadas: null,
        dist: [],
      };
      const { start, end } = range(year);
      const startD = new Date(start);
      const endD = new Date(end);

      // 1. Fecha de finalización efectiva por estudiante en el año.
      const finBy = new Map<string, Date>();
      const addFin = (sid: string, d: Date | null) => {
        if (!sid || !d || d < startD || d >= endD) return;
        const prevD = finBy.get(sid);
        if (!prevD || d < prevD) finBy.set(sid, d);
      };
      const { data: finalizadosData, error: finalizadosError } = await supabase
        .from(TABLE_NAME_ESTUDIANTES)
        .select(`id, ${FIELD_FECHA_FINALIZACION_ESTUDIANTES}, ${FIELD_ESTADO_ESTUDIANTES}`)
        .eq(FIELD_ESTADO_ESTUDIANTES, "Finalizado")
        .not(FIELD_FECHA_FINALIZACION_ESTUDIANTES, "is", null);
      if (finalizadosError) throw finalizadosError;
      (finalizadosData || []).forEach((s: Record<string, unknown>) => {
        addFin(
          String(s.id || ""),
          parseToUTCDate(s[FIELD_FECHA_FINALIZACION_ESTUDIANTES] as string)
        );
      });
      const ids = Array.from(finBy.keys());
      if (!ids.length) return empty;

      // 2. Prácticas de esos estudiantes: primera fecha de inicio, cantidad de
      //    registros y horas cargadas. Un registro no implica una rotación.
      interface Tray {
        first: Date | null;
        registros: number;
        horas: number;
      }
      const traj = new Map<string, Tray>();
      const { data: practicaData, error: practicaError } = await supabase
        .from(TABLE_NAME_PRACTICAS)
        .select(
          `estudiante_id, ${FIELD_FECHA_INICIO_PRACTICAS}, ${FIELD_HORAS_PRACTICAS}, ${FIELD_ESTADO_PRACTICA}`
        )
        .eq(FIELD_TIPO_ACTIVIDAD_PRACTICAS, "pps")
        .in("estudiante_id", ids);
      if (practicaError) throw practicaError;
      (practicaData || []).forEach((p: Record<string, unknown>) => {
        const sid = String(p.estudiante_id || "");
        if (!sid) return;
        const t = traj.get(sid) || { first: null, registros: 0, horas: 0 };
        t.registros += 1;
        const h = Number(p[FIELD_HORAS_PRACTICAS]);
        if (
          isPracticeStatusComputable(p[FIELD_ESTADO_PRACTICA] as string | null) &&
          Number.isFinite(h) &&
          h > 0
        ) {
          t.horas += h;
        }
        const d = parseToUTCDate(p[FIELD_FECHA_INICIO_PRACTICAS] as string);
        if (d && (!t.first || d < t.first)) t.first = d;
        traj.set(sid, t);
      });

      // 3. Duración en meses por estudiante. Se descartan trayectorias sin
      //    práctica registrada o con fechas incoherentes (datos pre-migración).
      const meses: number[] = [];
      let registrosSum = 0;
      let registrosN = 0;
      let horasSum = 0;
      let horasN = 0;
      let duracionesInvalidas = 0;
      finBy.forEach((fin, sid) => {
        const t = traj.get(sid);
        if (!t) return;
        if (t.registros > 0) {
          registrosSum += t.registros;
          registrosN += 1;
        }
        if (t.horas > 0) {
          horasSum += t.horas;
          horasN += 1;
        }
        if (!t.first) return;
        const m = ((fin.getTime() - t.first.getTime()) / 86400000) * MESES_POR_DIA;
        if (m >= 0 && m <= 72) {
          meses.push(Math.round(m * 10) / 10);
        } else {
          duracionesInvalidas += 1;
        }
      });
      if (!meses.length && !registrosN) {
        return { ...empty, totalFinalizados: finBy.size, duracionesInvalidas };
      }
      meses.sort((a, b) => a - b);

      return {
        totalFinalizados: finBy.size,
        n: meses.length,
        duracionesInvalidas,
        medianaMeses: percentil(meses, 0.5),
        promedioMeses: meses.length
          ? Math.round((meses.reduce((a, b) => a + b, 0) / meses.length) * 10) / 10
          : null,
        p25Meses: percentil(meses, 0.25),
        p75Meses: percentil(meses, 0.75),
        promedioRegistrosPractica: registrosN
          ? Math.round((registrosSum / registrosN) * 10) / 10
          : null,
        promedioHorasCargadas: horasN ? Math.round(horasSum / horasN) : null,
        dist: [
          { label: "Menos de 1 año", n: meses.filter((m) => m < 12).length },
          { label: "1 a 1½ años", n: meses.filter((m) => m >= 12 && m < 18).length },
          { label: "1½ a 2 años", n: meses.filter((m) => m >= 18 && m < 24).length },
          { label: "Más de 2 años", n: meses.filter((m) => m >= 24).length },
        ],
      };
    },
  });
};
