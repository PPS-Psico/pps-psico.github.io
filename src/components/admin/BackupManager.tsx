import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Toast from "../ui/Toast";
import { formatDate } from "../../utils/formatters";
import { injectEditorStyles } from "./editorStyles";
import { logger } from "../../utils/logger";

injectEditorStyles();

interface BackupConfig {
  id: string;
  enabled: boolean;
  frequency: "hourly" | "daily" | "weekly" | "monthly";
  backup_time: string;
  retain_count: number;
  include_tables: string[];
  last_backup_at: string | null;
}

interface BackupHistory {
  id: string;
  backup_type: "automatic" | "manual";
  status: "pending" | "running" | "completed" | "failed";
  tables_backed_up: string[];
  storage_path: string;
  file_size_bytes: number;
  record_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  metadata?: {
    action?: string;
    source_file?: string;
    results?: any;
    total_restored?: number;
  };
}

interface BackupFile {
  file_name: string;
  created_at: string;
  size_bytes: number;
  status: string;
  record_count: number;
  tables_backed_up: string[];
  backup_type: string;
}

const BackupManager: React.FC = () => {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  // Confirmación tipada de restauración (acción destructiva)
  const [restoreTarget, setRestoreTarget] = useState<{
    file: BackupFile;
    info: any;
    totalRecords: number;
    tables: string[];
  } | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [isPreparingRestore, setIsPreparingRestore] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );

  // Config form state
  const [configForm, setConfigForm] = useState({
    enabled: true,
    frequency: "daily" as const,
    backup_time: "02:00",
    retain_count: 3,
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-backups?action=list`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch backups");

      const responseData = await response.json();
      setConfig(responseData.config);
      setBackups(responseData.backups);

      // Set form values
      if (responseData.config) {
        setConfigForm({
          enabled: responseData.config.enabled,
          frequency: responseData.config.frequency,
          backup_time: responseData.config.backup_time?.slice(0, 5) || "02:00",
          retain_count: responseData.config.retain_count,
        });
      }
    } catch (error) {
      logger.error("Error fetching backups:", error);
      setToastInfo({ message: "Error al cargar backups", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-backups?action=history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch history");

      const responseData = await response.json();
      setHistory(responseData.history);
    } catch (error) {
      logger.error("Error fetching history:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setIsBackingUp(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automated-backup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Backup failed");
      }

      setToastInfo({ message: "Backup creado exitosamente", type: "success" });
      fetchData();
      fetchHistory();
    } catch (error) {
      logger.error("Backup error:", error);
      setToastInfo({
        message: error instanceof Error ? error.message : "Error al crear backup",
        type: "error",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Paso 1: dry-run para conocer el impacto y abrir la confirmación tipada.
  const handlePrepareRestore = async (backup: BackupFile) => {
    try {
      setSelectedBackup(backup);
      setIsPreparingRestore(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No authentication token available");

      const checkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-backup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ backup_file_name: backup.file_name, dry_run: true }),
        }
      );

      const checkData = await checkResponse.json();
      if (!checkResponse.ok) throw new Error(checkData.message || "Failed to check backup");

      const totalRecords = Object.values(checkData.records_per_table || {}).reduce(
        (a: any, b: any) => a + b,
        0
      ) as number;

      setRestoreConfirmText("");
      setRestoreTarget({
        file: backup,
        info: checkData.backup_info,
        totalRecords,
        tables: checkData.tables_to_restore || [],
      });
    } catch (error) {
      logger.error("Restore check error:", error);
      setToastInfo({
        message: error instanceof Error ? error.message : "Error al verificar backup",
        type: "error",
      });
      setSelectedBackup(null);
    } finally {
      setIsPreparingRestore(false);
    }
  };

  // Paso 2: ejecutar la restauración (sólo tras confirmación tipada).
  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    const backupFileName = restoreTarget.file.file_name;
    try {
      setIsRestoring(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No authentication token available");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-backup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ backup_file_name: backupFileName, dry_run: false }),
        }
      );

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message || "Restore failed");

      setToastInfo({
        message: `Restauración completada: ${responseData.summary?.total_records_restored} registros restaurados`,
        type: "success",
      });
      fetchHistory();
    } catch (error) {
      logger.error("Restore error:", error);
      setToastInfo({
        message: error instanceof Error ? error.message : "Error al restaurar backup",
        type: "error",
      });
    } finally {
      setIsRestoring(false);
      setRestoreTarget(null);
      setRestoreConfirmText("");
      setSelectedBackup(null);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-backups?action=config`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: configForm.enabled,
            frequency: configForm.frequency,
            backup_time: configForm.backup_time + ":00",
            retain_count: configForm.retain_count,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to save config");

      setToastInfo({ message: "Configuración guardada", type: "success" });
      setShowConfigModal(false);
      fetchData();
    } catch (error) {
      logger.error("Config error:", error);
      setToastInfo({ message: "Error al guardar configuración", type: "error" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Tipo de backup por posición/fecha → tono del sistema
  const getBackupType = (backup: BackupFile, index: number) => {
    const date = new Date(backup.created_at);
    if (index === 0) return { label: "Diario", tone: "accent" };
    if (date.getDay() === 0) return { label: "Semanal", tone: "ok" };
    if (date.getDate() === 1) return { label: "Mensual", tone: "ai" };
    return { label: "Extra", tone: "mute" };
  };

  if (isLoading) {
    return (
      <div className="dbe" style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <span
          className="dbe-spin"
          style={{ width: 28, height: 28, borderTopColor: "var(--accent)" }}
        />
      </div>
    );
  }

  return (
    <div className="dbe">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {/* Header */}
      <div
        className="dbe-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="eyebrow">Avanzado · respaldos</span>
          <h2 className="serif">Backups</h2>
          <p>Respaldos manuales y automáticos de la base, y restauración a un punto previo.</p>
          <span className="dbe-warnline">
            <span className="material-icons">warning_amber</span>
            Restaurar reemplaza los datos actuales y no se puede deshacer.
          </span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="dbe-btn" onClick={() => setShowConfigModal(true)}>
            <span className="material-icons">settings</span>
            Configuración
          </button>
          <button
            className="dbe-btn dbe-btn-primary"
            onClick={handleCreateBackup}
            disabled={isBackingUp}
          >
            {isBackingUp ? (
              <span className="dbe-spin" style={{ borderTopColor: "var(--paper)" }} />
            ) : (
              <span className="material-icons">backup</span>
            )}
            Crear backup
          </button>
        </div>
      </div>

      {/* Estado del sistema */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 22,
        }}
      >
        <div
          className="dbe-table-wrap"
          style={{
            marginTop: 0,
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            className="dbe-pill"
            data-tone={config?.enabled ? "ok" : "mute"}
            style={{ width: 34, height: 34, padding: 0, justifyContent: "center", borderRadius: 9 }}
          >
            <span className="material-icons">autorenew</span>
          </span>
          <div>
            <div className="eyebrow">Backup automático</div>
            <div className="dbe-cell-strong" style={{ marginTop: 2 }}>
              {config?.enabled ? "Activado" : "Desactivado"}
            </div>
          </div>
        </div>
        <div
          className="dbe-table-wrap"
          style={{
            marginTop: 0,
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            className="dbe-pill"
            data-tone="accent"
            style={{ width: 34, height: 34, padding: 0, justifyContent: "center", borderRadius: 9 }}
          >
            <span className="material-icons">schedule</span>
          </span>
          <div>
            <div className="eyebrow">Retención</div>
            <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
              <span className="dbe-pill" data-tone="accent">
                Diario
              </span>
              <span className="dbe-pill" data-tone="ok">
                Semanal
              </span>
              <span className="dbe-pill" data-tone="ai">
                Mensual
              </span>
            </div>
          </div>
        </div>
        <div
          className="dbe-table-wrap"
          style={{
            marginTop: 0,
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            className="dbe-pill"
            data-tone="ai"
            style={{ width: 34, height: 34, padding: 0, justifyContent: "center", borderRadius: 9 }}
          >
            <span className="material-icons">history</span>
          </span>
          <div>
            <div className="eyebrow">Último backup</div>
            <div className="dbe-cell-strong" style={{ marginTop: 2 }}>
              {config?.last_backup_at ? formatDate(config.last_backup_at) : "Nunca"}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Backups */}
      <div style={{ marginBottom: 8 }}>
        <span className="eyebrow">Backups disponibles · {backups.length}</span>
      </div>
      {backups.length === 0 ? (
        <div className="dbe-table-wrap" style={{ padding: 40, textAlign: "center" }}>
          <span className="material-icons" style={{ fontSize: 40, color: "var(--ink-4)" }}>
            cloud_off
          </span>
          <p style={{ color: "var(--ink-3)", marginTop: 8 }}>No hay backups disponibles.</p>
          <p className="dbe-fdesc">Creá el primero con el botón "Crear backup".</p>
        </div>
      ) : (
        <div className="dbe-table-wrap" style={{ marginTop: 0 }}>
          <div className="dbe-scroll">
            <table className="dbe-table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Fecha</th>
                  <th>Tamaño</th>
                  <th style={{ textAlign: "center" }}>Registros</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup, index) => {
                  const backupType = getBackupType(backup, index);
                  const busy = isRestoring && selectedBackup?.file_name === backup.file_name;
                  return (
                    <tr key={backup.file_name} style={{ cursor: "default" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span
                            className="material-icons"
                            style={{ fontSize: 17, color: "var(--ink-4)" }}
                          >
                            backup
                          </span>
                          <span className="dbe-cell-mono" style={{ color: "var(--ink-2)" }}>
                            {backup.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="dbe-cell-mono">{formatDate(backup.created_at)}</td>
                      <td className="dbe-cell-mono">{formatFileSize(backup.size_bytes)}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className="dbe-num">{backup.record_count}</span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            className="dbe-pill"
                            data-tone={backup.backup_type === "automatic" ? "accent" : "warn"}
                          >
                            {backup.backup_type === "automatic" ? "Automático" : "Manual"}
                          </span>
                          <span className="dbe-pill" data-tone={backupType.tone}>
                            {backupType.label}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="dbe-btn"
                          style={{ height: "auto", padding: "7px 12px", fontSize: 12 }}
                          onClick={() => handlePrepareRestore(backup)}
                          disabled={busy || isPreparingRestore}
                        >
                          {busy ? (
                            <span className="dbe-spin" />
                          ) : (
                            <span className="material-icons" style={{ fontSize: 15 }}>
                              restore
                            </span>
                          )}
                          Restaurar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historial */}
      <div style={{ margin: "26px 0 8px" }}>
        <span className="eyebrow">Historial de operaciones</span>
      </div>
      <div className="dbe-table-wrap" style={{ marginTop: 0 }}>
        <div className="dbe-scroll">
          <table className="dbe-table">
            <thead>
              <tr>
                <th>Operación</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((item) => {
                const isRestore = item.metadata?.action === "restore";
                const statusTone =
                  item.status === "completed"
                    ? "ok"
                    : item.status === "failed"
                      ? "warn"
                      : item.status === "running"
                        ? "accent"
                        : "mute";
                const statusLabel =
                  item.status === "completed"
                    ? "Completado"
                    : item.status === "failed"
                      ? "Fallido"
                      : item.status === "running"
                        ? "En progreso"
                        : "Pendiente";
                return (
                  <tr key={item.id} style={{ cursor: "default" }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          className="material-icons"
                          style={{ fontSize: 16, color: "var(--ink-4)" }}
                        >
                          {isRestore ? "restore" : "backup"}
                        </span>
                        <span className="dbe-cell-strong" style={{ fontWeight: 500 }}>
                          {isRestore ? "Restauración" : "Backup"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="dbe-pill" data-tone={statusTone}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="dbe-cell-mono">{formatDate(item.started_at)}</td>
                    <td>
                      <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                        {item.record_count > 0 && `${item.record_count} registros`}
                        {item.tables_backed_up?.length > 0 &&
                          ` · ${item.tables_backed_up.length} tablas`}
                      </span>
                      {item.error_message && (
                        <span style={{ color: "var(--warn)", marginLeft: 8, fontSize: 12 }}>
                          Error: {item.error_message}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmación tipada de restauración */}
      {restoreTarget && (
        <div className="dbe dbe-modal-bg" onClick={() => !isRestoring && setRestoreTarget(null)}>
          <div className="dbe-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="dbe-modal-head">
              <div>
                <span className="eyebrow" style={{ color: "var(--warn)" }}>
                  Acción destructiva
                </span>
                <h3 className="serif">Restaurar backup</h3>
              </div>
            </div>
            <div className="dbe-modal-body">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "var(--warn-s)",
                  border: "1px solid var(--warn)",
                  marginBottom: 16,
                }}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: 17, color: "var(--warn)", flexShrink: 0 }}
                >
                  warning_amber
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                  Los datos actuales serán <strong>reemplazados</strong> por el contenido de este
                  backup. Esta operación no se puede deshacer.
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 13,
                  color: "var(--ink-2)",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-3)" }}>Archivo</span>
                  <span className="mono">{restoreTarget.file.file_name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-3)" }}>Fecha</span>
                  <span className="mono">{formatDate(restoreTarget.info?.created_at)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-3)" }}>Registros</span>
                  <span className="mono">{restoreTarget.totalRecords}</span>
                </div>
                {restoreTarget.tables.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ color: "var(--ink-3)" }}>Tablas</span>
                    <span style={{ textAlign: "right" }}>{restoreTarget.tables.join(", ")}</span>
                  </div>
                )}
              </div>
              <label className="dbe-flabel">
                <span>Escribí RESTAURAR para confirmar</span>
              </label>
              <input
                className="dbe-field"
                value={restoreConfirmText}
                onChange={(e) => setRestoreConfirmText(e.target.value)}
                placeholder="RESTAURAR"
                autoFocus
              />
            </div>
            <div className="dbe-modal-foot">
              <button
                className="dbe-btn"
                onClick={() => setRestoreTarget(null)}
                disabled={isRestoring}
              >
                Cancelar
              </button>
              <button
                className="dbe-btn"
                style={{ background: "var(--warn)", color: "#fff", borderColor: "var(--warn)" }}
                onClick={handleConfirmRestore}
                disabled={isRestoring || restoreConfirmText.trim().toUpperCase() !== "RESTAURAR"}
              >
                {isRestoring ? (
                  <span className="dbe-spin" style={{ borderTopColor: "#fff" }} />
                ) : (
                  <span className="material-icons" style={{ fontSize: 16 }}>
                    restore
                  </span>
                )}
                Restaurar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuración */}
      {showConfigModal && (
        <div className="dbe dbe-modal-bg" onClick={() => setShowConfigModal(false)}>
          <div className="dbe-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="dbe-modal-head">
              <div>
                <span className="eyebrow">Backups</span>
                <h3 className="serif">Configuración</h3>
              </div>
              <button
                className="dbe-modal-x"
                onClick={() => setShowConfigModal(false)}
                aria-label="Cerrar"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <div
              className="dbe-modal-body"
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <label className="dbe-cell-strong" style={{ fontWeight: 500 }}>
                  Backup automático
                </label>
                <button
                  className="dbe-btn"
                  style={{ height: "auto", padding: "6px 12px" }}
                  onClick={() => setConfigForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                >
                  <span className="dbe-pill" data-tone={configForm.enabled ? "ok" : "mute"}>
                    {configForm.enabled ? "Activado" : "Desactivado"}
                  </span>
                </button>
              </div>

              <div>
                <label className="dbe-flabel">
                  <span>Frecuencia</span>
                </label>
                <div className="dbe-sel-icon">
                  <select
                    className="dbe-field sel"
                    value={configForm.frequency}
                    onChange={(e) =>
                      setConfigForm((prev) => ({ ...prev, frequency: e.target.value as any }))
                    }
                  >
                    <option value="hourly">Cada hora</option>
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                  <span className="material-icons">expand_more</span>
                </div>
              </div>

              <div>
                <label className="dbe-flabel">
                  <span>Hora del backup</span>
                </label>
                <input
                  type="time"
                  className="dbe-field"
                  value={configForm.backup_time}
                  onChange={(e) =>
                    setConfigForm((prev) => ({ ...prev, backup_time: e.target.value }))
                  }
                />
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "var(--accent-s)",
                  border: "1px solid var(--rule-2)",
                }}
              >
                <p
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}
                >
                  3 backups inteligentes
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12,
                    color: "var(--ink-3)",
                    lineHeight: 1.7,
                  }}
                >
                  <li>1 diario — el más reciente</li>
                  <li>1 semanal — último domingo</li>
                  <li>1 mensual — primer día del mes</li>
                </ul>
              </div>
            </div>
            <div className="dbe-modal-foot">
              <button className="dbe-btn" onClick={() => setShowConfigModal(false)}>
                Cancelar
              </button>
              <button className="dbe-btn dbe-btn-primary" onClick={handleSaveConfig}>
                <span className="material-icons">save</span>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManager;
