import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import "../../components/student/home/atlas/atlasHome.css";
import {
  FIELD_CORREO_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
} from "../../constants";
import { ALL_ORIENTACIONES } from "../../types";
import type { EstudianteFields } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import { db } from "../../lib/db";
import { supabase } from "../../lib/supabaseClient";
import { subscribeToFCM, unsubscribeFromFCM, isFCMSubscribed } from "../../lib/fcm";
import { logger } from "../../utils/logger";

interface AtlasProfileViewProps {
  studentDetails: EstudianteFields | null;
  isLoading: boolean;
}

const AtlasProfileView: React.FC<AtlasProfileViewProps> = ({ studentDetails, isLoading }) => {
  const { authenticatedUser, refreshAuth, logout } = useAuth();
  const { showModal } = useModal();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ correo: "", telefono: "", dni: "", orientacion: "" });

  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const isPushSupported =
    typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  const hasCheckedStatus = useRef(false);

  useEffect(() => {
    if (hasCheckedStatus.current || !authenticatedUser?.id) return;
    hasCheckedStatus.current = true;
    const checkStatus = async () => {
      try {
        const fcmSubscribed = await isFCMSubscribed();
        let dbHasToken = false;
        if (fcmSubscribed) {
          try {
            const { data, error } = await (supabase as any).rpc("check_fcm_token_exists", {
              uid: authenticatedUser.id,
            });
            if (!error && data) dbHasToken = data;
          } catch {
            logger.info("[AtlasProfileView] Could not check DB status");
          }
        }
        setIsPushEnabled(fcmSubscribed && dbHasToken);
      } catch (e) {
        logger.error("[AtlasProfileView] Error checking status:", e);
      }
    };
    checkStatus();
  }, [authenticatedUser?.id]);

  useEffect(() => {
    if (studentDetails) {
      setEditForm({
        correo: String(studentDetails[FIELD_CORREO_ESTUDIANTES] || ""),
        telefono: String(studentDetails[FIELD_TELEFONO_ESTUDIANTES] || ""),
        dni: String(studentDetails[FIELD_DNI_ESTUDIANTES] || ""),
        orientacion: String(studentDetails[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || ""),
      });
    }
  }, [studentDetails]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      if (!(studentDetails as { id?: string })?.id) throw new Error("ID no encontrado");
      const dniValue = data.dni ? parseInt(data.dni, 10) : null;
      const tieneDatosCompletos = dniValue && dniValue > 0 && data.correo && data.telefono;
      return db.estudiantes.update((studentDetails as { id: string }).id, {
        [FIELD_CORREO_ESTUDIANTES]: data.correo,
        [FIELD_TELEFONO_ESTUDIANTES]: data.telefono,
        [FIELD_DNI_ESTUDIANTES]: dniValue,
        [FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES]: data.orientacion || null,
        ...(tieneDatosCompletos ? { [FIELD_ESTADO_ESTUDIANTES]: "Activo" } : {}),
      });
    },
    onSuccess: () => {
      showModal("Actualizado", "Tus datos de contacto han sido guardados correctamente.");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["student"] });
      refreshAuth();
    },
    onError: (error) => showModal("Error", `No se pudo actualizar: ${error.message}`),
  });

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = () => {
    if (!editForm.correo || !editForm.correo.includes("@")) {
      showModal("Error", "Por favor ingresá un correo electrónico válido.");
      return;
    }
    updateProfileMutation.mutate(editForm);
  };

  const handleTogglePush = async () => {
    if (isPushLoading) return;
    setIsPushLoading(true);
    if (isPushEnabled) {
      const result = await unsubscribeFromFCM();
      if (result.success) {
        setIsPushEnabled(false);
        if (authenticatedUser?.id) {
          try {
            await (supabase as any).rpc("delete_fcm_token_user", { uid: authenticatedUser.id });
          } catch {
            /* noop */
          }
        }
        showModal("Listo", "Notificaciones desactivadas.");
      } else {
        showModal("Error", result.error || "No se pudieron desactivar las notificaciones.");
      }
    } else {
      const result = await subscribeToFCM(authenticatedUser?.id);
      if (result.success && result.dbSaved) {
        setIsPushEnabled(true);
        showModal(
          "Listo",
          "¡Notificaciones activadas! Vas a recibir alertas de nuevas convocatorias."
        );
      } else {
        setIsPushEnabled(false);
        showModal(
          "Atención",
          result.error ||
            "Se obtuvo el permiso pero no se pudo guardar en la base de datos. Intentá de nuevo."
        );
      }
    }
    setIsPushLoading(false);
  };

  if (isLoading || !studentDetails) {
    return (
      <div className="ah-root ah-unified">
        <main className="ah-main">
          <div className="ah-card" style={{ height: 120, opacity: 0.4 }} />
        </main>
      </div>
    );
  }

  const nombre = (studentDetails[FIELD_NOMBRE_ESTUDIANTES] as string) || "Estudiante";
  const initial = nombre.trim().charAt(0).toUpperCase() || "E";
  const legajo = studentDetails[FIELD_LEGAJO_ESTUDIANTES];
  const dni = studentDetails[FIELD_DNI_ESTUDIANTES];

  const fields: {
    lbl: string;
    key: keyof typeof editForm | null;
    value: React.ReactNode;
    type?: string;
  }[] = [
    { lbl: "Legajo", key: null, value: legajo ?? "—" },
    { lbl: "DNI", key: "dni", value: dni ?? "—", type: "text" },
    {
      lbl: "Correo electrónico",
      key: "correo",
      value: studentDetails[FIELD_CORREO_ESTUDIANTES] || "—",
      type: "email",
    },
    {
      lbl: "Teléfono",
      key: "telefono",
      value: studentDetails[FIELD_TELEFONO_ESTUDIANTES] || "—",
      type: "tel",
    },
  ];

  return (
    <div className="ah-root ah-unified">
      <main className="ah-main">
        <div className="ah-pagehead">
          <span className="eyebrow">Tu cuenta</span>
          <h1>
            Mi <em>perfil</em>.
          </h1>
          <p>Mantené tus datos de contacto actualizados.</p>
        </div>

        {/* Header */}
        <div className="ah-card">
          <div className="ah-profilehdr">
            <div className="ah-profilehdr__av">{initial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ah-profilehdr__name">{nombre}</div>
              <div className="ah-profilehdr__sub">
                <span className="dot" />
                Estudiante activo · LU {legajo ?? "—"}
              </div>
            </div>
            {!isEditing ? (
              <button
                type="button"
                className="ah-btn ah-btn--secondary"
                onClick={() => setIsEditing(true)}
              >
                <span className="material-icons" style={{ fontSize: 17 }}>
                  edit
                </span>
                Editar datos
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="ah-btn ah-btn--secondary"
                  disabled={updateProfileMutation.isPending}
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      correo: String(studentDetails[FIELD_CORREO_ESTUDIANTES] || ""),
                      telefono: String(studentDetails[FIELD_TELEFONO_ESTUDIANTES] || ""),
                      dni: String(studentDetails[FIELD_DNI_ESTUDIANTES] || ""),
                      orientacion: String(
                        studentDetails[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || ""
                      ),
                    });
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ah-btn ah-btn--primary"
                  disabled={updateProfileMutation.isPending}
                  onClick={handleSaveProfile}
                >
                  {updateProfileMutation.isPending ? "Guardando…" : "Guardar"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Datos */}
        <div className="ah-fieldgrid">
          {fields.map((f) => {
            const editable = isEditing && f.key;
            return (
              <div key={f.lbl} className={"ah-field" + (editable ? " ah-field--edit" : "")}>
                <div className="ah-field__lbl">{f.lbl}</div>
                {editable ? (
                  <input
                    className="ah-field__input"
                    type={f.type || "text"}
                    name={f.key as string}
                    value={editForm[f.key as keyof typeof editForm]}
                    onChange={handleEditChange}
                  />
                ) : (
                  <div className="ah-field__val">{f.value as React.ReactNode}</div>
                )}
              </div>
            );
          })}
          {/* Especialidad */}
          <div
            className={"ah-field" + (isEditing ? " ah-field--edit" : "")}
            style={{ gridColumn: "1 / -1" }}
          >
            <div className="ah-field__lbl">Especialidad / orientación</div>
            {isEditing ? (
              <select
                className="ah-field__select"
                name="orientacion"
                value={editForm.orientacion}
                onChange={handleEditChange}
              >
                <option value="">Seleccionar…</option>
                {ALL_ORIENTACIONES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <div className="ah-field__val">
                {studentDetails[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || "No definida"}
              </div>
            )}
          </div>
        </div>

        {/* Notificaciones */}
        <div className="ah-sechead" style={{ marginTop: 36 }}>
          <h6>Alertas</h6>
        </div>
        <div className="ah-card">
          <div className="ah-rowcard">
            <span
              className="ah-action__ic"
              style={{
                background: isPushEnabled ? "var(--primary-50)" : "var(--bg-sunken)",
                color: isPushEnabled ? "var(--primary-700)" : "var(--fg-muted)",
              }}
            >
              <span className="material-icons" style={{ fontSize: 22 }}>
                {isPushEnabled ? "notifications_active" : "notifications_off"}
              </span>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ah-action__t">Notificaciones push</div>
              <div className="ah-action__d">
                {!isPushSupported
                  ? "Tu navegador no es compatible."
                  : isPushEnabled
                    ? "Activas · recibís alertas de nuevas convocatorias."
                    : "Activalas para enterarte de nuevas convocatorias y avisos."}
              </div>
            </div>
            {isPushSupported && (
              <button
                type="button"
                className={"ah-toggle" + (isPushEnabled ? " on" : "")}
                onClick={handleTogglePush}
                disabled={isPushLoading}
                aria-pressed={isPushEnabled}
                aria-label="Notificaciones push"
                style={isPushLoading ? { opacity: 0.6, cursor: "wait" } : undefined}
              >
                <span className="ah-toggle__dot" />
              </button>
            )}
          </div>
        </div>

        {/* Aplicación */}
        <div className="ah-sechead" style={{ marginTop: 36 }}>
          <h6>Aplicación</h6>
        </div>
        <div className="ah-card" style={{ padding: 20 }}>
          <p className="ah-action__d" style={{ marginBottom: 16, fontSize: 13.5, lineHeight: 1.5 }}>
            Instalá <strong>Mi Panel</strong> para acceder directamente desde tu celular o
            computadora. Al estar en la pantalla de inicio, se abrirá a pantalla completa y
            facilitará recibir notificaciones importantes sobre tus PPS.
          </p>

          {window.self !== window.top && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                borderRadius: 10,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                fontSize: 12.5,
                color: "var(--fg-muted)",
              }}
            >
              <span
                className="material-icons"
                style={{ fontSize: 18, color: "var(--warn)", marginTop: 1 }}
              >
                info
              </span>
              <div>
                Al estar dentro de <strong>Moodle</strong>, el navegador bloquea la instalación de
                aplicaciones. Abre el panel directamente ingresando a{" "}
                <a
                  href="https://pps-psico.github.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                  style={{ color: "var(--primary-700)" }}
                >
                  pps-psico.github.io
                </a>{" "}
                en tu celular para poder instalarlo.
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ padding: 12, background: "var(--bg-sunken)", borderRadius: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  color: "var(--fg)",
                  marginBottom: 6,
                }}
              >
                <span className="material-icons" style={{ fontSize: 16, color: "#10b981" }}>
                  android
                </span>
                Android (Chrome)
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.45 }}>
                Toca los <strong>tres puntos</strong> arriba a la derecha y selecciona{" "}
                <strong>"Instalar"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
              </p>
            </div>

            <div style={{ padding: 12, background: "var(--bg-sunken)", borderRadius: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  color: "var(--fg)",
                  marginBottom: 6,
                }}
              >
                <span className="material-icons" style={{ fontSize: 16, color: "#3b82f6" }}>
                  phone_iphone
                </span>
                iOS (Safari)
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.45 }}>
                Toca <strong>"Compartir"</strong>{" "}
                <span
                  className="material-icons"
                  style={{ fontSize: 13, position: "relative", top: 1.5 }}
                >
                  ios_share
                </span>{" "}
                en Safari y selecciona <strong>"Agregar a Inicio"</strong>.
              </p>
            </div>

            <div style={{ padding: 12, background: "var(--bg-sunken)", borderRadius: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  color: "var(--fg)",
                  marginBottom: 6,
                }}
              >
                <span className="material-icons" style={{ fontSize: 16, color: "#8b5cf6" }}>
                  laptop
                </span>
                Computadora
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.45 }}>
                Haz clic en el ícono de <strong>instalación</strong>{" "}
                <span
                  className="material-icons"
                  style={{ fontSize: 13, position: "relative", top: 1.5 }}
                >
                  install_desktop
                </span>{" "}
                en la barra de URL.
              </p>
            </div>
          </div>
        </div>

        {/* Cerrar sesión (paridad con la vista mobile) */}
        <div className="ah-sechead" style={{ marginTop: 36 }}>
          <h6>Sesión</h6>
        </div>
        <div className="ah-card">
          <button
            type="button"
            className="ah-rowcard"
            onClick={logout}
            style={{
              width: "100%",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              className="ah-action__ic"
              style={{ background: "var(--bg-sunken)", color: "var(--fg-muted)" }}
            >
              <span className="material-icons" style={{ fontSize: 22 }}>
                logout
              </span>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ah-action__t">Cerrar sesión</div>
              <div className="ah-action__d">Salir de tu cuenta en este dispositivo.</div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};

export default AtlasProfileView;
