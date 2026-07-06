import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../constants";
import { logger } from "../utils/logger";

export type MoodleAutoLoginStatus = "checking" | "done";

/**
 * Lee el email que el campus Moodle inyecta en la URL del iframe.
 * Soporta tanto el query normal (?email=...) como el embebido en el hash
 * de HashRouter (#/login?email=...).
 */
const getEmailFromUrl = (): string => {
  if (typeof window === "undefined") return "";
  try {
    const candidates: string[] = [];

    const search = new URLSearchParams(window.location.search);
    candidates.push(search.get("email") || "");

    const hash = window.location.hash || "";
    const queryIndex = hash.indexOf("?");
    if (queryIndex !== -1) {
      const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
      candidates.push(hashParams.get("email") || "");
    }

    return (candidates.find((value) => value.trim() !== "") || "").trim().toLowerCase();
  } catch {
    return "";
  }
};

/**
 * `true` si la app fue abierta desde un origen de confianza:
 *  - embebida en un iframe (ej. panel embebido directo en Moodle), o
 *  - navegada desde una página del mismo sitio (ej. clic en "Entrar a mi panel"
 *    desde aula.html, que abre el panel en una pestaña nueva con referrer propio).
 *
 * Esta es la protección central del auto-login en GitHub Pages, donde NO se
 * pueden setear cabeceras (no hay CSP frame-ancestors disponible). Bloquea el
 * caso casual de copiar la URL con el email de otra persona y pegarla directo
 * en la barra de direcciones: ahí no hay iframe ni referrer → no hay auto-login
 * → cae al login normal con legajo y contraseña.
 *
 * IMPORTANTE: no es una barrera infranqueable (un usuario técnico puede falsificar
 * el referrer). El email viaja por la URL y no está firmado. Para identidad
 * verificada de verdad hace falta LTI (requiere admin de Moodle).
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
 * Intenta iniciar sesión automáticamente a partir del email del estudiante que
 * provee el campus Moodle. Si matchea con un estudiante registrado, lo loguea
 * sin fricción; si no, no hace nada y el usuario ve el login normal.
 */
export const useMoodleAutoLogin = (): MoodleAutoLoginStatus => {
  // Inicializa en "checking" solo si corresponde, para evitar el flash del login.
  const [status, setStatus] = useState<MoodleAutoLoginStatus>(() =>
    shouldAttempt() ? "checking" : "done"
  );
  const hasRun = useRef(false);

  useEffect(() => {
    const email = getEmailFromUrl();
    const isTrusted = isTrustedContext();
    const shouldRun = shouldAttempt();

    logger.info("[MoodleAutoLogin] Diagnóstico de auto-login:", {
      email,
      isTrustedContext: isTrusted,
      shouldAttempt: shouldRun,
      isIframe: window.self !== window.top,
      referrer: document.referrer,
      locationHref: window.location.href,
    });

    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
      try {
        if (!shouldRun) {
          logger.info(
            "[MoodleAutoLogin] No se cumplen las condiciones para auto-login (falta email o no es contexto confiable)."
          );
          setStatus("done");
          return;
        }

        logger.info("[MoodleAutoLogin] Intentando auto-login para:", email);

        // Si ya hay sesión activa, verificamos si es para la misma cuenta
        const { data: sessionData } = await supabase.auth.getSession();
        logger.info("[MoodleAutoLogin] Sesión activa actual:", sessionData?.session ? "Sí" : "No");
        if (sessionData?.session) {
          const sessionEmail = sessionData.session.user.email?.toLowerCase();
          if (sessionEmail && sessionEmail !== email) {
            logger.info(
              `[MoodleAutoLogin] La sesión activa (${sessionEmail}) es diferente de la URL (${email}). Cerrando sesión actual...`
            );
            await supabase.auth.signOut();
          } else {
            logger.info("[MoodleAutoLogin] Sesión activa coincide con la URL. Auto-login omitido.");
            setStatus("done");
            return;
          }
        }

        logger.info("[MoodleAutoLogin] Invocando Edge Function moodle-autologin...");
        // Pedimos a la Edge Function un token de auto-login para este email.
        const response = await fetch(`${SUPABASE_URL}/functions/v1/moodle-autologin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          logger.warn("[MoodleAutoLogin] Función respondió con error HTTP:", response.status);
          setStatus("done");
          return;
        }

        const result = (await response.json()) as {
          matched?: boolean;
          token_hash?: string;
          reason?: string;
        };
        logger.info("[MoodleAutoLogin] Respuesta de la Edge Function:", result);

        if (result?.matched && result.token_hash) {
          logger.info("[MoodleAutoLogin] Token recibido. Canjeando verifyOtp...");
          const { error } = await supabase.auth.verifyOtp({
            type: "magiclink",
            token_hash: result.token_hash,
          });
          if (error) {
            logger.warn("[MoodleAutoLogin] verifyOtp falló:", error.message);
          } else {
            logger.info(
              "[MoodleAutoLogin] Sesión iniciada automáticamente desde el campus con éxito."
            );
            // AuthContext detecta el SIGNED_IN y carga el perfil.
          }
        } else {
          logger.info(
            "[MoodleAutoLogin] Email no registrado o error en Edge Function. Razón:",
            result?.reason
          );
        }
      } catch (err) {
        logger.warn("[MoodleAutoLogin] Error inesperado:", err);
      } finally {
        setStatus("done");
      }
    };

    void run();
  }, []);

  return status;
};
