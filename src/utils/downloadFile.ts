/**
 * downloadFile — Descarga nativa de un Blob/File sin depender de `file-saver`.
 *
 * Reemplaza a `file-saver`, cuyo `import()` dinámico fallaba intermitentemente
 * bajo Vite ("Failed to fetch dynamically imported module") por ser un módulo
 * CommonJS que el optimizador de dependencias re-empaqueta. Esta versión usa
 * solo APIs del navegador (URL.createObjectURL + <a download>), igual de
 * compatible y sin red ni módulos externos.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "descarga";
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revocamos en el próximo tick para no cortar la descarga en navegadores lentos.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
