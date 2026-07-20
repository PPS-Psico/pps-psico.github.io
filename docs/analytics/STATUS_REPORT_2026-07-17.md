# Estado de situación analítica — 17 de julio de 2026

## Resumen ejecutivo

La aplicación ya dispone de una capa estadística confiable y versionada en
`analytics-v2`.
El principal error material era la capacidad 2026: sumar el valor técnico `250`
de cuatro lanzamientos producía 1.323 cupos. `analytics-v1` informa 492 plazas
operativas: 243 fijas y 249 realizadas.

El segundo error material era histórico: 2024 se mostraba como 69 lanzamientos y
332 plazas porque las filas legacy mezclaban oferta, slots, cohortes y
realización. La reconstrucción documental establece 42 ofertas publicadas: 36 de
cupo finito que totalizan exactamente 270 vacantes documentadas y seis sin cupo
finito. El resultado oficial de oferta finita es 270; las seis ofertas restantes
se presentan por separado y no se convierten en una estimación numérica.

Al mismo corte, los KPIs reconciliados son:

| KPI                           | 2025 al 17/07 | 2026 al 17/07 |
| ----------------------------- | ------------: | ------------: |
| Estudiantes que iniciaron PPS |           105 |           190 |
| Finalizaciones efectivas      |            17 |            28 |
| Lanzamientos PPS              |            35 |            41 |
| Capacidad operativa           |           195 |           492 |
| Postulaciones                 |           661 |           779 |

Para 2024 completo, `analytics-v2` publica 42 ofertas, 36 ofertas finitas por 270
vacantes documentadas y seis ofertas sin cupo finito. La demanda histórica no
está disponible. No calcula variaciones contra ciclos basados en filas operativas.

La comparación muestra crecimiento real de actividad, pero no debe interpretarse
como una mejora completa de eficiencia: 2026 incorpora capacidad realizada de
programas de alto volumen y todavía existen dos lanzamientos fijos con más
seleccionados que cupos registrados.

## Errores corregidos

1. Fundación Tiempo y Fernando Ulloa ya no se excluyen por nombre: son PPS reales.
2. Jornada y Relevamiento se separan como `actividad_especial`.
3. `Finalizados` usa estado y fecha efectivos, no la solicitud previa.
4. Las comparaciones abiertas usan el mismo día del calendario en ambos años.
5. Se eliminó el porcentaje de cobertura que recortaba resultados inválidos a 100%.
6. `Rotaciones` pasó a `registros de práctica` y `horas acreditadas` a `horas cargadas`.
7. No se imputan seleccionados a partir del cupo ni se transforman errores de consulta en ceros.
8. Tiempo de selección se publica como experimental, con `n` y cobertura.

## Calidad actual

| Indicador                           | 2025 al corte | 2026 al corte | Lectura                      |
| ----------------------------------- | ------------: | ------------: | ---------------------------- |
| Cobertura `selected_at`             |            0% |         43,8% | Experimental; no comparable  |
| Práctica vinculada a lanzamiento    |            0% |         98,8% | Historia 2025 incompleta     |
| Lanzamiento vinculado a institución |            0% |         95,1% | Historia 2025 incompleta     |
| Fijos por encima del cupo           |             5 |             2 | Revisión operativa requerida |

Después de completar la limpieza operativa, 2024 alcanzó 100% de cobertura:
80/80 lanzamientos PPS tienen institución y 363/363 prácticas PPS tienen
lanzamiento. Las 42 ofertas históricas están verificadas y conciliadas con 60
filas legacy; no quedan ofertas en estado de revisión.

El valor mediano provisional de espera 2026 es 1,1 días sobre 199 de 454
selecciones. No se usa como KPI de desempeño hasta superar 90% de cobertura por un
ciclo completo.

## Implementado en producto y base

- clasificación explícita de actividad y modalidad de capacidad;
- propagación automática de la clasificación a prácticas vinculadas;
- motivos controlados para solicitudes no concretadas;
- RPC `get_analytics_v2` con corte, fuente, completitud, comparabilidad y calidad;
- capa histórica privada con 42 ofertas, 31 slots, 50 relaciones legacy y 2 relanzamientos;
- backfill 2024 completo: 80 lanzamientos con institución y 363 prácticas con lanzamiento;
- 11 lanzamientos legacy reconstruidos, ocultos y archivados para no publicarlos;
- consolidación de duplicados UFLO y Municipalidad de Plottier;
- cierre de selección atómico y conversión de pendientes a `No Seleccionado`;
- timestamps de decisiones, cierre y bitácoras de reapertura;
- snapshots diarios normalizados de stocks con bitácora de ejecución;
- tableros de Admin, Directivo, Jefe y Reportero conectados al nuevo contrato;
- reportes y descargas con clasificación, capacidad y finalización corregidas;
- listas de detalle reconciliadas con sus KPI;
- orientación basada en inicios efectivos, rotulada como menciones cuando una
  persona participa en más de un área.

La validación final aprobó los tres contratos SQL, type-check, lint sin errores,
37 suites/391 tests y el build de producción con 2.673 módulos. El contrato
funcional transaccional cubre cierre/reapertura y cuatro pruebas cubren la cola de
notificaciones.

## Pendientes priorizados

### Completado — Observabilidad operativa

El cron de salud corre a las 10:05 UTC, 65 minutos después del snapshot. Persiste
400 días de historial, controla frescura/completitud, coberturas, cupos excedidos
y madurez de `selected_at`. Warning y critical aparecen en el centro de
notificaciones administrativas con enlace a Métricas. El primer estado productivo
es `warning` por 2 cupos fijos excedidos; snapshot y coberturas están sanos.

### P1 — Seguridad preexistente fuera de analítica

El asesor de Supabase no observó nuevos problemas en las tablas creadas. Sí
reportó advertencias previas: funciones `SECURITY DEFINER` expuestas, dos
extensiones en `public`, listado amplio del bucket `documentos_estudiantes` y
protección de contraseñas filtradas desactivada. Requieren un plan de seguridad
separado porque cambiar Auth/Storage puede afectar acceso y recuperación de cuenta.

### P2 — Reconciliación 2025 y maduración de indicadores

La historia 2025 todavía tiene baja cobertura de vínculos. Debe reconstruirse en
un ciclo independiente, sin inferir relaciones por texto. `selected_at` continúa
experimental hasta superar 90% de cobertura durante un ciclo completo. También
corresponde revisar operativamente los dos lanzamientos fijos 2026 que superan el
cupo registrado.

## Validación funcional controlada

El contrato `supabase/tests/selection_close_contract.sql` fue ejecutado contra el
proyecto productivo dentro de una transacción revertida. Con una sesión staff
simulada comprobó 1 seleccionado, 2 no seleccionados, timestamps, actor, eventos
de cierre y reapertura y permisos de `anon`. El resultado dejó cero fixtures.

La aplicación unifica ahora el cierre principal y el cierre desde el menú lateral
en un mismo servicio. Sus notificaciones se probaron con dependencias simuladas;
no se enviaron emails ni push reales.

## Decisión sobre FAQ estudiantil

No se modificó el FAQ: los cambios son de medición y operación admin. El flujo
visible del estudiante y sus acciones no cambiaron.
