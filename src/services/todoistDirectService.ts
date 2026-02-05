import { supabase } from "../lib/supabaseClient";

const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";
const TODOIST_TOKEN = "7b9437532f7ed754fd70ee3c6e2c1b47e4732e40";

interface TodoistResponse {
  success: boolean;
  id?: number;
  item_id?: number;
}

interface TaskData {
  todoist_task_id?: number;
  id?: number;
  item_id?: number;
  ppsName: string;
  content: string;
  due_date?: string;
  labels?: string[];
  priority?: number;
  institutionPhone?: string;
}

/**
 * Servicio de integración directa con la API REST v2 de Todoist
 * No depende del servidor MCP, usa fetch directo a la API
 */
class TodoistService {
  private async post<T = any>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${TODOIST_API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TODOIST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TodoistService] Error en ${endpoint}:`, errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Busca o crea un proyecto específico por nombre
   */
  private async getOrCreateProject(name: string): Promise<number> {
    // Buscar proyectos existentes
    const projectsResponse = await this.post<any>("projects", {
      sync_token: "*",
    });

    if (!projectsResponse.success || !projectsResponse.projects) {
      throw new Error("Error al obtener proyectos");
    }

    // Buscar si ya existe el proyecto "Convocatorias 2026"
    const existingProject = projectsResponse.projects.find(
      (p: any) => p.name.toLowerCase() === name.toLowerCase()
    );

    if (existingProject) {
      console.log(`[TodoistService] Proyecto "${name}" ya existe con ID: ${existingProject.id}`);
      return existingProject.id;
    }

    // Crear proyecto si no existe
    const projectData = {
      type: "project_add",
      temp_id: "convocatorias-project",
      args: {
        name: name,
        color: "#ff3e00", // Rojo suave para Convocatorias
        inbox: true,
      },
    };

    const response = await this.post<TodoistResponse>("projects", projectData);

    if (!response.success) {
      throw new Error("Error al crear proyecto");
    }

    return response.id!;
  }

  /**
   * Busca o crea una etiqueta específica
   */
  private async getOrCreateLabel(name: string): Promise<number> {
    const labelsResponse = await this.post<any>("labels", {
      sync_token: "*",
    });

    if (!labelsResponse.success || !labelsResponse.labels) {
      throw new Error("Error al obtener etiquetas");
    }

    const existingLabel = labelsResponse.labels.find(
      (l: any) => l.name.toLowerCase() === name.toLowerCase()
    );

    if (existingLabel) {
      console.log(`[TodoistService] Etiqueta "${name}" ya existe con ID: ${existingLabel.id}`);
      return existingLabel.id;
    }

    const labelData = {
      type: "label_add",
      temp_id: `${name}-label`,
      args: {
        name: name,
        color: this.getLabelColor(name),
        is_favorite: true,
        item_order: 0,
      },
    };

    const response = await this.post<TodoistResponse>("labels", labelData);

    if (!response.success) {
      throw new Error("Error al crear etiqueta");
    }

    return response.id!;
  }

  /**
   * Obtiene el color para una etiqueta
   */
  private getLabelColor(name: string): string {
    const colors: Record<string, string> = {
      Convocatoria: "#ff4d4d", // Rojo suave
      Gestión: "#ffcc00", // Naranja/ámbar
      Lanzamiento: "#3b82f6", // Azul
      Urgente: "#cf3333", // Rojo oscuro
    };

    return colors[name] || "#888888"; // Gris por defecto
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
  ): Promise<TodoistResponse> {
    try {
      // Obtener o crear el proyecto de convocatorias
      const projectId = await this.getOrCreateProject("Convocatorias 2026");

      // Obtener o crear etiquetas necesarias
      const labelIds: number[] = await Promise.all([
        this.getOrCreateLabel("Convocatoria"),
        this.getOrCreateLabel("Lanzamiento"),
      ]);

      // Construir la descripción
      let fullDescription = "";

      if (description) {
        fullDescription = description;
      } else {
        // Generar descripción automáticamente si no se proporciona
        fullDescription = `🎓 Orientación: ${this.extractOrientation(ppsName)}`;

        if (institutionPhone) {
          fullDescription += `\n📱 WhatsApp: ${institutionPhone}`;
        }
      }

      // Datos de la tarea
      const taskData = {
        type: "item_add",
        temp_id: `launch-task-${ppsName.replace(/\s+/g, "-").slice(0, 50)}`,
        args: {
          content: `Lanzar ${ppsName}`,
          description: fullDescription,
          due_string: launchDate,
          due_lang: "es", // Idioma español
          priority: priority,
          labels: labelIds.map(String), // Convertir a strings
          auto_reminder: true, // Recordatorio automático
        },
      };

      console.log("[TodoistService] Creando tarea:", {
        content: `Lanzar ${ppsName}`,
        due_string: launchDate,
        labels: ["Convocatoria", "Lanzamiento"],
      });

      const response = await this.post<TodoistResponse>("items", taskData);

      if (!response.success) {
        throw new Error("Error al crear tarea");
      }

      console.log("[TodoistService] Tarea creada con ID:", response.item_id);

      // Guardar en Supabase para seguimiento (si la tabla existe)
      await this.saveTaskToSupabase({
        item_id: response.item_id,
        ppsName,
        content: `Lanzar ${ppsName}`,
        due_date: launchDate,
        labels: ["Convocatoria", "Lanzamiento"],
        priority,
        institutionPhone,
      });

      return response;
    } catch (error) {
      console.error("[TodoistService] Error en createLanzamientoTask:", error);
      throw error;
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
      // Intentar guardar en Supabase (puede fallar si la tabla no existe)
      const { error } = await supabase.from("todoist_tasks" as any).insert({
        todoist_task_id: data.item_id || data.id,
        pps_name: data.ppsName,
        content: data.content,
        due_date: data.due_date,
        labels: JSON.stringify(data.labels),
        priority: data.priority,
        institution_phone: data.institutionPhone,
      } as any);

      if (error) {
        console.warn(
          "[TodoistService] No se pudo guardar en Supabase (tabla puede no existir):",
          error.message
        );
      }
    } catch (error) {
      console.warn("[TodoistService] Error en saveTaskToSupabase:", error);
    }
  }
}

export default new TodoistService();
