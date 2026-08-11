import type { FormEvent } from "react";
import { useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../constants";
import { supabase } from "../lib/supabaseClient";
import { getErrorMessage } from "../utils/getErrorMessage";
import { logger } from "../utils/logger";
import type { MoodleOnboardingProfile } from "./useMoodleAutoLogin";

/**
 * Alta guiada habilitada por un ticket de un solo uso emitido dentro del aula
 * PPS. La creación de Auth y la vinculación con la ficha se hacen en servidor;
 * el navegador no puede registrar una cuenta directamente.
 */
export type CampusOnboardingState = ReturnType<typeof useCampusOnboarding>;

export const useCampusOnboarding = (profile: MoodleOnboardingProfile) => {
  const [legajo, setLegajo] = useState("");
  const [dni, setDni] = useState(profile.dni);
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasExistingAccount, setHasExistingAccount] = useState(false);

  const dniLocked = profile.dni.length >= 6;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setHasExistingAccount(false);
    setIsLoading(true);

    try {
      const legajoClean = legajo.replace(/\D/g, "").trim();
      const dniClean = dni.replace(/\D/g, "").trim();
      const telefonoClean = telefono.trim();
      const email = profile.email.trim().toLowerCase();

      if (legajoClean.length < 4 || legajoClean.length > 8)
        throw new Error("Ingresá tu legajo (solo números, entre 4 y 8 dígitos).");
      if (dniClean.length < 6 || dniClean.length > 9)
        throw new Error("Ingresá un DNI válido (sin puntos).");
      if (!telefonoClean) throw new Error("Ingresá tu número de celular.");
      if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");
      if (password.length > 128)
        throw new Error("La contraseña no puede superar los 128 caracteres.");
      if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");

      const response = await fetch(`${SUPABASE_URL}/functions/v1/register-moodle-student`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          signupTicket: profile.signupTicket,
          legajo: legajoClean,
          dni: dniClean,
          telefono: telefonoClean,
          password,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        if (result.code === "already_registered") {
          setHasExistingAccount(true);
          throw new Error(
            "Tu correo del campus ya tiene una cuenta. Iniciá sesión o usá Recuperar Acceso."
          );
        }
        if (result.code === "rate_limited") {
          throw new Error("Demasiados intentos. Esperá un minuto y volvé a intentar.");
        }
        if (result.code === "invalid_or_expired_ticket") {
          throw new Error(
            "La autorización del aula venció. Recargá el Aula PPS del Campus Virtual y volvé a intentarlo."
          );
        }
        throw new Error(result.message || "No pudimos completar el alta. Revisá los datos.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setHasExistingAccount(true);
        throw new Error(
          "La cuenta quedó creada. Iniciá sesión con tu legajo y la contraseña que elegiste."
        );
      }

      logger.info(`[CampusOnboarding] Alta completada para legajo ${legajoClean}.`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    legajo,
    setLegajo,
    dni,
    setDni,
    dniLocked,
    telefono,
    setTelefono,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    error,
    hasExistingAccount,
    submit,
  };
};
