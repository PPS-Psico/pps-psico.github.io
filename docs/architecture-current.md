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

## Edge Functions

El repositorio mantiene 14 funciones canónicas. El catálogo actualizado de versiones,
políticas JWT, consumidores, secretos y legado remoto está en
[edge-functions-inventory.md](./edge-functions-inventory.md).

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

## Automatización de tareas e informes Moodle v2

La unidad canónica de entrega es `lanzamiento + orientación`. Supabase mantiene
la intención en `moodle_task_intents` y el padrón que debe entregar en
`moodle_task_expected_participants`; Moodle aporta la actividad observada, la
entrega real y la calificación.

Durante 2026 las tareas confirmadas conviven como `legacy_shared`: pueden estar
reutilizadas y nunca se reconfiguran automáticamente. Los lanzamientos desde
2027 generan intenciones `dedicated`, una por unidad, con clave estable, hash de
configuración y lease exclusivo. El escritor de navegador todavía no está
conectado: la base y el planner están listos, pero ninguna activación llama a
Moodle dentro de su transacción.

Jefatura lee las tareas únicas del año y sus orientaciones en lotes secuenciales
de 4. Los resultados válidos se conservan aunque otro lote falle. El resumen
operativo se obtiene de `get_moodle_task_unit_summaries_v1` y calcula sus
denominadores desde el padrón esperado, no desde todos los usuarios visibles en
Moodle. Véanse [los contratos activos](./moodle-v2/contracts.md) y el
[runbook](./moodle-task-automation-runbook.md).

## Estado de la documentacion heredada

- Airtable aparece en archivos heredados y tipos legacy, pero no debe leerse como backend principal actual.
- Existen integraciones accesorias o experimentales que no representan el corazon operativo del sistema.
- El plan maestro de profesionalizacion es la referencia para decidir prioridades tecnicas.

## Archivos de referencia

- [../README.md](../README.md)
- [./internal-professionalization-plan.md](./internal-professionalization-plan.md)
- [../SECURITY_REPORT.md](../SECURITY_REPORT.md)
- [../GITHUB_SECRETS.md](../GITHUB_SECRETS.md)
