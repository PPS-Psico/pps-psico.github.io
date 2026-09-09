# Plan de profesionalización y escalabilidad · Mi Panel Académico

Fecha: 04/09/2026. Alcance: revisión del checkout actual, incluidos cambios locales existentes; lectura de metadatos y definiciones en Supabase; comprobaciones locales y navegación con datos ficticios. No se modificaron reglas del producto ni datos productivos.

## Diagnóstico

Mantener React + Vite + TypeScript + Supabase y consolidar una aplicación modular. La base tecnológica y las pruebas ya permiten una evolución profesional. Los principales riesgos están en la coherencia de contratos, la autorización por operación, el mantenimiento de componentes y estilos grandes, y el comportamiento ante fallos.

El volumen actual observado en estadísticas de Postgres es moderado: aproximadamente 2.474 filas en convocatorias, 1.698 en prácticas, 402 en estudiantes y 219 en lanzamientos. Son estimaciones del motor, no conteos de negocio ni mediciones de concurrencia. No permiten prometer una capacidad máxima. Sí justifican empezar por consultas acotadas, medición y organización antes de cambiar infraestructura.

## Evidencia de calidad actual

| Comprobación                               | Resultado                                                           |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `npm run type-check`                       | Correcto                                                            |
| `npm run lint`                             | 0 errores, 460 advertencias                                         |
| `npm test -- --ci --runInBand --silent`    | 96 suites y 790 pruebas correctas                                   |
| `npm run test:e2e`                         | 7 pruebas correctas, Chromium, backend simulado                     |
| Build de producción en directorio separado | Correcto; advertencias por chunks grandes                           |
| `npm run check:migrations`                 | 263 archivos canónicos y 20 overlays válidos según el chequeo local |
| Ledger vivo                                | 261 entradas; última versión observada `20260904180000`             |
| RLS en tablas de `public`                  | Ninguna tabla con RLS deshabilitada en la lectura realizada         |

El chequeo de migraciones valida nombres, unicidad de versiones y archivos no vacíos. No compara el SQL con producción ni ejecuta un replay. Que pase no demuestra equivalencia entre ambos historiales. No se ejecutaron replay SQL, contratos RLS por usuario, carga concurrente ni `check:functions` en esta auditoría.

Las 460 advertencias de lint incluyen 100 de `any`, 70 de variables sin uso y 266 de reglas de accesibilidad: 89 de click sin equivalente de teclado, 80 de interacción en elementos estáticos, 70 de asociación label/control, 15 de elementos no interactivos y 12 de autofocus. Varias pueden corresponder al mismo elemento; las de autofocus requieren criterio contextual.

Fortalezas a conservar:

- Tipos de Supabase generados, TypeScript estricto y servicios por dominio.
- Lógica pura con pruebas de propiedades, contratos analíticos y pruebas de reconciliación.
- React Query, rutas lazy, clasificación central de errores y estados parciales en métricas.
- Cierre de selección mediante RPC y notificaciones con registro e idempotencia.
- Health check que consulta DB, Storage y frescura del backup, en vez de devolver salud fija.
- Simulación y E2E aislados de producción.
- Identidad Paper & Ink, jerarquía editorial y diseño móvil específico para estudiantes.

## Hallazgos prioritarios

### P1 · Precisar la autorización de las RPC

Los advisors actuales señalan cuatro funciones `SECURITY DEFINER` ejecutables por `anon`. Se revisaron sus definiciones. `close_moodle_task_v1` y `reopen_moodle_task_v1` comprueban `is_admin()`: no se comprobó escritura anónima. Sin embargo, `is_admin()` admite SuperUser, Jefe, Directivo y AdminTester, mientras esos procedimientos describen su acción como exclusiva de coordinación.

