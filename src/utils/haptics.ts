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

function isIos(): boolean {
  if (typeof window === "undefined" || !window.navigator) return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("ipod") ||
    (ua.includes("macintosh") && "ontouchend" in document)
  );
}

let iosHapticCheckbox: HTMLInputElement | null = null;
let iosHapticLabel: HTMLLabelElement | null = null;

function initIosHapticElements(): void {
  if (typeof document === "undefined") return;

  iosHapticCheckbox = document.getElementById("pps-ios-haptic-trigger") as HTMLInputElement;
  iosHapticLabel = document.getElementById("pps-ios-haptic-label") as HTMLLabelElement;

  if (!iosHapticCheckbox) {
    iosHapticCheckbox = document.createElement("input");
    iosHapticCheckbox.type = "checkbox";
    iosHapticCheckbox.id = "pps-ios-haptic-trigger";
    iosHapticCheckbox.setAttribute("switch", "");
    iosHapticCheckbox.style.position = "absolute";
    iosHapticCheckbox.style.opacity = "0";
    iosHapticCheckbox.style.pointerEvents = "none";
    iosHapticCheckbox.style.width = "1px";
    iosHapticCheckbox.style.height = "1px";
    iosHapticCheckbox.style.overflow = "hidden";

    iosHapticLabel = document.createElement("label");
    iosHapticLabel.htmlFor = "pps-ios-haptic-trigger";
    iosHapticLabel.id = "pps-ios-haptic-label";
    iosHapticLabel.style.display = "none";

    document.body.appendChild(iosHapticCheckbox);
    document.body.appendChild(iosHapticLabel);
  }
}

function fireIosHaptic(): void {
  if (typeof document === "undefined") return;
  if (!iosHapticLabel) {
    initIosHapticElements();
  }
  if (iosHapticLabel) {
    iosHapticLabel.click();
  }
}

function fire(pattern: number | number[]): void {
  if (prefersReducedMotion()) return;

  if (canVibrate()) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* noop — algunos navegadores lanzan si está bloqueado */
    }
  } else if (isIos()) {
    try {
      fireIosHaptic();
    } catch {
      /* noop */
    }
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
