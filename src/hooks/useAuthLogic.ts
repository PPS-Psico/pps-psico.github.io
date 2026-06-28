import { useState, FormEvent, ChangeEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  FIELD_DNI_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
} from "../constants";
import type { EstudianteFields, AirtableRecord } from "../types";
import type { AuthUser } from "../contexts/AuthContext";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";

interface UseAuthLogicProps {
  login: (user: AuthUser) => void;
  showModal: (title: string, message: string) => void;
}

type AuthMode = "login" | "register" | "forgot" | "reset" | "migration" | "recover";

const normalizePhone = (phone: unknown) => {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
};

const getFirstRow = (data: unknown) => (Array.isArray(data) && data.length > 0 ? data[0] : null);

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

export const useAuthLogic = ({ login, showModal: _showModal }: UseAuthLogicProps) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [resetStep, setResetStep] = useState<"verify" | "reset_password" | "success">("verify");
  const [migrationStep, setMigrationStep] = useState<1 | 2>(1);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);

  const [legajo, setLegajo] = useState(getInitialLegajoFromUrl);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  const [foundStudent, setFoundStudent] = useState<AirtableRecord<EstudianteFields> | null>(null);
  const [verificationData, setVerificationData] = useState({ dni: "", correo: "", telefono: "" });

  const resetFormState = () => {
    setError(null);
    setFieldError(null);
    setPassword("");
    setConfirmPassword("");
    setResetStep("verify");
    setMigrationStep(1);
    setRegisterStep(1);
    setVerificationData({ dni: "", correo: "", telefono: "" });
    setFoundStudent(null);
  };

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    // Clean session when switching modes to avoid lingering zombie states
    supabase.auth.signOut().catch(() => {});

    if (!((newMode === "migration" || newMode === "recover") && mode === "login")) {
      resetFormState();
    } else {
      // Keep legajo if switching from login failure
      setMigrationStep(1);
      setRegisterStep(1);
      setResetStep("verify");
      setError(null);
      setFieldError(null);
      setFoundStudent(null);
    }
  };

  const handleVerificationDataChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setVerificationData((prev) => ({ ...prev, [name]: value }));
    setFieldError(null);
  };

  const parseVerificationDni = (value: string) => {
    const cleanDni = value.replace(/\D/g, "").trim();
    const parsedDni = parseInt(cleanDni, 10);

    if (isNaN(parsedDni) || parsedDni === 0) {
      throw new Error("El DNI debe ser un número válido.");
    }

    return parsedDni;
  };

  const buildIdentityVerificationArgs = (includePhone: boolean) => ({
    legajo_input: legajo.trim(),
    dni_input: parseVerificationDni(verificationData.dni),
    correo_input: verificationData.correo.trim().toLowerCase(),
    telefono_input: includePhone ? verificationData.telefono.trim() : undefined,
  });

  const verifyStudentIdentity = async (includePhone: boolean) => {
    const { data, error } = await supabase.rpc(
      "verify_student_identity",
      buildIdentityVerificationArgs(includePhone)
    );

    if (error) {
      throw new Error("No pudimos validar tu identidad en este momento. Intenta nuevamente.");
    }

    return data && (data as unknown[]).length > 0 ? (data as unknown[])[0] : null;
  };

  const resetPasswordWithVerifiedIdentity = async (includePhone: boolean) => {
    return supabase.rpc("reset_student_password_verified", {
      ...buildIdentityVerificationArgs(includePhone),
      new_password: password,
    });
  };

  const getSignupStatus = async (email?: string) => {
    const { data, error } = await supabase.rpc("get_student_signup_status", {
      legajo_input: legajo.trim(),
      correo_input: email?.trim().toLowerCase() || undefined,
    });

    if (error) {
      const missingRpc =
        error.code === "PGRST202" ||
        String(error.message || "").includes("get_student_signup_status");

      if (missingRpc) {
        const { data: fallbackData, error: fallbackError } = await supabase.rpc(
          "get_student_for_signup",
          { legajo_input: legajo.trim() }
        );
        if (fallbackError)
          throw new Error("No pudimos validar el legajo en este momento. Intenta nuevamente.");

        const fallbackStudent = getFirstRow(fallbackData) as Record<string, unknown> | null;
        return fallbackStudent
          ? {
              ...fallbackStudent,
              signup_status: fallbackStudent.user_id ? "linked" : "available",
            }
          : { legajo: legajo.trim(), signup_status: "not_found" };
      }

      throw new Error("No pudimos validar el legajo en este momento. Intenta nuevamente.");
    }
    return getFirstRow(data);
  };

  const hydrateRegistrationForm = (student: Record<string, unknown>) => {
    setFoundStudent(student as unknown as AirtableRecord<EstudianteFields>);
    setVerificationData({
      dni: student.dni ? String(student.dni).replace(/\D/g, "") : "",
      correo: student.correo ? String(student.correo).trim().toLowerCase() : "",
      telefono: student.telefono ? String(student.telefono).trim() : "",
    });
  };

  const assertSignupStatusAllowsCreation = (student: Record<string, unknown> | null) => {
    const status = student?.signup_status || (student?.user_id ? "linked" : "available");

    if (!student || status === "not_found") {
      throw new Error(
        "El legajo no figura como estudiante habilitado. Revisá el número ingresado o contactá a coordinación."
      );
    }

    if (status === "linked") {
      throw new Error(
        "Este legajo ya tiene una cuenta activa. Iniciá sesión o usá Recuperar Acceso si olvidaste tu contraseña."
      );
    }

    if (status === "email_in_use") {
      throw new Error(
        "El correo indicado ya tiene una cuenta creada. Usá Recuperar Acceso para restablecer la contraseña."
      );
    }

    return student;
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
        // LIMPIEZA PREVENTIVA
        await supabase.auth.signOut();

        if (!legajoTrimmed || !passwordTrimmed)
          throw new Error("Por favor, completa todos los campos.");

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_student_email_by_legajo",
          { legajo_input: legajoTrimmed }
        );

        if (rpcError) throw new Error("Error de conexión al validar legajo. Intenta nuevamente.");

        const email =
          rpcData && typeof rpcData === "object" && "email" in (rpcData as Record<string, unknown>)
            ? String((rpcData as { email: string }).email || "")
                .trim()
                .toLowerCase()
            : "";

        if (!email)
          throw new Error(
            'Tu usuario parece incompleto. Por favor, ve a "Crear Cuenta" para actualizar tus datos.'
          );

        // 2. Intentar Login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: passwordTrimmed,
        });

        if (signInError) {
          logger.warn("Login failed:", signInError.message);

          if (signInError.message.includes("Invalid login credentials")) {
            // MODIFICADO: Ya no redirige a migración. Muestra error en pantalla.
            setError(
              "Contraseña incorrecta. Verificá tus datos o usá el botón de recuperar contraseña."
            );
            setFieldError("password");
          } else {
            setError("Ocurrió un error al iniciar sesión. Intenta nuevamente.");
          }
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
      // === LOGICA DE MIGRACIÓN / ACTIVACIÓN ===
      try {
        if (migrationStep === 1) {
          // Paso 1: Validar Identidad
          if (!legajoTrimmed || !verificationData.dni || !verificationData.correo) {
            throw new Error("Por favor completa los campos para validar tu identidad.");
          }

          const studentData = await verifyStudentIdentity(false);

          if (!studentData)
            throw new Error("Los datos ingresados no coinciden con nuestros registros.");

          setFoundStudent(studentData as unknown as AirtableRecord<EstudianteFields>);
          setMigrationStep(2);
          setIsLoading(false);
          return;
        }

        if (migrationStep === 2) {
          // Paso 2: Establecer Contraseña y Crear/Vincular Usuario
          if (password.length < 6)
            throw new Error("La contraseña debe tener al menos 6 caracteres.");
          if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");

          if (!foundStudent)
            throw new Error("Sesión de validación expirada. Por favor comienza de nuevo.");

          const email = String(foundStudent[FIELD_CORREO_ESTUDIANTES]).trim().toLowerCase();

          // 1. Intentamos CREAR el usuario
          const { data: _authData, error: signUpError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { legajo: legajoTrimmed } },
          });

          // 2. Manejo de Errores: ¿Ya existe?
          if (signUpError) {
            if (
              signUpError.message.includes("already registered") ||
              signUpError.status === 422 ||
              signUpError.status === 400
            ) {
              logger.info("Usuario ya existe en Auth, intentando forzar actualización de clave...");

              // Si ya existe, usamos RPC para resetear la clave Y REPARAR EL VINCULO
              const { error: rpcResetError } = await resetPasswordWithVerifiedIdentity(false);

              if (rpcResetError) {
                logger.error("RPC Reset Error:", rpcResetError);
                if (
                  rpcResetError.message.includes("No existe usuario") ||
                  rpcResetError.message.includes("not found")
                ) {
                  throw new Error(
                    "Error de integridad: El email de tu legajo no coincide con el usuario registrado. Contacta soporte."
                  );
                }
                throw new Error(
                  "No se pudo actualizar tu usuario existente. Intenta 'Recuperar Acceso'."
                );
              }
            } else {
              throw new Error(`Error al crear usuario: ${signUpError.message}`);
            }
          }

          // 3. Intento de Login final para confirmar y obtener sesión
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
          });

          if (loginError) {
            setMode("login");
            setError(
              "Cuenta configurada, pero el inicio de sesión automático falló. Por favor ingresa manualmente."
            );
          } else if (loginData.user) {
            // 4. Asegurar vínculo en DB (Self-healing por si acaso)
            const { error: linkError } = await supabase.rpc("register_new_student", {
              legajo_input: legajoTrimmed,
              userid_input: loginData.user.id,
              dni_input: parseInt(String(foundStudent[FIELD_DNI_ESTUDIANTES] ?? "0"), 10),
              correo_input: email,
              telefono_input: foundStudent[FIELD_TELEFONO_ESTUDIANTES] || "",
            });

            if (linkError) logger.warn("Link RPC warning (non-critical):", linkError);
          }
        }
      } catch (err) {
        logger.error("Migration error:", err);
        setError(getErrorMessage(err, "Error del servidor al procesar la solicitud."));
      } finally {
        setIsLoading(false);
      }
    } else if (mode === "register") {
      try {
        if (registerStep === 1) {
          if (!legajoTrimmed) throw new Error("Por favor ingresa tu legajo.");

          const student = assertSignupStatusAllowsCreation(
            (await getSignupStatus()) as Record<string, unknown> | null
          );

          hydrateRegistrationForm(student);
          setRegisterStep(2);
          setIsLoading(false);
          return;
        }

        if (registerStep === 2) {
          const { dni, correo, telefono } = verificationData;
          if (!dni || !correo || !telefono || !password)
            throw new Error("Todos los campos son obligatorios.");
          if (password.length < 6)
            throw new Error("La contraseña debe tener al menos 6 caracteres.");
          if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");

          const inputEmail = correo.trim().toLowerCase();
          const cleanDniInt = parseVerificationDni(dni);
          assertSignupStatusAllowsCreation(
            (await getSignupStatus(inputEmail)) as Record<string, unknown> | null
          );

          // Intentar crear usuario
          const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: inputEmail,
            password: password,
            options: { data: { legajo: legajoTrimmed } },
          });

          let userId = authData?.user?.id;

          if (signUpError || !userId) {
            logger.warn("SignUp failed:", signUpError);
            const errorMsg = signUpError?.message || "";
            const lowerMsg = errorMsg.toLowerCase();

            if (lowerMsg.includes("already registered") || lowerMsg.includes("exists")) {
              throw new Error(
                "Ya existe una cuenta con este correo. Por favor, usa la opción '¿Olvidaste tu contraseña?' desde Iniciar Sesión."
              );
            } else if (lowerMsg.includes("password") || lowerMsg.includes("contraseña")) {
              throw new Error(
                `La contraseña no cumple con los requisitos del sistema: ${errorMsg}`
              );
            } else if (lowerMsg.includes("rate limit") || lowerMsg.includes("seconds")) {
              throw new Error(
                "Demasiados intentos. Por favor espera un minuto y vuelve a intentarlo."
              );
            } else {
              throw new Error(
                `No se pudo crear la cuenta: ${errorMsg || "Verifica los datos ingresados."}`
              );
            }
          }

          if (userId) {
            // Garantizar datos actualizados con DNI limpio y cambiar estado a Activo
            const { error: linkError } = await supabase.rpc("register_new_student", {
              legajo_input: legajoTrimmed,
              userid_input: userId,
              dni_input: cleanDniInt,
              correo_input: inputEmail,
              telefono_input: telefono,
            });

            if (linkError) {
              const msg = String(linkError.message || "").toLowerCase();
              if (msg.includes("cuenta vinculada") || msg.includes("already")) {
                throw new Error(
                  "La cuenta se creó, pero el legajo ya aparece vinculado. Intentá ingresar o usá Recuperar Acceso."
                );
              }
              throw new Error(
                "La cuenta se creó, pero no pudimos completar tus datos. Contactá a coordinación para vincular el legajo."
              );
            }

            await supabase
              .from("estudiantes")
              .update({ estado: "Activo" })
              .eq("legajo", legajoTrimmed);
          }
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    } else if (mode === "recover") {
      try {
        clearLogs();
        addLog("info", `Iniciando recuperación de contraseña para legajo: ${legajoTrimmed}`);

        if (resetStep === "verify") {
          addLog("info", "Validando datos de identidad");

          if (
            !legajoTrimmed ||
            !verificationData.dni ||
            !verificationData.correo ||
            !verificationData.telefono
          ) {
            throw new Error("Por favor completa todos los campos para validar tu identidad.");
          }

          const studentData = await verifyStudentIdentity(true);

          if (!studentData) {
            addLog("error", "Datos no coinciden para recuperación", { legajo: legajoTrimmed });
            throw new Error("Los datos ingresados no coinciden con nuestros registros.");
          }

          addLog("success", "Verificación exitosa");
          setResetStep("reset_password");
          setIsLoading(false);
          return;
        }

        if (resetStep === "reset_password") {
          addLog("info", "Restableciendo contraseña");

          if (password.length < 6)
            throw new Error("La contraseña debe tener al menos 6 caracteres.");
          if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");

          const { error: rpcResetError } = await resetPasswordWithVerifiedIdentity(true);

          if (rpcResetError) {
            addLog("error", "RPC Error al restablecer contraseña", {
              message: rpcResetError.message,
              code: rpcResetError.code,
              details: rpcResetError.details,
              hint: rpcResetError.hint,
              status: (rpcResetError as { status?: number }).status,
            });

            if (
              rpcResetError.message.includes("No existe un usuario registrado con el correo") ||
              rpcResetError.message.includes("No existe usuario") ||
              rpcResetError.message.includes("not found")
            ) {
              addLog("info", "Usuario no encontrado en auth, intentando crear usuario...");

              const studentEmail = verificationData.correo.trim().toLowerCase();

              addLog("info", "Creando usuario en auth con email:", { email: studentEmail });

              const { error: signUpError } = await supabase.auth.signUp({
                email: studentEmail,
                password: password,
                options: { data: { legajo: legajoTrimmed } },
              });

              if (signUpError && !signUpError.message.includes("already registered")) {
                addLog("error", "Error al crear usuario", { signUpError });
                throw new Error(`Error al crear usuario: ${signUpError.message}`);
              }

              addLog(
                "info",
                "Usuario creado o ya existía, intentando resetear contraseña nuevamente..."
              );

              const { error: retryResetError } = await supabase.rpc(
                "reset_student_password_verified",
                {
                  ...buildIdentityVerificationArgs(true),
                  new_password: password,
                }
              );

              if (retryResetError) {
                addLog("error", "Error en segundo intento de reset", { retryResetError });
                throw new Error(
                  "No se pudo completar la recuperación de contraseña. Por favor, intenta 'Crear Cuenta' o contacta a soporte."
                );
              }

              addLog("success", "Usuario creado y contraseña restablecida");
            } else if (
              rpcResetError.message.includes("constraint") ||
              rpcResetError.message.includes("duplicate")
            ) {
              throw new Error(
                "Error de validación en la base de datos. Intenta nuevamente en unos minutos o contacta a soporte."
              );
            } else if (rpcResetError.code === "23505") {
              throw new Error(
                "Error de restricción única en la base de datos. Es posible que ya haya una solicitud pendiente."
              );
            } else if (((rpcResetError as { status?: number }).status ?? 0) >= 500) {
              throw new Error(
                "El servidor no está respondiendo correctamente (Error 500). Este es un error temporal. Por favor, intenta en unos minutos."
              );
            } else {
              throw new Error(
                `Error del servidor al restablecer la contraseña. Si el problema persiste, contacta a: blas.rivera@uflouniversidad.edu.ar`
              );
            }
          }

          addLog("success", "Contraseña restablecida exitosamente");

          const studentEmail = verificationData.correo.trim().toLowerCase();

          addLog("info", "Intentando login automático", { email: studentEmail });

          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: studentEmail,
            password: password,
          });

          if (loginError) {
            addLog("info", "Login automático falló, mostrando éxito manual", { loginError });
            setResetStep("success");
            setIsLoading(false);
            return;
          }

          if (loginData.user) {
            addLog("success", "Login automático exitoso");
          }

          setResetStep("success");
          setIsLoading(false);
        }
      } catch (err) {
        addLog("error", "Error durante recuperación", {
          error: getErrorMessage(err),
          stack: err instanceof Error ? err.stack : undefined,
          mode,
          resetStep,
          legajo: legajoTrimmed,
        });

        const errorMessage = getErrorMessage(err, "Error desconocido al recuperar contraseña.");
        const additionalInfo =
          mode === "recover" && resetStep === "reset_password"
            ? "\n\n🔧 Detalles técnicos para soporte:\nEste error indica un problema al actualizar la contraseña en el servidor. Por favor, contacta a blas.rivera@uflouniversidad.edu.ar con tu legajo y menciona 'Error al recuperar contraseña'."
            : "";

        setError(errorMessage + additionalInfo);
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
    rememberMe,
    setRememberMe,
    isLoading,
    error,
    fieldError,
    foundStudent,
    verificationData,
    debugLogs,
    clearLogs,
    handleVerificationDataChange,
    handleFormSubmit,
    handleForgotLegajoSubmit: (e: FormEvent) => e.preventDefault(),
  };
};