`moodle_task_close_state_v1()` es ejecutable por `anon` y su definición no tiene filtro de identidad o rol. Devuelve estados y fechas operativas del catálogo. Esa exposición merece revisión explícita, aunque no devuelve nombres de estudiantes. El análisis se limitó a definiciones y privilegios; no se invocaron escrituras para intentar explotarlas.

Acción: matriz rol × recurso × operación, grants mínimos y controles específicos para cerrar/reabrir tareas, con pruebas de aislamiento de jefatura por orientación. Revisar también funciones expuestas a usuarios autenticados sin suponer que `SECURITY DEFINER` sea por sí mismo una vulnerabilidad: varias RPC del proyecto lo necesitan.

Aceptación: pruebas negativas con anónimo, estudiante ajeno y rol sin atribución; pruebas positivas del rol autorizado; ninguna ampliación de permisos por compartir un helper demasiado general. Los cambios SQL deben seguir el procedimiento de ledger vigente en AGENTS.md.

### P1 · Validar antes de integrar y probar el artefacto publicado

El workflow principal se dispara con `push` a `main` y ejecución manual; no tiene trigger `pull_request`. Ya ejecuta lint, tipos, unitarias y E2E, pero la barrera llega después de integrar. El workflow de Edge Functions es independiente y no espera esas validaciones del frontend.

Los E2E arrancan Vite en desarrollo. El React Compiler se activa únicamente en producción. Por eso las siete pruebas no certifican el runtime compilado, el despliegue de GitHub Pages, el iframe de Moodle ni el service worker.

Acción: job reutilizable de validación en PR, chequeos obligatorios configurados en el repositorio, despliegue dependiente de los checks pertinentes y un smoke del build servido como producción. Verificar también el subdirectorio real y el retorno desde Campus. La configuración remota de protección de ramas no fue inspeccionada.

Aceptación: un PR que falla no es integrable; los recorridos esenciales pasan sobre el build; los contratos de Edge/SQL corren en un ambiente aislado; los despliegues conservan una versión y un procedimiento de recuperación verificables.

### P1 · Separar error, dato desconocido y cero

En Inicio administrativo se reprodujo una caída de las consultas usando un backend ficticio inaccesible. La interfaz informa el fallo, pero muestra simultáneamente `0` y “Nada por acreditar”. Además, el error del briefing se presenta como si todavía no se hubiera generado.

`useInicioData.ts` usa `data ?? []` y valores predeterminados en cero. El estado agregado de error es útil, pero las tarjetas continúan recibiendo números válidos. Esto puede inducir una decisión operativa equivocada.

Acción: resultado tipado por sección (`loading`, `ready`, `empty`, `partial`, `error`), último dato confirmado y fecha de actualización. En ausencia de dato válido, mostrar “No disponible” y un reintento localizado. Reservar cero para consultas exitosas.

Aceptación: una prueba de fallo de cada consulta no produce una afirmación de ausencia de trabajo. Una consulta exitosa sin filas sí muestra el estado vacío correspondiente. Aplicar el patrón existente de `QueryState`/`DbError` progresivamente.

### P1 · Reconciliar documentación y comportamiento

AGENTS.md documenta Borrador → Selección → Seguro → Confirmación → Activa. El código y la pantalla revisados muestran Borrador → Selección → Confirmación → Seguro → Activa. También difieren el mapeo de `Cerrado`/`Confirmacion` y el papel del calendario en la clasificación activa.

La discrepancia se confirma en `aseguramientoService.ts` y `lanzadorState.ts`. No se determina aquí cuál es la regla de negocio aprobada ni se propone invertir el flujo automáticamente.

Acción: resolver una definición vigente, fecharla en una decisión arquitectónica, reconciliar instrucciones, contratos, pruebas y documentación. Tratar del mismo modo las descripciones históricas de analítica y Moodle: algunas deudas documentadas ya están parcialmente resueltas en código.

