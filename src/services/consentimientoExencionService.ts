/**
 * consentimientoExencionService — "Perdonar" la firma de un estudiante.
 *
 * Coordinación puede decidir que alguien queda en la nómina firme o no firme
 * (contacto por otro canal, firma en papel, problema de acceso al panel). La
 * exención vive en `convocatorias.consentimiento_exceptuado_at` y las RPCs la
 * respetan: no se le pide el compromiso, no recibe el último recordatorio y la
 * baja automática lo saltea. Si ya había sido dado de baja por vencimiento, la
 * RPC lo repone en la nómina con su práctica.
 *
 * A propósito NO se escribe una fila en `compromisos_pps`: ahí vive el acta que
 * el estudiante aceptó y su firma, y él la ve como comprobante propio.
 */
import { supabase } from "../lib/supabaseClient";
import { classifyDbError } from "../lib/dbError";

/** Exime a un estudiante de la firma digital para esta convocatoria. */
export async function eximirConsentimiento(
  convocatoriaId: string,
  motivo?: string | null
): Promise<void> {
  // El parámetro tiene `default null` en la RPC, así que omitirlo equivale a
  // "sin motivo"; los tipos generados lo declaran opcional, no nullable.
  const { error } = await supabase.rpc("eximir_consentimiento", {
    p_convocatoria_id: convocatoriaId,
    p_motivo: motivo?.trim() || undefined,
  });
  if (error) {
    throw classifyDbError(error, {
      table: "convocatorias",
      operation: "eximirConsentimiento",
    });
  }
}

/** Quita la exención: al estudiante vuelve a exigírsele la firma. */
export async function revertirExencionConsentimiento(convocatoriaId: string): Promise<void> {
  const { error } = await supabase.rpc("revertir_exencion_consentimiento", {
    p_convocatoria_id: convocatoriaId,
  });
  if (error) {
    throw classifyDbError(error, {
      table: "convocatorias",
      operation: "revertirExencionConsentimiento",
    });
  }
}
