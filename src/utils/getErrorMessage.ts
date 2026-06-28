/**
 * Extrae un mensaje legible de un valor capturado de tipo `unknown`.
 *
 * Pensado para reemplazar el patrón `catch (e: any) { ...e.message }`, que
 * anula el chequeo de tipos. Con `catch (e)` el error es `unknown` (estándar
 * bajo `strict`), y este helper lo normaliza de forma segura:
 *  - `Error`            -> `.message`
 *  - `string`           -> tal cual
 *  - objeto con message -> `String(message)` (cubre PostgrestError, etc.)
 *  - resto              -> fallback
 */
export function getErrorMessage(e: unknown, fallback = "Error desconocido"): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}
