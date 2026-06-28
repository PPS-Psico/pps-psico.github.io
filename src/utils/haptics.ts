/**
 * haptics — feedback táctil sutil para mobile.
 *
 * Notas de plataforma:
 * - Android/Chrome: dispara la Vibration API (se siente).
 * - iOS Safari: Apple NO implementa la Vibration API → degradación silenciosa
 *   (no hace nada, no rompe). Ninguna librería web puede sortear esa restricción.
 * - Respeta `prefers-reduced-motion`: si el usuario pidió menos movimiento, no vibra.
 *
 * Los patrones son intencionalmente cortos y discretos (criterio "sutil, no juguete").
 */

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function canVibrate(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function" &&
    !prefersReducedMotion()
  );
}

function fire(pattern: number | number[]): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* noop — algunos navegadores lanzan si está bloqueado */
  }
}

export const haptics = {
  /** Toque ligero — navegación entre tabs, taps de bajo peso. */
  tap: () => fire(8),
  /** Selección con un poco más de cuerpo — elegir nota, opción, toggle. */
  select: () => fire(12),
  /** Confirmación positiva — inscribirse, firmar, guardar. */
  success: () => fire([10, 40, 18]),
  /** Aviso — acción que requiere atención. */
  warning: () => fire([16, 60, 16]),
  /** Error — algo falló. */
  error: () => fire([28, 50, 28]),
};

export default haptics;
