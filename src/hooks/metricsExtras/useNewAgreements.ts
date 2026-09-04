import { useQuery } from "@tanstack/react-query";
import {
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_PRACTICAS,
  FIELD_MODALIDAD_CUPO_LANZAMIENTOS,
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ORIENTACIONES_INSTITUCIONES,
  FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS,
  FIELD_TIPO_ACTIVIDAD_PRACTICAS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_INSTITUCIONES,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PRACTICAS,
} from "../../constants";
import { supabase } from "../../lib/supabaseClient";
import { getGroupName, normalizeStringForComparison } from "../../utils/formatters";
import { range, ORIENT_FROM_STRING, ESTADOS_SELECCIONADO } from "./shared";
import type { OrientKey } from "./types";

// ════════════════════════════════════════════════════════════════════════════
// CONVENIOS NUEVOS · ficha por institución (Reporte ejecutivo/comparativo)
// Instituciones con convenio firmado en el año (`convenio_nuevo` = año), con la
// oferta que trajeron: orientación, PPS lanzadas y cupos ofrecidos. Dato clave
// para las gestiones: qué instituciones nuevas suman y con cuánta capacidad.
// ════════════════════════════════════════════════════════════════════════════
export interface NewAgreement {
  institucion: string;
  orientaciones: OrientKey[];
  pps: number;
  cupos: number;
}

export const useNewAgreements = ({
  year,
  isTestingMode = false,
}: {
  year: number;
  isTestingMode?: boolean;
}) => {
  return useQuery({
    queryKey: ["newAgreements", year, isTestingMode],
    enabled: !isTestingMode,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<NewAgreement[]> => {
      // 1. Instituciones con convenio nuevo del año. Agrupamos por nombre de
      //    grupo (getGroupName) para coincidir con la identidad usada en las
      //    métricas de lanzamientos.
      const { data: instRaw } = await supabase
        .from(TABLE_NAME_INSTITUCIONES)
        .select(`${FIELD_NOMBRE_INSTITUCIONES}, ${FIELD_ORIENTACIONES_INSTITUCIONES}`)
        // convenio_nuevo es smallint (año): comparamos con el número.
        .eq(FIELD_CONVENIO_NUEVO_INSTITUCIONES, year);
      const insts = (instRaw || []) as Array<Record<string, unknown>>;
      if (!insts.length) return [];

      interface Acc {
        orientDeclared: Set<OrientKey>;
        orientLaunch: Set<OrientKey>;
        pps: number;
        cupos: number;
      }
      const byInst = new Map<string, Acc>();
      insts.forEach((i) => {
        const nombre = getGroupName(String(i[FIELD_NOMBRE_INSTITUCIONES] || ""));
        if (!nombre) return;
        const acc = byInst.get(nombre) || {
          orientDeclared: new Set<OrientKey>(),
          orientLaunch: new Set<OrientKey>(),
          pps: 0,
          cupos: 0,
        };
        // orientaciones declaradas en la institución (texto libre, puede traer varias).
        String(i[FIELD_ORIENTACIONES_INSTITUCIONES] || "")
          .split(/[,;/]/)
          .forEach((o) => {
            const t = o.trim();
            if (t) acc.orientDeclared.add(ORIENT_FROM_STRING(t));
          });
        byInst.set(nombre, acc);
      });
      if (byInst.size === 0) return [];

      // 2. Lanzamientos del año → cupos + orientación real por institución.
      const { start, end } = range(year);
      const { data: launchRaw, error: launchError } = await supabase
        .from(TABLE_NAME_LANZAMIENTOS_PPS)
        .select(
          `id, ${FIELD_NOMBRE_PPS_LANZAMIENTOS}, ${FIELD_ORIENTACION_LANZAMIENTOS}, ${FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS}, ${FIELD_MODALIDAD_CUPO_LANZAMIENTOS}`
        )
        .eq(FIELD_TIPO_ACTIVIDAD_LANZAMIENTOS, "pps")
        .gte(FIELD_FECHA_INICIO_LANZAMIENTOS, start.slice(0, 10))
        .lt(FIELD_FECHA_INICIO_LANZAMIENTOS, end.slice(0, 10));
      if (launchError) throw launchError;
      const launches = (launchRaw || []) as Array<Record<string, unknown>>;
      const realizedLaunchToInstitution = new Map<string, string>();
      launches.forEach((l) => {
        const nombre = getGroupName(String(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || ""));
        const acc = byInst.get(nombre);
        if (!acc) return;
        acc.pps += 1;
        if (l[FIELD_MODALIDAD_CUPO_LANZAMIENTOS] === "realizado") {
          realizedLaunchToInstitution.set(String(l.id), nombre);
        } else {
          acc.cupos += Number(l[FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS] || 0);
        }
        acc.orientLaunch.add(ORIENT_FROM_STRING(l[FIELD_ORIENTACION_LANZAMIENTOS] as string));
      });

      if (realizedLaunchToInstitution.size) {
        const realizedIds = Array.from(realizedLaunchToInstitution.keys());
        const selectedByLaunch = new Map<string, Set<string>>();
        const addSelected = (launchId: string, studentId: string) => {
          if (!launchId || !studentId) return;
          const selected = selectedByLaunch.get(launchId) || new Set<string>();
          selected.add(studentId);
          selectedByLaunch.set(launchId, selected);
        };
        const { data: convData, error: convError } = await supabase
          .from(TABLE_NAME_CONVOCATORIAS)
          .select(
            `estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS}, ${FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS}`
          )
          .in(FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS, realizedIds);
        if (convError) throw convError;
        ((convData || []) as Array<Record<string, unknown>>).forEach((c) => {
          const estado = normalizeStringForComparison(
            String(c[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "")
          );
          if (!ESTADOS_SELECCIONADO.includes(estado)) return;
          addSelected(
            String(c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] || ""),
            String(c.estudiante_id || "")
          );
        });
        const { data: practicaData, error: practicaError } = await supabase
          .from(TABLE_NAME_PRACTICAS)
          .select(`estudiante_id, ${FIELD_LANZAMIENTO_VINCULADO_PRACTICAS}`)
          .eq(FIELD_TIPO_ACTIVIDAD_PRACTICAS, "pps")
          .in(FIELD_LANZAMIENTO_VINCULADO_PRACTICAS, realizedIds);
        if (practicaError) throw practicaError;
        ((practicaData || []) as Array<Record<string, unknown>>).forEach((p) => {
          addSelected(
            String(p[FIELD_LANZAMIENTO_VINCULADO_PRACTICAS] || ""),
            String(p.estudiante_id || "")
          );
        });
        realizedLaunchToInstitution.forEach((institucion, launchId) => {
          const acc = byInst.get(institucion);
          if (acc) acc.cupos += selectedByLaunch.get(launchId)?.size || 0;
        });
      }

      return Array.from(byInst.entries())
        .map(([institucion, acc]) => {
          // Preferimos la orientación real de los lanzamientos; si la institución
          // aún no lanzó nada, usamos la declarada en su ficha.
          const set = acc.orientLaunch.size ? acc.orientLaunch : acc.orientDeclared;
          let orientaciones: OrientKey[] = Array.from(set).filter((o) => o !== "sindefinir");
          if (orientaciones.length === 0 && set.has("sindefinir")) orientaciones = ["sindefinir"];
          return {
            institucion,
            orientaciones,
            pps: acc.pps,
            cupos: acc.cupos,
          };
        })
        .sort((a, b) => b.cupos - a.cupos || a.institucion.localeCompare(b.institucion, "es"));
    },
  });
};
