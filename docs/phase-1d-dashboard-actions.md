# Fase 1D — Adopción incremental en Dashboard

## Objetivo

Empezar a retirar la familia global `.btn` mediante grupos pequeños y homogéneos, usando el adapter administrativo validado en Fase 1C.

## Primer corte

Se migran únicamente dos acciones hermanas del Dashboard:

- `DetectionBand`: “Abrir bandeja Hermes”;
- `SolicitudesBand`: “Ver todas”.

Ambas son botones fuera de formularios, con handlers sin evento, variante ghost, tamaño pequeño, texto e icono derecho. Conservan `className="press"` y no cambian navegación ni datos.

## Evidencia visual

Se incorpora una captura determinista del Dashboard admin en modo de simulación. La captura espera que ambas acciones sean visibles antes de generar el PNG.

## Exclusiones

Quedan fuera los modificadores `.btn-ai`, `.btn-wa` y `.btn-mail`; botones submit, loading o icon-only; `span`/`label` con aspecto de botón; Atlas, `.ed` y Lanzador `.lv4-*`.

## Criterio de cierre

Type-check, lint focalizado, build, suite existente y baseline visual correctos, sin cambios funcionales ni de datos.

## Iconografía local

La primera captura del Dashboard reveló que Material Icons dependía de Google Fonts y mostraba ligaduras como texto cuando la red estaba bloqueada. La fuente se incorpora ahora mediante `@fontsource/material-icons@5.3.0`, con versión exacta, y la clase de ligaduras vive en los fundamentos compartidos. Esto mantiene iconos correctos en baseline, PWA y escenarios offline.
