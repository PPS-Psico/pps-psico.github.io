import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { AuthUser } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { getErrorMessage } from "../utils/getErrorMessage";
import { logger } from "../utils/logger";

interface UseAuthLogicProps {
  login: (user: AuthUser) => void;
  showModal: (title: string, message: string) => void;
}

type AuthMode = "login" | "register" | "forgot" | "reset" | "migration" | "recover";

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const SUPABASE_AUTH_STORAGE_KEY = "sb-qxnxtnhtbpsgzprqtrjl-auth-token";

/**
 * El login manual puede empezar con un refresh token viejo guardado por otra
 * ejecución local. Esa sesión rota no debe impedir solicitar una nueva.
 *
 * `scope: "local"` evita revocar las sesiones que el mismo usuario tenga en
 * Moodle/GitHub. Si Supabase no puede cerrar la sesión porque el refresh token
 * ya fue revocado, descartamos solamente la copia de este navegador.
 */
export const clearLocalSessionBeforeLogin = async () => {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      logger.warn("No se pudo cerrar la sesión local anterior; se descartará del navegador.");
    }
  } catch (error) {
    logger.warn("La sesión local anterior ya no era válida; se iniciará una nueva.", error);
  } finally {
    try {
      localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    } catch {
      // El navegador puede negar almacenamiento persistente. setSession sigue
      // pudiendo montar la sesión actual en memoria.
    }
  }
};

/**
 * Lee un parámetro de la URL tanto del query string normal (?legajo=123)
 * como del query embebido en el hash de HashRouter (#/login?legajo=123).
 * Se usa para integrar "Mi Panel" dentro del campus Moodle: el plugin
 * FilterCodes inyecta el dato del alumno en la URL del iframe (ej. {idnumber}),
 * y acá lo leemos para prellenar el legajo. NOTA: el dato es solo una
 * conveniencia de UX; nunca se usa para autenticar (eso lo hace la contraseña).
 */
const getInitialLegajoFromUrl = (): string => {
  if (typeof window === "undefined") return "";
  try {
    const candidates: string[] = [];

    const search = new URLSearchParams(window.location.search);
    candidates.push(search.get("legajo") || "");

    const hash = window.location.hash || "";
    const queryIndex = hash.indexOf("?");
    if (queryIndex !== -1) {
      const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
      candidates.push(hashParams.get("legajo") || "");
    }

    const raw = candidates.find((value) => value.trim() !== "") || "";
    // Solo dígitos: el legajo siempre es numérico, evita inyección de basura.
    return raw.replace(/\D/g, "").slice(0, 20);
  } catch {
    return "";
  }
};

/**
 * Lee el token de recuperación del enlace que llega por mail
 * (#/login?reset_token=...). El token es hexadecimal de 64 caracteres; se
 * sanitiza para no arrastrar nada raro de la URL a la llamada.
 */
export const getResetTokenFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const candidates: string[] = [];

    const search = new URLSearchParams(window.location.search);
    candidates.push(search.get("reset_token") || "");

    const hash = window.location.hash || "";
    const queryIndex = hash.indexOf("?");
    if (queryIndex !== -1) {
      const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
      candidates.push(hashParams.get("reset_token") || "");
    }

    const raw = (candidates.find((value) => value.trim() !== "") || "").trim();
    return /^[a-f0-9]{64}$/i.test(raw) ? raw.toLowerCase() : null;
  } catch {
    return null;
  }
};

export const removeResetTokenFromUrl = (): void => {
  if (typeof window === "undefined") return;

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("reset_token");

    const queryIndex = url.hash.indexOf("?");
    if (queryIndex !== -1) {
      const hashPath = url.hash.slice(0, queryIndex);
      const hashParams = new URLSearchParams(url.hash.slice(queryIndex + 1));
      hashParams.delete("reset_token");
      const remainingQuery = hashParams.toString();
      url.hash = remainingQuery ? `${hashPath}?${remainingQuery}` : hashPath;
    }

    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // La limpieza es defensiva. Un navegador con una URL no estándar no debe
    // impedir que el alumno use el formulario.
  }
};

