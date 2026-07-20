import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "./layout/ThemeToggle";
import { useAuth } from "../contexts/AuthContext";
import { useModal } from "../contexts/ModalContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAuthLogic } from "../hooks/useAuthLogic";
import { useMoodleAutoLogin } from "../hooks/useMoodleAutoLogin";
import type { MoodleOnboardingProfile } from "../hooks/useMoodleAutoLogin";
import { useCampusOnboarding } from "../hooks/useCampusOnboarding";
import CampusEntryLoader from "./CampusEntryLoader";
import {
  FIELD_NOMBRE_SEPARADO_ESTUDIANTES,
  FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
} from "../constants";
import { toTitleCase } from "../utils/formatters";

/* ── Íconos de trazo (lucide-style) — misma firma que ds/Icon ── */
type AuthIconName =
  | "idcard"
  | "fingerprint"
  | "mail"
  | "phone"
  | "lock"
  | "lockreset"
  | "eye"
  | "eyeoff"
  | "arrow"
  | "shieldcheck"
  | "chart"
  | "cap"
  | "check"
  | "alert";

const AUTH_PATHS: Record<AuthIconName, React.ReactNode> = {
  idcard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2.5" />
      <path d="M14 10h4M14 14h4" />
    </>
  ),
  fingerprint: (
    <>
      <path d="M5 11a7 7 0 0 1 14 0" />
      <path d="M8.5 11a3.5 3.5 0 0 1 7 0c0 4-.5 7-1.5 9" />
      <path d="M12 11v3c0 3 .5 5 1 7" />
      <path d="M8 13c0 4-.7 6.5-1.5 8" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  lockreset: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7-2.5" />
      <path d="M15 3v3h-3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeoff: (
    <>
      <path d="M10.7 5.1A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2.2 2.9" />
      <path d="M6.6 6.6A13 13 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M2 2l20 20" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </>
  ),
  shieldcheck: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-3 3 3 5-6" />
    </>
  ),
  cap: (
    <>
      <path d="M12 4 2 9l10 5 10-5-10-5z" />
      <path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  alert: (
    <>
      <path d="M10.3 4 3.3 16A2 2 0 0 0 5 19h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
};

const AuthIcon: React.FC<{ name: AuthIconName; size?: number; strokeWidth?: number }> = ({
  name,
  size = 18,
  strokeWidth = 1.7,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {AUTH_PATHS[name]}
  </svg>
);

/* ── Campo editorial (scope .ed) ── */
interface EdInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: AuthIconName;
  hasError?: boolean;
  reveal?: { shown: boolean; toggle: () => void };
}
const EdInput: React.FC<EdInputProps> = ({ icon, hasError, reveal, className = "", ...props }) => (
  <div className="ed-field">
    <span className="ed-field__icon">
      <AuthIcon name={icon} size={18} />
    </span>
    <input
      {...props}
      name={props.name ?? props.id}
      className={`ed-input ${hasError ? "ed-input--error" : ""} ${className}`}
    />
    {reveal && (
      <button
        type="button"
        onClick={reveal.toggle}
        className="ed-field__reveal"
        aria-label={reveal.shown ? "Ocultar" : "Mostrar"}
      >
        <AuthIcon name={reveal.shown ? "eyeoff" : "eye"} size={19} />
      </button>
    )}
  </div>
);

/* ── Bienvenida / alta desde el campus Moodle ──
   Se muestra cuando el alumno entró embebido desde Moodle y su perfil del
   campus no matchea ninguna cuenta del panel (ver useMoodleAutoLogin).
   Nombre, apellido, correo y DNI vienen de Moodle; completa legajo, celular
   y contraseña. Componente propio (no un render-fn de Auth) para que
   useCampusOnboarding capture el perfil al montarse. */
const CampusWelcome: React.FC<{
  profile: MoodleOnboardingProfile;
  onGoToLogin: () => void;
}> = ({ profile, onGoToLogin }) => {
  const ob = useCampusOnboarding(profile);
  const [showPassword, setShowPassword] = useState(false);

  const firstName = toTitleCase(profile.firstname.trim()) || "";
  const fullName = toTitleCase(`${profile.firstname} ${profile.lastname}`.trim());

  return (
    <form onSubmit={ob.submit} className="space-y-6 animate-fade-in-up">
      <div className="text-left mb-6">
        <span className="ed-eyebrow block mb-3">Primer ingreso · Campus UFLO</span>
        <h2 className="au-h text-[40px]">
          ¡Hola{firstName ? ", " : ""}
          <em>{firstName || "bienvenido/a"}!</em>
        </h2>
        <p className="text-[var(--ink-muted)] mt-2 text-[15.5px] leading-relaxed">
          Es tu primera vez en Mi Panel. Ya tomamos tus datos del campus — completá lo que falta y
          en un minuto estás adentro.
        </p>
      </div>

      {/* Datos que llegaron del campus (solo lectura) */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-sunken)] px-4 py-3 space-y-1.5">
        {fullName && (
          <p className="text-sm text-[var(--ink)] font-semibold flex items-center gap-2">
            <AuthIcon name="idcard" size={16} /> {fullName}
          </p>
        )}
        <p className="text-sm text-[var(--ink-muted)] flex items-center gap-2 break-all">
          <AuthIcon name="mail" size={16} /> {profile.email}
        </p>
        {ob.dniLocked && (
          <p className="text-sm text-[var(--ink-muted)] flex items-center gap-2">
            <AuthIcon name="fingerprint" size={16} /> DNI {ob.dni}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <EdInput
          id="campus-legajo"
          type="text"
          value={ob.legajo}
          onChange={(e) => ob.setLegajo(e.target.value)}
          placeholder="Número de Legajo"
          icon="idcard"
          disabled={ob.isLoading}
          inputMode="numeric"
          autoFocus
        />
        {!ob.dniLocked && (
          <EdInput
            id="campus-dni"
            type="text"
            value={ob.dni}
            onChange={(e) => ob.setDni(e.target.value)}
            placeholder="DNI (sin puntos)"
            icon="fingerprint"
            disabled={ob.isLoading}
            inputMode="numeric"
          />
        )}
        <EdInput
          id="campus-telefono"
          type="tel"
          value={ob.telefono}
          onChange={(e) => ob.setTelefono(e.target.value)}
          placeholder="Número de Celular"
          icon="phone"
          disabled={ob.isLoading}
        />
        <EdInput
          id="campus-password"
          type={showPassword ? "text" : "password"}
          value={ob.password}
          onChange={(e) => ob.setPassword(e.target.value)}
          placeholder="Nueva Contraseña (mín. 6 caracteres)"
          icon="lock"
          disabled={ob.isLoading}
          reveal={{ shown: showPassword, toggle: () => setShowPassword(!showPassword) }}
        />
        <EdInput
          id="campus-confirm"
          type="password"
          value={ob.confirmPassword}
          onChange={(e) => ob.setConfirmPassword(e.target.value)}
          placeholder="Confirmar Contraseña"
          icon="lock"
          disabled={ob.isLoading}
        />
      </div>

      {ob.error && (
        <div
          aria-live="assertive"
          className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl animate-shake"
        >
          <span className="text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5">
            <AuthIcon name="alert" size={18} />
          </span>
          <p className="text-sm text-rose-600 dark:text-rose-300 leading-snug font-medium">
            {ob.error}
          </p>
        </div>
      )}

      <div className="pt-1">
        <button type="submit" disabled={ob.isLoading} className="ed-btn-primary">
          {ob.isLoading ? (
            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>Crear mi cuenta</span>
          )}
        </button>
      </div>

      <div className="text-center pt-1">
        <button
          type="button"
          onClick={onGoToLogin}
          className={`w-full text-center text-sm font-semibold transition-colors p-2 ${
            ob.hasExistingAccount
              ? "text-[var(--ink)] underline underline-offset-4"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          Ya tengo cuenta — iniciar sesión
        </button>
      </div>
    </form>
  );
};

interface AuthProps {
  inline?: boolean;
}

const Auth: React.FC<AuthProps> = ({ inline = false }) => {
  const { login } = useAuth();
  const { showModal } = useModal();
  const { resolvedTheme } = useTheme();

  const {
    mode,
    setMode,
    migrationStep,
    registerStep,
    resetStep,
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
    verificationData,
    debugLogs,
    clearLogs,
    handleVerificationDataChange,
    handleFormSubmit,
    foundStudent,
  } = useAuthLogic({ login, showModal });

  const [showPassword, setShowPassword] = useState(false);

  // Ingreso automático desde el campus Moodle (si el email/DNI matchea un
  // estudiante) u onboarding (si es un alumno del campus sin cuenta).
  const { status: autoLoginStatus, onboarding } = useMoodleAutoLogin();
  // El alumno puede salir de la bienvenida hacia el login normal (p. ej. si ya
  // tiene cuenta con otro correo).
  const [campusWelcomeDismissed, setCampusWelcomeDismissed] = useState(false);
  const campusOnboardingActive = !!onboarding && !campusWelcomeDismissed && mode === "login";

  const [embedded] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true; // cross-origin ⇒ embebidos
    }
  });

  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const copyLogsToClipboard = () => {
    const logsText = debugLogs.join("\n");
    navigator.clipboard.writeText(logsText).then(() => {
      showModal("Copiado", "Los logs técnicos han sido copiados al portapapeles.");
    });
  };

  const getDisplayName = () => {
    if (!foundStudent) return "";
    const nombre = foundStudent[FIELD_NOMBRE_SEPARADO_ESTUDIANTES];
    const apellido = foundStudent[FIELD_APELLIDO_SEPARADO_ESTUDIANTES];
    if (nombre && apellido) return toTitleCase(`${nombre} ${apellido}`);
    return toTitleCase(foundStudent[FIELD_NOMBRE_ESTUDIANTES] || "");
  };

  const submitBtn = (label: string, withArrow = false) => (
    <button type="submit" disabled={isLoading} className="ed-btn-primary">
      {isLoading ? (
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <span>{label}</span>
          {withArrow && (
            <span className="transition-transform group-hover:translate-x-1">
              <AuthIcon name="arrow" size={20} strokeWidth={2} />
            </span>
          )}
        </>
      )}
    </button>
  );

  const backLink = (label: string) => (
    <button
      type="button"
      onClick={() => setMode("login")}
      className="w-full text-center text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors p-2"
    >
      {label}
    </button>
  );

  // --- SUB-COMPONENTES DE FORMULARIO ---

  const renderLogin = () => (
    <>
      <div className="au-loginhead text-left mb-9 hidden lg:block">
        <span className="ed-eyebrow block mb-4">Acceso · Panel PPS</span>
        <h2 className="au-h text-[52px]">
          Hola <em>de nuevo.</em>
        </h2>
        <p className="text-[var(--ink-muted)] mt-3 text-[15.5px] leading-relaxed max-w-sm">
          Ingresá con tu legajo para ver tus prácticas, convocatorias y horas acreditadas.
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="au-loginform space-y-6">
        <div className="au-loginfields space-y-5">
          <EdInput
            id="legajo"
            type="text"
            value={legajo}
            onChange={(e) => setLegajo(e.target.value)}
            placeholder="Número de Legajo"
            icon="idcard"
            disabled={isLoading}
            autoComplete="username"
            autoFocus
          />

          <EdInput
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            icon="lock"
            disabled={isLoading}
            autoComplete="current-password"
            hasError={fieldError === "password"}
            reveal={{ shown: showPassword, toggle: () => setShowPassword(!showPassword) }}
          />

          <div className="flex justify-between items-center px-1">
            <label
              htmlFor="remember-me"
              className="flex items-center gap-2.5 cursor-pointer group select-none"
            >
              <div className="relative flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="ed-check peer"
                />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--bg-elevated)] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                  <AuthIcon name="check" size={13} strokeWidth={2.6} />
                </span>
              </div>
              <span className="text-sm font-semibold text-[var(--ink-muted)] group-hover:text-[var(--ink)] transition-colors">
                Recordarme
              </span>
            </label>

            <button
              type="button"
              onClick={() => setMode("recover")}
              className="text-sm font-bold text-[var(--accent-text)] hover:opacity-80 transition-opacity"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>

        <div className="group pt-2">{submitBtn("Iniciar Sesión", true)}</div>

        <div className="au-loginjoin mt-8 flex items-center justify-center pt-8 border-t border-[var(--line)]">
          <p className="text-[var(--ink-muted)] text-sm font-medium">
            ¿Primera vez aquí?{" "}
            <button
              type="button"
              onClick={() => setMode("register")}
              className="font-bold text-[var(--ink)] hover:underline transition"
            >
              Crear cuenta de estudiante
            </button>
          </p>
        </div>
      </form>
    </>
  );

  const renderRegister = () => (
    <form onSubmit={handleFormSubmit} className="space-y-6 animate-fade-in-up">
      {registerStep === 1 ? (
        <>
          <div className="text-left mb-8">
            <span className="ed-eyebrow block mb-3">Registro · Paso 1 de 2</span>
            <h2 className="au-h text-[40px]">
              Crear <em>cuenta.</em>
            </h2>
            <p className="text-[var(--ink-muted)] mt-2 text-[15.5px] leading-relaxed">
              Ingresa tu legajo para verificar si estás habilitado.
            </p>
          </div>
          <EdInput
            id="legajo"
            type="text"
            value={legajo}
            onChange={(e) => setLegajo(e.target.value)}
            placeholder="Número de Legajo"
            icon="idcard"
            disabled={isLoading}
            autoFocus
          />
          <div className="pt-2">{submitBtn("Verificar")}</div>
        </>
      ) : (
        <>
          <div className="text-left mb-8">
            <span className="ed-eyebrow block mb-3">Registro · Paso 2 de 2</span>
            <h2 className="au-h text-[40px]">
              ¡Hola, <em>{getDisplayName()}!</em>
            </h2>
            <p className="text-[var(--ink-muted)] mt-2 text-[15.5px] leading-relaxed">
              Confirma tus datos y crea una contraseña segura.
            </p>
          </div>
          <div className="space-y-4">
            <EdInput
              name="dni"
              type="text"
              placeholder="DNI (sin puntos)"
              icon="fingerprint"
              value={verificationData.dni}
              onChange={handleVerificationDataChange}
              disabled={isLoading}
              inputMode="numeric"
              autoFocus
            />
            <EdInput
              name="correo"
              type="email"
              placeholder="Correo electrónico"
              icon="mail"
              value={verificationData.correo}
              onChange={handleVerificationDataChange}
              disabled={isLoading}
            />
            <EdInput
              name="telefono"
              type="tel"
              placeholder="Número de Celular"
              icon="phone"
              value={verificationData.telefono}
              onChange={handleVerificationDataChange}
              disabled={isLoading}
            />
            <EdInput
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva Contraseña (mín. 6 caracteres)"
              icon="lock"
              disabled={isLoading}
            />
            <EdInput
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar Contraseña"
              icon="lock"
              disabled={isLoading}
            />
          </div>
          <div className="pt-2">{submitBtn("Crear Cuenta")}</div>
        </>
      )}
      <div className="text-center pt-2">{backLink("Volver a Iniciar Sesión")}</div>
    </form>
  );

  const renderMigration = () => (
    <form onSubmit={handleFormSubmit} className="space-y-6 animate-fade-in-up">
      {migrationStep === 1 ? (
        <>
          <div className="text-left mb-8">
            <span className="ed-eyebrow block mb-3">Activación · Paso 1 de 2</span>
            <h2 className="au-h text-[40px]">
              Activá <em>tu acceso.</em>
            </h2>
            <p className="text-[var(--ink-muted)] mt-2 text-[15.5px] leading-relaxed">
              Valida tu identidad para configurar el nuevo acceso.
            </p>
          </div>
          <div className="space-y-4">
            <EdInput
              name="dni"
              type="text"
              placeholder="DNI (sin puntos)"
              icon="fingerprint"
              value={verificationData.dni}
              onChange={handleVerificationDataChange}
              disabled={isLoading}
              autoFocus
            />
            <EdInput
              name="correo"
              type="email"
              placeholder="Correo registrado"
              icon="mail"
              value={verificationData.correo}
              onChange={handleVerificationDataChange}
              disabled={isLoading}
            />
          </div>
          <div className="pt-2">{submitBtn("Validar")}</div>
        </>
      ) : (
        <>
          <div className="text-left mb-8">
            <span className="ed-eyebrow block mb-3">Activación · Paso 2 de 2</span>
            <h2 className="au-h text-[40px]">
              Identidad <em>verificada.</em>
            </h2>
            <p className="text-[var(--ink-muted)] mt-2 text-[15.5px] leading-relaxed">
              Crea tu nueva contraseña.
            </p>
          </div>
          <div className="space-y-4">
            <EdInput
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva Contraseña"
              icon="lock"
              disabled={isLoading}
              autoFocus
            />
            <EdInput
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar Contraseña"
              icon="lock"
              disabled={isLoading}
            />
          </div>
          <div className="pt-2">{submitBtn("Establecer")}</div>
        </>
      )}
      <div className="text-center pt-2">{backLink("Cancelar")}</div>
    </form>
  );

  const renderRecover = () => (
    <form onSubmit={handleFormSubmit} className="space-y-8 animate-fade-in-up">
      <div className="text-left">
        <span className="ed-eyebrow block mb-4">Recuperación de acceso</span>
        <h2 className="au-h text-[40px]">
          Recuperar <em>acceso.</em>
        </h2>
        <p className="text-[var(--ink-muted)] mt-2 text-[15.5px] leading-relaxed">
          {resetStep === "verify"
            ? "Completa los datos para validar tu identidad."
            : resetStep === "reset_password"
              ? "Identidad confirmada. Ingresa tu nueva clave."
              : "¡Proceso completado con éxito!"}
        </p>
      </div>

      {resetStep === "verify" && (
        <div className="space-y-4 animate-fade-in">
          <EdInput
            id="rec-legajo"
            type="text"
            value={legajo}
            onChange={(e) => setLegajo(e.target.value)}
            placeholder="Número de Legajo"
            icon="idcard"
            disabled={isLoading}
          />
          <EdInput
            name="dni"
            type="text"
            placeholder="DNI"
            icon="fingerprint"
            value={verificationData.dni}
            onChange={handleVerificationDataChange}
            disabled={isLoading}
            inputMode="numeric"
          />
          <EdInput
            name="correo"
            type="email"
            placeholder="Correo registrado"
            icon="mail"
            value={verificationData.correo}
            onChange={handleVerificationDataChange}
            disabled={isLoading}
          />
          <EdInput
            name="telefono"
            type="tel"
            placeholder="Celular registrado"
            icon="phone"
            value={verificationData.telefono}
            onChange={handleVerificationDataChange}
            disabled={isLoading}
          />
        </div>
      )}

      {resetStep === "reset_password" && (
        <div className="space-y-5 animate-fade-in">
          <EdInput
            id="new-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva Contraseña"
            icon="lock"
            disabled={isLoading}
            autoFocus
            reveal={{ shown: showPassword, toggle: () => setShowPassword(!showPassword) }}
          />
          <EdInput
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repetir Contraseña"
            icon="lockreset"
            disabled={isLoading}
          />
        </div>
      )}

      {resetStep === "success" && (
        <div className="bg-[var(--tint)] border border-[var(--accent-soft)] p-8 rounded-2xl text-center animate-fade-in">
          <div className="mx-auto bg-[var(--accent)] text-[var(--on-accent)] w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <AuthIcon name="check" size={30} strokeWidth={2.4} />
          </div>
          <h3 className="au-h text-3xl text-[var(--ink)] mb-2">¡Listo!</h3>
          <p className="text-[var(--ink-soft)] mb-8 font-medium text-sm">Contraseña actualizada.</p>
          <button type="button" onClick={() => setMode("login")} className="ed-btn-primary">
            Iniciar Sesión
          </button>
        </div>
      )}

      {resetStep !== "success" && (
        <div className="pt-2 space-y-3">
          {submitBtn(resetStep === "verify" ? "Validar Identidad" : "Establecer Contraseña")}
          {backLink("Cancelar")}
        </div>
      )}
    </form>
  );

  const renderContent = () => {
    if (campusOnboardingActive && onboarding) {
      return (
        <CampusWelcome profile={onboarding} onGoToLogin={() => setCampusWelcomeDismissed(true)} />
      );
    }
    switch (mode) {
      case "login":
        return renderLogin();
      case "register":
        return renderRegister();
      case "migration":
        return renderMigration();
      case "recover":
        return renderRecover();
      default:
        return renderLogin();
    }
  };

  const features: { icon: AuthIconName; text: string; desc: string }[] = [
    { icon: "shieldcheck", text: "Gestión 100% Digital", desc: "Olvídate del papel." },
    { icon: "chart", text: "Seguimiento Real", desc: "Tu progreso al instante." },
    { icon: "cap", text: "Acreditación Directa", desc: "Vinculación con SAC." },
  ];

  // Alerta de error (reutilizable en desktop y mobile)
  const errorAlert = error ? (
    <div className="flex items-start gap-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl shadow-sm animate-shake transition duration-300">
      <div className="p-2 bg-white dark:bg-rose-950 rounded-full text-rose-500 dark:text-rose-400 shadow-sm border border-rose-100 dark:border-rose-900/50 flex-shrink-0">
        <AuthIcon name="alert" size={18} />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200 mb-1">Atención</h4>
        <div className="space-y-2">
          <p className="text-sm text-rose-600 dark:text-rose-300 leading-snug font-medium whitespace-pre-line">
            {error}
          </p>
          {mode === "recover" && resetStep === "reset_password" && (
            <details className="group">
              <summary className="text-xs font-bold text-rose-700 dark:text-rose-300 cursor-pointer hover:text-rose-900 dark:hover:text-rose-100 transition-colors select-none">
                🔧 Ver información técnica
              </summary>
              <div className="mt-2 p-3 bg-rose-100/50 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800">
                <p className="text-xs text-rose-700 dark:text-rose-300 font-mono leading-relaxed">
                  <span className="font-bold">Código de referencia:</span> REC-001
                  <br />
                  <span className="font-bold">Paso:</span> Restablecer contraseña
                  <br />
                  <span className="font-bold">Acción recomendada:</span> Si el error persiste,
                  contacta a blas.rivera@uflouniversidad.edu.ar con tu número de legajo.
                  <br />
                  <span className="font-bold">Posibles causas:</span>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    <li>El servidor no está respondiendo correctamente</li>
                    <li>Hay un problema con la base de datos</li>
                    <li>La sesión ha expirado (vuelve a validar)</li>
                  </ul>
                </p>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const debugBlock =
    debugLogs.length > 0 ? (
      <div className="mt-4">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer select-none">
            <span className="material-icons text-amber-500 !text-lg">bug_report</span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Ver Logs de Diagnóstico ({debugLogs.length})
            </span>
          </summary>
          <div className="mt-3 p-4 bg-[var(--bg-sunken)] rounded-xl border border-[var(--line)]">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-[var(--line)]">
              <span className="text-xs font-bold text-[var(--ink-muted)] uppercase tracking-wider">
                Log del sistema
              </span>
              <div className="flex gap-2">
                <button
                  onClick={copyLogsToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--line-strong)] rounded-lg text-xs font-bold text-[var(--ink-soft)] hover:bg-[var(--bg-sunken)] transition-colors"
                >
                  <span className="material-icons !text-sm">content_copy</span>
                  Copiar
                </button>
                <button
                  onClick={clearLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-elevated)] border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                >
                  <span className="material-icons !text-sm">delete</span>
                  Borrar
                </button>
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
              <pre className="text-xs font-mono text-[var(--ink-soft)] leading-relaxed whitespace-pre-wrap break-all">
                {debugLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`mb-1 ${log.includes("[ERROR]") ? "text-red-600 dark:text-red-400" : log.includes("[SUCCESS]") ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                  >
                    {log}
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </details>
      </div>
    ) : null;

  // Marca "Mi Panel" (mismo mark editorial que el header del panel)
  const brandMark = (
    <div className="mp-mark">
      <div className="mp-logo">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <rect x="3" y="10" width="4" height="11" rx="1.5" fill="currentColor" />
          <rect x="10" y="4" width="4" height="17" rx="1.5" fill="currentColor" />
          <rect x="17" y="14" width="4" height="7" rx="1.5" fill="currentColor" />
        </svg>
      </div>
      <span className="mp-brand">
        Mi&nbsp;<b>Panel</b>
      </span>
    </div>
  );

  // ===== LOGIN MOBILE — pantalla completa "Ingresá a tu práctica." (top-aligned) =====
  const renderMobileLogin = () => (
    <div className="au-mlogin">
      <span className="au-orb au-orb--1" aria-hidden="true" />
      <span className="au-orb au-orb--2" aria-hidden="true" />
      <span className="au-orb au-orb--3" aria-hidden="true" />

      <header className="au-mtop">
        {brandMark}
        <span className="au-mtag">PPS · 2026</span>
      </header>

      <form onSubmit={handleFormSubmit} className="au-mbody">
        <div className="au-mcenter">
          <div className="au-mhead animate-fade-in-up">
            <span className="au-eyebrow">Mi Panel · Estudiantes</span>
            <h1 className="au-title mt-3 text-[clamp(40px,12vw,52px)]">
              Ingresá a
              <br />
              tu <span className="au-grad">práctica.</span>
            </h1>
          </div>

          <div className="mt-10 space-y-6 animate-fade-in-up">
            <div className="au-mfield">
              <label htmlFor="m-legajo" className="au-mlabel">
                Legajo
              </label>
              <input
                id="m-legajo"
                name="legajo"
                className="au-min"
                type="text"
                inputMode="numeric"
                value={legajo}
                onChange={(e) => setLegajo(e.target.value)}
                placeholder="Nº de legajo"
                autoComplete="username"
                disabled={isLoading}
                autoFocus
              />
              <span className="au-mhelp">Usá tu legajo institucional.</span>
            </div>

            <div className="au-mfield">
              <label htmlFor="m-pass" className="au-mlabel">
                Contraseña
              </label>
              <div className="au-mpass">
                <input
                  id="m-pass"
                  name="password"
                  className="au-min"
                  style={{ paddingRight: 48 }}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="au-meye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <AuthIcon name={showPassword ? "eyeoff" : "eye"} size={19} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label
                htmlFor="m-remember-me"
                className="flex items-center gap-2.5 cursor-pointer group select-none"
              >
                <div className="relative flex items-center">
                  <input
                    id="m-remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                    className="ed-check peer"
                  />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--bg-elevated)] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                    <AuthIcon name="check" size={13} strokeWidth={2.6} />
                  </span>
                </div>
                <span className="text-sm font-semibold text-[var(--ink-muted)] group-hover:text-[var(--ink)] transition-colors">
                  Recordarme
                </span>
              </label>
              <button type="button" className="au-mlink" onClick={() => setMode("recover")}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {(errorAlert || debugBlock) && (
            <div className="mt-6 space-y-3" aria-live="assertive">
              {errorAlert}
              {debugBlock}
            </div>
          )}
        </div>

        <div className="au-mctabar">
          <button type="submit" className="au-mcta" disabled={isLoading}>
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Entrar a mi panel</span>
                <AuthIcon name="arrow" size={19} strokeWidth={2.2} />
              </>
            )}
          </button>
          <p className="au-mfoot">
            ¿No tenés cuenta?{" "}
            <button type="button" onClick={() => setMode("register")}>
              Crear cuenta
            </button>
          </p>
        </div>
      </form>
    </div>
  );

  // Mientras se intenta el ingreso automático desde el campus Moodle, mostramos
  // un loader en vez del formulario para evitar el parpadeo del login. Es el
  // MISMO loader (CampusEntryLoader) que muestra StudentDashboard durante la
  // carga de sesión, para que se vea un solo spinner continuo.
  if (autoLoginStatus === "checking") {
    return <CampusEntryLoader inline={inline} resolvedTheme={resolvedTheme} />;
  }

  if (inline) {
    /* Versión embebida bajo el topbar del panel: mismo dúo panel de marca +
       formulario del login original, adaptado al flujo (sin fixed/100dvh). */
    return (
      <div
        className="ed au-embed animate-fade-in-up"
        data-mode={resolvedTheme}
        data-accent="teal"
        data-auth-mode={mode}
        style={{ color: "var(--ink)" }}
      >
        <aside className="au-brand au-embed__brand">
          <div className="relative z-10">{brandMark}</div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="au-eyebrow">Mi Panel · Estudiantes</span>
              <span className="au-rule" />
            </div>
            <h2 className="au-title text-[clamp(38px,3.4vw,52px)]">
              Tu práctica
              <br />
              empieza <span className="au-grad">acá.</span>
            </h2>
            <p className="au-sub mt-5 text-[15.5px] leading-relaxed max-w-sm">
              Centralizá tus prácticas, inscripciones y acreditaciones en una sola plataforma —
              clara, ordenada y siempre al día.
            </p>
          </div>

          <div className="relative z-10 max-w-sm">
            {features.map((item) => (
              <div key={item.text} className="au-feat">
                <span className="au-feat__ic">
                  <AuthIcon name={item.icon} size={19} />
                </span>
                <div>
                  <h4 className="au-feat__t">{item.text}</h4>
                  <p className="au-feat__d">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="au-embed__form">
          <div className="w-full max-w-md mx-auto">
            {renderContent()}

            {errorAlert && (
              <div aria-live="assertive" className="mt-6">
                {errorAlert}
              </div>
            )}

            {debugBlock}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="ed fixed inset-0 w-full h-[100dvh] overflow-hidden"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      {/* ============ MOBILE ============ */}
      <div
        className={`${embedded && !isNarrow ? "hidden" : "lg:hidden"} h-full overflow-y-auto overflow-x-hidden custom-scrollbar`}
      >
        {mode === "login" && !campusOnboardingActive ? (
          renderMobileLogin()
        ) : (
          <div className="au-mlogin">
            <span className="au-orb au-orb--1" aria-hidden="true" />
            <span className="au-orb au-orb--2" aria-hidden="true" />
            <span className="au-orb au-orb--3" aria-hidden="true" />
            <header className="au-mtop">
              {brandMark}
              <ThemeToggle />
            </header>
            <div className="au-mbody" style={{ paddingTop: 28, paddingBottom: 32 }}>
              <div className="w-full max-w-md mx-auto">
                {renderContent()}
                {(errorAlert || debugBlock) && (
                  <div className="mt-6 space-y-3" aria-live="assertive">
                    {errorAlert}
                    {debugBlock}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ DESKTOP ============ */}
      <div
        className={`${embedded && !isNarrow ? "grid" : "hidden lg:grid"} h-full grid-cols-[1.2fr_0.8fr]`}
      >
        {/* ===== PANEL DE MARCA (desktop) — gradiente UFLO inmersivo ===== */}
        <aside className="au-brand relative flex flex-col justify-between p-12 xl:p-16">
          <div className="relative z-10">{brandMark}</div>

          <div className="relative z-10 max-w-xl">
            <div className="flex items-center gap-3 mb-7">
              <span className="au-eyebrow">Mi Panel · Estudiantes</span>
              <span className="au-rule" />
            </div>
            <h1 className="au-title text-[clamp(52px,5vw,76px)]">
              Tu práctica
              <br />
              empieza <span className="au-grad">acá.</span>
            </h1>
            <p className="au-sub mt-6 text-[17px] leading-relaxed max-w-md">
              Centralizá tus prácticas, inscripciones y acreditaciones en una sola plataforma —
              clara, ordenada y siempre al día.
            </p>
          </div>

          <div className="relative z-10">
            <div className="max-w-md">
              {features.map((item) => (
                <div key={item.text} className="au-feat">
                  <span className="au-feat__ic">
                    <AuthIcon name={item.icon} size={19} />
                  </span>
                  <div>
                    <h4 className="au-feat__t">{item.text}</h4>
                    <p className="au-feat__d">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <p className="au-sub text-[10px] font-semibold uppercase tracking-[0.14em] leading-relaxed">
                Prácticas Profesionales Supervisadas
                <br />
                Psicología
              </p>
            </div>
          </div>
        </aside>

        {/* ===== PANEL DE FORMULARIO ===== */}
        <main className="relative flex flex-col h-full overflow-y-auto lg:overflow-hidden overflow-x-hidden custom-scrollbar">
          {/* Theme toggle (solo desktop) */}
          <div className="absolute top-6 right-8 z-20 flex items-center gap-3">
            <ThemeToggle />
          </div>

          {/* FORM */}
          <div className="flex-1 flex flex-col justify-center px-10 xl:px-16 py-8">
            <div className="w-full max-w-md mx-auto">
              {renderContent()}

              {errorAlert && (
                <div aria-live="assertive" className="mt-6">
                  {errorAlert}
                </div>
              )}

              {debugBlock}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Auth;
