
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Toast from './ui/Toast';

interface ChangePasswordModalProps {
    isOpen: boolean;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen }) => {
    const { completePasswordChange } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toastInfo, setToastInfo] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setIsLoading(true);
        try {
            // 1. Actualizar contraseña en Sistema de Autenticación (Supabase Auth)
            const { error: updateError } = await (supabase.auth as any).updateUser({ password: newPassword });
            if (updateError) throw updateError;

            // 2. Sincronizar "banderita" en la Base de Datos (Tabla estudiantes)
            // Intentamos primero por RPC (más seguro/admin)
            // Cast to any to bypass strict checks, pass empty object as args
            const { error: rpcError } = await (supabase.rpc as any)('mark_password_changed', {});

            // Si el RPC falla (a veces por permisos o caché), intentamos actualización directa
            if (rpcError) {
                console.warn("RPC mark_password_changed falló, intentando update directo...", rpcError);

                const { data: userData } = await (supabase.auth as any).getUser();
                if (userData.user) {
                    const { error: directError } = await (supabase as any)
                        .from('estudiantes')
                        .update({ must_change_password: false })
                        .eq('user_id', userData.user.id);

                    if (directError) {
                        console.error("Fallo crítico al actualizar estado en DB:", directError);
                        // No lanzamos error aquí para no bloquear al usuario, ya que el Auth sí se actualizó.
                        // El estado local lo salvará por esta sesión.
                    }
                }
            }

            setToastInfo({ message: 'Contraseña actualizada correctamente.', type: 'success' });

            // 3. Actualizar estado local inmediatamente (SIN RECARGAR)
            // Esto cierra el modal y permite al usuario seguir usando la app.
            setTimeout(() => {
                completePasswordChange();
            }, 1500);

        } catch (e: any) {
            setError(e.message || 'Error al actualizar la contraseña.');
            setIsLoading(false); // Solo detenemos carga si hubo error en el paso 1
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => { }} />}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-700">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-icons !text-3xl">lock_reset</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cambio de Contraseña Requerido</h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
                        Por seguridad, necesitamos que definas una nueva contraseña personal para unificar el acceso a tu panel.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nueva Contraseña</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Mínimo 6 caracteres"
                            required
                            minLength={6}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirmar Contraseña</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Repite la contraseña"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /><span>Guardando...</span></> : 'Establecer Contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
