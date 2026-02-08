import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FIELD_CORREO_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_NOTAS_INTERNAS_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
} from "../../constants";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { db } from "../../lib/db";
import {
  subscribeToOneSignal,
  unsubscribeFromOneSignal,
  isOneSignalSubscribed,
} from "../../lib/onesignal";
import type { EstudianteFields } from "../../types";
import { SkeletonBox } from "../Skeletons";

// Premium Profile Card Component
const ProfileCard: React.FC<{
  label: string;
  value?: string | number | null;
  icon: string;
  isEditable?: boolean;
  name?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  delay?: number;
}> = ({ label, value, icon, isEditable, name, onChange, type = "text", delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={`relative group overflow-hidden rounded-2xl border transition-all duration-300 ${
      isEditable
        ? "bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-slate-900/50 border-blue-200 dark:border-blue-800/50 shadow-sm shadow-blue-500/10"
        : "bg-white dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg hover:shadow-slate-500/5"
    }`}
  >
    <div className="relative z-10 flex items-center gap-4 p-4">
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
          isEditable
            ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
            : "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-500 group-hover:text-blue-500 group-hover:from-blue-50 group-hover:to-blue-100 dark:group-hover:from-blue-900/30 dark:group-hover:to-blue-800/20 transition-all duration-300"
        }`}
      >
        <span className="material-icons !text-xl">{icon}</span>
      </motion.div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
          {label}
        </p>
        {isEditable && onChange && name ? (
          <input
            type={type}
            name={name}
            value={value || ""}
            onChange={onChange}
            className="w-full bg-transparent border-b-2 border-blue-300 dark:border-blue-700 text-base font-bold text-blue-900 dark:text-blue-100 focus:outline-none focus:border-blue-500 pb-1 transition-colors"
            autoFocus={name === FIELD_CORREO_ESTUDIANTES}
          />
        ) : (
          <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
            {value || "---"}
          </p>
        )}
      </div>

      {isEditable && (
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="material-icons text-blue-400 !text-lg"
        >
          edit
        </motion.span>
      )}
    </div>
  </motion.div>
);

// Premium Button Component
const PremiumButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
}> = ({ onClick, children, variant = "primary", disabled, className = "" }) => {
  const variants = {
    primary: "from-blue-500 to-indigo-600 text-white shadow-blue-500/30 hover:shadow-blue-500/40",
    secondary:
      "from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 shadow-slate-500/10 hover:shadow-slate-500/20",
    danger: "from-rose-500 to-pink-600 text-white shadow-rose-500/30 hover:shadow-rose-500/40",
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative overflow-hidden flex-1 py-3.5 px-6 rounded-xl font-bold text-sm
        bg-gradient-to-r ${variants[variant]}
        shadow-lg transition-all duration-300
        disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none
        ${className}
      `}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  );
};

interface ProfileViewProps {
  studentDetails: EstudianteFields | null;
  isLoading: boolean;
  updateInternalNotes: any;
}

