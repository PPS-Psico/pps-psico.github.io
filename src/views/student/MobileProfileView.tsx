import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../lib/db";
import { supabase } from "../../lib/supabaseClient";
import { subscribeToFCM, unsubscribeFromFCM, isFCMSubscribed } from "../../lib/fcm";
import { logger } from "../../utils/logger";
import { haptics } from "../../utils/haptics";

interface MobileProfileViewProps {
  studentDetails: EstudianteFields | null;
  isLoading: boolean;
}

const MobileProfileView: React.FC<MobileProfileViewProps> = ({ studentDetails, isLoading }) => {
  const { authenticatedUser, refreshAuth, logout } = useAuth();
  const { showModal } = useModal();
  const { resolvedTheme } = useTheme();
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
            logger.info("[MobileProfileView] Could not check DB status");
          }
        }
        setIsPushEnabled(fcmSubscribed && dbHasToken);
      } catch (e) {
        logger.error("[MobileProfileView] Error checking status:", e);
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
      if (!(studentDetails as any)?.id) throw new Error("ID no encontrado");
      const dniValue = data.dni ? parseInt(data.dni, 10) : null;
      const tieneDatosCompletos = dniValue && dniValue > 0 && data.correo && data.telefono;
      return db.estudiantes.update((studentDetails as any).id, {
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
    onError: (error: any) => showModal("Error", `No se pudo actualizar: ${error.message}`),
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
    haptics.tap();
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

  const fieldCardStyle: React.CSSProperties = {
    border: "1px solid var(--line)",
    borderRadius: 14,
    background: "var(--bg-elevated)",
    padding: "12px 14px",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: ".07em",
    textTransform: "uppercase",
    color: "var(--ink-subtle)",
    marginBottom: 5,
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--ink)",
    wordBreak: "break-word",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--line-strong)",
    borderRadius: 10,
    background: "var(--bg-elevated)",
    color: "var(--ink)",
    font: "inherit",
    fontSize: 15,
    padding: "9px 11px",
    outline: "none",
  };

  if (isLoading || !studentDetails) {
    return (
      <div className="ed" data-mode={resolvedTheme} data-accent="teal">
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 18px" }}>
          <div
            style={{ height: 150, borderRadius: 22, background: "var(--bg-sunken)", opacity: 0.5 }}
          />
        </div>
      </div>
    );
  }

  const nombre = (studentDetails[FIELD_NOMBRE_ESTUDIANTES] as string) || "Estudiante";
  const initial = nombre.trim().charAt(0).toUpperCase() || "E";
  const legajo = studentDetails[FIELD_LEGAJO_ESTUDIANTES];

  const fields: {
    lbl: string;
    key: keyof typeof editForm | null;
    value: React.ReactNode;
    type?: string;
    full?: boolean;
  }[] = [
    { lbl: "Legajo", key: null, value: legajo ?? "—" },
    { lbl: "DNI", key: "dni", value: studentDetails[FIELD_DNI_ESTUDIANTES] ?? "—", type: "text" },
    {
      lbl: "Correo electrónico",
      key: "correo",
      value: studentDetails[FIELD_CORREO_ESTUDIANTES] || "—",
      type: "email",
      full: true,
    },
    {
      lbl: "Teléfono",
      key: "telefono",
      value: studentDetails[FIELD_TELEFONO_ESTUDIANTES] || "—",
      type: "tel",
    },
  ];

  return (
    <div
      className="ed"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{ minHeight: "60vh", background: "transparent" }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 18px 24px" }}>
        {/* Banner gradiente con avatar */}
        <div className="perfil-banner">
          <div className="perfil-banner__grad" />
          <div className="perfil-avatar">{initial}</div>
          <div className="perfil-name display">{nombre}</div>
          <div className="mono perfil-lu">LU {legajo ?? "—"} · PSICOLOGÍA</div>
        </div>

        {/* Datos de contacto */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "24px 2px 12px",
          }}
        >
          <span className="eyebrow" style={{ fontSize: 11 }}>
            Datos de contacto
          </span>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                font: "inherit",
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--accent)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
              }}
            >
              <span className="material-icons" style={{ fontSize: 16 }}>
                edit
              </span>
              Editar
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
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
                style={{
                  font: "inherit",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--ink-muted)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={updateProfileMutation.isPending}
                onClick={handleSaveProfile}
                style={{
                  font: "inherit",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--accent)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {updateProfileMutation.isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {fields.map((f) => {
            const editable = isEditing && f.key;
            return (
              <div
                key={f.lbl}
                style={{ ...fieldCardStyle, gridColumn: f.full ? "1 / -1" : undefined }}
              >
                <div style={labelStyle}>{f.lbl}</div>
                {editable ? (
                  <input
                    style={inputStyle}
                    type={f.type || "text"}
                    name={f.key as string}
                    value={editForm[f.key as keyof typeof editForm]}
                    onChange={handleEditChange}
                  />
                ) : (
                  <div style={valueStyle}>{f.value as React.ReactNode}</div>
                )}
              </div>
            );
          })}
          {/* Orientación */}
          <div style={{ ...fieldCardStyle, gridColumn: "1 / -1" }}>
            <div style={labelStyle}>Especialidad / orientación</div>
            {isEditing ? (
              <select
                style={inputStyle}
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
              <div style={valueStyle}>
                {studentDetails[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || "No definida"}
              </div>
            )}
          </div>
        </div>

        {/* Alertas */}
        <div
          className="eyebrow"
          style={{ fontSize: 11, display: "block", margin: "26px 2px 12px" }}
        >
          Alertas
        </div>
        <div className="perfilrow" style={{ borderBottom: 0 }}>
          <div
            className="perfilrow__icon"
            style={{
              background: isPushEnabled
                ? "color-mix(in oklab, var(--accent) 14%, transparent)"
                : "var(--bg-sunken)",
              color: isPushEnabled ? "var(--accent)" : "var(--ink-muted)",
            }}
          >
            <span className="material-icons" style={{ fontSize: 20 }}>
              {isPushEnabled ? "notifications_active" : "notifications_off"}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>
              Notificaciones push
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 1, lineHeight: 1.4 }}>
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
              onClick={handleTogglePush}
              disabled={isPushLoading}
              aria-pressed={isPushEnabled}
              aria-label="Notificaciones push"
              style={{
                width: 50,
                height: 30,
                borderRadius: 999,
                border: 0,
                flexShrink: 0,
                cursor: isPushLoading ? "wait" : "pointer",
                background: isPushEnabled ? "var(--accent)" : "var(--line-strong)",
                position: "relative",
                transition: "background .2s",
                opacity: isPushLoading ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: isPushEnabled ? 23 : 3,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,.22)",
                  transition: "left .2s",
                }}
              />
            </button>
          )}
        </div>

        {/* Cerrar sesión */}
        <button
          type="button"
          onClick={logout}
          className="perfilrow"
          style={{ borderBottom: 0, marginTop: 8 }}
        >
          <div className="perfilrow__icon">
            <span className="material-icons" style={{ fontSize: 20, color: "var(--ink-muted)" }}>
              logout
            </span>
          </div>
          <div
            style={{
              flex: 1,
              textAlign: "left",
              fontSize: 14.5,
              fontWeight: 600,
              color: "var(--ink-muted)",
            }}
          >
            Cerrar sesión
          </div>
        </button>
      </div>
    </div>
  );
};

export default MobileProfileView;
