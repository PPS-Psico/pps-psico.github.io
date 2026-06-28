import { supabase } from "../lib/supabaseClient";
import { db } from "../lib/db";
import type { Convenio } from "../types";
import { FIELD_INSTITUCION_ID_CONVENIOS, FIELD_FECHA_FIRMA_CONVENIOS } from "../constants";

export interface ConvenioPorVencer {
  convenio_id: string;
  institucion_id: string;
  institucion: string;
  tipo: string;
  fecha_firma: string;
  fecha_vencimiento: string;
  dias_restantes: number;
}

export interface ConveniosKpis {
  nuevos_convenios: number;
  renovaciones: number;
  convenios_por_vencer: number;
  target_year: number;
}

/** KPIs de convenios (renovaciones + próximos a vencer) para el dashboard. */
export async function fetchConveniosKpis(year: number): Promise<ConveniosKpis | null> {
  const { data, error } = await supabase.rpc("get_convenios_kpis", { p_year: year });
  if (error) return null;
  return data as unknown as ConveniosKpis;
}

/** Lista de convenios próximos a vencer dentro de `dias` (default 90). */
export async function fetchConveniosPorVencer(dias = 90): Promise<ConvenioPorVencer[]> {
  const { data, error } = await supabase.rpc("get_convenios_por_vencer", { p_days: dias });
  if (error) return [];
  return (data || []) as ConvenioPorVencer[];
}

/** Todos los convenios de una institución, más recientes primero. */
export async function fetchConveniosDeInstitucion(institucionId: string): Promise<Convenio[]> {
  return db.convenios.getAll({
    filters: { [FIELD_INSTITUCION_ID_CONVENIOS]: institucionId },
    sort: [{ field: FIELD_FECHA_FIRMA_CONVENIOS, direction: "desc" }],
  }) as Promise<Convenio[]>;
}

/**
 * Registra un convenio. El trigger de la DB rellena fecha_vencimiento
 * (= firma + 24 meses) si no se pasa, y sincroniza instituciones.convenio_nuevo.
 */
export async function crearConvenio(input: {
  institucionId: string;
  fechaFirma: string;
  tipo?: "marco" | "especifico";
  esRenovacion?: boolean;
  fechaVencimiento?: string | null;
  archivoUrl?: string | null;
  notas?: string | null;
}): Promise<Convenio> {
  return db.convenios.create({
    institucion_id: input.institucionId,
    fecha_firma: input.fechaFirma,
    tipo: input.tipo ?? "marco",
    es_renovacion: input.esRenovacion ?? false,
    fecha_vencimiento: input.fechaVencimiento ?? null,
    archivo_url: input.archivoUrl ?? null,
    notas: input.notas ?? null,
  }) as Promise<Convenio>;
}