const ProfileView: React.FC<ProfileViewProps> = ({
  studentDetails,
  isLoading,
  updateInternalNotes,
}) => {
  const { isSuperUserMode, isJefeMode } = useAuth();
  const { showModal } = useModal();
  const queryClient = useQueryClient();

  // OneSignal state
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const isPushSupported = "Notification" in window && "serviceWorker" in navigator;

  const [internalNotes, setInternalNotes] = useState("");
  const [isNotesChanged, setIsNotesChanged] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ correo: string; telefono: string }>({
    correo: "",
    telefono: "",
  });

  // Check OneSignal subscription status
  useEffect(() => {
    const checkStatus = async () => {
      const subscribed = await isOneSignalSubscribed();
      setIsPushEnabled(subscribed);
    };
    checkStatus();
  }, []);

  const handleSubscribe = async () => {
    setIsPushLoading(true);
    const result = await subscribeToOneSignal(legajo);
    if (result.success) {
      setIsPushEnabled(true);
      showModal("Éxito", "¡Notificaciones activadas correctamente!");
    } else {
      showModal("Error", result.error || "No se pudieron activar las notificaciones");
    }
    setIsPushLoading(false);
  };

  const handleUnsubscribe = async () => {
    setIsPushLoading(true);
    const result = await unsubscribeFromOneSignal();
    if (result.success) {
      setIsPushEnabled(false);
      showModal("Éxito", "Notificaciones desactivadas");
    } else {
      showModal("Error", result.error || "No se pudieron desactivar las notificaciones");
    }
    setIsPushLoading(false);
  };

  useEffect(() => {
    if (studentDetails) {
      setInternalNotes(studentDetails[FIELD_NOTAS_INTERNAS_ESTUDIANTES] || "");
      setEditForm({
        correo: String(studentDetails[FIELD_CORREO_ESTUDIANTES] || ""),
        telefono: String(studentDetails[FIELD_TELEFONO_ESTUDIANTES] || ""),
      });
    }
    setIsNotesChanged(false);
  }, [studentDetails]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalNotes(e.target.value);
    setIsNotesChanged(
      e.target.value !== (studentDetails?.[FIELD_NOTAS_INTERNAS_ESTUDIANTES] || "")
    );
  };

  const handleSaveNotes = () => {
    if (isNotesChanged) updateInternalNotes.mutate(internalNotes);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { correo: string; telefono: string }) => {
      if (!(studentDetails as any).id) throw new Error("ID no encontrado");
      return db.estudiantes.update((studentDetails as any).id, {
        [FIELD_CORREO_ESTUDIANTES]: data.correo,
        [FIELD_TELEFONO_ESTUDIANTES]: data.telefono,
      });
    },
    onSuccess: () => {
      showModal("Actualizado", "Tus datos de contacto han sido guardados correctamente.");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["student"] });
    },
    onError: (error: any) => {
      showModal("Error", `No se pudo actualizar: ${error.message}`);
    },
  });

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = () => {
    if (!editForm.correo || !editForm.correo.includes("@")) {
      showModal("Error", "Por favor ingresa un correo electrónico válido.");
      return;
    }
    updateProfileMutation.mutate(editForm);
  };

  if (isLoading || !studentDetails) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const {
    [FIELD_NOMBRE_ESTUDIANTES]: nombre,
    [FIELD_LEGAJO_ESTUDIANTES]: legajo,
    [FIELD_DNI_ESTUDIANTES]: dni,
  } = studentDetails;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Premium Header - Clean & Modern */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700/60 p-6 md:p-8 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50"
      >
        {/* Subtle gradient accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <div className="relative z-10 flex items-center gap-4 md:gap-6">
          {/* Avatar - Soft blue in light mode, colored in dark mode */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-blue-50 dark:bg-gradient-to-br dark:from-blue-500 dark:to-indigo-600 flex items-center justify-center border border-blue-200/60 dark:border-0 shadow-sm shadow-blue-500/10 dark:shadow-lg dark:shadow-blue-500/20"
          >
            <span className="material-icons !text-4xl md:!text-5xl text-blue-500 dark:text-white">
              person
            </span>
          </motion.div>

          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl md:text-3xl font-black mb-1 text-slate-800 dark:text-white"
            >
              {nombre}
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="inline-flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm md:text-base font-medium text-slate-500 dark:text-slate-400">
                Estudiante Activo
              </span>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <ProfileCard label="Legajo" value={legajo} icon="numbers" delay={0.1} />
        <ProfileCard label="DNI" value={dni} icon="fingerprint" delay={0.3} />

        <ProfileCard
          label="Correo Electrónico"
          value={isEditing ? editForm.correo : studentDetails[FIELD_CORREO_ESTUDIANTES]}
          icon="email"
          isEditable={isEditing}
          name="correo"
          onChange={handleEditChange}
          type="email"
          delay={0.4}
        />
        <ProfileCard
          label="Teléfono"
          value={isEditing ? editForm.telefono : studentDetails[FIELD_TELEFONO_ESTUDIANTES]}
          icon="phone"
          isEditable={isEditing}
          name="telefono"
          onChange={handleEditChange}
          type="tel"
          delay={0.5}
        />
      </div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="pt-4"
      >
        {!isEditing ? (
          <PremiumButton onClick={() => setIsEditing(true)}>
            <span className="material-icons !text-lg">edit_note</span>
            Editar Datos de Contacto
          </PremiumButton>
        ) : (
          <div className="flex gap-3">
            <PremiumButton
              variant="secondary"
              onClick={() => {
                setIsEditing(false);
                setEditForm({
                  correo: String(studentDetails[FIELD_CORREO_ESTUDIANTES] || ""),
                  telefono: String(studentDetails[FIELD_TELEFONO_ESTUDIANTES] || ""),
                });
              }}
              disabled={updateProfileMutation.isPending}
            >
              Cancelar
            </PremiumButton>
            <PremiumButton onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-icons !text-lg">save</span>
                  Guardar Cambios
                </>
              )}
            </PremiumButton>
          </div>
        )}
      </motion.div>

      {isEditing && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-slate-400 italic"
        >
          Nota: Actualizar tu correo aquí modificará dónde recibes las notificaciones, pero tu
          usuario de acceso seguirá siendo el mismo hasta que lo cambies en seguridad.
        </motion.p>
      )}

      {/* Notifications Section - Premium */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="pt-6 border-t border-slate-200 dark:border-slate-800"
      >
        <h3 className="font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
          <span className="material-icons text-slate-400">notifications</span>
          Configuración de Alertas
        </h3>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 p-5 shadow-lg shadow-blue-500/5">
          {/* Background glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />

          {!isPushSupported ? (
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <span className="material-icons !text-xl text-amber-600 dark:text-amber-400">
                  warning_amber
                </span>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex-1">
                Navegador no compatible
              </h4>
            </div>
          ) : (
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={
                      isPushEnabled
                        ? {
                            scale: [1, 1.1, 1],
                            boxShadow: [
                              "0 0 0 0 rgba(59, 130, 246, 0.4)",
                              "0 0 0 10px rgba(59, 130, 246, 0)",
                              "0 0 0 0 rgba(59, 130, 246, 0)",
                            ],
                          }
                        : {}
                    }
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all ${
                      isPushEnabled
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                    }`}
                  >
                    <span className="material-icons !text-xl">
                      {isPushEnabled ? "notifications_active" : "notifications_off"}
                    </span>
                  </motion.div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex-1">
                    Notificaciones Push
                  </h4>
                </div>

                <button
                  onClick={isPushEnabled ? handleUnsubscribe : handleSubscribe}
                  disabled={isPushLoading}
                  className={`relative min-w-[56px] h-8 rounded-full transition-all duration-300 ${
                    isPushEnabled
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/30"
                      : "bg-slate-300 dark:bg-slate-600"
                  } ${isPushLoading ? "opacity-70 cursor-wait" : "cursor-pointer"}`}
                >
                  <motion.div
                    animate={{
                      left: isPushEnabled ? "calc(100% - 28px)" : "4px",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md"
                  />
                </button>
              </div>

              {isPushEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 pt-4 border-t border-blue-200/50 dark:border-blue-700/50 flex flex-col gap-3"
                >
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <span className="material-icons !text-sm">check_circle</span>
                    Dispositivo vinculado correctamente
                  </p>

                  {/* Mensaje informativo */}
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-xs text-green-700 dark:text-green-400">
                      <span className="material-icons !text-sm align-middle mr-1">
                        check_circle
                      </span>
                      <strong>¡Listo!</strong> Las notificaciones están activadas. Recibirás alertas
                      cuando haya nuevas convocatorias.
                    </p>
                  </div>

                  {/* Botón de prueba local */}
                  <button
                    onClick={async () => {
                      try {
                        if (!("serviceWorker" in navigator)) {
                          showModal("Error", "Service Worker no soportado");
                          return;
                        }
                        const registration = await navigator.serviceWorker.ready;
                        const subscription = await registration.pushManager.getSubscription();

                        // Intentar mostrar notificación local de prueba
                        if (Notification.permission === "granted") {
                          await registration.showNotification("🧪 Prueba Local", {
                            body: "Si ves esto, las notificaciones funcionan!",
                            icon: "./icons/icon-192x192.png",
                            requireInteraction: true,
                          });
                          showModal(
                            "Info",
                            `Service Worker activo. Suscripción: ${subscription ? "Sí" : "No"}. Notificación local enviada.`
                          );
                        } else {
                          showModal("Error", "Permiso de notificaciones no concedido");
                        }
                      } catch (e: any) {
                        showModal("Error", `Error: ${e.message}`);
                      }
                    }}
                    className="mt-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-icons !text-sm">check_circle</span>
                    Probar notificación local
                  </button>

                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-[10px] text-blue-700 dark:text-blue-400">
                      <strong>✨ OneSignal:</strong> Usamos OneSignal para enviar notificaciones de
                      forma confiable. Recibirás alertas instantáneas cuando haya nuevas
                      convocatorias disponibles.
                    </p>
                  </div>

                  <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 ml-5 mt-2">
                    Si cambias de dispositivo o navegador, deberás activarlas nuevamente allí.
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {(isSuperUserMode || isJefeMode) && (
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            (Visible para administradores solo para pruebas. Los alumnos ven esto en su perfil).
          </p>
        )}
      </motion.div>

      {/* Notas Internas (Solo Admin) */}
      {(isSuperUserMode || isJefeMode) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 p-6 border border-amber-200 dark:border-amber-800/50"
        >
          {/* Background glow */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-500">
              <span className="material-icons">lock</span>
              <h3 className="font-bold text-sm uppercase tracking-wide">
                Notas Internas (Privado)
              </h3>
            </div>
            <textarea
              value={internalNotes}
              onChange={handleNotesChange}
              rows={4}
              className="w-full text-sm rounded-xl border border-amber-200 dark:border-amber-800 bg-white/80 dark:bg-slate-900/50 p-4 focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-all"
              placeholder="Escribir nota..."
            />
            <div className="mt-3 flex justify-end">
              <motion.button
                onClick={handleSaveNotes}
                disabled={!isNotesChanged || updateInternalNotes.isPending}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {updateInternalNotes.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-icons !text-sm">save</span>
                )}
                {updateInternalNotes.isPending ? "Guardando..." : "Guardar Nota"}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProfileView;
