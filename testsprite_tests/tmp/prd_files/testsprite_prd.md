# Panel de Gestión de Prácticas Profesionales (PPS) - UFLO

## Propósito del Producto
Una aplicación web para facilitar la gestión, inscripción y seguimiento de las Prácticas Profesionales Supervisadas (PPS) de la carrera de Psicología en la Universidad de Flores (UFLO). Permite a los estudiantes gestionar su trayectoria práctica y a los administrativos/directivos supervisar el proceso.

## Roles de Usuario

### 1. Estudiante
*   **Dashboard Personal**: Vista resumen de su estado actual (horas sumadas, prácticas activas, nivel de avance).
*   **Gestión de Prácticas**: Visualización de historial de prácticas. Capacidad de editar fechas de finalización y subir certificados.
*   **Inscripción (Convocatorias)**: Visualización de ofertas de prácticas disponibles (Instituciones) y postulación a las mismas.
*   **Seguimiento**: Estado de solicitudes (Pendiente, Aceptado, Rechazado).

### 2. Administrador (Directivo/Gestión)
*   **Editor DB**: Acceso CRUD completo a las tablas maestras (Estudiantes, Prácticas, Instituciones).
    *   *Estudiantes*: Ver legajo, plan de estudios y horas totales acumuladas.
    *   *Prácticas*: Asignar estudiantes a instituciones, modificar horas, validar certificados.
    *   *Instituciones*: ABM de centros de práctica, convenios y cupos.
*   **Planificación (Calendar)**: Vista de calendario para organizar fechas de inicio/fin de convocatorias.
*   **Smart Analysis**: Herramienta basada en IA para detectar instituciones con convenios por vencer o que requieren acción inmediata.
*   **Gestión de Solicitudes**: Aprobar o rechazar postulaciones de estudiantes.

## Flujos Clave a Probar (Frontend)

1.  **Login**: Autenticación contra Supabase (tabla `auth.users` vinculada a `public.users`).
2.  **Edición de Fecha (Estudiante)**:
    *   El estudiante accede a su tabla de prácticas.
    *   Hace clic en la fecha de fin de una práctica activa.
    *   Modifica el valor y guarda (debe persistir en DB).
3.  **Cálculo de Horas (Admin)**:
    *   El administrador entra al "Editor Estudiantes".
    *   El sistema debe calcular automáticamente la suma de horas de todas las prácticas del estudiante.
4.  **Visualización de Instituciones**:
    *   El listado debe filtrar correctamente por instituciones activas/inactivas.
    *   Las etiquetas de "Nuevo Convenio" o "Legacy" deben renderizarse correctamente.

## Stack Tecnológico
*   **Frontend**: React + Vite (SPA).
*   **Estilos**: TailwindCSS.
*   **Base de Datos**: Supabase (PostgreSQL + RLS).
*   **Estado**: React Query (TanStack Query).
