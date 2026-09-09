# Etapa 3 — modularización y consultas

Implementación del 5 de septiembre de 2026. La etapa 1 permanece pausada y Sentry sigue pendiente de activación. No se aplicó SQL ni se modificaron permisos, estados del pipeline o reglas de acreditación.

## Búsqueda de reemplazos

Antes, `useSeleccionadorLogic` descargaba todos los estudiantes al abrir cualquier vista que usara ese hook. La única consumidora de la búsqueda era `ActivaView`: filtraba por nombre o legajo en memoria y mostraba cinco resultados, sin paginación. La consulta quedaba deshabilitada cuando no había inscriptos.

Ahora `features/estudiantes` contiene:

- `studentSearchService.ts`: lectura de estudiantes activos por nombre o legajo. Proyecta únicamente `id`, `nombre` y `legajo`; pide 21 filas por página, muestra 20 y usa la adicional para habilitar «Siguiente». No calcula el total ni descarga las demás páginas.
- `useStudentSearch.ts`: búsqueda a partir de dos caracteres, espera de 300 ms al escribir, cancelación con `AbortSignal`, paginación y caché compartida entre convocatorias durante 60 segundos.
- `StudentReplacementSearch.tsx`: estados de carga, error, vacío, resultados y navegación. Utiliza exclusivamente estilos `lv4` del Lanzador.

Los postulados se excluyen de cada página usando el roster actual, fuera de la caché del padrón. Si todos los resultados de una página están postulados, se puede avanzar: una página sin disponibles no se presenta como el final de la búsqueda. Al cambiar el texto se vuelve a la primera página. Al cerrar la búsqueda se desmonta su consulta.

La búsqueda se habilita únicamente cuando el roster está confirmado, incluso si está vacío, y se suspende mientras se actualiza. Si falla ese roster, se muestra un reintento específico. La inscripción continúa pasando por las validaciones existentes de estado activo y DNI; mostrar un resultado no reemplaza esas validaciones.

La base confirmó que nombre, legajo y estado son columnas de texto. La consulta REST anónima con filtros normales y caracteres reservados respondió HTTP 200 sin filas visibles. Esto verifica la sintaxis, no una sesión administrativa real ni las políticas de RLS. No se imprimieron perfiles ni credenciales.

## Inicio administrativo

Las siete consultas se trasladaron a `features/inicio/inicioService.ts`, con errores clasificados mediante `DbError`. `inicioQueries.ts` reúne sus claves, tiempos de vigencia e invalidación. Se conservaron los valores de las claves existentes y los criterios de las consultas para no cambiar cálculos o contratos.

`useInicioData` compone los resultados y mantiene los estados de carga, error y dato anterior implementados en la etapa 2. `AdminDashboard` utiliza la invalidación explícita del módulo y conserva la actualización de `gmailHilos`.

Los estados resueltos de finalización se movieron a `domain/finalizacion/states.ts`. El helper anterior los reexporta por compatibilidad. Así el servicio de Inicio ya no importa código de una pantalla.

Las claves del Seleccionador se construyen desde `launchQueryKeys.ts`. Se retiraron la consulta y las invalidaciones de `availableStudents`, que ya no tienen consumidores. Las búsquedas del padrón no se invalidan por cambiar la selección en otra convocatoria.

## Límites de dependencias

ESLint impide que los servicios de estos dos módulos y la constante de dominio importen React, React Query, componentes, vistas o hooks. Las vistas consumen hooks y servicios; la capa de datos no depende de las pantallas.

La reorganización es gradual. No se movieron carpetas enteras ni se modificaron las exportaciones que necesitan conjuntos completos. Quedan para próximos cambios la extracción de las restantes operaciones del Seleccionador y la extensión de estas convenciones a otras funcionalidades. Las consultas agregadas de Inicio conservan su alcance anterior: esta etapa no certifica su comportamiento por encima del límite de filas de PostgREST ni cambia su contrato de negocio.

## Validación

Resultado final local: TypeScript sin errores; ESLint sin errores y con 460 advertencias previas; Jest con 102 suites y 816 pruebas aprobadas; Playwright con 9 recorridos aprobados sobre el build de producción. Se conservan las advertencias de tamaño de chunks ya conocidas. Capturas con datos ficticios en `artifacts/modularization-2026-09-05/`. El detector no informó observaciones en el nuevo módulo de búsqueda.

Las pruebas nuevas cubren proyección y límite de filas, orden por nombre e ID, caracteres reservados, error frente a vacío, debounce, cancelación, exclusión actualizada, páginas sin disponibles, cambio de término y recuperación. Un recorrido de Playwright verifica la búsqueda real de la interfaz contra una API ficticia, incluida una convocatoria sin inscriptos, el paso a la segunda página y el uso a 390 px.

Comandos de regresión:

```sh
npm run type-check
npm run lint
npm test -- --ci --runInBand
npm run test:e2e:production
```
