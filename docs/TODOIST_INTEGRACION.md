# Integracion Todoist

## Estado actual

La integracion con Todoist existe en el codigo, pero hoy debe considerarse experimental o incompleta.

Se observaron estas piezas:

- hooks y servicios en `src/hooks/useTodoistIntegration.ts`,
- `src/services/todoistService.ts`,
- `src/services/todoistDirectService.ts`,
- soporte de datos del lado Supabase.

## Riesgos detectados

- hubo documentacion vieja con tokens reales incrustados;
- parte del flujo aparece marcado como pendiente o con `TODO`;
- no debe asumirse como integracion productiva lista para operar sin revision.

## Criterio recomendado

- no documentar ni guardar tokens reales en el repo;
- si se retoma esta integracion, mover secretos a un entorno seguro;
- definir si Todoist sigue siendo una integracion valida o si debe retirarse;
- documentar el contrato real solo cuando el flujo quede cerrado.

## Estado documental

Se eliminaron documentos redundantes o inseguros y se dejo este archivo como unica referencia del tema.
