# Plan de modernización técnica — septiembre de 2026

Estado: **completo con deuda documentada**. Inicio: 3 de septiembre de 2026. Cierre: 4 de septiembre de 2026.

Este documento es el workboard operativo del saneamiento técnico transversal. Complementa el roadmap general de `internal-professionalization-plan.md`; no reemplaza los contratos de analítica, Moodle, seguridad ni migraciones.

## 1. Resultado buscado

Reducir el tiempo de feedback local, eliminar configuración obsoleta del runtime, mejorar la carga percibida y achicar la superficie de mantenimiento sin cambiar reglas de negocio, métricas, permisos, datos productivos ni contratos públicos.

### Fuera de alcance

- hacer squash, renombrar o reescribir migraciones aplicadas;
- ejecutar DDL/DML productivo como parte de este track;
- cambiar definiciones de métricas o poblaciones analíticas;
- rediseñar pantallas o alterar flujos del estudiante;
- migrar globalmente la arquitectura, los estilos o el runner de tests;
- reescribir el historial de Git o borrar prototipos sin clasificación previa.

## 2. Baseline verificable

Mediciones locales tomadas el 3 de septiembre de 2026:

| Indicador                                |                     Baseline |
| ---------------------------------------- | ---------------------------: |
| TypeScript sin caché                     |                       36,4 s |
| TypeScript incremental, primera corrida  |                       42,0 s |
| TypeScript incremental, corrida caliente |                        8,4 s |
| Jest secuencial                          | 90 suites, 765 tests, 95,1 s |
| Migraciones registradas en Supabase      |                          254 |
| Archivos locales de migración            |                          256 |
| Archivos de migración rastreados por Git |                          248 |
| Artefactos rastreados en `tmp/`          |       147 archivos, ~15,2 MB |
| Artefactos rastreados en `output/`       |         15 archivos, ~1,1 MB |

El ledger remoto y los nombres locales requieren reconciliación antes de modificar documentación operativa: hay 76 migraciones con el mismo nombre y distinto timestamp, seis nombres solo locales y cuatro solo remotos. De los ocho archivos locales sin seguimiento, cinco ya figuran en el ledger remoto y tres todavía no.

Estos números son una fotografía fechada, no constantes del proyecto.

## 3. Guardrails obligatorios

1. Preservar cambios locales ajenos y revisar `git status` antes y después de cada paquete.
2. No tocar migraciones sin seguimiento hasta clasificarlas contra el ledger y su intención operativa; el conteo puede cambiar por trabajo concurrente.
3. Para métricas, leer los cinco contratos indicados por `AGENTS.md`, conservar query keys y agregar reconciliación agregado-detalle.
4. Para Supabase, consultar la base viva; no inferir estado productivo desde nombres locales.
5. No editar `src/types/supabase.ts` a mano. Después de cualquier cambio real de DB: regenerar tipos y ejecutar type-check.
6. Conservar `.lv4-*` y su contrato visual hasta aprobar expresamente un cambio en `AGENTS.md`.
7. Todo cambio visual requiere baseline antes/después; producción y datos reales permanecen bloqueados durante capturas.
8. No agregar FAQ del estudiante sin consentimiento explícito. Si un cambio altera su experiencia, presentar primero la propuesta.
9. Cada paquete debe ser reversible con un revert propio y no mezclar refactor con cambio funcional.
10. No hacer push, deploy ni reescritura de historial sin instrucción explícita.

## 4. Secuencia y gates

| Paquete | Objetivo                                  | Depende de             | Estado                     |
| ------- | ----------------------------------------- | ---------------------- | -------------------------- |
| WP-00   | Congelar baseline y reconciliar el ledger | —                      | Completo                   |
| WP-01   | Quick wins seguros de configuración y DX  | WP-00 inventario       | Completo                   |
| WP-02   | Carga percibida y tipografías             | WP-01                  | Completo                   |
| WP-03   | Código muerto y artefactos versionados    | WP-01                  | Completo                   |
| WP-04   | Refactor modular sin cambio semántico     | WP-03                  | Completo                   |
| WP-05   | Extracción gradual de CSS inyectado       | WP-02, baseline visual | Completo (primer corte)    |
| WP-06   | Piloto medido de Vitest                   | WP-01                  | Cerrado; no supera el gate |
| WP-07   | Cierre, documentación y evidencia         | WP-02–WP-06            | Completo                   |

