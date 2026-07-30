# Fase 1C — Adapter de acciones administrativas

## Objetivo

Conectar `src/components/ui/admin/ActionButton.tsx` con los estilos semánticos `app-button` sin sustituir su contrato administrativo histórico.

## Decisión

`ActionButton` permanece como adapter propio. No delega directamente en `ui/Button` porque conserva diferencias necesarias:

- variante y default `secondary`;
- variante `ghost`;
- prop `loading`;
- contenido visible durante la carga;
- `type="button"` como valor seguro;
- callback `onClick` sin exposición del evento.

## Alcance

- mapear primary, secondary y danger a las variantes compartidas;
- agregar una variante semántica `app-button--ghost` sin elevación;
- reutilizar tamaños, iconos y spinner compartidos;
- agregar `aria-busy` y ocultar iconos decorativos;
- mantener sin cambios los ocho usos en `RecordatoriosView`, `AdminErrorBoundary` y `SearchAndFilter`.

## Exclusiones

No se migran `.btn`, botones nativos, Atlas, `.ed`, el DS estudiante ni Lanzador `.lv4-*`.

## Criterio de cierre

Type-check, lint focalizado, build, suite existente y baseline visual correctos, sin cambios funcionales ni de datos.

## Hallazgo de validación

El baseline de `seguro` se estaba capturando antes de resolver sus dos ramas mock. El harness ahora espera el roster `1/1` y el paso final del generador, y usa la desactivación nativa de animaciones de Playwright. La captura actual representa el estado completo y fue idéntica en ejecuciones consecutivas.
