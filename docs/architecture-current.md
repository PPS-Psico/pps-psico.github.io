# Arquitectura actual

## Proposito

Este documento resume como funciona realmente hoy la aplicacion, sin arrastrar framing historico que ya quedo viejo.

El panel debe leerse como una herramienta interna de coordinacion y seguimiento. No es un sistema academico oficial ni reemplaza la validacion institucional final, que sigue dependiendo de planillas, circuitos docentes y la carga definitiva en SAC.

## Stack

- Frontend: React + Vite + TypeScript.
- UI: Tailwind CSS.
- Estado async: React Query.
- Backend principal: Supabase.
- Procesos server-side: Supabase Edge Functions.

## Backend operativo

La fuente principal de datos es Supabase. El frontend consume:

- autenticacion;
- tablas de negocio;
- storage;
- funciones Edge para tareas sensibles o automatizadas.

El proyecto de referencia documentado internamente es `qxnxtnhtbpsgzprqtrjl`.

## Edge Functions observadas en el repo

- `automated-backup`
- `generate-content`
- `health-check`
- `launch-scheduler`
- `list-backups`
- `restore-backup`
- `send-fcm-notification`

## Dominios funcionales principales

- estudiantes;
- convocatorias;
- lanzamientos PPS;
- practicas;
- finalizacion e informes;
- recordatorios y notificaciones;
- compromiso digital;
- herramientas administrativas;
- backups y recuperacion.

## Estado de la documentacion heredada

- Airtable aparece en archivos heredados y tipos legacy, pero no debe leerse como backend principal actual.
- Existen integraciones accesorias o experimentales que no representan el corazon operativo del sistema.
- El plan maestro de profesionalizacion es la referencia para decidir prioridades tecnicas.

## Archivos de referencia

- [../README.md](../README.md)
- [./internal-professionalization-plan.md](./internal-professionalization-plan.md)
- [../SECURITY_REPORT.md](../SECURITY_REPORT.md)
- [../GITHUB_SECRETS.md](../GITHUB_SECRETS.md)
