# Fase 1B — Botones compartidos

## Objetivo

Profesionalizar la primitiva compartida `src/components/ui/Button.tsx` usando los fundamentos `--app-*`, sin modificar lógica, contratos ni sistemas visuales especializados.

## Alcance

- conservar las variantes `primary`, `secondary` y `danger`;
- conservar tamaños, iconos, posición, `isLoading`, `disabled` y atributos nativos;
- usar superficies, texto, bordes, sombras, foco y movimiento semánticos;
- asegurar un área táctil mínima de 44 px;
- exponer carga mediante `aria-busy` y mantener texto visible;
- responder automáticamente a light/dark y al shell de estudiante.

## Exclusiones

- `src/components/ui/admin/ActionButton.tsx`;
- la familia global `.btn`;
- Atlas (`.ah-*`) y autenticación estudiante (`.ed-*`);
- `src/components/student/ds/Button.tsx`;
- Lanzador (`.lv4-*`);
- migraciones masivas de botones nativos o ad hoc.

## Compatibilidad

Los consumidores existentes mantienen imports y props. Las clases adicionales de layout, como `w-full`, `h-12` o `flex-1`, continúan aplicándose sin introducir variantes nuevas.

## Criterio de cierre

- type-check, lint focalizado y build correctos;
- baseline visual válido y sin regresiones ajenas al alcance;
- estados primary, secondary, danger, disabled y loading coherentes;
- sin cambios de rutas, datos, Supabase, Moodle o lógica de negocio.
