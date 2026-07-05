/**
 * `true` si la app corre embebida dentro de un iframe (ej. el campus Moodle).
 * Se usa para que el panel adopte fondo transparente y se funda con el fondo
 * del campus, en vez de pintar su crema/oscuro propio (que se ve "recortado").
 */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ua = window.navigator.userAgent.toLowerCase();
    const isWebView =
      ua.includes("webview") ||
      ua.includes("moodle") ||
      ua.includes("campus") ||
      ((ua.includes("ipad") || ua.includes("iphone") || ua.includes("ipod")) &&
        !ua.includes("safari"));

    return window.self !== window.top || isWebView;
  } catch {
    return true; // cross-origin ⇒ embebidos
  }
}

export default isEmbedded;
