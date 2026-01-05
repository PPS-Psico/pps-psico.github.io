
import React, { useState } from 'react';
import MiPanelLogo from './MiPanelLogo';
import UfloLogo from './UfloLogo';
import ThemeToggle from './layout/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import Input from './ui/Input';
import { useAuthLogic } from '../hooks/useAuthLogic';
import {
    FIELD_NOMBRE_SEPARADO_ESTUDIANTES,
    FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
    FIELD_NOMBRE_ESTUDIANTES
} from '../constants';
import { toTitleCase } from '../utils/formatters';
import Button from './ui/Button';

const Auth: React.FC = () => {
    const { login } = useAuth();
    const { showModal } = useModal();
    const { resolvedTheme } = useTheme();

    const {
        mode, setMode,
        migrationStep,
        registerStep,
        resetStep,
        legajo, setLegajo,
        password, setPassword,
        confirmPassword, setConfirmPassword,
        rememberMe, setRememberMe,
        isLoading, error, fieldError,
        verificationData, handleVerificationDataChange,
        handleFormSubmit,
        foundStudent
    } = useAuthLogic({ login, showModal });

    const [showPassword, setShowPassword] = useState(false);

    const getDisplayName = () => {
        if (!foundStudent) return '';
        const nombre = foundStudent[FIELD_NOMBRE_SEPARADO_ESTUDIANTES];
        const apellido = foundStudent[FIELD_APELLIDO_SEPARADO_ESTUDIANTES];
        if (nombre && apellido) return toTitleCase(`${nombre} ${apellido}`);
        return toTitleCase(foundStudent[FIELD_NOMBRE_ESTUDIANTES] || '');
    };

    // --- SUB-COMPONENTES DE FORMULARIO ---

    const renderLogin = () => (
        <>
            <div className="text-left mb-10">
                <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    Hola de nuevo.
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg font-medium animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    Ingresa a tu panel académico.
                </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                    <Input
                        id="legajo"
                        type="text"
                        value={legajo}
                        onChange={(e) => setLegajo(e.target.value)}
                        placeholder="Número de Legajo"
                        icon="badge"
                        disabled={isLoading}
                        autoComplete="username"
                        autoFocus
                        className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 h-14 font-semibold"
                    />

                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                            icon="lock"
                            disabled={isLoading}
                            autoComplete="current-password"
                            className={`bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 h-14 font-semibold ${fieldError === 'password' ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' : ''}`}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10" aria-label={showPassword ? 'Ocultar' : 'Mostrar'}>
                            <span className="material-icons !text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                    </div>

                    <div className="flex justify-between items-center px-1">
                        <label htmlFor="remember-me" className="flex items-center gap-2.5 cursor-pointer group select-none">
                            <div className="relative flex items-center">
                                <input id="remember-me" name="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={isLoading} className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 dark:border-slate-600 bg-transparent transition-all checked:border-slate-900 checked:bg-slate-900 dark:checked:border-white dark:checked:bg-white" />
                                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white dark:text-slate-900 opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                                    <span className="material-icons !text-[14px] font-bold">check</span>
                                </span>
                            </div>
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Recordarme</span>
                        </label>

                        <button type="button" onClick={() => setMode('recover')} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>
                </div>

                <div className="pt-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group w-full relative overflow-hidden bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg py-4 px-6 rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/20 dark:hover:shadow-white/10 hover:-translate-y-1 active:scale-95 disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                        <div className="relative flex items-center justify-center gap-3">
                            {isLoading ? (
                                <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>Iniciar Sesión</span>
                                    <span className="material-icons !text-2xl transition-transform group-hover:translate-x-1">arrow_forward</span>
                                </>
                            )}
                        </div>
                    </button>
                </div>

                <div className="mt-8 flex items-center justify-center pt-8 border-t border-slate-100 dark:border-slate-800 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        ¿Primera vez aquí?{' '}
                        <button
                            type="button"
                            onClick={() => setMode('register')}
                            className="font-bold text-slate-900 dark:text-white hover:underline transition-all"
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
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Crear Cuenta</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base leading-relaxed">
                            Ingresa tu legajo para verificar si estás habilitado.
                        </p>
                    </div>
                    <Input id="legajo" type="text" value={legajo} onChange={(e) => setLegajo(e.target.value)} placeholder="Número de Legajo" icon="badge" disabled={isLoading} autoFocus className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                    <div className="pt-2">
                        <Button type="submit" isLoading={isLoading} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-14 text-lg rounded-2xl" size="lg">Verificar</Button>
                    </div>
                </>
            ) : (
                <>
                    <div className="text-left mb-8">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">¡Hola, {getDisplayName()}!</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base leading-relaxed">
                            Confirma tus datos y crea una contraseña segura.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <Input name="dni" type="text" placeholder="DNI (sin puntos)" icon="fingerprint" value={verificationData.dni} onChange={handleVerificationDataChange} disabled={isLoading} inputMode="numeric" autoFocus className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                        <Input name="correo" type="email" placeholder="Correo electrónico" icon="email" value={verificationData.correo} onChange={handleVerificationDataChange} disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                        <Input name="telefono" type="tel" placeholder="Número de Celular" icon="smartphone" value={verificationData.telefono} onChange={handleVerificationDataChange} disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva Contraseña (mín. 6 caracteres)" icon="lock" disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                        <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar Contraseña" icon="lock" disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                    </div>
                    <div className="pt-4">
                        <Button type="submit" isLoading={isLoading} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-14 text-lg rounded-2xl" size="lg">Crear Cuenta</Button>
                    </div>
                </>
            )}
            <div className="text-center pt-2">
                <button type="button" onClick={() => setMode('login')} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors p-2">
                    Volver a Iniciar Sesión
                </button>
            </div>
        </form>
    );

    const renderMigration = () => (
        <form onSubmit={handleFormSubmit} className="space-y-6 animate-fade-in-up">
            {migrationStep === 1 ? (
                <>
                    <div className="text-left mb-8">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Activación</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base leading-relaxed">
                            Valida tu identidad para configurar el nuevo acceso.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <Input name="dni" type="text" placeholder="DNI (sin puntos)" icon="fingerprint" value={verificationData.dni} onChange={handleVerificationDataChange} disabled={isLoading} autoFocus className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                        <Input name="correo" type="email" placeholder="Correo registrado" icon="email" value={verificationData.correo} onChange={handleVerificationDataChange} disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                    </div>
                    <div className="pt-4">
                        <Button type="submit" isLoading={isLoading} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-14 text-lg rounded-2xl" size="lg">Validar</Button>
                    </div>
                </>
            ) : (
                <>
                    <div className="text-left mb-8">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Identidad Verificada</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-base leading-relaxed">
                            Crea tu nueva contraseña.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva Contraseña" icon="lock" disabled={isLoading} autoFocus className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                        <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar Contraseña" icon="lock" disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                    </div>
                    <div className="pt-4">
                        <Button type="submit" isLoading={isLoading} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-14 text-lg rounded-2xl" size="lg">Establecer</Button>
                    </div>
                </>
            )}
            <div className="text-center pt-2">
                <button type="button" onClick={() => setMode('login')} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors p-2">
                    Cancelar
                </button>
            </div>
        </form>
    );

    const renderRecover = () => (
        <form onSubmit={handleFormSubmit} className="space-y-8 animate-fade-in-up">
            <div className="text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold mb-6 border border-slate-200 dark:border-slate-700">
                    <span className="material-icons !text-sm">lock_reset</span>
                    Recuperación
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Recuperar Acceso
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-base leading-relaxed">
                    {resetStep === 'verify'
                        ? "Completa los datos para validar tu identidad."
                        : resetStep === 'reset_password'
                            ? "Identidad confirmada. Ingresa tu nueva clave."
                            : "¡Proceso completado con éxito!"
                    }
                </p>
            </div>

            {resetStep === 'verify' && (
                <div className="space-y-4 animate-fade-in">
                    <Input id="rec-legajo" type="text" value={legajo} onChange={(e) => setLegajo(e.target.value)} placeholder="Número de Legajo" icon="badge" disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                    <Input name="dni" type="text" placeholder="DNI" icon="fingerprint" value={verificationData.dni} onChange={handleVerificationDataChange} disabled={isLoading} inputMode="numeric" className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                    <Input name="correo" type="email" placeholder="Correo registrado" icon="email" value={verificationData.correo} onChange={handleVerificationDataChange} disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                    <Input name="telefono" type="tel" placeholder="Celular registrado" icon="smartphone" value={verificationData.telefono} onChange={handleVerificationDataChange} disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                </div>
            )}

            {resetStep === 'reset_password' && (
                <div className="space-y-5 animate-fade-in">
                    <div className="relative">
                        <Input id="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva Contraseña" icon="lock" disabled={isLoading} autoFocus className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10">
                            <span className="material-icons !text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                    </div>
                    <Input id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetir Contraseña" icon="lock_reset" disabled={isLoading} className="bg-slate-50 dark:bg-slate-800/50 h-14" />
                </div>
            )}

            {resetStep === 'success' && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-8 rounded-2xl text-center animate-fade-in">
                    <div className="mx-auto bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300 w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <span className="material-icons !text-4xl">check</span>
                    </div>
                    <h3 className="font-black text-xl text-slate-900 dark:text-white mb-2">¡Listo!</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium text-sm">
                        Contraseña actualizada.
                    </p>
                    <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all"
                    >
                        Iniciar Sesión
                    </button>
                </div>
            )}

            {resetStep !== 'success' && (
                <div className="pt-4 space-y-4">
                    <Button type="submit" isLoading={isLoading} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-14 text-lg rounded-2xl" size="lg">
                        {resetStep === 'verify' ? 'Validar Identidad' : 'Establecer Contraseña'}
                    </Button>
                    <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="w-full text-center text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors p-2"
                    >
                        Cancelar
                    </button>
                </div>
            )}
        </form>
    );

    const renderContent = () => {
        switch (mode) {
            case 'login': return renderLogin();
            case 'register': return renderRegister();
            case 'migration': return renderMigration();
            case 'recover': return renderRecover();
            default: return renderLogin();
        }
    };

    return (
        <div className="fixed inset-0 w-full h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden font-sans selection:bg-blue-500/30">

            {/* BACKGROUND EFFECTS */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-400/20 dark:bg-indigo-900/10 rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
                <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-blue-400/20 dark:bg-blue-900/10 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-purple-400/20 dark:bg-purple-900/10 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-4000"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            {/* HEADER (ABSOLUTE TOP) */}
            <header className="flex-none h-20 px-6 sm:px-12 flex items-center justify-between z-30 relative w-full">
                <div className="flex items-center gap-6">
                    <div className="drop-shadow-sm">
                        <MiPanelLogo className="h-10 sm:h-12 w-auto" variant={resolvedTheme} />
                    </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                    <div className="hidden sm:block opacity-80 hover:opacity-100 transition-opacity">
                        <UfloLogo className="h-8 sm:h-10 w-auto grayscale contrast-125" variant={resolvedTheme} />
                    </div>
                    <div className="pl-2 border-l border-slate-200 dark:border-slate-800">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* MAIN SCROLLABLE AREA */}
            <main className="flex-1 w-full relative overflow-y-auto overflow-x-hidden custom-scrollbar z-20">
                <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 py-8 sm:py-12">

                    {/* TARJETA FLOTANTE (ISLA) */}
                    <div className="w-full max-w-[1100px] min-h-[600px] bg-white/80 dark:bg-[#0f1523]/80 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 dark:shadow-black/80 overflow-hidden border border-white/60 dark:border-slate-700/50 relative backdrop-blur-2xl flex flex-col xl:flex-row ring-1 ring-white/40 dark:ring-white/5">

                        {/* LEFT SIDE (Branding - Desktop Only) */}
                        <div className="hidden xl:flex w-5/12 relative flex-col justify-between p-16 overflow-hidden bg-slate-50/50 dark:bg-[#0B1120]/50 border-r border-slate-100 dark:border-slate-800">
                            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br from-blue-400/10 to-indigo-400/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-emerald-400/10 to-teal-400/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

                            <div className="relative z-10 h-full flex flex-col justify-center gap-12">
                                {/* Logo removed from here to ensure clean layout and no duplication with header */}

                                <div className="space-y-10">
                                    <div className="space-y-6">
                                        <h1 className="text-5xl font-black leading-[1.05] tracking-tighter animate-fade-in-up text-slate-900 dark:text-white" style={{ animationDelay: '100ms' }}>
                                            Gestión académica <br />
                                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">inteligente.</span>
                                        </h1>
                                        <p className="text-lg leading-relaxed font-medium text-slate-600 dark:text-slate-400 max-w-sm animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                                            Centraliza tus prácticas, inscripciones y acreditaciones en una plataforma unificada y simple.
                                        </p>
                                    </div>

                                    <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                                        {[
                                            { icon: 'verified_user', text: 'Gestión 100% Digital', desc: 'Olvídate del papel.' },
                                            { icon: 'insights', text: 'Seguimiento Real', desc: 'Tu progreso al instante.' },
                                            { icon: 'school', text: 'Acreditación Directa', desc: 'Vinculación con SAC.' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-start gap-4 group">
                                                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform duration-300">
                                                    <span className="material-icons !text-xl">{item.icon}</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">{item.text}</h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{item.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pt-8 border-t border-slate-200/60 dark:border-slate-800 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                                    <div className="opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
                                        <UfloLogo className="h-8 w-auto" variant={resolvedTheme} />
                                    </div>
                                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-tight">
                                        Facultad de Psicología <br /> y Ciencias Sociales
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDE: Form Wrapper */}
                        <div className="w-full xl:w-7/12 flex flex-col relative bg-white/50 dark:bg-transparent">
                            <div className="flex-1 flex flex-col justify-center p-8 sm:p-12 lg:p-16 w-full max-w-xl mx-auto">
                                {renderContent()}

                                {/* Error Message Area */}
                                <div aria-live="assertive" className="mt-8 min-h-[60px]">
                                    {error && (
                                        <div className="flex items-start gap-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl shadow-sm animate-shake transition-all duration-300">
                                            <div className="p-2 bg-white dark:bg-rose-950 rounded-full text-rose-500 dark:text-rose-400 shadow-sm border border-rose-100 dark:border-rose-900/50 flex-shrink-0">
                                                <span className="material-icons !text-lg">error</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200">Atención</h4>
                                                <p className="text-sm text-rose-600 dark:text-rose-300 mt-1 leading-snug font-medium">{error}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Footer Branding */}
                            <div className="xl:hidden p-6 text-center border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                                    UFLO Universidad • Facultad de Psicología
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Auth;