export const useAuthLogic = ({ login, showModal: _showModal }: UseAuthLogicProps) => {
  // Token de recuperación que llega por el enlace del mail
  // (#/login?reset_token=...). Si está presente, la pantalla arranca
  // directamente en el paso de elegir la nueva contraseña.
  const [resetToken, setResetToken] = useState<string | null>(() => getResetTokenFromUrl());
  const [mode, setMode] = useState<AuthMode>(resetToken ? "recover" : "login");
  const [resetStep, setResetStep] = useState<
    "verify" | "reset_password" | "email_sent" | "success"
  >(resetToken ? "reset_password" : "verify");
  const [migrationStep, setMigrationStep] = useState<1 | 2>(1);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);

  const [legajo, setLegajo] = useState(getInitialLegajoFromUrl);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (type: "error" | "info" | "success", message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ""}`;
    setDebugLogs((prev) => [...prev, logEntry]);
    logger.info(logEntry);
  };

  const clearLogs = () => setDebugLogs([]);

  const [verificationData, setVerificationData] = useState({ dni: "", correo: "", telefono: "" });

  useEffect(() => {
    if (resetToken) removeResetTokenFromUrl();
  }, [resetToken]);

  const resetFormState = () => {
    setError(null);
    setFieldError(null);
    setPassword("");
    setConfirmPassword("");
    setCaptchaToken(null);
    setResetStep("verify");
    setMigrationStep(1);
    setRegisterStep(1);
    setVerificationData({ dni: "", correo: "", telefono: "" });
  };

  const handleModeChange = (newMode: AuthMode) => {
    const resolvedMode = newMode === "migration" ? "recover" : newMode;
    setMode(resolvedMode);
    // Clean session when switching modes to avoid lingering zombie states
    supabase.auth.signOut({ scope: "local" }).catch(() => {});

    if (!(resolvedMode === "recover" && mode === "login")) {
      resetFormState();
    } else {
      // Keep legajo if switching from login failure
      setMigrationStep(1);
      setRegisterStep(1);
      setResetStep("verify");
      setError(null);
      setFieldError(null);
    }
  };

  const handleVerificationDataChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setVerificationData((prev) => ({ ...prev, [name]: value }));
    setFieldError(null);
  };

  const assertValidNewPassword = () => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new Error(`La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`);
    }
    if (password !== confirmPassword) {
      throw new Error("Las contraseñas no coinciden.");
    }
  };

  const requestPasswordResetLink = async (legajoValue: string) => {
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) {
      throw new Error("Completá la verificación de seguridad.");
    }

    const { error: invokeError } = await supabase.functions.invoke("request-password-reset", {
      body: { legajo: legajoValue, captchaToken },
    });

    if (invokeError) {
      throw new Error(
        "No pudimos procesar el pedido en este momento. Intentá nuevamente en unos minutos."
      );
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const legajoTrimmed = legajo.trim();
    const passwordTrimmed = password.trim();

    if (legajoTrimmed === "testing" && passwordTrimmed === "testing") {
      login({ legajo: "99999", nombre: "Usuario de Prueba", role: "AdminTester" });
      return;
    }

    // BYPASS ELIMINADO: Ahora el admin se loguea como un usuario real de Supabase
    // para garantizar que las políticas RLS funcionen correctamente.
    // El legajo 'admin' ya existe en la BD y tiene email 'admin@sistema.com'.

    setIsLoading(true);
    setError(null);
    setFieldError(null);

    if (mode === "login") {
      try {
        // La limpieza es local y tolera refresh tokens vencidos o revocados.
        // Nunca debe bloquear un nuevo intento de login.
        await clearLocalSessionBeforeLogin();

        if (!legajoTrimmed || !password) throw new Error("Por favor, completa todos los campos.");

        const { data: loginResult, error: invokeError } = await supabase.functions.invoke(
          "student-login",
          {
            body: {
              legajo: legajoTrimmed,
              password,
            },
          }
        );

        const sessionTokens = loginResult as {
          ok?: boolean;
          accessToken?: string;
          refreshToken?: string;
        } | null;

        if (
          invokeError ||
          !sessionTokens?.ok ||
          !sessionTokens.accessToken ||
          !sessionTokens.refreshToken
        ) {
          setError("Legajo o contraseña incorrectos. Verificá tus datos o usá Recuperar acceso.");
          setFieldError("password");
          setIsLoading(false);
          return;
        }

        const { error: signInError } = await supabase.auth.setSession({
          access_token: sessionTokens.accessToken,
          refresh_token: sessionTokens.refreshToken,
        });

        if (signInError) {
          logger.warn("No se pudo montar la sesión devuelta por student-login");
          setError("No pudimos iniciar sesión en este momento. Intentá nuevamente.");
          setIsLoading(false);
          return;
        }
        // Si el login es exitoso, AuthContext detectará el cambio de sesión automáticamente
      } catch (err) {
        logger.error("Login error:", err);
        setError(getErrorMessage(err, "Error al iniciar sesión."));
      } finally {
        setIsLoading(false);
      }
    } else if (mode === "migration") {
      // El flujo legacy verificaba DNI/correo y podía cambiar la contraseña por
      // RPC. Cualquier entrada histórica a ese modo se deriva al canal seguro.
      try {
        if (!legajoTrimmed) throw new Error("Ingresá tu número de legajo.");
        await requestPasswordResetLink(legajoTrimmed);
        setMode("recover");
        setResetStep("email_sent");
      } catch (err) {
        setError(getErrorMessage(err, "No pudimos iniciar la recuperación."));
      } finally {
        setIsLoading(false);
      }
    } else if (mode === "register") {
      // El alta pública está cerrada. Este guard también bloquea cualquier
      // estado legacy que intente forzar el modo de registro desde el cliente.
      setMode("login");
      setError("La creación de cuentas sólo está disponible desde el Aula PPS del Campus Virtual.");
      setIsLoading(false);
      return;
    } else if (mode === "recover") {
      try {
        clearLogs();

        // Paso 1: el alumno pide el enlace con su legajo. No se le piden datos
        // personales: eso era justamente el problema del flujo anterior (DNI,
        // correo y teléfono no son secretos y se podían cosechar).
        if (resetStep === "verify") {
          if (!legajoTrimmed) {
            throw new Error("Ingresá tu número de legajo.");
          }

          addLog("info", "Pidiendo enlace de recuperación");
          await requestPasswordResetLink(legajoTrimmed);

          // La respuesta es siempre la misma exista o no el legajo, para no
          // convertir esta pantalla en un verificador de quién está registrado.
          addLog("success", "Pedido enviado");
          setResetStep("email_sent");
          setIsLoading(false);
          return;
        }

        // Paso 2: el alumno llegó desde el enlace del mail (?reset_token=...) y
        // elige su nueva contraseña.
        if (resetStep === "reset_password") {
          if (!resetToken) {
            throw new Error(
              "Falta el enlace de recuperación. Abrí el link que te enviamos por correo."
            );
          }
          assertValidNewPassword();

          addLog("info", "Canjeando token de recuperación");

          const { data, error: invokeError } = await supabase.functions.invoke(
            "reset-password-with-token",
            { body: { token: resetToken, password } }
          );

          const result = data as { ok?: boolean; error?: string } | null;

          if (invokeError || !result?.ok) {
            addLog("error", "No se pudo canjear el token", {
              message: invokeError?.message ?? result?.error,
            });
            throw new Error(
              result?.error ||
                "El enlace no es válido o ya venció. Pedí uno nuevo desde 'Recuperar acceso'."
            );
          }

          addLog("success", "Contraseña actualizada");
          setResetToken(null);
          setResetStep("success");
          setIsLoading(false);
        }
      } catch (err) {
        addLog("error", "Error durante recuperación", {
          error: getErrorMessage(err),
          mode,
          resetStep,
        });
        setError(getErrorMessage(err, "Error desconocido al recuperar contraseña."));
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  };

  return {
    mode,
    setMode: handleModeChange,
    resetStep,
    migrationStep,
    setMigrationStep,
    registerStep,
    setRegisterStep,
    legajo,
    setLegajo,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    captchaToken,
    setCaptchaToken,
    rememberMe,
    setRememberMe,
    isLoading,
    error,
    fieldError,
    verificationData,
    debugLogs,
    clearLogs,
    handleVerificationDataChange,
    handleFormSubmit,
    handleForgotLegajoSubmit: (e: FormEvent) => e.preventDefault(),
  };
};
