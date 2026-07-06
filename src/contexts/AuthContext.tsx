import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { logger } from "../utils/logger";
import { suppressMoodleAutoLogin } from "../hooks/useMoodleAutoLogin";
import {
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
  FIELD_USER_ID_ESTUDIANTES,
  FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES,
  FIELD_ROLE_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
} from "../constants";

export type AuthUser = {
  id?: string;
  studentId?: string;
  legajo: string;
  nombre: string;
  role?: "Jefe" | "SuperUser" | "Directivo" | "AdminTester" | "Reportero";
  orientaciones?: string[];
  mustChangePassword?: boolean;
  needsDataCompletion?: boolean;
};

interface AuthContextType {
  authenticatedUser: AuthUser | null;
  isSuperUserMode: boolean;
  isJefeMode: boolean;
  isDirectivoMode: boolean;
  isAdminTesterMode: boolean;
  isReporteroMode: boolean;
  isAuthLoading: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  completePasswordChange: () => void;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const queryClient = useQueryClient();

  // Refs to track state without triggering re-renders
  const refreshLoopCounter = useRef(0);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authStabilizationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dedup del fetch de perfil: `getSession()`, `INITIAL_SESSION` y `SIGNED_IN`
  // disparan processSession por separado para la MISMA sesión → sin esto se
  // hacían 3-4 SELECT idénticos a `estudiantes` en el arranque, compitiendo
  // entre sí y escalando la latencia (medido: 643→1707ms). Guardamos el último
  // user_id procesado para saltear los duplicados; se resetea en SIGNED_OUT.
  const processedUserIdRef = useRef<string | null>(null);

