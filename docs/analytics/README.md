# Analítica de Mi Panel Académico

Esta carpeta es la fuente de verdad para las métricas del panel. Toda cifra del
reporte ejecutivo debe tener una definición, una fuente, un grano, un período y
una regla de calidad documentados antes de publicarse.

## Documentos

- [METRIC_DICTIONARY.md](./METRIC_DICTIONARY.md): contratos de métricas y estado de madurez.
- [criterio-metricas-ingresantes.md](../criterio-metricas-ingresantes.md): contrato
  vigente de matrícula administrativa, cuentas, activación, cohorte, demanda e
  inicios.
- [HISTORICAL_SCOPE_DECISIONS.md](./HISTORICAL_SCOPE_DECISIONS.md): decisiones
  de dominio sobre Sede Comahue, gestión, modalidades legacy y reconstrucción
  2023–2024.
- [DATA_QUALITY_BASELINE_2026-07-17.md](./DATA_QUALITY_BASELINE_2026-07-17.md): línea de base obtenida de Supabase productivo.
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md): fases, dependencias y criterios de aceptación.
- [STATUS_REPORT_2026-07-17.md](./STATUS_REPORT_2026-07-17.md): estado ejecutivo, correcciones aplicadas y pendientes.
- [CHANGELOG_2026-07-17.md](./CHANGELOG_2026-07-17.md): migraciones, cambios de producto y validación de la entrega.
- [ANALYTICS_V2_2024_RELEASE.md](./ANALYTICS_V2_2024_RELEASE.md): contrato v2, reconstrucción 2024, seguridad, comparabilidad y validación.
- [EXECUTIVE_REPORT_REDESIGN_BRIEF.md](./EXECUTIVE_REPORT_REDESIGN_BRIEF.md): definición funcional y dirección visual aprobada para los informes profesional y de gestión.
- [EXECUTIVE_REPORT_CONTRACT.md](./EXECUTIVE_REPORT_CONTRACT.md): contrato único de datos, reglas de publicación, identidad, operación y pruebas del nuevo reporte.
- [DASHBOARD_REPORT_CONTRACT.md](./DASHBOARD_REPORT_CONTRACT.md): fuente, corte y criterio compartidos entre dashboard, informes web y PDF.
- [RUNBOOK.md](./RUNBOOK.md): operación, verificación y recuperación de la capa analítica.
- [OBSERVABILITY.md](./OBSERVABILITY.md): chequeos diarios, umbrales, alertas y seguridad operativa.
- [REFERENCES.md](./REFERENCES.md): fuentes externas de buenas prácticas.
- [reconstruction/WHATSAPP_2024_RECONSTRUCTION_REPORT.md](./reconstruction/WHATSAPP_2024_RECONSTRUCTION_REPORT.md): reconstrucción auditable de oferta 2024, matriz de candidatos y lotes de backfill.

## Regla de cambio

Un cambio de métrica no está completo hasta que:

1. actualiza el diccionario y asigna una versión;
2. agrega o ajusta pruebas;
3. documenta backfills, exclusiones y limitaciones;
4. reconcilia el resultado contra datos agregados de Supabase;
5. registra la fecha desde la que la serie es comparable.

## Orden de precedencia

Cuando dos documentos entren en conflicto:

1. decisión de negocio vigente y fechada;
2. `criterio-metricas-ingresantes.md` para poblaciones;
3. `HISTORICAL_SCOPE_DECISIONS.md` para alcance histórico;
4. `METRIC_DICTIONARY.md` para resultados y cálculos;
5. contratos de cada informe;
6. documentos de auditoría, reconstrucción y changelog;
7. comentarios de código y nombres legacy.

Una migración explica la implementación que existía al aplicarse, pero no
reemplaza una decisión de negocio posterior. Si el código y el contrato vigente
difieren, se documenta como deuda de implementación; no se redefine la métrica
para que coincida con el código.
