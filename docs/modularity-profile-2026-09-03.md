# Perfil de modularidad — 2026-09-03

Este perfil documenta el primer corte de WP-04. No cambia contratos, reglas de negocio, query keys ni datos.

## Métricas

`useMetricsExtras.ts` concentraba 14 hooks y 14 query keys en un único archivo. Ahora funciona como barrel estable y cada hook vive en `src/hooks/metricsExtras/`, con tipos y utilidades puras compartidos.

Se conservaron exactamente estas query keys:

- `metricsHeredados`, `metricsDinamica`, `metricsFunnel`, `metricsTopInst`;
- `metricsFinalizadosSeries`, `hermesActivity`, `metricsReportLaunches`, `ytdFlows`;
- `trayectoriaFinalizados`, `tiempoSeleccion`, `esfuerzoPrimeraSeleccion`;
- `sinPpsDetail`, `newAgreements`, `metricsTimeline`.

La API pública sigue saliendo de `src/hooks/useMetricsExtras.ts`. TypeScript, 90 suites/765 tests y el build pasan después del corte.

## Superficies pendientes

| Superficie                |         Tamaño actual | Hallazgo                                                                                       | Siguiente corte recomendado                                                                                          |
| ------------------------- | --------------------: | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GestionView.tsx`         | 1480 líneas / 73,8 kB | Mezcla queries, deep-links, bandeja, acciones Gmail con undo, cómputos y render                | Extraer primero el controlador de correo/undo con tests de timers; después deep-links y selección                    |
| `StudentPanelContext.tsx` |   311 líneas / 9,7 kB | El objeto `value` se recrea en cada render aunque varios derivados ya usan `useMemo`           | Medir renders por consumidor; como paso barato, memoizar `value`; separar contextos solo si la medición lo justifica |
| `NotificationContext.tsx` |  770 líneas / 28,2 kB | Toast ya está separado y memoizado; FCM, Realtime, persistencia, sonido y badges siguen juntos | Extraer efectos internos a hooks privados conservando `useToast` y `useNotifications`                                |

## Resultado de los cortes

Los tres cortes se aplicaron después del perfil inicial, sin cambiar APIs públicas, query keys ni contratos de datos:

| Superficie                | Resultado                                                                                                                                                                                                                                                                                        | Evidencia focal                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GestionView.tsx`         | 1480 → 1195 líneas. La cola Gmail, timers de deshacer, leídos y borradores pasaron a `useGestionMailController`; contacto, recordatorios y cambios de estado pasaron a `useGestionInstitutionController`. Se retiró además el controlador huérfano `handlePlanToday`, que no tenía invocaciones. | 2 suites / 5 tests: deshacer antes de 5 s, commit posterior, refetch de fuentes, borradores y actualización atómica de estado/notas/historial. |
| `StudentPanelContext.tsx` | El perfil reprodujo `1 → 2` renders del consumidor ante un update ajeno del padre. El valor agregado ahora conserva identidad con `useMemo`: el mismo caso queda en `1 → 1`. No se dividió la API porque la medición justificó primero la solución mínima.                                       | 1 suite / 1 test de conteo de renders.                                                                                                         |
| `NotificationContext.tsx` | 770 → 528 líneas. FCM, seis suscripciones Realtime, badge PWA y sonido viven en unidades internas; `useToast`, `useNotifications` y `NotificationProvider` conservan su firma. El callback Realtime ahora es estable y el desmontaje sigue retirando el canal.                                   | 2 suites / 4 tests: alta/baja FCM, feedback, badge, registro de seis listeners, filtrado por usuario y cleanup del canal.                      |

En total, WP-04 agrega 5 suites y 10 pruebas focales. La corrida combinada de estas suites pasa sin errores y el lint focal queda en 0 errores; conserva dos advertencias de accesibilidad preexistentes en el contenedor central de Gestión.

El type-check global pasó durante los dos primeros cortes. Al cerrar Realtime apareció transitoriamente un error concurrente fuera de WP-04 en `ConfirmacionView`; se preservó ese trabajo ajeno y, una vez reconciliado por su autor, el cierre global quedó verde: type-check, build, 96 suites/783 tests, 260 migraciones canónicas + 20 overlays y 7 E2E.
