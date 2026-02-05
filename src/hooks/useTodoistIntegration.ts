import { useCallback } from "react";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_CUPOS_DISPONIBLES_LANZAMIENTOS,
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
} from "../constants";
import {
  createTodoistTask,
  generateTaskDescription,
  shouldCreateTodoistTask,
} from "../services/todoistService";

type LanzamientoPPS = any;

interface UseTodoistIntegrationProps {
  onToast?: (message: string, type: "success" | "error") => void;
}

export const useTodoistIntegration = ({ onToast }: UseTodoistIntegrationProps = {}) => {
  const handleGestionChange = useCallback(
    async (
      pps: LanzamientoPPS,
      oldFields: Partial<LanzamientoPPS>,
      newFields: Partial<LanzamientoPPS>
    ) => {
      const oldStatus = oldFields[FIELD_ESTADO_GESTION_LANZAMIENTOS];
      const newStatus = newFields[FIELD_ESTADO_GESTION_LANZAMIENTOS];
      const oldRelaunchDate = oldFields[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS];
      const newRelaunchDate = newFields[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS];

      // Verificar si se debe crear tarea en Todoist
      if (!shouldCreateTodoistTask(oldStatus, newStatus, oldRelaunchDate, newRelaunchDate)) {
        return;
      }

      try {
        // Generar descripción de la tarea
        const description = generateTaskDescription(pps, pps.telefono_institucion);

        // Crear tarea en Todoist
        const task = createTodoistTask(
          pps[FIELD_NOMBRE_PPS_LANZAMIENTOS],
          newRelaunchDate,
          description
        );

        // TODO: Crear la tarea usando el servicio de Todoist
        // const result = await todoist_create_task(task);
        // if (result) {
        //   onToast?.("Tarea creada en Todoist ✅", "success");
        // }

        console.log("[Todoist Integration] Tarea a crear:", {
          content: task.content,
          due_string: task.due_string,
          labels: task.labels,
        });

        // Por ahora, solo loguear (integración pendiente)
        // onToast?.("Lanzamiento confirmado (Todoist: pendiente de configuración)", "success");
      } catch (error) {
        console.error("[Todoist Integration] Error al crear tarea:", error);
        // onToast?.("Error al crear tarea en Todoist", "error");
      }
    },
    [onToast]
  );

  const createManualTodoistTask = useCallback(
    async (pps: LanzamientoPPS) => {
      try {
        const description = generateTaskDescription(pps, pps.telefono_institucion);
        const task = createTodoistTask(
          pps[FIELD_NOMBRE_PPS_LANZAMIENTOS],
          pps[FIELD_FECHA_RELANZAMIENTO_LANZAMIENTOS],
          description
        );

        console.log("[Todoist Integration] Creando tarea manual:", task);

        // TODO: Implementar cuando Todoist MCP esté configurado
        onToast?.("Creando tarea en Todoist...", "success");
      } catch (error) {
        console.error("[Todoist Integration] Error:", error);
        onToast?.("Error al crear tarea", "error");
      }
    },
    [onToast]
  );

  return {
    handleGestionChange,
    createManualTodoistTask,
  };
};
