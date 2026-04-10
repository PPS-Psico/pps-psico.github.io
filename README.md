# Mi Panel Academico

Aplicacion web para gestion operativa de Practicas Profesionales Supervisadas (PPS) de UFLO.

Importante: este panel se usa como herramienta interna de seguimiento y apoyo operativo. No reemplaza los registros academicos oficiales de la facultad ni debe tomarse como fuente definitiva para acreditaciones o validaciones institucionales.

Hoy el sistema ya cubre flujos reales de estudiantes y administracion. El foco actual del repo no es reescribir ni "demo-izar" la app, sino profesionalizarla: ordenar arquitectura, endurecer seguridad y documentar mejor el comportamiento real.

## Estado actual

- Frontend en React + Vite + TypeScript.
- Estilos con Tailwind CSS.
- Backend principal en Supabase.
- Operaciones sensibles y automatizaciones en Supabase Edge Functions.
- Caching y estado async con React Query.
- El proyecto Supabase operativo referenciado en la documentacion interna es `qxnxtnhtbpsgzprqtrjl`.

## Flujos principales

### Estudiante

- Inicio de sesion.
- Visualizacion del panel personal.
- Seguimiento de horas y practicas.
- Inscripcion a convocatorias.
- Seguimiento de solicitudes y practicas activas.
- Entrega y seguimiento de informes.
- Flujo de compromiso digital previo al inicio.

### Administracion

- Busqueda y seguimiento de estudiantes.
- Gestion de convocatorias y lanzamientos.
- Seleccion de alumnos.
- Seguimiento de practicas activas.
- Correccion de informes.
- Generacion de datos operativos y seguros.
- Recordatorios, notificaciones y automatizaciones.
- Backup y restauracion desde herramientas administrativas.

## Arquitectura real

La documentacion vieja del proyecto todavia arrastraba referencias a Airtable. Eso ya no representa el backend principal del sistema.

Resumen actual:

- La app consume Supabase desde el frontend con autenticacion y RLS.
- Varias acciones sensibles se apoyan en Edge Functions.
- Existen integraciones secundarias o experimentales que no forman parte del nucleo principal.
- La documentacion de referencia viva arranca en [docs/README.md](./docs/README.md).

## Variables de entorno para desarrollo

Copia `.env.example` a `.env` y completa los valores necesarios.

### Requeridas

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Opcionales segun modulo

- `VITE_GA4_MEASUREMENT_ID`
- `VITE_SENTRY_DSN`
- `VITE_ENABLE_MONITORING_IN_DEV`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_ONESIGNAL_APP_ID`
- `VITE_ONESIGNAL_SAFARI_WEB_ID`
- `VITE_APP_VERSION`

### Variables legacy

Las variables de Airtable ya no forman parte de la configuracion esperada del frontend actual. Si todavia aparecen en scripts o artefactos heredados, deben leerse como legado tecnico y no como setup recomendado.

## Desarrollo local

### Requisitos

- Node.js 20 o superior.
- npm.

### Instalacion

```bash
npm install
```

### Comandos utiles

```bash
npm run dev
npm run build
npm run lint
npm run type-check
npm run test
```

## Edge Functions presentes en el repo

- `automated-backup`
- `generate-content`
- `health-check`
- `launch-scheduler`
- `list-backups`
- `restore-backup`
- `send-fcm-notification`

## Documentacion recomendada

- [docs/README.md](./docs/README.md): indice general de documentacion.
- [docs/architecture-current.md](./docs/architecture-current.md): foto tecnica actual.
- [docs/internal-professionalization-plan.md](./docs/internal-professionalization-plan.md): roadmap interno y prioridades.
- [SECURITY_REPORT.md](./SECURITY_REPORT.md): estado de seguridad y advertencias.
- [GITHUB_SECRETS.md](./GITHUB_SECRETS.md): configuracion de secretos y entornos.
- [GUIA_GESTION_ADMIN.md](./GUIA_GESTION_ADMIN.md): guia funcional del panel admin.

## Criterio de documentacion

Si una mejora cambia arquitectura, seguridad, estados o integraciones, debe actualizar al menos uno de estos artefactos:

- `README.md`
- `docs/architecture-current.md`
- `docs/internal-professionalization-plan.md`
- documento tematico correspondiente
