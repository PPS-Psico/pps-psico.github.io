import { useEffect, useRef, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../constants";
import {
  isEmbeddedInMoodle,
  requestMoodleCourseContext,
  type MoodleCourseContext,
} from "../lib/moodleBridge";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../utils/logger";

export type MoodleAutoLoginStatus = "checking" | "done";

/**
 * Perfil de alta entregado por el puente del aula PPS. El ticket es de un solo
 * uso, vence a los cinco minutos y está ligado en servidor al curso, usuario,
 * correo y DNI informados por Moodle.
 */
export type MoodleOnboardingProfile = Pick<
  MoodleCourseContext,
  | "courseId"
  | "moodleUserId"
  | "moodleUsername"
  | "email"
  | "firstname"
  | "lastname"
  | "signupTicket"
  | "signupTicketExpiresAt"
> & {
  dni: string;
};

export type MoodleAutoLoginResult = {
  status: MoodleAutoLoginStatus;
  onboarding: MoodleOnboardingProfile | null;
};

const ONBOARDING_REASONS = new Set(["not_registered", "no_account"]);

/**
 * Guard a nivel de módulo: la resolución de entrada del campus se ejecuta una
 * vez por carga real, incluso con re-montajes de React. `logout()` lo activa
 * para que cerrar sesión deje al estudiante en el login hasta recargar.
 */
let autoLoginConsumed = false;
export const suppressMoodleAutoLogin = (): void => {
  autoLoginConsumed = true;
};

let onboardingResult: MoodleOnboardingProfile | null = null;

/**
 * Resuelve la entrada exclusivamente a partir de un mensaje del padre Moodle.
 * La URL pública ya no habilita autologin ni alta aunque contenga datos que
 * parezcan de FilterCodes.
 */
export const useMoodleAutoLogin = (): MoodleAutoLoginResult => {
  const [status, setStatus] = useState<MoodleAutoLoginStatus>(() =>
    !autoLoginConsumed && isEmbeddedInMoodle() ? "checking" : "done"
  );
  const [onboarding, setOnboarding] = useState<MoodleOnboardingProfile | null>(onboardingResult);
  const hasRun = useRef(false);
  const safetyDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
      let landingOnDashboard = false;

      try {
        if (autoLoginConsumed || !isEmbeddedInMoodle()) {
          setStatus("done");
          return;
        }

        autoLoginConsumed = true;
        const context = await requestMoodleCourseContext();

        logger.info("[MoodleEntry] Contexto validado por el aula PPS", {
          courseId: context.courseId,
          moodleUserId: context.moodleUserId,
        });

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          landingOnDashboard = true;
          return;
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/moodle-autologin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: context.email,
            profile: {
              firstname: context.firstname,
              lastname: context.lastname,
              username: context.moodleUsername,
            },
          }),
        });

        if (!response.ok) {
          logger.warn("[MoodleAutoLogin] La función respondió con error HTTP", response.status);
          return;
        }

        const result = (await response.json()) as {
          matched?: boolean;
          reason?: string;
          token_hash?: string;
        };

        if (result.matched && result.token_hash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: "magiclink",
            token_hash: result.token_hash,
          });

          if (verifyError) {
            logger.warn("[MoodleAutoLogin] No se pudo canjear la sesión de un solo uso");
          } else {
            landingOnDashboard = true;
          }
          return;
        }

        if (result.reason && ONBOARDING_REASONS.has(result.reason)) {
          onboardingResult = {
            ...context,
            dni: context.moodleUsername,
          };
          setOnboarding(onboardingResult);
          logger.info("[MoodleEntry] Alta habilitada por el aula PPS", result.reason);
          return;
        }

        logger.info("[MoodleEntry] Se continúa por el login normal", result.reason);
      } catch (error) {
        logger.warn("[MoodleAutoLogin] El aula no entregó un contexto válido", error);
      } finally {
        if (landingOnDashboard) {
          if (safetyDoneTimer.current) clearTimeout(safetyDoneTimer.current);
          safetyDoneTimer.current = setTimeout(() => setStatus("done"), 7_000);
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
