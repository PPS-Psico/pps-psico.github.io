# Criterio de métricas — Ingresantes y cohorte

> Decisión de criterio tomada el 2026-05-31, tras detectar que el dashboard
> mostraba "218 ingresantes 2025 vs 73 en 2026", una caída que no era real.

---

## El problema que teníamos

La métrica "Matrícula generada / Nuevos ingresantes en el año" daba números
imposibles: **218 en 2025 vs 73 en 2026**, cuando los dos años fueron parecidos
en actividad real de PPS.

Causas, confirmadas con los datos:

1. **`created_at` está contaminado por la migración de Airtable.** Al migrar, los
   registros históricos (estudiantes y convocatorias) entraron con `created_at`
   de 2025. Estudiantes que ya venían haciendo PPS desde 2023/2024 quedaban
   contados como "nuevos de 2025". De los 218 "debut 2025", al menos 90 tenían
   prueba de actividad anterior.

2. **La definición vieja medía "primera vez en la tabla convocatorias"**, que es
   una métrica de _debut_ — naturalmente alta el primer año del sistema y
   decreciente después, porque el "stock" de quienes debutan se agota. No medía
   ingresantes.

3. **Se comparaba un año completo (2025) contra uno en curso (2026).**

La actividad real (prácticas por `fecha_inicio` del lanzamiento, inmune a la
migración) viene **creciendo**: 2023→124, 2024→363, 2025→593, 2026→372 (a mayo).
No hubo ningún derrumbe.

---

## La solución: campo `cohorte`

Se agregó la columna `estudiantes.cohorte` (smallint).

### Criterio de definición (el acordado)

> **cohorte = año de la PRIMERA ACTIVIDAD PPS REAL del estudiante**, definida
> como el **mínimo** entre:
>
> - `fecha_inicio` del lanzamiento de sus convocatorias,
> - `fecha_inicio` propia de sus convocatorias (copia desnormalizada),
> - `fecha_inicio` de sus prácticas.
>
> **NUNCA** `created_at` (lo aplastó la migración).

Se descartan fechas con año fuera de rango (basura tipo `2202`).

### Regla para los estudiantes "sin PPS"

- Cargado a mano (solo nombre + legajo), sin cuenta y sin PPS → `cohorte = NULL`.
  **No cuenta** para ninguna métrica de ingresantes. Es solo un legajo habilitado
  a registrarse.
- Cuando crea cuenta y se inscribe a su primera PPS → se le asigna
  `cohorte = año de esa primera actividad`, **automáticamente** (trigger).

Esto lo implementan los triggers `trg_set_cohorte_conv` (en `convocatorias`) y
`trg_set_cohorte_prac` (en `practicas`): al insertarse la primera actividad de un
estudiante con cohorte NULL, le calculan y setean el año. No pisan correcciones
manuales (solo actúan si la cohorte es NULL).

### Editable a mano

`cohorte` es un campo persistente, no un cálculo al vuelo. Para casos especiales
(p. ej. un dato que el criterio automático no captura bien), se edita
directamente y el trigger no lo sobrescribe.

---

## Resultado

| Año  | Ingresantes (cohorte) | Nota                        |
| ---- | --------------------- | --------------------------- |
| 2021 | 5                     | cola histórica de Airtable  |
| 2022 | 7                     |                             |
| 2023 | 32                    |                             |
| 2024 | 120                   | ver "limitación 2024" abajo |
| 2025 | 98                    |                             |
| 2026 | 78                    | año en curso (a mayo)       |

El falso "218 vs 73" desapareció. 2024/2025/2026 son del mismo orden.

### Limitación conocida — 2024 infla un poco

2024 (120) da más que 2025 (98), lo cual es contraintuitivo. Causa: los datos
heredados anteriores a noviembre 2024 (cuando asumió la coordinación actual) son
un "desastre de datos" migrado de Airtable. Muchos estudiantes con actividad real
de 2021-2023 tienen su primer registro fechado en 2024, así que la cohorte 2024
absorbe arrastre histórico. **No hay forma 100% confiable de separar eso solo con
los datos del panel.**

Se cruzó con el Airtable original (campo manual "Fecha de creación", cargado en
265/266 estudiantes): da 2024=142, 2025=124. Es decir, **las dos fuentes
independientes coinciden en que 2024 ≥ 2025** en cargas de matrícula — 2024 fue
un año de regularización masiva de la migración, no una cohorte normal.

---

## Decisión final: la métrica principal NO es "ingresantes"

La cohorte (debut / primera PPS) tiene dos defectos estructurales para mostrar
la salud del programa:

- **No crece**: cada estudiante debuta una sola vez, así que la serie tiende a
  bajar tras el pico inicial.
- **2024 está inflado** por la regularización migratoria.

Pero la facultad **viene creciendo**, y eso se ve en una métrica distinta:
**"Estudiantes en PPS"** = estudiantes DISTINTOS con al menos una actividad PPS
real en el año (por `fecha_inicio` del lanzamiento/práctica, inmune a la
migración). Cuenta a cada estudiante cada año que participa.

| Año  | Estudiantes en PPS | a 31/may (YTD) |
| ---- | ------------------ | -------------- |
| 2021 | 5                  | 1              |
| 2022 | 9                  | 5              |
| 2023 | 39                 | 12             |
| 2024 | 158                | 67             |
| 2025 | 215                | 162            |
| 2026 | 199 (en curso)     | 199            |

A la misma altura del año, **2026 (199) ya supera a 2025 (162)** — crecimiento
real y sostenido.

### Qué quedó en el dashboard

- **Hero principal**: "Estudiantes en PPS" (la que crece). Su trend es
  **YTD-aware**: si el año está en curso, compara contra el año anterior a la
  misma altura (por día del año), no contra el año completo. Así 2026 muestra
  +23% en vez de una falsa caída.
- **"Ingresantes (cohorte)"**: queda como métrica secundaria.
- **Nota de 2024**: al seleccionar el año 2024 en Métricas aparece un aviso de
  "año de transición" (regularización de la migración, no comparable directo).
- **Gráfico de evolución y serie**: pasan a contar "estudiantes en PPS" por año.

Implementación: `supabase/migrations/20260601170000_add_estudiantes_en_pps_metric.sql`
(agrega `estudiantes_en_pps`, `estudiantes_en_pps_prev`, trend YTD-aware y
`get_estudiantes_en_pps_list`).

---

## Implementación

- Migración `supabase/migrations/20260601150000_add_cohorte_to_estudiantes.sql`
  — columna + función `calc_cohorte_estudiante` + backfill + triggers + índice.
- Migración `supabase/migrations/20260601160000_metrics_use_cohorte.sql`
  — `get_admin_metrics_kpis` (matricula_generada, enrollment_evolution, trend) y
  `get_ingresantes_list` ahora cuentan por `cohorte`.
- Frontend: `useExecutiveReportData` (reporte clásico) usa `cohorte` para
  "Estudiantes Nuevos"; etiquetas del dashboard v3 y el clásico actualizadas a
  "Ingresantes del año · Nuevos en el sistema de PPS (cohorte)".

## Pendiente para el flujo de carga

Cuando se cargue el listado de ingresantes de fin de año (nombre + legajo), el
formulario de "usuario nuevo sin cuenta" debería permitir setear la `cohorte`
explícitamente. Hoy queda NULL hasta la primera PPS; para ingresantes que aún no
hicieron PPS pero ya sabés de qué año son, conviene poder cargarlo a mano.
