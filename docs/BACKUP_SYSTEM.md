# Sistema de backups

## Alcance

El repo incluye una solucion de backups y restauracion apoyada en Supabase Edge Functions y una interfaz administrativa.

Este documento describe el modulo tal como aparece hoy en el codigo. No debe leerse como garantia de recuperacion total sin validacion operativa.

## Piezas principales

### Edge Functions

- `automated-backup`
- `list-backups`
- `restore-backup`

### UI administrativa

- `src/components/admin/BackupManager.tsx`

El componente consume las funciones Edge autenticadas y permite:

- consultar configuracion;
- listar backups disponibles;
- crear backups manuales;
- consultar historial;
- lanzar restauraciones con confirmacion previa.

## Flujo actual

### Consulta inicial

`BackupManager` pide:

- `list-backups?action=list`
- `list-backups?action=history`

Para eso necesita una sesion autenticada y un access token valido.

### Backup manual

El panel llama a `POST /functions/v1/automated-backup` con JWT del usuario autenticado.

### Restauracion

El flujo actual tiene dos pasos:

1. `dry_run: true` para inspeccionar el backup.
2. `dry_run: false` para confirmar la restauracion real.

Esto reduce el riesgo de restaurar "a ciegas", pero sigue siendo una operacion sensible que debe limitarse a roles administrativos.

## Configuracion y secretos

### GitHub / CI

Si se dispara desde automatizaciones externas, puede intervenir `CRON_SECRET`.

### Supabase

Segun el despliegue, suelen ser necesarios:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Los valores reales no deben documentarse en el repo.

## Automatizacion

El documento historico proponia varias opciones de cron. Eso sigue siendo valido en concepto, pero la decision correcta depende del entorno real.

Opciones habituales:

- GitHub Actions;
- cron externo;
- scheduler gestionado.

La regla importante es que la ejecucion automatica use credenciales server-side y deje trazabilidad.

## Riesgos y cuidados

- restaurar reemplaza datos y requiere validacion humana;
- la existencia del modulo no reemplaza una prueba real de recuperacion;
- conviene revisar storage, retencion y permisos antes de considerar el sistema "cerrado";
- los backups deben auditarse junto con historial y logs de ejecucion.

## Verificacion minima recomendada

1. Confirmar que el usuario admin obtiene token valido.
2. Confirmar que `list-backups` responde correctamente.
3. Ejecutar un backup manual.
4. Confirmar que aparece en historial.
5. Probar `dry_run` de restauracion en un entorno seguro antes de una restauracion real.
