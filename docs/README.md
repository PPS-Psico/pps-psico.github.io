# Documentacion del proyecto

Este directorio concentra documentacion vigente y util para operar o evolucionar la app.

## Documentos base

- [phase-0-baseline.md](./phase-0-baseline.md): baseline verificable y orden de ejecución de la Fase 0.
- [architecture-current.md](./architecture-current.md): foto tecnica actual del sistema.
- [internal-professionalization-plan.md](./internal-professionalization-plan.md): roadmap interno y criterios de prioridad.
- [analytics/README.md](./analytics/README.md): métricas, calidad de datos y plan de analítica confiable.
- [migration-history-reconciliation.md](./migration-history-reconciliation.md): replay local y reconciliación de las 111 migraciones productivas.
- [visual-baseline.md](./visual-baseline.md): matriz y capturas previas al rediseño, aisladas de producción.
- [criterio-metricas-ingresantes.md](./criterio-metricas-ingresantes.md):
  definiciones vigentes de matrícula administrativa, cuentas, activación,
  cohorte, postulantes e inicios PPS.
- [analytics/HISTORICAL_SCOPE_DECISIONS.md](./analytics/HISTORICAL_SCOPE_DECISIONS.md):
  decisiones de negocio para Sede Comahue y tratamiento de modalidades
  históricas.

## Documentos operativos

- [edge-functions-inventory.md](./edge-functions-inventory.md): catálogo canónico, JWT, consumidores y secretos.
- [BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md): backup y restauracion.
- [PUSH_NOTIFICATIONS_SETUP.md](./PUSH_NOTIFICATIONS_SETUP.md): push notifications.
- [TODOIST_INTEGRACION.md](./TODOIST_INTEGRACION.md): estado real de la integracion con Todoist.

## Que ya no usamos como fuente de verdad

Se eliminaron o consolidaron documentos duplicados, pruebas locales viejas, instrucciones con puertos hardcodeados, propuestas superadas y notas que exponian tokens o secretos.

## Regla de mantenimiento

Si cambia alguno de estos aspectos, hay que actualizar la documentacion correspondiente:

- arquitectura o backend;
- seguridad o permisos;
- integraciones activas;
- operacion admin;
- definiciones, fuentes o comparabilidad de métricas;
- roadmap tecnico.
