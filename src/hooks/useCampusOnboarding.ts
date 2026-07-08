import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";
import type { MoodleOnboardingProfile } from "./useMoodleAutoLogin";

/**
 * Alta guiada de un estudiante que entra desde el campus Moodle y no tiene
 * cuenta en el panel. Nombre, apellido, correo (y normalmente DNI = username
 * de Moodle) llegan del perfil del campus; el alumno completa legajo, celular
 * y contraseña.
 *
 * Según lo que diga `get_student_signup_status` para el legajo ingresado:
 *  - not_found   → fila nueva: signUp + register_campus_student (INSERT).
 *  - available   → fila precargada sin cuenta: signUp + register_new_student
 *                  (UPDATE/vinculación), validando que el DNI coincida.
 *  - linked      → ya tiene cuenta con otro correo: no se crea nada, se lo
 *                  manda a iniciar sesión (el próximo ingreso auto-loguea por
 *                  DNI gracias a la Edge Function).
 *  - email_in_use→ el correo del campus ya tiene cuenta: iniciar sesión.
 */

const getFirstRow = (data: unknown): Record<string, unknown> | null => {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  return (data as Record<string, unknown>) ?? null;
};

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
      if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
      if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");

      // 1. ¿Qué sabemos de este legajo?
      const { data: statusData, error: statusError } = await supabase.rpc(
        "get_student_signup_status",
        { legajo_input: legajoClean, correo_input: email }
      );
      if (statusError)
        throw new Error("No pudimos validar el legajo en este momento. Intentá nuevamente.");

      const row = getFirstRow(statusData);
      const signupStatus = String(row?.signup_status ?? "not_found");

      if (signupStatus === "linked") {
        setHasExistingAccount(true);
        throw new Error(
          "Este legajo ya tiene una cuenta creada con otro correo. Iniciá sesión con ese correo y contraseña (o usá Recuperar Acceso); la próxima vez vas a entrar automático desde el campus."
        );
      }

      if (signupStatus === "email_in_use") {
        setHasExistingAccount(true);
        throw new Error(
          "Tu correo del campus ya tiene una cuenta en el panel. Iniciá sesión con tu legajo y contraseña, o usá Recuperar Acceso."
        );
      }

      const isLinkFlow = signupStatus === "available";

      // Fila precargada: el DNI cargado por coordinación (si existe) debe
      // coincidir con el del alumno — evita vincular el legajo de otra persona.
      if (isLinkFlow) {
        const rowDni = String(row?.dni ?? "").replace(/\D/g, "");
        if (rowDni && rowDni !== dniClean) {
          throw new Error(
            "El legajo ingresado no coincide con tu DNI. Revisá el número o contactá a coordinación."
          );
        }
      }

      // 2. Crear el usuario de Auth con el correo del campus.
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

      // 3. Crear o vincular la fila de estudiantes.
      const baseArgs = {
        legajo_input: legajoClean,
        userid_input: userId,
        dni_input: Number(dniClean),
        correo_input: email,
        telefono_input: telefonoClean,
      };
      const { error: rpcError } = isLinkFlow
        ? await supabase.rpc("register_new_student", baseArgs)
        : await supabase.rpc("register_campus_student", {
            ...baseArgs,
            nombre_input: profile.firstname,
            apellido_input: profile.lastname,
          });
      if (rpcError) {
        logger.warn(
          `[CampusOnboarding] ${isLinkFlow ? "register_new_student" : "register_campus_student"} falló:`,
          rpcError.message
        );
        throw new Error(
          rpcError.message ||
            "La cuenta se creó pero no pudimos completar tu perfil. Contactá a coordinación."
        );
      }

      logger.warn(
        `[CampusOnboarding] Alta exitosa (${isLinkFlow ? "vinculación" : "fila nueva"}) para legajo ${legajoClean}.`
      );
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
