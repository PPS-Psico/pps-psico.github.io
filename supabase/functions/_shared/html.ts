/**
 * Escapa texto que se interpola en los mails HTML.
 *
 * Estaba copiado en 4 funciones, con una divergencia: tres escapaban la comilla
 * simple como `&#039;` y una como `&#39;`. Son equivalentes en HTML, pero que
 * hubiera dos versiones de una función de escape es justo el tipo de cosa que no
 * conviene dejar librada a qué archivo copió alguien.
 *
 * El `&` va primero a propósito: si se escapara después, volvería a escapar los
 * `&` que introdujeron los reemplazos anteriores.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
