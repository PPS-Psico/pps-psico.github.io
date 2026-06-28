import { supabase } from "../lib/supabaseClient";
import { logger } from "../utils/logger";
import { getErrorMessage } from "../utils/getErrorMessage";

const TODOIST_API_BASE = "https://api.todoist.com/api/v1";
// El token NO debe vivir en el código. Se lee de una variable de entorno.
// IMPORTANTE: rotar el token anterior (estuvo hardcodeado en el repo) y setear
// VITE_TODOIST_TOKEN en el entorno. Idealmente, proxyear vía Edge Function para
// no exponer el token en el bundle del cliente.
const TODOIST_TOKEN = import.meta.env.VITE_TODOIST_TOKEN || "";

interface TaskData {
  todoist_task_id?: number;
  ppsName: string;
  content: string;
  due_date?: string;
  labels?: string[];
  priority?: number;
  institutionPhone?: string;
}

interface SyncCommand {
  type: string;
  temp_id?: string;
  uuid: string;
  args: Record<string, unknown>;
}

/** Respuesta (parcial) del endpoint Sync v1 de Todoist que consumimos. */
interface SyncResponse {
  projects?: { id: string; name: string }[];
  labels?: { id: string; name: string }[];
  sync_status?: Record<string, unknown>;
  temp_id_mapping?: Record<string, string>;
  user?: { full_name?: string };
}

/**
 * Servicio de integración directa con la API v1 (Sync API) de Todoist
 * https://developer.todoist.com/api/v1/
 *
 * La API v1 usa el endpoint /sync con comandos en formato x-www-form-urlencoded
 */
