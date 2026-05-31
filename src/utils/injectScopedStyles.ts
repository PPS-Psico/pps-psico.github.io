/**
 * Inyecta un bloque de CSS scoped en <head> una sola vez, de forma imperativa.
 *
 * Por qué no renderizar `<style>` en el JSX: el patrón
 *   {!document.getElementById(id) && <style id={id}>{css}</style>}
 * provoca parpadeo (FOUC). React monta el <style>, en el siguiente render lo
 * encuentra con getElementById y renderiza `false`, así que lo desmonta; al
 * siguiente render vuelve a montarlo, y así en bucle. Inyectarlo en el <head>
 * por fuera del árbol de React lo deja estable: se agrega una vez y nunca se
 * remueve durante reconciliación.
 *
 * Llamar a nivel de módulo (se ejecuta una vez al importar, antes del primer
 * render) para evitar cualquier flash de contenido sin estilos.
 */
export function injectScopedStyles(id: string, css: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
