import { useEffect, useRef, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../constants";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../utils/logger";

export type MoodleAutoLoginStatus = "checking" | "done";

/**
 * Perfil de Moodle para el alta de un estudiante que todavía no existe en el
 * panel (o existe sin cuenta). `dni` viene del username de Moodle (confirmado
 * por la sonda moodle_probe); puede venir vacío si el label del campus es viejo.
 */
export type MoodleOnboardingProfile = {
  email: string;
  firstname: string;
  lastname: string;
  dni: string;
};

export type MoodleAutoLoginResult = {
  status: MoodleAutoLoginStatus;
  /** Presente cuando la Edge Function determinó que este alumno del campus
   *  no tiene cuenta en el panel: dispara la pantalla de bienvenida/alta. */
  onboarding: MoodleOnboardingProfile | null;
};

/** Razones de la Edge Function que habilitan el alta desde el campus. */
const ONBOARDING_REASONS = new Set(["not_registered", "no_account"]);

/**
 * Lee el email que el campus Moodle inyecta en la URL del iframe.
 * Soporta tanto el query normal (?email=...) como el embebido en el hash
 * de HashRouter (#/login?email=...).
 */
const getUrlParam = (name: string): string => {
  if (typeof window === "undefined") return "";
  try {
    const candidates: string[] = [];

    const search = new URLSearchParams(window.location.search);
    candidates.push(search.get(name) || "");

    const hash = window.location.hash || "";
    const queryIndex = hash.indexOf("?");
    if (queryIndex !== -1) {
      const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
      candidates.push(hashParams.get(name) || "");
    }

    const value = (candidates.find((v) => v.trim() !== "") || "").trim();
    // Tag de FilterCodes sin interpolar (ej. "{idnumber}") ⇒ tratar como vacío.
    return value.includes("{") ? "" : value;
  } catch {
    return "";
  }
};

const getEmailFromUrl = (): string => getUrlParam("email").toLowerCase();

/**
 * Perfil que el campus inyecta mediante FilterCodes. Nombre, apellido, correo y
 * username (DNI en UFLO) precargan el alta; idnumber se conserva solo como dato
 * diagnóstico porque Moodle no entrega allí el legajo.
 */
export const getMoodleProfileFromUrl = (): {
  firstname: string;
  lastname: string;
  idnumber: string;
  username: string;
  phone1: string;
  phone2: string;
} => ({
  firstname: getUrlParam("firstname"),
  lastname: getUrlParam("lastname"),
  // idnumber = campo "Número de ID" (opcional en Moodle, potencial legajo).
  idnumber: getUrlParam("idnumber"),
  // username = "Nombre de usuario" de Moodle: en UFLO parece ser el DNI —
  // si la sonda lo confirma, es la clave de match que no depende del correo.
  username: getUrlParam("username"),
  phone1: getUrlParam("phone1"),
  phone2: getUrlParam("phone2"),
});

/**
 * `true` si la app fue abierta desde un origen de confianza:
 *  - embebida en un iframe (ej. panel embebido directo en Moodle), o
 *  - navegada desde una página del mismo sitio (ej. clic en "Entrar a mi panel"
 *    desde aula.html, que abre el panel en una pestaña nueva con referrer propio).
 *
 * Esta condición limita la experiencia automática al contexto de Campus, pero
 * no autentica por sí sola: iframe y referrer pueden falsificarse. El backend
 * exige además coincidencia estricta de cuatro atributos, una cuenta ya
 * vinculada, rol de alumno y correo Auth confirmado antes de emitir un token
 * de un solo uso. Sigue siendo un fallback transitorio, no SSO federado.
 */
const isTrustedContext = (): boolean => {
  // Caso 1: embebida en un iframe.
  try {
    if (window.self !== window.top) return true;
  } catch {
    // Acceso bloqueado por cross-origin ⇒ estamos dentro de un iframe ajeno.
    return true;
  }

  // Caso 2: navegada desde el mismo sitio (aula.html → panel).
  try {
    if (!document.referrer) return false;
    const referrer = new URL(document.referrer);
    return referrer.host === window.location.host;
  } catch {
    return false;
  }
};

const shouldAttempt = (): boolean => getEmailFromUrl() !== "" && isTrustedContext();

/**
 * Guard a nivel de módulo: la resolución de entrada del campus se ejecuta una
 * vez por carga real, incluso con re-montajes de React. `logout()` lo activa
 * para que cerrar sesión deje al estudiante en el login hasta recargar.
 */
let autoLoginConsumed = false;
export const suppressMoodleAutoLogin = (): void => {
  autoLoginConsumed = true;
};

// Onboarding a nivel módulo: sobrevive a los re-montajes de <Auth> (cambios de
// pestaña del panel embebido) igual que el guard de arriba.
let onboardingResult: MoodleOnboardingProfile | null = null;

/**
 * Resuelve la entrada desde Moodle: conserva una sesión ya activa, inicia una
 * sesión de un solo uso cuando correo, DNI, nombre y apellido coinciden con un
 * alumno vinculado, muestra el alta guiada a quien no tiene cuenta y usa el
 * login normal como fallback ante cualquier ambigüedad.
 */
export const useMoodleAutoLogin = (): MoodleAutoLoginResult => {
  // Inicializa en "checking" solo si corresponde, para evitar el flash del login.
  // Si el único intento de esta carga ya se consumió (o hubo logout), arrancamos
  // en "done" directamente: sin loader ni re-intento.
  const [status, setStatus] = useState<MoodleAutoLoginStatus>(() =>
    !autoLoginConsumed && shouldAttempt() ? "checking" : "done"
  );
  const [onboarding, setOnboarding] = useState<MoodleOnboardingProfile | null>(onboardingResult);
  const hasRun = useRef(false);
  // Red de seguridad: si mantenemos el loader esperando que el panel monte la
  // sesión y por algún motivo no llega, liberamos el loader para no dejar un
  // spinner infinito.
  const safetyDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const email = getEmailFromUrl();
    const isTrusted = isTrustedContext();
    const shouldRun = shouldAttempt();
    const safeLocation =
      window.location.origin +
      window.location.pathname +
      (window.location.hash ? window.location.hash.split("?")[0] : "");

    logger.warn("[MoodleEntry] Diagnóstico de entrada desde Campus:", {
      email,
      isTrustedContext: isTrusted,
      shouldAttempt: shouldRun,
      isIframe: window.self !== window.top,
      referrer: document.referrer,
      location: safeLocation,
    });

    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
      // Si ya existe una sesión, AuthContext montará el panel. En ese caso
      // mantenemos el loader para evitar mostrar el login durante la transición.
      let landingOnDashboard = false;
      try {
        // Ya se intentó en esta carga de página (o se cerró sesión): no reintentar.
        if (autoLoginConsumed) {
          logger.warn("[MoodleAutoLogin] Intento ya consumido en esta carga. Omitido.");
          setStatus("done");
          return;
        }

        if (!shouldRun) {
          logger.warn(
            "[MoodleEntry] No se cumplen las condiciones de entrada (falta email o no es contexto de Campus)."
          );
          setStatus("done");
          return;
        }

        // Reservar el único intento antes de cualquier await evita resoluciones
        // duplicadas cuando React monta el componente de forma concurrente.
        autoLoginConsumed = true;

        logger.warn("[MoodleEntry] Resolviendo entrada para el perfil de Campus");

        // Una URL sin firma nunca debe cerrar ni reemplazar una sesión válida.
        const { data: sessionData } = await supabase.auth.getSession();
        logger.warn("[MoodleEntry] Sesión activa actual:", sessionData?.session ? "Sí" : "No");
        if (sessionData?.session) {
          landingOnDashboard = true;
          return;
        }

        logger.warn("[MoodleEntry] Solicitando sesión de un solo uso desde Campus...");
        // El backend exige coincidencia estricta de correo, DNI, nombre y
        // apellido con una cuenta de alumno ya vinculada y confirmada.
        const response = await fetch(`${SUPABASE_URL}/functions/v1/moodle-autologin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email, profile: getMoodleProfileFromUrl() }),
        });

        if (!response.ok) {
          logger.warn("[MoodleAutoLogin] Función respondió con error HTTP:", response.status);
          setStatus("done");
          return;
        }

        const result = (await response.json()) as {
          matched?: boolean;
          reason?: string;
          token_hash?: string;
        };
        logger.warn("[MoodleEntry] Respuesta de la Edge Function:", result.reason);

        if (result.matched && result.token_hash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: "magiclink",
            token_hash: result.token_hash,
          });

          if (verifyError) {
            logger.warn("[MoodleAutoLogin] No se pudo canjear la sesión de un solo uso");
          } else {
            logger.warn("[MoodleAutoLogin] Sesión iniciada automáticamente desde Campus");
            landingOnDashboard = true;
          }
        } else if (result?.reason && ONBOARDING_REASONS.has(result.reason)) {
          // Estudiante sin cuenta: precargar nombre, apellido, correo y DNI.
          // El legajo y el celular los completa el estudiante.
          const p = getMoodleProfileFromUrl();
          onboardingResult = {
            email,
            firstname: p.firstname,
            lastname: p.lastname,
            dni: p.username.replace(/\D/g, ""),
          };
          setOnboarding(onboardingResult);
          logger.warn("[MoodleEntry] Mostrando alta guiada:", result.reason);
        } else {
          // Datos incompletos/no coincidentes y errores continúan por el canal
          // seguro de legajo + contraseña.
          logger.warn("[MoodleEntry] Continuando con login normal:", result?.reason);
        }
      } catch (err) {
        logger.warn("[MoodleAutoLogin] Error inesperado:", err);
      } finally {
        if (landingOnDashboard) {
          // El panel está por montar la sesión; mantener el loader. Red de
          // seguridad por si el perfil no llega a cargar.
          if (safetyDoneTimer.current) clearTimeout(safetyDoneTimer.current);
          safetyDoneTimer.current = setTimeout(() => setStatus("done"), 7000);
        } else {
          setStatus("done");
        }
      }
    };

    void run();

    return () => {
      if (safetyDoneTimer.current) clearTimeout(safetyDoneTimer.current);
    };
  }, []);

  return { status, onboarding };
};
