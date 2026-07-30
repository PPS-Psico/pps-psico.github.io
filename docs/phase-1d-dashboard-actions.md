# Fase 1D — Adopción incremental administrativa

## Objetivo

Retirar la familia global `.btn` mediante grupos pequeños y homogéneos, usando el adapter administrativo validado en Fase 1C.

## Primer corte: Dashboard

Se migran únicamente dos acciones hermanas del Dashboard:

- `DetectionBand`: “Abrir bandeja Hermes”;
- `SolicitudesBand`: “Ver todas”.

Ambas son botones fuera de formularios, con handlers sin evento, variante ghost, tamaño pequeño, texto e icono derecho. Conservan `className="press"` y no cambian navegación ni datos.

## Segundo corte: modal de rechazo

Se migran únicamente las acciones del pie de `RejectModal`:

- `Cancelar` → `ActionButton`, variante `secondary`, tamaño `sm`;
- `Rechazar` → `ActionButton`, variante `danger`, tamaño `sm`, icono `close`.

Se conservan los handlers, el valor original del comentario, el bloqueo cuando el motivo está vacío, `type="button"` y `className="press"`. No se agrega loading ni cambia el cierre del modal.

## Evidencia visual

El baseline incluye una captura determinista del Dashboard y `13-admin-solicitudes-rechazo.png`. Para la segunda, el harness crea una solicitud de modificación solo en `mockDb`, abre Admin → Solicitudes → Correcciones y muestra el modal con un motivo ficticio, sin confirmar el rechazo.

Ambas capturas bloquean producción y toda red externa, usan reloj fijo y no contienen sesiones ni datos reales.

## Exclusiones

Quedan fuera los modificadores `.btn-ai`, `.btn-wa` y `.btn-mail`; botones submit, loading o icon-only; `span`/`label` con aspecto de botón; disparadores y modales de correo; Atlas, `.ed` y Lanzador `.lv4-*`.

## Criterio de cierre

Type-check, lint focalizado, build, suite existente y las trece capturas del baseline correctos, sin cambios funcionales ni de datos. La comparación visual debe confirmar ausencia de loaders, ligaduras como texto, recortes y overflow.

## Iconografía local

La primera captura del Dashboard reveló que Material Icons dependía de Google Fonts y mostraba ligaduras como texto cuando la red estaba bloqueada. La fuente se incorpora mediante `@fontsource/material-icons@5.3.0`, con versión exacta, y la clase de ligaduras vive en los fundamentos compartidos. Esto mantiene iconos correctos en baseline, PWA y escenarios offline.
