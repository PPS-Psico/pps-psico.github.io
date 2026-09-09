import { supabase } from "../../lib/supabaseClient";
import { classifyDbError } from "../../lib/dbError";
import { FINALIZACION_HISTORY_STATES } from "../../domain/finalizacion/states";

export async function fetchInicioBrief() {
  const { data, error } = await supabase
    .from("agent_suggestions")
    .select("id, payload, created_at")
    .eq("tipo", "daily_brief")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw classifyDbError(error, { operation: "fetchInicioBrief" });
  return data;
}

export async function fetchInicioSolicitudes() {
  const { data, error } = await supabase
    .from("solicitudes_pps")
    .select("id, estado_seguimiento, actualizacion, created_at, nombre_institucion, nombre_alumno")
    .not("estado_seguimiento", "in", "(Realizada,No se pudo concretar,Archivado)")
    .order("created_at", { ascending: false });
  if (error) throw classifyDbError(error, { operation: "fetchInicioSolicitudes" });
  return data || [];
}

export async function fetchInicioInstituciones() {
  const { data, error } = await supabase.from("instituciones").select("id, nombre");
  if (error) throw classifyDbError(error, { operation: "fetchInicioInstituciones" });
  return data || [];
}

export async function fetchInicioCorrecciones() {
  const [mod, nuevas] = await Promise.all([
    supabase
      .from("solicitudes_modificacion_pps")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente"),
    supabase
      .from("solicitudes_nueva_pps")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente"),
  ]);
  if (mod.error) throw classifyDbError(mod.error, { operation: "fetchInicioCorrecciones" });
  if (nuevas.error) throw classifyDbError(nuevas.error, { operation: "fetchInicioCorrecciones" });
  return (mod.count ?? 0) + (nuevas.count ?? 0);
}

export async function fetchInicioEgreso() {
  const { data, error } = await supabase
    .from("finalizacion_pps")
    .select("id, estado, created_at")
    .not("estado", "in", `(${FINALIZACION_HISTORY_STATES.join(",")})`);
  if (error) throw classifyDbError(error, { operation: "fetchInicioEgreso" });
  const rows = data || [];
  let pendientes = 0,
    enProceso = 0;
  let masViejoDias = 0;
  for (const r of rows) {
    if (r.estado === "En Proceso") enProceso++;
    else pendientes++;
    if (r.created_at) {
      const dias = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
      if (dias > masViejoDias) masViejoDias = dias;
    }
  }
  return { total: rows.length, pendientes, enProceso, masViejoDias };
}

export async function fetchInicioDrafts() {
  const [preview, total] = await Promise.all([
    supabase
      .from("agent_suggestions")
      .select("id, payload, contexto, institucion_id, tipo, created_at")
      .in("tipo", ["email_draft", "whatsapp_followup"])
      .eq("estado", "pending")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("agent_suggestions")
      .select("id", { count: "exact", head: true })
      .in("tipo", ["email_draft", "whatsapp_followup"])
      .eq("estado", "pending"),
  ]);
  if (preview.error) throw classifyDbError(preview.error, { operation: "fetchInicioDrafts" });
  if (total.error) throw classifyDbError(total.error, { operation: "fetchInicioDrafts" });
  return { items: preview.data || [], total: total.count ?? 0 };
}

export async function fetchInicioContacts() {
  const { count, error } = await supabase
    .from("whatsapp_contactos")
    .select("chat_jid", { count: "exact", head: true })
    .neq("tipo", "ignorado");
  if (error) throw classifyDbError(error, { operation: "fetchInicioContacts" });
  return count ?? 0;
}
