// Servicio de Integración con Todoist
// Permite crear tareas automáticamente al confirmar lanzamientos

export interface TodoistTaskCreation {
  content: string; // Título de la tarea
  description?: string; // Descripción opcional
  due_string?: string; // Fecha en formato natural: "tomorrow", "15/03/2026"
  priority?: number; // 1 (normal) a 4 (urgente)
  labels?: string[]; // Etiquetas como ["Convocatoria", "Gestión"]
}

export const TODOIST_LABELS = {
  CONVOCATORIA: "Convocatoria",
  GESTION: "Gestión",
  URGENTE: "Urgente",
  LANZAMIENTO: "Lanzamiento",
} as const;

/**
 * Formatea el nombre de la PPS para una tarea de Todoist
 * Ejemplo: "Clínica Demo - Sede A" → "Lanzar Clínica Demo - Sede A"
 */
export const formatTaskName = (ppsName: string): string => {
  return `Lanzar ${ppsName}`;
};

/**
 * Crea una tarea de Todoist para un lanzamiento confirmado
 *
 * @param ppsName Nombre de la PPS
 * @param launchDate Fecha de lanzamiento (formato YYYY-MM-DD)
 * @param description Descripción opcional (horarios, comisión, etc.)
 * @returns Objeto para crear la tarea
 */
export const createTodoistTask = (
  ppsName: string,
  launchDate?: string,
  description?: string
): TodoistTaskCreation => {
  const task: TodoistTaskCreation = {
    content: formatTaskName(ppsName),
    labels: [TODOIST_LABELS.CONVOCATORIA, TODOIST_LABELS.LANZAMIENTO],
    priority: 2, // Prioridad media
  };

  // Agregar fecha si existe
  if (launchDate) {
    task.due_string = formatTodoistDate(launchDate);
    task.description = description;
  }

  // Agregar descripción si existe
  if (description) {
    const existingDesc = task.description || "";
    task.description = existingDesc + (existingDesc ? "\n\n" : "") + description;
  }

  return task;
};

/**
 * Convierte fecha de lanzamiento (YYYY-MM-DD) a formato de Todoist
 * Todoist acepta formatos como "2026-03-15", "15/03/2026", "next Friday"
 */
const formatTodoistDate = (date: string): string => {
  // Si ya viene en formato ISO, devolverlo tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  // Si viene en formato DD/MM/YYYY, convertir a YYYY-MM-DD
  const parts = date.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return date;
};

/**
 * Determina si se debe crear una tarea en Todoist
 * Se crea cuando:
 * 1. El estado cambia a "Relanzamiento Confirmado"
 * 2. Hay una fecha de relanzamiento
 */
export const shouldCreateTodoistTask = (
  oldStatus: string | undefined,
  newStatus: string,
  oldRelaunchDate: string | undefined,
  newRelaunchDate: string | undefined
): boolean => {
  // Solo crear cuando el nuevo estado es confirmado
  if (newStatus !== "Relanzamiento Confirmado") {
    return false;
  }

  // No crear si ya tenía una fecha y no cambió
  if (oldStatus === "Relanzamiento Confirmado" && oldRelaunchDate === newRelaunchDate) {
    return false;
  }

  // Crear si hay una fecha nueva
  return !!newRelaunchDate;
};

/**
 * Genera descripción detallada para la tarea
 * Incluye orientación, cupos, horarios, etc.
 */
export const generateTaskDescription = (pps: any, institutionPhone?: string): string => {
  const parts: string[] = [];

  // Orientación
  if (pps.orientacion) {
    parts.push(`🎓 Orientación: ${pps.orientacion}`);
  }

  // Cupos
  if (pps.cupos_disponibles) {
    parts.push(`👥 Cupos: ${pps.cupos_disponibles}`);
  }

  // Horario
  if (pps.horario_seleccionado) {
    parts.push(`⏰ Horario: ${pps.horario_seleccionado}`);
  }

  // Teléfono de la institución
  if (institutionPhone) {
    parts.push(`📱 WhatsApp: ${institutionPhone}`);
  }

  return parts.join("\n");
};