## 5. Paquetes de trabajo

### WP-00 — Baseline y seguridad del ledger

Alcance:

- registrar estado del worktree sin modificar cambios ajenos;
- comparar versión y nombre de migraciones locales, rastreadas y remotas;
- clasificar las diferencias por: timestamp divergente, nombre divergente, aplicada sin archivo rastreado y local no aplicada;
- actualizar el protocolo canónico de `AGENTS.md` solo después de resolver esa clasificación;
- conservar `migration-history-reconciliation.md` como evidencia fechada, no como conteo permanente.

Criterios de aceptación:

- matriz local/remoto revisable, sin exponer secretos ni datos personales;
- ninguna migración aplicada se renombra, borra o reaplica;
- `npm run check:migrations` pasa;
- cualquier reconciliación posterior se valida también contra el ledger vivo.

Rollback: documental; no hay cambios de DB en este paquete.

### WP-01 — Configuración segura y feedback local

Alcance:

- habilitar caché incremental de TypeScript dentro de `node_modules/.cache`;
- retirar el import map inerte y las autorizaciones `esm.sh` asociadas de la CSP;
- corregir el builder Docker para instalar las dependencias de compilación y reducir su contexto con `.dockerignore`;
- alinear la documentación base con React 19;
- retirar conteos volátiles de los documentos no fechados.

Criterios de aceptación:

- dos type-checks consecutivos pasan y el segundo reutiliza caché;
- no quedan referencias frontend a `esm.sh`;
- Jest, lint y build pasan;
- el HTML construido no contiene import map;
- el Dockerfile conserva una imagen final estática sin dependencias de desarrollo.

Rollback: revert único de configuración; no toca datos ni lógica de negocio.

### WP-02 — Carga percibida y fuentes

Alcance:

- ejecutar `npm run perf:benchmark` y registrar tres corridas comparables;
- reemplazar la ocultación global de `body` por render inmediato con fallbacks;
- evitar esperas explícitas por Bricolage Grotesque, Geist y Manrope;
- inventariar familias y pesos realmente usados por ruta;
- evaluar fuentes locales o subconjuntos por ruta antes de eliminar familias activas.

Criterios de aceptación:

- contenido legible desde el primer render, incluso sin Google Fonts;
- FCP/LCP no empeoran en la mediana de tres corridas;
- baseline visual revisado en desktop, tablet, mobile, light y dark;
- no aparecen saltos de layout, iconos como texto ni regresiones de foco.

Rollback: restaurar únicamente el bootstrap tipográfico anterior.

### WP-03 — Código muerto e higiene del repositorio

Alcance:

- eliminar solo módulos sin imports confirmados por búsqueda y compilación;
- clasificar `tmp/`, `output/`, archivos de diseño, parches y prototipos como conservar, mover, ignorar o retirar;
- usar `git rm --cached` únicamente para dejar de rastrear archivos que deban permanecer localmente;
- agregar reglas de ignore correspondientes;
- conservar `Pagina PPS/` mientras siga siendo el prototipo servido por `npm run proto`.

Criterios de aceptación:

- manifiesto de archivos materiales antes de retirarlos;
- cero imports rotos;
- type-check, tests y build pasan;
- no se reescribe el historial de Git;
- todo archivo retirado sigue recuperable desde commits previos o desde su ubicación acordada.

Rollback: revert del commit de higiene; los archivos locales desindexados no se borran.

### WP-04 — Modularidad guiada por contratos

Alcance:

- separar físicamente los 14 hooks de `useMetricsExtras.ts`, conservando firmas, query keys y cálculos;
- extraer controladores cohesivos de `GestionView.tsx` sin mezclar cambios visuales;
- perfilar `StudentPanelContext` antes de decidir entre memoización, contextos separados o selectores;
- separar internamente FCM, Realtime, badges y sonido de `NotificationContext` conservando `useToast` y `useNotifications`.

Criterios de aceptación:

- API pública y comportamiento sin cambios;
- pruebas de reconciliación agregado-detalle para métricas;
- valores contrastados con lectura actual de Supabase cuando corresponda;
- no aumenta el número de requests ni se invalidan query keys;
- cada extracción tiene tests focalizados y un diff revisable.

Rollback: un commit por extracción, sin migraciones de datos.

### WP-05 — CSS estático por superficie

Alcance:

- comenzar por `metricasV3Styles.ts` o `editorStyles.ts`;
- comparar tamaño de chunk JS, CSS emitido y orden de carga;
- mantener namespaces y especificidad;
- intervenir `lanzadorStyles.ts` solo después de cambiar conscientemente el contrato `.lv4-*` de `AGENTS.md`.

Criterios de aceptación:

- sin FOUC ni diferencias visuales no aprobadas;
- reducción verificable del CSS embebido en JavaScript;
- carga lazy de la superficie preservada;
- baseline visual y build pasan.

Rollback: restaurar la importación/inyección de la superficie individual.

### WP-06 — Piloto Vitest, sin compromiso de migración

Muestra mínima:

- una suite de funciones puras;
- una suite de hook;
- una suite de componente;
- una integración de vista;
- una suite con mocks de contexto/Supabase.

Medición:

- tres corridas en frío y tres calientes;
- tiempo de watch sobre un cambio pequeño;
- tiempo de configuración y conversión;
- paridad de mocks, cobertura y mensajes de error.

Gate de adopción:

- cero tests omitidos o debilitados;
- mejora mediana proyectada de al menos 30 % en la suite/CI o mejora clara del ciclo watch;
- no sostener dos runners de forma indefinida;
- si no supera el gate, optimizar Jest y cerrar el piloto sin migración global.

Rollback: eliminar la configuración piloto y conservar Jest como runner único.

### WP-07 — Cierre

Validación final:

```bash
npm run check:migrations
npm run lint
npm run type-check
npm test -- --ci
npm run test:e2e
npm run build
```

Además:

- registrar tiempos antes/después;
- actualizar este workboard y los documentos afectados;
- proponer FAQ solo si hubo un cambio visible para estudiantes;
- entregar commits convencionales separados por paquete;
- no desplegar ni hacer push sin autorización.

## 6. Registro de ejecución

### 2026-09-03

- [x] Baseline local de TypeScript y Jest.
- [x] Inventario local de migraciones y artefactos rastreados.
- [x] Lectura remota del ledger de Supabase.
- [x] TypeScript incremental habilitado; type-check caliente verificado en 11,6 s durante la ejecución.
- [x] Import map y permisos `esm.sh` retirados del frontend y del HTML construido.
- [x] Builder Docker corregido, contexto de build acotado y validación real completada con el daemon activo.
- [x] Seis módulos huérfanos retirados; type-check, 90 suites/765 tests, siete E2E y build pasaron.
- [x] Documentación base alineada con React 19 y sin conteos permanentes de migraciones.
- [x] Lint global sin errores; conserva 471 warnings preexistentes como deuda gradual.
- [x] Reconciliación detallada del ledger documentada en `migration-ledger-audit-2026-09-03.md`; ninguna migración fue aplicada, renombrada ni reparada.
- [x] `npm run check:migrations`: 258 migraciones canónicas y 20 overlays locales válidos.
- [x] Bootstrap tipográfico global retirado: contenido visible aun si Google Fonts falla; cuatro hojas remotas consolidadas en una carga no bloqueante.
- [x] Baseline visual de seis combinaciones revisado; SSIM 1,0 en desktop/tablet y mayor a 0,9978 en mobile.
- [x] Benchmark temporal de fuentes repetido sobre host estable (2026-09-03, 22:00). Preflight: CPU 25,8 % de promedio y 6,28 GB libres, contra 49 % y 0,81 GB de la primera serie. A/B intercalado A-B-A-B, diez corridas frías por variante, aislando el bootstrap tipográfico sin reintroducir el import map. FCP 2312 → 2342 ms (p = 0,36), LCP 2658 → 2674 ms (p = 0,76), TBT 582 → 649,5 ms (p = 0,22): ninguna diferencia se distingue del ruido en una prueba de permutación de 200 000 remuestreos. La regresión de +30 % de la primera serie era carga del host. Se conservan los −3 requests y −2268 bytes. Gate temporal de WP-02 satisfecho.
- [x] Artefactos versionados de `tmp/`, `output/` y `tsconfig.node.tsbuildinfo` retirados solo del índice; los archivos permanecen en disco.
- [x] Los 14 hooks de `useMetricsExtras.ts` se separaron por dominio conservando API y query keys.
- [x] Primer CSS inyectado extraído: Métricas emite un asset lazy propio y reduce el total de la superficie en ~1,51 kB gzip.
- [x] Code-splitting de PDF reparado: el visor queda en un chunk lazy de ~127 kB gzip y deja de inflar `SolicitudesManager` hasta que se abre un PDF.
- [x] Validación de cierre parcial: type-check, 90 suites/765 tests, siete E2E, lint sin errores y build de producción.
- [ ] El lint actual informa 462 warnings preexistentes/concurrentes; este track no los convirtió en cambios funcionales.
- [x] Seguridad de dependencias cerrada sin `audit fix --force`: los 8 hallazgos (1 bajo, 4 moderados, 3 altos) se trataron en tres grupos y `npm audit` pasa a 0.
  - Matriz individual, advisories, exposición y validación: `docs/dependency-security-audit-2026-09-03.md`.
  - Runtime directo: `dompurify` subió de `^3.3.0` a `^3.4.14` dentro de la misma major; regresión de sanitización en `src/components/admin/dashboard/__tests__/Briefing.security.test.tsx`.
  - Toolchain transitivo: `@humanfs/node@0.16.8`, `browserslist@4.28.8`, `fast-uri@3.1.7`, `nanoid@3.3.18` y `postcss-selector-parser@6.1.4` fijados por `overrides`, todos parches dentro de la rama compatible.
  - Herencia de ExcelJS: `uuid@11.1.1` aislado por `override` porque ExcelJS 4.4 sigue fijando la rama 8; ExcelJS no se movió de versión.
