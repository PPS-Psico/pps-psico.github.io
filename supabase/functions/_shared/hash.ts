/**
 * SHA-256 en hexadecimal.
 *
 * Estaba copiado en 5 funciones (`issue-moodle-signup-ticket`,
 * `moodle-autologin`, `register-moodle-student`, `request-password-reset`,
 * `reset-password-with-token`) en dos variantes que sólo diferían en el estilo
 * del `map` -- `Array.from(x, fn)` contra `Array.from(x).map(fn)` -- y producían
 * exactamente el mismo resultado.
 *
 * Se usa para hashear tickets de un solo uso y tokens de recuperación de
 * contraseña antes de guardarlos, así que conviene que haya una sola
 * implementación: si algún día hay que cambiarla, se cambia en un lugar y no en
 * cinco.
 */
export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
