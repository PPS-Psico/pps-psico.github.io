export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: "solicitud_pps" | "acreditacion" | "info" | "recordatorio" | "estado" | "lanzamiento";
  link: string;
  isRead: boolean;
}
