import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

/* ─────────────────────────────────────────────────────────────────────────────
   Entregas del Aula (tareas de Moodle por área/institución).

   Fuente primaria: tabla `aula_entregas` en Supabase (ver
   supabase/create_aula_entregas_table.sql). Permite a coordinación sumar o
   desactivar espacios de entrega SIN deploy: se edita la tabla y el panel lo
   refleja en la próxima carga.

   Fallback: si la tabla no existe todavía, falla la red o viene vacía, se usa
   el listado embebido de abajo (el vigente al momento de integrar el Aula).
   ──────────────────────────────────────────────────────────────────────────── */

export const MOODLE_ASSIGN = "https://campus.uflo.edu.ar/mod/assign/view.php?id=";

export interface DeliveryInstitution {
  name: string;
  moodleId: string;
}

export interface DeliveryArea {
  id: string;
  name: string;
  color: string;
  institutions: DeliveryInstitution[];
}

/* Colores por área — mismos tokens que usa el resto del panel. Las áreas que
   lleguen de la tabla con un id no mapeado caen al acento primario. */
const AREA_COLORS: Record<string, string> = {
  clinica: "var(--area-clinica)",
  laboral: "#C0392B",
  educacional: "var(--area-educacional)",
  comunitaria: "var(--area-comunitaria)",
};
const AREA_NAMES: Record<string, string> = {
  clinica: "Área clínica",
  laboral: "Laboral y comunitaria",
  educacional: "Área educacional",
  comunitaria: "Área comunitaria",
};

export const FALLBACK_DELIVERY_AREAS: DeliveryArea[] = [
  {
    id: "clinica",
    name: AREA_NAMES.clinica,
    color: AREA_COLORS.clinica,
    institutions: [
      { name: "Cita Salud", moodleId: "946366" },
      { name: "Fundación Tiempo", moodleId: "1085731" },
      { name: "Dige", moodleId: "1014110" },
      { name: "Ateneos Ulloa", moodleId: "926287" },
      { name: "Entrevistas Ulloa", moodleId: "920727" },
      { name: "Kano", moodleId: "914852" },
      { name: "Relevamiento Prof.", moodleId: "906164" },
      { name: "Barriletes en Bandada", moodleId: "805657" },
      { name: "Programa Aser", moodleId: "805658" },
    ],
  },
  {
    id: "laboral",
    name: AREA_NAMES.laboral,
    color: AREA_COLORS.laboral,
    institutions: [
      { name: "Randstad", moodleId: "1085736" },
      { name: "Human", moodleId: "1074975" },
      { name: "Prevención en Colonias", moodleId: "1009867" },
      { name: "Camioneros", moodleId: "906141" },
    ],
  },
  {
    id: "educacional",
    name: AREA_NAMES.educacional,
    color: AREA_COLORS.educacional,
    institutions: [{ name: "Relevamiento Prof.", moodleId: "906167" }],
  },
];

interface AulaEntregaRow {
  area: string;
  institucion: string;
  moodle_id: string;
  orden: number | null;
  activo: boolean;
}

const AREA_ORDER = ["clinica", "laboral", "educacional", "comunitaria"];

function groupRows(rows: AulaEntregaRow[]): DeliveryArea[] {
  const byArea = new Map<string, DeliveryInstitution[]>();
  for (const row of rows) {
    if (!row.activo || !row.moodle_id) continue;
    const list = byArea.get(row.area) ?? [];
    list.push({ name: row.institucion, moodleId: String(row.moodle_id) });
    byArea.set(row.area, list);
  }
  return [...byArea.entries()]
    .sort(
      ([a], [b]) =>
        (AREA_ORDER.indexOf(a) + 1 || AREA_ORDER.length + 1) -
        (AREA_ORDER.indexOf(b) + 1 || AREA_ORDER.length + 1)
    )
    .map(([id, institutions]) => ({
      id,
      name: AREA_NAMES[id] ?? id,
      color: AREA_COLORS[id] ?? "var(--primary-500)",
      institutions,
    }));
}

export function useAulaEntregas(): { areas: DeliveryArea[]; isLive: boolean } {
  const { data } = useQuery({
    queryKey: ["aula_entregas"],
    queryFn: async () => {
      // La tabla aún no está en los tipos generados (types/supabase.ts); el
      // cast evita el error de compilación hasta regenerarlos.
      const { data: rows, error } = await (supabase as any)
        .from("aula_entregas")
        .select("area, institucion, moodle_id, orden, activo")
        .order("orden", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (rows ?? []) as AulaEntregaRow[];
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const grouped = data && data.length > 0 ? groupRows(data) : [];
  if (grouped.length > 0) return { areas: grouped, isLive: true };
  return { areas: FALLBACK_DELIVERY_AREAS, isLive: false };
}