Aceptación: una tabla de transiciones canónica, consumida o verificada por pruebas, y ausencia de instrucciones contradictorias para la misma operación. Conservar los hashes y divergencias históricas de migraciones; no renombrar ni reaplicar historia para alinear listados.

### P2 · Organizar por funcionalidades y acotar dependencias

Hay una transición incompleta entre `components`, `views`, `hooks`, `services`, `logic`, `domain` y `features`. Jefatura y reportes ya muestran una organización útil. Persisten componentes de más de 1.300 líneas, un archivo Atlas CSS de 10.124 líneas y CSS global de 4.485 líneas. El tamaño es una señal para inspeccionar responsabilidades, no una razón suficiente para fragmentar todo.

Acción gradual: usar `features/lanzamientos`, `features/solicitudes`, `features/estudiantes`, `features/moodle` y `features/reportes`; mantener reglas puras en dominio, llamadas en servicios y hooks como coordinación de datos. Unificar keys de React Query e introducir límites de importación. Retirar código sin consumidores después de confirmarlo; por ejemplo, `useOperationalData` sólo aparece referenciado por su propia prueba en la búsqueda realizada.

Primeros candidatos: Seleccionador, formularios de inscripción/finalización y estilos Atlas. Extraer operaciones concretas antes de mover carpetas masivamente. Mantener los tipos autogenerados intactos y validar payloads externos en los límites del sistema.

Aceptación: una modificación de una regla no exige duplicarla en desktop/mobile; servicios testeables sin renderizar la pantalla; advertencias nuevas bloqueadas, reducción progresiva de deuda verificada.

### P2 · Consultas y rendimiento medidos

`fetchAllData` recorre páginas de 1.000 hasta descargar el conjunto completo. Eso evita truncamientos, pero no limita el trabajo. En Seleccionador, la búsqueda de estudiantes disponibles descarga todos los estudiantes y excluye los inscriptos en el cliente; además incorpora el lanzamiento a la cache key, aunque la carga base sea la misma.

Acción: búsquedas y filtros del lado servidor, proyecciones de columnas, páginas o cursores estables según necesidad; RPC de lectura sólo cuando resuelva un agregado o permiso concreto. Medir cancelaciones y reintentos para evitar trabajo duplicado entre el wrapper y React Query. Conservar exportaciones completas donde la operación sí las necesita.

