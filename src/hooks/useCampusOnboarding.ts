import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getErrorMessage } from "../utils/getErrorMessage";
import { logger } from "../utils/logger";
import type { MoodleOnboardingProfile } from "./useMoodleAutoLogin";

/**
 * Alta guiada de un estudiante que entra desde el campus Moodle y no tiene
 * cuenta en el panel. Nombre, apellido, correo (y normalmente DNI = username
 * de Moodle) llegan del perfil del campus; el alumno completa legajo, celular
 * y contraseña.
 *
 * La vinculación con una fila precargada o la creación de una fila nueva se
 * resuelven de forma atómica en `register_campus_student`. El navegador no
 * consulta ni recibe datos personales del registro académico.
 */

export type CampusOnboardingState = ReturnType<typeof useCampusOnboarding>;

export const useCampusOnboarding = (profile: MoodleOnboardingProfile) => {
  const [legajo, setLegajo] = useState("");
  // El DNI viene de Moodle; editable solo si el campus no lo inyectó.
  const [dni, setDni] = useState(profile.dni);
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  /** true cuando el legajo ya tiene cuenta: la salida es "iniciá sesión". */
  const [hasExistingAccount, setHasExistingAccount] = useState(false);

  const dniLocked = profile.dni.length >= 6;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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

      // Crear el usuario de Auth con el correo recibido desde el campus.
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { legajo: legajoClean } },
      });
      const userId = authData?.user?.id;

      if (signUpError || !userId) {
        const msg = (signUpError?.message || "").toLowerCase();
        if (msg.includes("already registered") || msg.includes("exists")) {
          setHasExistingAccount(true);
          throw new Error(
            "Tu correo del campus ya tiene una cuenta. Iniciá sesión o usá Recuperar Acceso."
          );
        }
        if (msg.includes("rate limit") || msg.includes("seconds")) {
          throw new Error("Demasiados intentos. Esperá un minuto y volvé a intentar.");
        }
        throw new Error(
          `No se pudo crear la cuenta: ${signUpError?.message || "verificá los datos."}`
        );
      }

      // La RPC decide en servidor si corresponde vincular una fila precargada
      // o crear una nueva, y valida correo confirmado + DNI antes de vincular.
      const { error: rpcError } = await supabase.rpc("register_campus_student", {
        legajo_input: legajoClean,
        userid_input: userId,
        dni_input: Number(dniClean),
        correo_input: email,
        telefono_input: telefonoClean,
        nombre_input: profile.firstname,
        apellido_input: profile.lastname,
      });
      if (rpcError) {
        logger.warn("[CampusOnboarding] Alta segura falló:", rpcError.message);
        throw new Error(
          "La cuenta se creó, pero no pudimos validar los datos con el registro académico. Revisalos o contactá a coordinación."
        );
      }

      logger.warn(`[CampusOnboarding] Alta completada para legajo ${legajoClean}.`);
      // La sesión ya quedó activa por signUp: AuthContext detecta SIGNED_IN,
      // encuentra el perfil recién creado/vinculado y monta el panel solo.
    } catch (err) {
      setError(getErrorMessage(err));
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