- [x] Verificación de la remediación (2026-09-03): versiones corregidas presentes en `node_modules`; `npm audit` responde 0/0/0/0/0. Para descartar un cero de caché offline se corrió un control con `dompurify@3.3.0` y `nanoid@3.3.7` en un proyecto aparte: el mismo endpoint devolvió 1 moderado y 1 alto, así que el cero del proyecto es real.
- [x] Evidencia funcional del salto mayor de `uuid`: ciclo escritura/lectura XLSX de ExcelJS con acentos y formato numérico (6631 bytes, valores idénticos al round-trip) y 2 suites/8 tests verdes sobre los dos consumidores directos.
- [ ] Pendiente menor: `node_modules/.deno/` conserva un `uuid@8.3.2` en la caché npm de Deno (1093 paquetes). No forma parte del grafo npm ni del bundle; queda anotado para higiene, no como hallazgo de seguridad.
- [x] WP-01 validado con el daemon activo (2026-09-03). El cuelgue anterior de 17 minutos era presión de memoria, no WSL: con 4,18 GB libres el daemon respondió en 15 s (Docker 29.2.1, backend Linux).
- [x] Hallazgo real del build Docker: `npm ci` no podía completarse nunca sobre `node:20-alpine`. El devDependency `deno` 2.9.5 —usado sólo por `deno check` de edge functions en CI— aborta su postinstall con «Musl is not supported». Se corrigió con `npm ci --ignore-scripts` en el builder: el único `prepare` del proyecto es `husky`, que ya estaba deshabilitado, y ni Vite ni TypeScript ni el plugin de React dependen de un postinstall. Esto explica además el `node_modules/.deno/` local.
- [x] Smoke real del contenedor sobre puerto aislado: `/` 200 con 12 749 bytes de HTML, fallback SPA de `/admin/metricas` 200, entry chunk servido con 657 915 bytes y `application/javascript`, 404 real para un asset inexistente. La imagen final pesa 82,4 MB y no contiene `node`, `npm` ni `node_modules`; el HTML servido no tiene import map ni referencias a `esm.sh`. Contenedor e imagen de validación eliminados al terminar.
- [x] Validación de cierre con las dependencias actualizadas: `check:migrations` (258 canónicas y 20 overlays), type-check sin errores, lint con 0 errores y 473 warnings preexistentes, 91 suites y 766 tests, y 7 E2E. Las 91 suites y 766 tests superan el baseline de 90/765 por la regresión de sanitización agregada.
- [x] Fragilidad E2E mitigada: una corrida previa pasó 7/7, pero `login` e `inscripcion` tardaron 28,9–29,4 s contra el timeout global de 30 s por el montaje frío de Vite. Ambos `describe` ahora declaran 60 s, igual que acreditación; las esperas funcionales siguen acotadas a 15 s, por lo que no se debilitaron las aserciones. La corrida posterior al cambio volvió a pasar 7/7 en 44,5 s. El costo de compilación fría queda como deuda de infraestructura, no como regresión del producto.
- [x] WP-04 implementado: `GestionView` bajó de 1480 a 1195 líneas mediante dos controllers cohesivos; `StudentPanelContext` evita renders por updates ajenos del padre (`1 → 2` antes, `1 → 1` después); `NotificationContext` bajó de 770 a 528 líneas al separar FCM, seis listeners Realtime, badge PWA y sonido. APIs públicas, query keys y tablas se conservaron.
- [x] Gates focales de WP-04: 5 suites/10 tests verdes y lint de archivos intervenidos con 0 errores. Las dos advertencias de accesibilidad restantes en el contenedor central de Gestión son preexistentes.
- [x] Gate global posterior a WP-04 reconciliado con la edición paralela: type-check y build de producción verdes; Jest pasa 96 suites/783 tests; migraciones valida 260 canónicas y 20 overlays; lint pasa con 0 errores y 462 warnings preexistentes/concurrentes; Playwright pasa 7/7 en 35,4 s después del ajuste de timeout.
- [x] WP-06 cerrado sin adopción: 5 suites/29 tests en paridad; Vitest mejoró 24,2 % en frío y 17,2 % en caliente, por debajo del gate. Se retiraron configuración y dependencias piloto.

