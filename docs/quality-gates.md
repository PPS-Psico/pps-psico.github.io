# Calidad y operación — etapa 2

La etapa 1 (permisos y contratos) queda pausada por decisión del responsable. Estos cambios no aplican SQL ni despliegan servicios.

## Validación antes de integrar

El workflow `CI/CD Pipeline` ejecuta `Validar aplicación` en cada PR hacia `main`, en pushes a `main` y por ejecución manual:

1. Validación local de nombres y versiones de migraciones.
2. Inventario y tipos de Edge Functions.
3. ESLint, TypeScript y Jest.
4. Playwright contra un build estático de producción, incluyendo React Compiler.

Los PR usan Supabase ficticia y no requieren secretos. Los artefactos con configuración real y el despliegue de Pages sólo se ejecutan desde `main`, después de validar. Las trazas de navegador de los fallos se conservan siete días.

El chequeo de Deno resuelve sus dependencias en su caché y no reinstala el árbol npm del frontend. Se completó la declaración local de `notify-selection-closed`, ya incluida en el despliegue, conservando `verify_jwt = true`.

**Configuración remota pendiente:** al integrar el workflow, marcar `Validar aplicación` como check obligatorio en la protección de `main`. Definir el job en YAML no impide por sí solo que GitHub permita integrar un PR fallido. No se modificó esa protección desde esta tarea.

Comandos locales:

```sh
npm run type-check
npm run lint
npm test -- --ci --runInBand
npm run check:functions
npm run check:migrations
npm run test:e2e:production
```

El último comando genera `.e2e-dist/`, sirve el resultado en el puerto 4180 y ejecuta los recorridos existentes más el caso de fallo y recuperación de Inicio. No reutiliza un servidor previo. `npm run test:e2e` conserva la modalidad de desarrollo.

Los mocks verifican interacción y comportamiento del frontend; no certifican RLS, autenticación real, capacidad o reconciliación de métricas. `check:migrations` tampoco certifica el replay del SQL ni el ledger remoto.

## Estados de Inicio administrativo

Cada sección distingue carga, respuesta válida vacía, respuesta con datos, fallo inicial y fallo de actualización. Un fallo inicial muestra «No disponible»; una actualización fallida conserva el último dato confirmado, con fecha y aviso. El reintento por sección no vuelve a consultar todo el panel. El botón global sigue disponible.

Una consulta lenta de Hermes no bloquea las secciones listas. Si no se pudo consultar el catálogo de instituciones, no se etiqueta una institución como «sin catalogar». El resumen de solicitudes sólo calcula su texto sustituto cuando todas las consultas necesarias respondieron correctamente.

Las tarjetas se apilan en móvil para que el mensaje y el reintento conserven espacio. Las pruebas cubren error frente a cero, recuperación, caché, carga parcial y catálogo no disponible.

## Captura de errores

Se utiliza la dependencia Sentry ya presente, cargada dinámicamente en producción si existe `VITE_SENTRY_DSN`. El workflow incorpora el secreto de ese nombre y etiqueta la versión con el SHA del commit mediante `VITE_APP_RELEASE`. Sin DSN, en desarrollo y en los recorridos con backend ficticio permanece desactivada.

Se capturan errores globales y objetos `Error` enviados al logger, incluidos los boundaries de React. No se envían los argumentos restantes del logger. El evento de salida usa una lista de campos permitidos: identificador, fecha, versión y ubicación en bundles. Se omiten mensajes originales, variables, usuario, formularios, cookies, navegación y breadcrumbs. No se habilitan replay, sesiones, trazas de rendimiento ni integración de consola.

La CSP permite los endpoints de ingestión alojados de Sentry (`ingest.sentry.io`, `ingest.us.sentry.io`, `ingest.de.sentry.io`). Un destino propio requiere declarar su origen preciso en la CSP.

**Activación pendiente:** configurar el DSN del proyecto elegido y comprobar la recepción de un error de prueba en un entorno controlado. No se creó una cuenta ni se enviaron eventos a un servicio externo. La captura comienza cuando termina la carga del SDK; errores anteriores a su inicialización y errores sólo registrados como texto quedan fuera de esta cobertura inicial.

La implementación sigue la API disponible en la dependencia instalada y la [documentación de filtrado de Sentry](https://docs.sentry.io/platforms/javascript/configuration/filtering/).

## Verificación local

- TypeScript: sin errores.
- Jest: 98 suites, 798 pruebas aprobadas.
- Playwright sobre build de producción: 8 recorridos aprobados, incluida recuperación de Inicio en móvil.
- ESLint: sin errores; se mantienen 460 advertencias previas.
- Edge Functions: 20 verificadas; el chequeo conserva las versiones npm del lockfile.
- Historial local de migraciones: validación aprobada, sin ejecución de SQL.

El build conserva las advertencias por chunks grandes, correspondientes al trabajo de rendimiento de fases posteriores. La revisión visual comprobó el indicador «No disponible», el aviso y el acceso al reintento en escritorio y a 390 px. El detector de diseño marcó estilos preexistentes de la familia administrativa; no se cambió la identidad visual en esta etapa.

Tras igualar la altura de las tarjetas se confirmó nuevamente el recorrido en desarrollo. Las capturas finales están en `artifacts/quality-gates-2026-09-04/` y contienen datos ficticios. El servidor habitual quedó disponible en `http://localhost:5173/`.