class TodoistService {
  private async sync(commands: SyncCommand[]): Promise<SyncResponse> {
    const formData = new URLSearchParams();
    formData.append("sync_token", "*");
    formData.append("resource_types", '["all"]');
    formData.append("commands", JSON.stringify(commands));

    const response = await fetch(`${TODOIST_API_BASE}/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TODOIST_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[TodoistService] Error en sync:`, errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  private generateUUID(): string {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  }

  /**
   * Obtiene o crea un proyecto específico por nombre
   */
  private async getOrCreateProject(name: string): Promise<string> {
    // Primero hacemos un sync para obtener los proyectos existentes
    const syncData = await this.sync([]);

    const existingProject = syncData.projects?.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );

    if (existingProject) {
      logger.info(`[TodoistService] Proyecto "${name}" ya existe con ID: ${existingProject.id}`);
      return existingProject.id;
    }

    // Crear proyecto si no existe
    const commands: SyncCommand[] = [
      {
        type: "project_add",
        temp_id: `project-${Date.now()}`,
        uuid: this.generateUUID(),
        args: {
          name: name,
          color: "berry_red", // Rojo para Convocatorias
        },
      },
    ];

    const response = await this.sync(commands);

    if (response.sync_status && Object.values(response.sync_status).some((s) => s !== "ok")) {
      logger.error("[TodoistService] Error al crear proyecto:", response.sync_status);
      throw new Error("Error al crear proyecto en Todoist");
    }

    // El ID real está en temp_id_mapping
    const projectId = response.temp_id_mapping?.[commands[0].temp_id!];
    logger.info(`[TodoistService] Proyecto "${name}" creado con ID: ${projectId}`);

    return projectId ?? "";
  }

  /**
   * Obtiene o crea una etiqueta específica
   */
  private async getOrCreateLabel(name: string): Promise<string> {
    const syncData = await this.sync([]);

    const existingLabel = syncData.labels?.find((l) => l.name.toLowerCase() === name.toLowerCase());

    if (existingLabel) {
      logger.info(`[TodoistService] Etiqueta "${name}" ya existe con ID: ${existingLabel.id}`);
      return existingLabel.id;
    }

    const commands: SyncCommand[] = [
      {
        type: "label_add",
        temp_id: `label-${name}-${Date.now()}`,
        uuid: this.generateUUID(),
        args: {
          name: name,
          color: this.getLabelColor(name),
          is_favorite: true,
        },
      },
    ];

    const response = await this.sync(commands);

    if (response.sync_status && Object.values(response.sync_status).some((s) => s !== "ok")) {
      logger.error("[TodoistService] Error al crear etiqueta:", response.sync_status);
      throw new Error("Error al crear etiqueta en Todoist");
    }

    const labelId = response.temp_id_mapping?.[commands[0].temp_id!];
    logger.info(`[TodoistService] Etiqueta "${name}" creada con ID: ${labelId}`);

    return labelId ?? "";
  }

  /**
   * Obtiene el color para una etiqueta
   */
  private getLabelColor(name: string): string {
    const colors: Record<string, string> = {
      Convocatoria: "red",
      Gestión: "yellow",
      Lanzamiento: "blue",
      Urgente: "berry_red",
    };

    return colors[name] || "grey";
  }

  /**
   * Crea una tarea de lanzamiento en Todoist
   */
  async createLanzamientoTask(
    ppsName: string,
    launchDate?: string,
    description?: string,
    priority: number = 2,
    institutionPhone?: string
  ): Promise<{ success: boolean; item_id?: string; error?: string }> {
    try {
      logger.info("[TodoistService] Iniciando creación de tarea...", { ppsName, launchDate });

      // Obtener o crear etiquetas (no necesitamos el proyecto para tareas en inbox)
      const labelIds = await Promise.all([
        this.getOrCreateLabel("Convocatoria"),
        this.getOrCreateLabel("Lanzamiento"),
      ]);

      // Construir la descripción
      let fullDescription = "";

      if (description) {
        fullDescription = description;
      } else {
        fullDescription = `🎓 Orientación: ${this.extractOrientation(ppsName)}`;
        if (institutionPhone) {
          fullDescription += `\n📱 WhatsApp: ${institutionPhone}`;
        }
      }

      // Crear el comando para agregar la tarea
      const tempId = `task-${Date.now()}`;
      const commands: SyncCommand[] = [
        {
          type: "item_add",
          temp_id: tempId,
          uuid: this.generateUUID(),
          args: {
            content: `Lanzar ${ppsName}`,
            description: fullDescription,
            due: launchDate ? { string: launchDate, lang: "es" } : undefined,
            priority: priority,
            labels: labelIds,
          },
        },
      ];

      logger.info("[TodoistService] Enviando comando:", JSON.stringify(commands, null, 2));

      const response = await this.sync(commands);

      logger.info("[TodoistService] Respuesta:", JSON.stringify(response, null, 2));

      // Verificar si hubo errores
      const syncStatus = response.sync_status?.[commands[0].uuid];
      if (syncStatus && syncStatus !== "ok") {
        logger.error("[TodoistService] Error en sync:", syncStatus);
        throw new Error(`Error de Todoist: ${JSON.stringify(syncStatus)}`);
      }

      // Obtener el ID real de la tarea
      const itemId = response.temp_id_mapping?.[tempId];

      logger.info("[TodoistService] Tarea creada exitosamente con ID:", itemId);

      // Guardar en Supabase para seguimiento
      await this.saveTaskToSupabase({
        todoist_task_id: parseInt(itemId ?? "", 10),
        ppsName,
        content: `Lanzar ${ppsName}`,
        due_date: launchDate,
        labels: ["Convocatoria", "Lanzamiento"],
        priority,
        institutionPhone,
      });

      return { success: true, item_id: itemId };
    } catch (error) {
      logger.error("[TodoistService] Error en createLanzamientoTask:", error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Extrae la orientación del nombre de la PPS
   */
  private extractOrientation(ppsName: string): string {
    const orientations = ["Clínica", "Educacional", "Laboral", "Comunitaria"];

    for (const orient of orientations) {
      if (ppsName.toLowerCase().includes(orient.toLowerCase())) {
        return orient;
      }
    }

    return "No especificada";
  }

  /**
   * Guarda la tarea en Supabase para seguimiento
   */
  private async saveTaskToSupabase(data: TaskData): Promise<void> {
    try {
      const { error } = await supabase.from("todoist_tasks" as any).insert({
        todoist_task_id: data.todoist_task_id,
        pps_name: data.ppsName,
        content: data.content,
        due_date: data.due_date,
        labels: JSON.stringify(data.labels),
        priority: data.priority,
        institution_phone: data.institutionPhone,
      } as any);

      if (error) {
        logger.warn("[TodoistService] No se pudo guardar en Supabase:", error.message);
      }
    } catch (error) {
      logger.warn("[TodoistService] Error en saveTaskToSupabase:", error);
    }
  }

  /**
   * Prueba la conexión con Todoist
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.sync([]);
      logger.info("[TodoistService] Conexión exitosa. Usuario:", response.user?.full_name);
      return true;
    } catch (error) {
      logger.error("[TodoistService] Error de conexión:", error);
      return false;
    }
  }
}

export default new TodoistService();