Durante la ejecución apareció una migración local adicional sin seguimiento. Se preservó sin inspeccionarla ni modificarla; confirma que los conteos del baseline son una fotografía y que WP-00 debe tolerar trabajo concurrente.

### 2026-09-04 — empaquetado y cierre

- [x] Los cambios del track quedaron separados en commits convencionales y reversibles; no se incluyeron las migraciones ni los cambios funcionales concurrentes de Lanzador, consentimiento y Solicitudes.
- [x] Validación final sobre el árbol integrado: `type-check`, lint con 0 errores, 96 suites/783 tests, 260 migraciones canónicas + 20 overlays, build de producción y 7 E2E en 35,4 s.
- [x] `npm audit` conserva una corrida online válida en 0 hallazgos. El reintento del cierre se interrumpió después de más de dos minutos sin respuesta del endpoint; no se usó `audit fix --force`.
- [x] No hubo cambios visibles para estudiantes que requieran una propuesta de FAQ.
- [x] No se hizo push ni deploy.

Commits del track anteriores a este cierre documental:

| WP        | Commit    | Contenido                                               |
| --------- | --------- | ------------------------------------------------------- |
| WP-00     | `10a7345` | Reconciliación del ledger y protocolo de migraciones    |
| WP-01     | `8677520` | Caché TypeScript, Docker y configuración del bootstrap  |
| WP-02     | `c323210` | Render inmediato, benchmark y code-splitting de PDF     |
| WP-03     | `472184a` | Módulos huérfanos y artefactos generados                |
| Seguridad | `49e533c` | Ocho hallazgos de dependencias remediados sin `--force` |
| WP-04     | `26b4a92` | Hooks suplementarios de métricas                        |
| WP-04     | `6262149` | Controladores de correo e instituciones de Gestión      |
| WP-04     | `e6ce9b8` | Identidad estable del contexto del panel de estudiante  |
| WP-04     | `3120729` | Efectos de push, Realtime, badge y sonido               |
| WP-05     | `278ab05` | CSS de Métricas como asset lazy                         |
| WP-06     | `6c29f69` | Resultado del piloto Vitest y decisión de no adopción   |
| WP-07     | `86454c5` | Timeouts E2E acotados para el montaje frío de Vite      |