  // Función de limpieza profunda
  const deepCleanup = useCallback(() => {
    logger.info("🧹 Ejecutando limpieza profunda de sesión...");
    localStorage.removeItem("sb-qxnxtnhtbpsgzprqtrjl-auth-token");
    sessionStorage.clear();
    queryClient.clear();
    processedUserIdRef.current = null;
    setAuthenticatedUser(null);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      logger.info("🚪 Cerrando sesión...");

      // Evita que el auto-login del campus Moodle nos vuelva a loguear apenas
      // cerramos sesión: el guard se limpia solo con una recarga real de la
      // página (F5). Ver useMoodleAutoLogin / suppressMoodleAutoLogin.
      suppressMoodleAutoLogin();

      // 1. Cancel React Query fetching
      queryClient.cancelQueries();

      // 2. Clear local state first
      setAuthenticatedUser(null);

      // 3. Sign out from Supabase (Safe catch if no session exists)
      const { error } = await supabase.auth.signOut();
      if (error) logger.warn("Supabase signOut warning:", error.message);

      // 4. Force cleanup
      deepCleanup();
    } catch (error) {
      logger.error("Error during forced logout:", error);
      deepCleanup();
    }
  }, [queryClient, deepCleanup]);

  useEffect(() => {
    let isMounted = true;

    // Clear any existing timeout
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

    // Safety Timeout: If nothing happens in 8 seconds, stop loading.
    safetyTimeoutRef.current = setTimeout(() => {
      if (isMounted && isAuthLoading) {
        logger.warn("⚠️ Auth check timed out. Stopping spinner.");
        setIsAuthLoading(false);
      }
    }, 8000);

    const processSession = async (session: Session | null) => {
      // If no session, clear user and stop loading
      if (!session?.user) {
        processedUserIdRef.current = null;
        if (isMounted) {
          setAuthenticatedUser(null);
          setIsAuthLoading(false);
        }
        return;
      }

      // Dedup: si ya procesamos (o estamos procesando) este mismo user_id,
      // evitar el SELECT redundante. El primero en llegar gana y completa el
      // fetch; los duplicados (getSession + INITIAL_SESSION + SIGNED_IN) salen acá.
      if (processedUserIdRef.current === session.user.id) {
        logger.scoped(
          "Auth",
          `fetch de perfil omitido — ya procesado (user_id=${session.user.id})`
        );
        return;
      }
      processedUserIdRef.current = session.user.id;

      try {
        // Fetch profile from DB including DNI for validation
        const fetchNum = logger.count("Auth · fetch perfil");
        logger.scoped(
          "Auth",
          `Buscando estudiante (user_id=${session.user.id}, evento #${fetchNum})`
        );
        const endTimer = logger.time(`Auth · query estudiantes #${fetchNum}`);
        let profile: any = null;
        let queryError = null;

        const { data, error } = await supabase
          .from("estudiantes")
          .select(
            `id, ${FIELD_LEGAJO_ESTUDIANTES}, ${FIELD_NOMBRE_ESTUDIANTES}, ${FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES}, ${FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES}, ${FIELD_ROLE_ESTUDIANTES}, ${FIELD_DNI_ESTUDIANTES}, ${FIELD_CORREO_ESTUDIANTES}, ${FIELD_TELEFONO_ESTUDIANTES}, estado, ${FIELD_USER_ID_ESTUDIANTES}`
          )
          .eq(FIELD_USER_ID_ESTUDIANTES, session.user.id)
          .maybeSingle();

        if (!data && !error && session.user.email) {
          logger.warn(
            `[Auth] No se encontró perfil por user_id. Buscando por email fallback: ${session.user.email}`
          );
          const { data: emailData, error: emailError } = await supabase
            .from("estudiantes")
            .select(
              `id, ${FIELD_LEGAJO_ESTUDIANTES}, ${FIELD_NOMBRE_ESTUDIANTES}, ${FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES}, ${FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES}, ${FIELD_ROLE_ESTUDIANTES}, ${FIELD_DNI_ESTUDIANTES}, ${FIELD_CORREO_ESTUDIANTES}, ${FIELD_TELEFONO_ESTUDIANTES}, estado, ${FIELD_USER_ID_ESTUDIANTES}`
            )
            .ilike(FIELD_CORREO_ESTUDIANTES, session.user.email)
            .maybeSingle();

          if (emailData && !emailError) {
            logger.warn(
              `[Auth] Encontrado perfil por email. Actualizando user_id a: ${session.user.id}`
            );
            const { error: updateError } = await supabase
              .from("estudiantes")
              .update({ [FIELD_USER_ID_ESTUDIANTES]: session.user.id })
              .eq("id", emailData.id);

            if (updateError) {
              logger.error("[Auth] Error vinculando user_id:", updateError.message);
            }
            profile = {
              ...emailData,
              [FIELD_USER_ID_ESTUDIANTES]: session.user.id,
            };
          } else {
            queryError = emailError;
          }
        } else {
          profile = data;
          queryError = error;
        }
        endTimer();

        logger.scoped("Auth", "Profile encontrado:", profile, "error:", queryError);

        if (isMounted) {
          if (profile && !error) {
            const dbRole = profile[FIELD_ROLE_ESTUDIANTES] as AuthUser["role"] | undefined;

            // Verificar si le faltan datos esenciales (DNI)
            const dniValue = profile[FIELD_DNI_ESTUDIANTES];
            logger.info("[Auth] DNI value:", dniValue, "type:", typeof dniValue);
            const hasDni =
              dniValue !== null &&
              dniValue !== undefined &&
              dniValue !== 0 &&
              String(dniValue).trim() !== "";
            const isAdminRole = ["SuperUser", "Jefe", "Directivo", "AdminTester"].includes(
              dbRole || ""
            );
            const needsDataCompletion = !hasDni && !isAdminRole;
            logger.info("[Auth] hasDni:", hasDni, "needsDataCompletion:", needsDataCompletion);

            // Auto-activar si tiene DNI válido y está inactivo
            const currentEstado = profile.estado;
            const hasValidData =
              hasDni && profile[FIELD_CORREO_ESTUDIANTES] && profile[FIELD_TELEFONO_ESTUDIANTES];
            if (hasValidData && currentEstado !== "Activo" && currentEstado !== "Finalizado") {
              logger.info("[Auth] Auto-activando estudiante:", profile.id);
              supabase
                .from("estudiantes")
                .update({ estado: "Activo" })
                .eq("id", profile.id)
                .then(() => {
                  logger.info("[Auth] Estudiante activado");
                });
            }

            // Stabilization: Delay the state update slightly to let previous React tree unmount cleanly
            if (authStabilizationTimer.current) clearTimeout(authStabilizationTimer.current);

            authStabilizationTimer.current = setTimeout(() => {
              setAuthenticatedUser({
                id: session.user.id,
                studentId: profile.id,
                legajo: profile[FIELD_LEGAJO_ESTUDIANTES] || "", // Fallback to empty string
                nombre: profile[FIELD_NOMBRE_ESTUDIANTES] || "Usuario", // Fallback
                orientaciones: profile[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]
                  ? [profile[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]]
                  : [],
                mustChangePassword: !!profile[FIELD_MUST_CHANGE_PASSWORD_ESTUDIANTES], // Boolean cast
                needsDataCompletion,
                role: dbRole,
              });
              setIsAuthLoading(false);
            }, 50); // Small delay to decouple from event loop
          } else {
            logger.warn(
              `Profile not found for authenticated user (email: ${session.user.email}, id: ${session.user.id}). Posible Admin o Error de Integridad.`
            );
            if (session.user.email === "admin@uflo.edu.ar") {
              setAuthenticatedUser({
                id: session.user.id,
                legajo: "admin",
                nombre: "Administrador UFLO",
                role: "SuperUser",
              });
              setIsAuthLoading(false);
            } else {
              // Permitir reintento: este user_id no quedó resuelto y la sesión es inválida.
              logger.warn("[Auth] Cerrando sesión de Supabase por perfil no encontrado.");
              processedUserIdRef.current = null;
              setAuthenticatedUser(null);
              setIsAuthLoading(false);
              supabase.auth
                .signOut()
                .catch((e) => logger.warn("Error signing out mismatched user:", e));
            }
          }
        }
      } catch (err) {
        logger.error("Profile fetch error:", err);
        // Falló el fetch: liberar el dedup para poder reintentar.
        processedUserIdRef.current = null;
        if (isMounted) {
          setAuthenticatedUser(null);
          setIsAuthLoading(false);
        }
      }
    };

    // Initialize: Get current session
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("refresh token") || msg.includes("not found") || msg.includes("invalid")) {
          logger.error("🚨 Token corrupto detectado. Limpiando almacenamiento.");
          deepCleanup();
        }
        if (isMounted) setIsAuthLoading(false);
      } else {
        processSession(data.session);
      }
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.info(`AUTH EVENT: ${event}`);

      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

      if (event === "TOKEN_REFRESHED") {
        refreshLoopCounter.current += 1;
        if (refreshLoopCounter.current > 3) {
          logger.error("🔄 Bucle de refresco detectado. Forzando salida.");
          refreshLoopCounter.current = 0;
          deepCleanup();
          if (isMounted) setIsAuthLoading(false);
          return;
        }
      } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        refreshLoopCounter.current = 0;
        processSession(session);
      } else if (event === "SIGNED_OUT") {
        refreshLoopCounter.current = 0;
        processedUserIdRef.current = null;
        if (isMounted) {
          setAuthenticatedUser(null);
          setIsAuthLoading(false);
          queryClient.clear();
        }
      }
    });

    return () => {
      isMounted = false;
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      if (authStabilizationTimer.current) clearTimeout(authStabilizationTimer.current);
      subscription.unsubscribe();
    };
    // Listener de auth: debe montarse UNA sola vez. Re-suscribir ante cada cambio
    // de isAuthLoading provocaría bucles de suscripción; el safety-timeout asume
    // el estado inicial de carga a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, deepCleanup]);

  const login = useCallback((user: AuthUser) => {
    setAuthenticatedUser(user);
    setIsAuthLoading(false);
  }, []);

  const completePasswordChange = useCallback(() => {
    setAuthenticatedUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
  }, []);

  const refreshAuth = useCallback(() => {
    setAuthenticatedUser((prev) => (prev ? { ...prev, needsDataCompletion: false } : null));
  }, []);

  const isSuperUserMode =
    authenticatedUser?.role === "SuperUser" || authenticatedUser?.legajo === "admin";
  const isJefeMode = authenticatedUser?.role === "Jefe";
  const isDirectivoMode = authenticatedUser?.role === "Directivo";
  const isAdminTesterMode = authenticatedUser?.role === "AdminTester";
  const isReporteroMode = authenticatedUser?.role === "Reportero";

  // Memoizamos el value para no recrear el objeto en cada render del provider:
  // así los muchos consumidores de `useAuth` solo re-renderizan cuando cambian
  // el usuario o el estado de carga, no por re-renders del árbol superior.
  const value = useMemo(
    () => ({
      authenticatedUser,
      isSuperUserMode,
      isJefeMode,
      isDirectivoMode,
      isAdminTesterMode,
      isReporteroMode,
      isAuthLoading,
      login,
      logout,
      completePasswordChange,
      refreshAuth,
    }),
    [
      authenticatedUser,
      isSuperUserMode,
      isJefeMode,
      isDirectivoMode,
      isAdminTesterMode,
      isReporteroMode,
      isAuthLoading,
      login,
      logout,
      completePasswordChange,
      refreshAuth,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
