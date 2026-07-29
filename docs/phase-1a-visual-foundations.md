# Fase 1A — Fundamentos visuales y shell

## Objetivo

Crear una base visual común para evolucionar la interfaz por partes, sin cambiar lógica de negocio ni asumir información que la aplicación no puede obtener de Moodle.

## Alcance inicial

- aliases semánticos para canvas, superficies, texto, bordes, foco, radios, sombras, movimiento y capas;
- shell raíz sensible al contexto Paper & Ink, estudiante y embed;
- enlace “Saltar al contenido” y estado offline accesible;
- shell móvil de administración conectado a los mismos tokens;
- hit areas de 44 px, foco visible y respeto por `prefers-reduced-motion`;
- baseline visual aislado que omite diagnósticos externos y espera el roster mock antes de capturar;
- documentación del límite entre fundamentos compartidos y sistemas especializados.

## Límites

- `.lv4-*` sigue siendo la única fuente visual dentro del Lanzador;
- `.ed` y `.ah-root` conservan los tokens Atlas del estudiante;
- no se migran todavía botones, cards, inputs ni vistas completas;
- no se agregan indicadores operativos que dependan de APIs de Moodle;
- no cambia ninguna ruta, consulta, mutación ni contrato de datos.

## Archivos centrales

- `src/styles/foundations.css`
- `src/components/layout/Layout.tsx`
- `src/views/AdminView.tsx`
- `src/main.tsx`
- `scripts/capture-visual-baseline.mjs`

## Estrategia de adopción

1. Usar aliases `--app-*` en el shell y componentes compartidos nuevos.
2. Migrar superficies existentes una familia por vez.
3. Mantener adapters explícitos para Atlas y Lanzador en lugar de forzar un único aspecto.
4. Comparar cada intervención con `docs/visual-baseline.md`.
5. Actualizar capturas solo cuando el cambio visual sea intencional y revisado.

## Criterio de cierre

- type-check, lint focalizado y build en verde;
- baseline visual regenerable sin requests externas;
- navegación y contenido accesibles por teclado;
- light/dark y embed conservan sus fondos correctos;
- ninguna regresión funcional en AdminView o StudentView.
