import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Toast from "../ui/Toast";
import { ActionButton, AdminCard, StatusBadge } from "../ui/admin";
import { formatDate } from "../../utils/formatters";

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
      console.error("Error fetching backups:", error);
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
      console.error("Error fetching history:", error);
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
      console.error("Backup error:", error);
      setToastInfo({
        message: error instanceof Error ? error.message : "Error al crear backup",
        type: "error",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (backupFileName: string) => {
    try {
      setIsRestoring(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }

      // Primero verificar qué se va a restaurar
      const checkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-backup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            backup_file_name: backupFileName,
            dry_run: true,
          }),
        }
      );

      const checkData = await checkResponse.json();

      if (!checkResponse.ok) {
        throw new Error(checkData.message || "Failed to check backup");
      }

      // Confirmar restauración
      const confirmed = window.confirm(
        `¿Estás seguro de que quieres restaurar el backup?\n\n` +
          `Archivo: ${backupFileName}\n` +
          `Fecha del backup: ${formatDate(checkData.backup_info?.created_at)}\n` +
          `Tablas: ${checkData.tables_to_restore?.join(", ")}\n` +
          `Total de registros: ${Object.values(checkData.records_per_table).reduce((a: any, b: any) => a + b, 0)}\n\n` +
          `⚠️ ADVERTENCIA: Los datos actuales serán reemplazados.`
      );

      if (!confirmed) {
        setIsRestoring(false);
        return;
      }

      // Realizar restauración
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-backup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            backup_file_name: backupFileName,
            dry_run: false,
          }),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Restore failed");
      }

      setToastInfo({
        message: `Restauración completada: ${responseData.summary?.total_records_restored} registros restaurados`,
        type: "success",
      });
      fetchHistory();
    } catch (error) {
      console.error("Restore error:", error);
      setToastInfo({
        message: error instanceof Error ? error.message : "Error al restaurar backup",
        type: "error",
      });
    } finally {
      setIsRestoring(false);
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
      console.error("Config error:", error);
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

  // Función para determinar el tipo de backup (diario, semanal, mensual)
  const getBackupType = (backup: BackupFile, index: number) => {
    const date = new Date(backup.created_at);

    // El más reciente siempre es el diario
    if (index === 0) {
      return { label: "Diario", color: "bg-blue-100 text-blue-800" };
    }

    // Si es domingo (0), es semanal
    if (date.getDay() === 0) {
      return { label: "Semanal", color: "bg-emerald-100 text-emerald-800" };
    }

    // Si es día 1 del mes, es mensual
    if (date.getDate() === 1) {
      return { label: "Mensual", color: "bg-purple-100 text-purple-800" };
    }

    // Por defecto, es un backup adicional (no debería pasar con la nueva lógica)
    return { label: "Extra", color: "bg-slate-100 text-slate-800" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white">Gestión de Backups</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Realiza y restaura backups de la base de datos
          </p>
        </div>
        <div className="flex gap-3">
          <ActionButton
            variant="secondary"
            icon="settings"
            onClick={() => setShowConfigModal(true)}
          >
            Configuración
          </ActionButton>
          <ActionButton
            variant="primary"
            icon="backup"
            onClick={handleCreateBackup}
            loading={isBackingUp}
          >
            Crear Backup
          </ActionButton>
        </div>
      </div>

      {/* Estado del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard variant="default">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${config?.enabled ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"}`}
            >
              <span className="material-icons">autorenew</span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Backup Automático</p>
              <p className="font-bold text-slate-800">
                {config?.enabled ? "Activado" : "Desactivado"}
              </p>
            </div>
          </div>
        </AdminCard>

        <AdminCard variant="default">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <span className="material-icons">schedule</span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Frecuencia</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Diario
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  Semanal
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  Mensual
                </span>
              </div>
            </div>
          </div>
        </AdminCard>

        <AdminCard variant="default">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
              <span className="material-icons">history</span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Último Backup</p>
              <p className="font-bold text-slate-800">
                {config?.last_backup_at ? formatDate(config.last_backup_at) : "Nunca"}
              </p>
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Lista de Backups */}
      <AdminCard
        header={
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="material-icons text-blue-600">storage</span>
              Backups Disponibles ({backups.length})
            </h3>
          </div>
        }
      >
        {backups.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-icons text-6xl text-slate-300 mb-4">cloud_off</span>
            <p className="text-slate-500">No hay backups disponibles</p>
            <p className="text-sm text-slate-400 mt-2">
              Crea tu primer backup usando el botón "Crear Backup"
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                    Archivo
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                    Fecha
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                    Tamaño
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                    Registros
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                    Tipo
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup, index) => {
                  const backupType = getBackupType(backup, index);
                  return (
                    <tr
                      key={backup.file_name}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="material-icons text-slate-400">backup</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                            {backup.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatDate(backup.created_at)}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatFileSize(backup.size_bytes)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {backup.record_count} registros
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <StatusBadge
                            status={backup.backup_type === "automatic" ? "info" : "warning"}
                            size="sm"
                          >
                            {backup.backup_type === "automatic" ? "Automático" : "Manual"}
                          </StatusBadge>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${backupType.color}`}
                          >
                            {backupType.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            icon="restore"
                            onClick={() => {
                              setSelectedBackup(backup);
                              handleRestore(backup.file_name);
                            }}
                            loading={isRestoring && selectedBackup?.file_name === backup.file_name}
                          >
                            Restaurar
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Historial */}
      <AdminCard
        header={
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-icons text-purple-600">history</span>
            Historial de Operaciones
          </h3>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                  Operación
                </th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                  Estado
                </th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                  Fecha
                </th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                  Detalles
                </th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="material-icons text-slate-400">
                        {item.metadata?.action === "restore" ? "restore" : "backup"}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-sm capitalize">
                        {item.metadata?.action === "restore" ? "Restauración" : "Backup"}
                      </span>
                      <StatusBadge
                        status={item.backup_type === "automatic" ? "info" : "warning"}
                        size="sm"
                      >
                        {item.backup_type === "automatic" ? "Auto" : "Manual"}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge
                      status={
                        item.status === "completed"
                          ? "success"
                          : item.status === "failed"
                            ? "error"
                            : item.status === "running"
                              ? "info"
                              : "neutral"
                      }
                      size="sm"
                    >
                      {item.status === "completed" && "Completado"}
                      {item.status === "failed" && "Fallido"}
                      {item.status === "running" && "En progreso"}
                      {item.status === "pending" && "Pendiente"}
                    </StatusBadge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                    {item.record_count > 0 && `${item.record_count} registros`}
                    {item.tables_backed_up?.length > 0 &&
                      ` • ${item.tables_backed_up.length} tablas`}
                    {item.error_message && (
                      <span className="text-rose-600 ml-2">Error: {item.error_message}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Modal de Configuración */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                Configuración de Backups
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700 dark:text-slate-300">
                  Backup Automático
                </label>
                <button
                  onClick={() => setConfigForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    configForm.enabled ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      configForm.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Frecuencia
                </label>
                <select
                  value={configForm.frequency}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      frequency: e.target.value as any,
                    }))
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                >
                  <option value="hourly">Cada hora</option>
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Hora del Backup
                </label>
                <input
                  type="time"
                  value={configForm.backup_time}
                  onChange={(e) =>
                    setConfigForm((prev) => ({ ...prev, backup_time: e.target.value }))
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Estrategia de Retención
                </label>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                    <strong>3 backups inteligentes:</strong>
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <li>
                      ✅ <strong>1 diario</strong> - El más reciente
                    </li>
                    <li>
                      ✅ <strong>1 semanal</strong> - Último domingo
                    </li>
                    <li>
                      ✅ <strong>1 mensual</strong> - Último 1ro del mes
                    </li>
                  </ul>
                </div>
                <p className="text-xs text-slate-500 mt-2">Espacio total: ~15MB (3 × 5MB)</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <ActionButton variant="ghost" onClick={() => setShowConfigModal(false)}>
                Cancelar
              </ActionButton>
              <ActionButton variant="primary" icon="save" onClick={handleSaveConfig}>
                Guardar
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManager;