Los advisors de rendimiento informan ocho FKs sin índice de cobertura, 22 avisos de políticas permisivas múltiples, 35 índices sin uso observado y un aviso de bloat. Son candidatos para medir con planes de consulta y estadísticas, no una orden de crear o eliminar índices en masa. Ver la [guía oficial de optimización de Supabase](https://supabase.com/docs/guides/database/query-optimization).

Build observado: entry JS de unos 658 kB (195 kB gzip), CSS global de 260 kB (41 kB gzip) y Atlas CSS de 186 kB (31 kB gzip). Los bundles diferidos de PDF/Excel son grandes; su tamaño no equivale a descarga inicial. `index.html` solicita ocho familias en Google Fonts y existen fuentes locales adicionales.

Aceptación: presupuestos de peso por ruta, comparación con esta base y carga simulada al menos 10× mayor en un ambiente descartable. Medir latencia p95 de operaciones y experiencia en móvil antes de fijar una capacidad prometida. Revisar imports y fuentes; conservar las precauciones documentadas contra chunks que rompan el orden de dependencias de React.

### P2 · Conectar observabilidad y recuperación

Sentry y web-vitals figuran como dependencias y existe `VITE_SENTRY_DSN`, pero la búsqueda de inicialización en `src` no encontró integración activa. En el logger y AdminErrorBoundary las llamadas a Sentry están comentadas. Hay diagnósticos locales y health check real; la telemetría de errores del frontend necesita conexión explícita.

Acción: errores con release y operación, métricas de experiencia, alertas sobre health/frescura de trabajos y un identificador para relacionar una operación entre frontend, Edge y worker. Excluir nombres, legajos, correos, tokens y documentos académicos de la telemetría. Revisar CSP al habilitar un destino nuevo. Probar la restauración de backup en un ambiente descartable y documentar tiempos de pérdida y recuperación aceptables.

Aceptación: error controlado visible en el monitor con contexto suficiente y sin datos personales; alerta comprobada por trabajo vencido; restauración ensayada. La auditoría no certificó configuración de monitores externos ni una restauración real.

### P2 · Completar la operación de Moodle por etapas

El workboard ya distingue planner, worker y operación real. Conservar ese rigor: contratos, leases y deduplicación son una base valiosa, pero no prueban que la creación dedicada esté funcionando.

Acción: contrastar el workboard con estado desplegado y registros de ejecución; integrar observación persistente con checkpoints, backoff y estados parciales; dry-run y piloto dedicado de 2027 antes de ampliar escritura. Preservar el carácter compartido de tareas históricas. Documentar recuperación e idempotencia de cada integración.

Aceptación: evidencia de ejecución real del piloto, repetición sin duplicados, fallo recuperable y frescura visible. No se ensayó el worker real en esta revisión.

## Mejora visual propuesta

La dirección actual tiene identidad y resulta apropiada para PPS. El avance más útil es aumentar coherencia, legibilidad y claridad de las acciones.

| Prioridad | Hallazgo                                             | Cambio propuesto                                                                                     | Validación                                                                    |
| --------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| P1        | Aviso de Confirmación comprimido en móvil            | Apilar texto y acción; botón en su propia fila dentro de una variante `.lv4-*`                       | En viewport 390×844 el texto conserva ancho útil; probar también 360px y zoom |
| P1        | Cero y “Nada por acreditar” frente a error           | Estado desconocido explícito por tarjeta y reintento localizado                                      | Fallo de red y respuesta vacía producen estados distintos                     |
| P2        | Identidad tipográfica y controles divergentes        | Tokens semánticos compartidos con variantes de rol explícitas                                        | Botones, campos, modales, estados y foco pertenecen al mismo sistema          |
| P2        | Metadatos muy pequeños/tenues en Lanzador            | Subir texto operativo esencial a una escala legible, reservar microtexto para información secundaria | Contraste medido, teclado, zoom 200% y lector de pantalla                     |
| P2        | Inicio dedica mucha superficie a un briefing ausente | Colocar trabajo pendiente y próxima acción primero; briefing como apoyo compacto                     | Coordinación identifica qué atender sin recorrer contenido vacío              |
| P2        | Representaciones distintas en desktop/mobile         | Un modelo de presentación compartido para estados de convocatoria                                    | Mismo dato produce el mismo significado en ambos tamaños                      |

En el simulador, el mismo Hospital Garrahan apareció como “Ya realizada” en desktop y “Seleccionado/a / Inscripto” en móvil. Esto demuestra divergencia de presentación sobre la misma muestra, no cuál es el estado real de esa PPS. Revisar precedencias en `StudentHomeAtlas` y `StudentConvCard`.

El problema del banner móvil quedó medido: contenedor de unos 275px, botón de unos 194px y `.lv4-banner-main` con ancho calculado de 0px. El viewport no presentaba overflow horizontal global; el problema está dentro del layout flex. El contenedor adicional del simulador reduce el área útil y debe repetirse la comprobación en la ruta final y en Campus.

Conservar los scopes `.lv4-*` del Lanzador, las adaptaciones móviles del estudiante y los colores institucionales de orientación. Compartir fundamentos no significa imponer el mismo layout a todos los roles. Reconciliar DESIGN.md con las variantes aprobadas antes de tratar toda diferencia como error.

Usar [WCAG 2.2](https://www.w3.org/TR/WCAG22/) como criterio verificable. Los 44px son una buena meta de comodidad para controles táctiles; no equivalen por sí solos al requisito AA de tamaño mínimo, que tiene otra definición y excepciones. No se certificó conformidad completa ni se midieron todos los contrastes.

## Plan de ejecución

Estimación orientativa para una persona dedicada: 6–8 semanas para una consolidación acotada. Los tiempos deben ajustarse tras resolver los contratos y comprobar ambientes disponibles. Cada fase debe producir cambios pequeños y revisables.

| Etapa                         | Esfuerzo orientativo | Entrega                                                                                           | Criterio de cierre                                                                  |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Permisos y contratos       | 3–5 días             | Matriz de permisos, exposición RPC revisada, decisión del pipeline, procedimiento de ledger claro | Reglas inequívocas y pruebas negativas de autorización                              |
| 2. Calidad y operación        | 4–6 días             | Checks en PR, smoke del build, estados de error coherentes, captura de errores                    | Fallos visibles y cambios inválidos bloqueados antes de integrar                    |
| 3. Modularización y consultas | 7–10 días            | Primeras funcionalidades separadas, búsquedas paginadas, keys/errores compartidos                 | Sin duplicación de reglas ni lecturas completas innecesarias en los casos elegidos  |
| 4. Consistencia visual        | 5–7 días             | Banner móvil, tipografía, controles, accesibilidad y jerarquía de Inicio                          | Matriz desktop/mobile/oscuro/teclado con regresiones verificadas                    |
| 5. Capacidad y recuperación   | 5–8 días             | Presupuestos de rendimiento, prueba de carga, restauración y piloto de integración acotado        | Evidencia de tiempos, recuperación e idempotencia; pendientes operativos explícitos |

El primer sprint debería entregar: revisión de las tres RPC Moodle citadas, CI en PR, corrección error/cero, banner móvil y resolución documentada del contrato del Lanzador. La reorganización más amplia queda apoyada en esas garantías.

Para la regresión visual, aprovechar las capturas existentes pero agregar comparación efectiva: `visual:baseline:check` hoy comprueba cantidad de archivos y firma PNG, no diferencias visuales. Añadir escenarios de error, vacío, datos extensos, móvil y modo oscuro. Empezar por flujos de mayor impacto: inscripción, consentimiento, selección, acreditación y lectura de jefatura.

Si una etapa cambia la experiencia del estudiante, proponer las FAQ correspondientes. Su incorporación requiere el consentimiento explícito indicado en AGENTS.md; este plan no agrega preguntas ni respuestas.

## Referencias locales

Actualización posterior al análisis: el responsable pausó la etapa 1 y autorizó implementar la etapa 2. Los cambios y los pendientes de activación se documentan en [quality-gates.md](quality-gates.md). Los hallazgos y las capturas de este informe describen el estado anterior a esa implementación.

La etapa 3 fue autorizada después, manteniendo Sentry sin activar. Su implementación en Inicio y búsqueda de reemplazos está documentada en [modularization-and-queries.md](modularization-and-queries.md).

| Evidencia                               | Ubicación                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Disparadores de CI                      | `.github/workflows/ci-cd.yml:3`                                                                |
| E2E contra desarrollo                   | `playwright.config.ts:58`                                                                      |
| Compilador exclusivo de producción      | `vite.config.ts:45`                                                                            |
| Valores predeterminados de Inicio       | `src/hooks/useInicioData.ts:299`, `:330`, `:366`                                               |
| Presentación de cifras                  | `src/components/admin/dashboard/DetectionCard.tsx:87`                                          |
| Contrato documentado del pipeline       | `AGENTS.md:170`                                                                                |
| Contrato implementado                   | `src/services/aseguramientoService.ts:69`; `src/views/admin/lanzador/lanzadorState.ts:85`      |
| Búsqueda completa de estudiantes        | `src/hooks/useSeleccionadorLogic.ts:594`                                                       |
| Lectura paginada hasta agotar filas     | `src/services/supabaseService.ts:130`                                                          |
| Logger sin captura externa activa       | `src/utils/logger.ts:72`                                                                       |
| Banner flex y texto comprimido          | `src/views/admin/lanzador/lanzadorStyles.ts:332`; `shared.tsx:154`; `ConfirmacionView.tsx:706` |
| Fuentes externas múltiples              | `index.html:370`                                                                               |
| Validación superficial del baseline     | `scripts/capture-visual-baseline.mjs:29`                                                       |
| Ledger histórico                        | `docs/migration-ledger-audit-2026-09-03.md`                                                    |
| Operación Moodle pendiente de confirmar | `docs/moodle-v2/workboard.md`                                                                  |

## Método y límites de la revisión visual

⚠️ DEGRADED: single-context (los dos subagentes fallaron por límite de créditos del workspace). La evaluación se completó directamente con código y navegador; no se presenta como una revisión independiente de dos evaluadores.

Se revisaron login, Inicio estudiante y administrativo, Lanzador y Confirmación. Navegador local con backend falso, desktop de aproximadamente 1280×720 y móvil 390×844. Jefatura y reportes se inspeccionaron por fuente/documentación, sin certificar su recorrido completo autenticado. La evaluación visual directa precedió a la lectura del detector.

El detector produjo JSON válido con 625 observaciones: 314 tamaños, 200 colores, 97 radios, tres fuentes, seis bordes laterales, dos gradientes de texto, dos transiciones de layout y una fuente considerada común. No son 625 defectos. Las rampas dark, los colores por orientación y los marcadores laterales semánticos explican parte de los avisos; el criterio de “fuente común” no justifica reemplazar una tipografía funcional. El desacuerdo entre DESIGN.md y las variantes actuales limita el valor del conteo.

Heurísticas orientativas del área revisada, 0–4; juicio de diseño, no medición con usuarios:

| Heurística                  | Puntuación | Evidencia principal                                              |
| --------------------------- | ---------: | ---------------------------------------------------------------- |
| Visibilidad del estado      |          1 | Error agregado acompañado de ceros                               |
| Vocabulario del dominio     |          3 | Horas, prácticas, solicitudes y etapas reconocibles              |
| Control y libertad          |          2 | Navegación y reintentos; no se ejecutaron acciones irreversibles |
| Consistencia                |          2 | Divergencias entre roles, dispositivos y documentación           |
| Prevención de errores       |          2 | Avisos y decisiones explícitas; limitaciones en móvil            |
| Reconocimiento              |          3 | Pipeline y agrupación por estado visibles                        |
| Eficiencia                  |          2 | Búsqueda disponible; espacios y acciones móviles mejorables      |
| Jerarquía y economía visual |          2 | Buena identidad; briefing vacío domina Inicio                    |
| Recuperación de errores     |          2 | Reintento existente, significado del dato fallido ambiguo        |
| Ayuda                       |          3 | Aula/FAQ y explicaciones de los pasos presentes por fuente       |
| Total orientativo           |      22/40 | Calidad desigual entre el estado normal y los casos difíciles    |

Personas prioritarias: estudiante que consulta desde el celular (mantener claridad de estado entre dispositivos); coordinación con poco tiempo (priorizar cola y datos confiables); persona que navega con teclado o necesita texto ampliado (resolver controles semánticos y layouts comprimidos).

Evidencias guardadas en `artifacts/project-audit-2026-09-04/`: `student-mobile.png`, `lanzador-mobile.png`, `admin-error-desktop.png` y `design-detector.json`. No se inyectaron overlays; se usaron capturas y lecturas DOM. La pestaña se cerró, el viewport se restableció y el servidor temporal se detuvo. El build de auditoría se conserva en `tmp/project-audit-build-20260904/`, ignorado por Git.

Questions skipped: el pedido es un análisis y un plan; las decisiones pendientes se expresan como entregables de la primera etapa, sin bloquear el informe.
