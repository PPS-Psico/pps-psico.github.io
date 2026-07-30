# Baseline visual — Fase 0F

Fecha inicial: 29 de julio de 2026. Artefactos: `artifacts/visual-baseline/`.

## Propósito

Congelar la apariencia anterior a los próximos rediseños para poder comparar decisiones, detectar regresiones evidentes y discutir cambios con evidencia. No es una suite de aprobación pixel-perfect.

## Aislamiento

`npm run visual:baseline` inicia un Vite local con variables ficticias, entra mediante el usuario de simulación y usa `mockDb`. El reloj del navegador queda fijado en `2026-01-15T12:00:00-03:00` para que los fixtures relativos no cambien de bucket con el paso del tiempo. Playwright bloquea toda solicitud cuyo origen no sea el servidor local; no usa sesiones, credenciales ni datos de Supabase productivo.

Las capturas del Lanzador esperan señales finales de sus queries mock, no banners síncronos ni demoras arbitrarias: selección exige el roster de tres postulantes y seguro exige tanto el conteo `1/1` como el paso final del generador. Esto evita versionar estados parciales con loaders.

El Lanzador propaga `isTestingMode` a lista, conteos, roster, seleccionador y seguro. Esto evita que el entorno rotulado “Datos aislados de producción” consulte RPCs o tablas reales.

## Matriz capturada

| Rol        | Estado/vista                     | Viewport/tema                          |
| ---------- | -------------------------------- | -------------------------------------- |
| Público    | Login                            | 1440×900 light; 390×844 light          |
| Estudiante | Inicio                           | 1440×900 light/dark; 1024×768; 390×844 |
| Estudiante | Mis Prácticas                    | 1440×900 light                         |
| Estudiante | Mis Solicitudes                  | 1440×900 light                         |
| Admin      | Lanzador sin selección           | 1440×900 light                         |
| Admin      | Lanzador `seleccion` (`Abierta`) | 1440×900 light                         |
| Admin      | Lanzador `seguro` (`Cerrado`)    | 1440×900 light                         |

Las once capturas y su manifiesto se validan con `npm run visual:baseline:check`.

## Exclusiones explícitas

- `Jefe`, `Directivo` y `Reportero`: sus vistas todavía no tienen un adapter mock completo; capturarlas con red bloqueada produciría una falsa baseline vacía.
- Estados `borrador`, `confirmacion`, `activa` y `archivada`: no existen fixtures deterministas actuales. Se agregarán cuando esos flujos entren en una intervención visual.
- Modales destructivos, carga, error y animaciones: fuera de este primer baseline. Las animaciones se desactivan para estabilizar las imágenes.
- Las capturas históricas de julio permanecen como evidencia, pero no son el golden mantenido.

## Flujo de actualización

1. Ejecutar `npm run visual:baseline` desde una rama de trabajo.
2. Revisar las imágenes y `manifest.json`; no aprobar solo porque el script terminó.
3. Ejecutar `npm run visual:baseline:check`, type-check y build.
4. Versionar cambios de capturas únicamente cuando el cambio visual sea intencional.

CI no regenera imágenes ni descarga navegadores. Solo la validación local produce el baseline; esto evita costo y diferencias de render entre runners.
