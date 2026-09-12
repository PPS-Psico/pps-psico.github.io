# Plan de integridad de PPS y solicitudes

Fecha: 11 de septiembre de 2026.
Estado: documento original de diagnóstico y diseño. Parte de las correcciones ya
fue implementada y verificada durante la revisión hasta `37b5c97`. Los hallazgos
y cantidades de partida se conservan como evidencia histórica, no como estado actual.

Plan vigente de pendientes: [plan-pendientes-integridad-pps.md](plan-pendientes-integridad-pps.md).

Revisión: incorpora la segunda revisión del responsable y nuevas comprobaciones.
Se separa el cierre de riesgos inmediatos de la reparación histórica extensa.

## Resultado buscado

Impedir nuevas referencias institucionales inválidas, resolver solicitudes sin
escrituras parciales ni duplicados por reintento y conservar evidencia de cada
decisión académica. Los controles deben funcionar desde el panel, scripts y
automatizaciones, y seguir funcionando cuando cambie el frontend.

No requiere reemplazar React, Supabase ni el hosting. Requiere consolidar las
reglas de negocio y hacerlas exigibles en la base de datos.

## Evidencia de partida

Lectura de Supabase y código local realizada el 11/09/2026:

- 221 filas en `lanzamientos_pps`: 132 con institución existente, 88 con NULL y
  una con `recInstMock_nuevo`. Son filas físicas, no una métrica de ofertas.
- De los 88 NULL, 84 tienen inicio en 2025; dos corresponden a Fundación Tiempo
  con inicio en 2026; uno es una prueba técnica y otro una copia sin fecha.
- `lanzamientos_pps.institucion_id` es texto sin FK hacia `instituciones`.
- `src/components/admin/launcher/useLaunchManager.ts:1003` conserva el fallback
  ficticio; `handleSubmit` no exige una institución seleccionada.
- Las 27 prácticas del lanzamiento del Ministerio conservan el vínculo por
  `lanzamiento_id` y 70 horas registradas. Esto no valida documentalmente cada
  acreditación ni justifica modificar solicitudes pendientes.
- `scripts/pps/correcciones.py` no compara horas solicitadas contra la referencia
  del lanzamiento.
- `approveSolicitudNuevaPPS` crea la práctica y luego aprueba la solicitud.
  `approveSolicitudModificacion` aprueba primero y luego actualiza horas.
  Ambas secuencias están en `src/services/solicitudesService.ts`; no forman una
  transacción única. El chequeo previo de estado no resuelve concurrencia.
- La aprobación de nueva PPS copia las horas solicitadas y crea una práctica sin
  `lanzamiento_id`; tampoco conserva allí el `institucion_id` de la solicitud.
- Ya existen pruebas unitarias, E2E y CI. Las pruebas del servicio usan mocks y
  no demuestran atomicidad ni exclusión de aprobaciones concurrentes en Postgres.
- `Panel.get()` devuelve solo 1000 IDs de prácticas frente a 1699 filas contadas
  mediante SQL. El helper hace una sola petición y no verifica cobertura. Es un
  defecto adicional de lectura, confirmado ejecutando una consulta de solo lectura.
- Las ocho solicitudes de modificación de horas aprobadas coinciden actualmente
  con las horas de sus prácticas. Esto no prueba que nunca hubiera fallos o
  reparaciones anteriores. Tampoco una búsqueda de duplicados exactos demuestra
  que todas las incorporaciones hayan quedado aplicadas correctamente.
- No se reprodujeron los seis grupos descritos en la revisión externa usando
  igualdad de estudiante, institución, orientación, fechas y horas: se encontró
  un grupo en Mirarte, con lanzamiento asociado. Para reconciliar resultados
  deben conservarse las consultas y sus criterios; no atribuir causa solo por
  timestamp ni descartar un reintento solo porque hoy existe un lanzamiento.

## Reglas objetivo

1. Una institución se identifica por un UUID existente. Su nombre es editable y
   puede tener alias; no se convierte en una clave automática de identidad.
2. Un borrador puede estar incompleto. Publicar, reabrir o activar una PPS
   institucional exige un vínculo válido. Las excepciones históricas se
   identifican explícitamente y no habilitan nuevas publicaciones incompletas.
3. Una práctica puede proceder de un lanzamiento, de una incorporación externa
   aprobada o de una actividad especial. No se obliga a las dos últimas a tener
   un lanzamiento ficticio. Se preservan los contratos vigentes de PPS especiales.
4. Horas solicitadas, horas de referencia y horas aprobadas son datos distintos.
   La decisión conserva quién la tomó, cuándo, cuánto aprobó y con qué evidencia.
5. Una solicitud se resuelve una sola vez. La resolución y su efecto académico
   se confirman juntos o se revierten juntos.
6. Una coincidencia ambigua o una evidencia ausente exige revisión explícita.
   No encontrar un lanzamiento no equivale a validar las horas pedidas.
7. Un cambio posterior de nombre, horas o fechas del lanzamiento no reescribe
   silenciosamente la evidencia histórica de una resolución.

## Entrega 1 — Contención y diagnóstico reproducible

Prioridad inmediata. Puede prepararse antes de la limpieza histórica.

- Eliminar el fallback ficticio de todos los caminos de escritura. Guardar NULL
  únicamente en borradores incompletos; exigir selección o creación válida para
  publicar. Revisar crear, editar, duplicar, relanzar e importar.
- Añadir protección transitoria de base: rechazar nuevos vínculos inexistentes
  y nuevas transiciones operativas incompletas, sin impedir la reparación de
  registros históricos. Diseñar su convivencia con los estados legacy reales.
- Reparar la única referencia inexistente del Ministerio con evidencia y valor
  anterior conservado. Añadir FK nullable sin esperar a completar los 88 NULL:
  estos no impiden la FK. Como origen es text y destino uuid, revisar dependencias
  y realizar la conversión compatible a UUID; no basta con añadir REFERENCES al
  campo actual. Si la migración requiere más trabajo, mantener la contención y
  avanzar inmediatamente con las resoluciones atómicas.
- La FK garantiza existencia, no elección correcta de institución ni ausencia
  de NULL. Mantener la regla de publicación y la revisión de correspondencia.
- Añadir lectura paginada explícita al cliente Python, con orden estable y
  verificación de cobertura. Distinguir lecturas de una página de lecturas
  completas; no cambiar silenciosamente el significado de límites intencionales.
  Un escaneo fallido o incompleto no puede producir un veredicto de integridad.
- Para auditorías completas, preferir consultas SQL en una misma instantánea;
  para lecturas paginadas, controlar cambios concurrentes y volver a verificar
  cuando impidan asegurar cobertura. Probar más de 1000 filas y fallo de una página.
- Inventariar todos los escritores: frontend, RPC, Edge Functions, scripts,
  importaciones, procesos Moodle y agentes con credenciales privilegiadas.
- Crear un diagnóstico de solo lectura, con salida legible y JSON, que enumere
  referencias inválidas, ausencias clasificadas, discrepancias institucionales y
  resoluciones sin efecto académico trazable. Distinguir pruebas e históricos.
- Revisar las propuestas pendientes de la automatización con la referencia del
  lanzamiento y respaldo documental. No corregir horas automáticamente.

Cierre: intentar guardar un ID ficticio o publicar sin institución falla también
por API; el diagnóstico reproduce el inventario y distingue deuda histórica de
nuevos errores.

## Entrega 2 — Resoluciones atómicas y permisos efectivos

Prioridad inmediata, antes de la limpieza histórica. El mínimo es dos operaciones
transaccionales, bloqueo de solicitud, vínculo único a la práctica resultante,
permisos efectivos y pruebas de rollback y reintento.

- Sustituir las secuencias de aprobación por operaciones de dominio en Postgres:
  resolver incorporación y resolver modificación de horas. Reutilizar el patrón
  de las bajas atómicas existente sin mezclar sus reglas disciplinarias.
- Dentro de una misma transacción: autenticar y autorizar al actor, bloquear la
  solicitud, comprobar pendiente y pertenencia, validar la decisión, crear o
  modificar la práctica, registrar auditoría y resolver la solicitud.
- Para cambios de horas, bloquear también la práctica. Mantener un orden
  consistente de bloqueos. El bloqueo básico no se pospone: un doble clic o un
  reintento concurrente existe incluso con un solo coordinador. El control de
  versión o valor esperado entre solicitudes diferentes puede añadirse en una
  segunda iteración, sin frenar la transacción inicial.
- Añadir vínculo único entre solicitud de incorporación y práctica resultante.
  Definir idempotencia: mismo intento devuelve el resultado existente; un intento
  incompatible informa conflicto. La unicidad por solicitud no reemplaza la
  detección de solicitudes distintas para una misma PPS.
- Registrar horas pedidas, referencia y versión consultadas, horas aprobadas,
  diferencia, motivo, fuente documental, actor y fecha. Reutilizar auditoría
  existente cuando cubra el contrato y completar lo faltante. En el primer corte
  conservar al menos actor, fecha, solicitud, práctica y valores antes/después;
  completar referencia y evidencia estructuradas junto con la entrega 3.
- Revisar INSERT, UPDATE, grants y RLS. El estudiante debe poder presentar una
  solicitud pendiente, pero no establecer campos de resolución ni elegir otro
  estudiante. Probar llamadas directas, no solo el formulario.
- Impedir que el cliente eluda la resolución mediante UPDATE de estado o de
  campos protegidos. Migrar cada escritor legítimo antes de cerrar esos permisos.
- Usar funciones con privilegios mínimos; encapsular lógica privilegiada en
  esquema privado, fijar search_path y restringir EXECUTE según el contrato.
- Como mejora posterior, si se confirma que la resolución dispara correos,
  registrar el evento en la misma transacción
  y enviarlo después mediante una cola con clave de deduplicación y reintentos.
  Un fallo de correo no debe repetir la acreditación. No prometer entrega externa
  exactamente una vez si el proveedor no ofrece esa garantía.

La cola de correo, el versionado académico completo y las pantallas adicionales
no son prerrequisitos de la primera RPC. La autenticación, autorización, bloqueo,
unicidad, atomicidad y cierre de escrituras que eludan la RPC sí son parte del mínimo.

Cierre: doble clic, reintento, dos coordinadores y fallo intermedio producen una
sola resolución íntegra; acceso no autorizado y cambios directos quedan rechazados.

## Entrega 3 — Referencia académica y revisión de solicitudes

Depende del contrato de datos y de la operación de resolución.

- Incorporar lanzamiento y orientación verificados a la revisión de nuevas PPS
  cuando correspondan. Para modificaciones, partir de la práctica y su vínculo
  existente antes de buscar candidatos.
- Añadir explícitamente `solicitudes_nueva_pps.lanzamiento_id uuid NULL` con FK a
  `lanzamientos_pps.id`, índice y política de eliminación que preserve trazabilidad.
  Separar una sugerencia del estudiante o agente de la verificación administrativa
  mediante estado, actor y fecha de verificación. No confiar en el ID recibido.
- La resolución valida institución, orientación y pertinencia del lanzamiento;
  conserva el vínculo y la institución en la práctica creada. Un UUID existente
  que corresponde a otra PPS tampoco debe aceptarse como referencia verificada.
- Mantener NULL para procedencia externa legítima y para casos pendientes de
  identificación. Persistir la procedencia y distinguir ausencia de lanzamiento
  por diseño de vínculo todavía no resuelto. No backfillear por similitud automática.
- Si existe más de un candidato, mostrar opciones y evidencia; no elegir uno
  automáticamente por proximidad de fechas. Fechas diferentes se presentan como
  diferencia a justificar, no como coincidencia exacta.
- Permitir procedencia externa documentada sin inventar un lanzamiento. Resolver
  la identidad de institución cuando la actividad sea institucional; mantener
  excepciones de actividades especiales bajo sus contratos vigentes.
- Definir la referencia por lanzamiento y orientación, alineada con la unidad
  existente de Moodle. Si ambas orientaciones acreditan igual, comparten valor;
  si difieren, guardar la diferencia explícitamente. No inferir 64/70 horas por
  nombre de orientación. La regla académica debe confirmarse antes de cargarla.
- Mantener el valor histórico de referencia consultado al resolver. Cambiar la
  referencia de una cohorte no debe modificar acreditaciones ya decididas.
- En la vista administrativa, presentar juntos: horas pedidas, referencia, horas
  propuestas para aprobar, diferencia, fechas, orientación y respaldo.
- Toda excepción respecto de la referencia exige motivo y evidencia; el monto
  final lo decide coordinación. La coincidencia aritmética tampoco equivale a
  aprobación documental.
- Compartir un contrato versionado de validación entre panel y automatización.
  El backend aplica la regla; TypeScript y Python consumen sus resultados y no
  mantienen copias divergentes de la decisión académica.
- Añadir búsqueda de acuerdos por encima de la referencia al procedimiento del
  agente, con fuentes trazables. La IA propone; la resolución usa la operación
  controlada y las autorizaciones existentes.

Cierre: un pedido de 80 con referencia 70 muestra la diferencia y exige una
decisión respaldada; un caso ambiguo nunca aparece como completamente validado.

## Entrega 4 — Reparación histórica controlada

Depende del inventario de la entrega 1. No bloquea la FK ni las RPC atómicas.
Es trabajo posterior necesario para completar los cruces históricos; puede
priorizarse por las cohortes que se estén revisando.

- Preparar una tabla de reparación con registro, valor anterior, institución
  propuesta, evidencia y grado de certeza. Resolver primero Ministerio y las
  dos PPS de Fundación Tiempo; luego revisar las 84 filas de 2025.
- Usar nombres normalizados, alias, fechas, orientaciones y relaciones existentes
  para producir candidatos. No asignar por similitud de texto ni por primer
  resultado. Registrar aparte los casos sin evidencia suficiente.
- Conservar IDs de lanzamientos y prácticas. No recrear filas para reparar un
  vínculo. Completar institución en prácticas derivadas cuando sea inequívoco y
  detectar cualquier desacuerdo con una institución ya guardada.
- Exportar los valores afectados y registrar cada reparación. Aplicar cambios
  condicionados al valor previo para no pisar ediciones concurrentes.
- Verificar la FK instalada en la entrega 1 y retirar cualquier compatibilidad
  transitoria pendiente cuando todos sus consumidores estén migrados.
- Preferir archivar instituciones referenciadas y restringir su eliminación.
  Documentar fusión y alias para evitar duplicados de catálogo.
- No aplicar un NOT NULL global que rompa borradores o excepciones históricas.
  Las reglas de publicación deben verificar la integridad operativa.
- Antes de modificar vínculos, revisar efectos de triggers de Moodle y otros
  consumidores; no adoptar ni reconfigurar tareas históricas durante esta limpieza.

Cierre: cero referencias no nulas inexistentes; toda ausencia restante tiene
clasificación y tratamiento; cero cambios involuntarios en horas, notas, estados,
identidad de prácticas o vínculos Moodle.

## Entrega 5 — Pruebas y publicación segura

- Añadir contratos SQL sobre Postgres real de prueba para FK, reglas de estado,
  permisos, rollback, idempotencia y concurrencia. Ampliar los tests existentes;
  no confiar en mocks para demostrar propiedades de la base.
- Casos mínimos: UUID inexistente; placeholder; borrador sin institución;
  publicación incompleta; renombre institucional; varias cohortes; dos
  orientaciones con referencias distintas; solicitud externa; actividad especial;
  excepción de horas; evidencia ausente; resolución simultánea; versión obsoleta;
  fallo entre operaciones; reintento de correo; usuario sin rol autorizado.
- Añadir casos de 1001 o más filas, límite intencional y fallo a mitad de paginado.
  Conservar la consulta y alcance de cada auditoría para poder reproducirla.
- Cubrir en E2E crear, duplicar, publicar y resolver una solicitud. Ejecutar las
  pruebas de integración fuera de producción con datos sintéticos.
- Ampliar CI existente: mantener tipos, tests y build; incorporar replay y
  contratos de migraciones cuando los cambios sean de base. La comprobación
  actual de nombres de migraciones no demuestra que el esquema pueda reconstruirse.
- Después de cada migración aplicada: `npm run gen-types` y `npm run type-check`.
  No editar `src/types/supabase.ts` manualmente.
- Desplegar primero backend compatible, luego consumidores y por último retirar
  escrituras antiguas. Ensayar rollback y contemplar pestañas abiertas con una
  versión anterior del frontend: deben fallar claramente, nunca guardar a medias.
- Comparar antes/después los registros afectados y contratos existentes. Si se
  modifican métricas, seguir las lecturas y reconciliaciones obligatorias de
  AGENTS.md; este plan no cambia las definiciones analíticas.

Cierre: migración ensayada, contratos aprobados, tipos regenerados, CI verde y
lectura posterior de producción consistente con el cambio previsto.

## Entrega 6 — Mantenimiento y detección temprana

- Programar, como parte de la implementación futura, el diagnóstico de integridad
  y alertar solo sobre nuevas incidencias o cambios que requieran intervención.
  Este documento no crea una automatización.
- Registrar errores por operación con identificador de solicitud o lanzamiento;
  evitar datos personales y contenido de correos en logs generales.
- Mantener una lista acotada de excepciones históricas con motivo y responsable;
  una excepción nueva debe ser visible, no quedar absorbida por un NULL silencioso.
- Documentar contratos, escritores autorizados, procedimiento de reparación y
  despliegue. Vincular las reglas críticas desde AGENTS.md y tests.
- Mantener fixtures y simulaciones separados de los caminos de escritura reales.
  Retirar placeholders de producción; no borrar pruebas históricas sin revisar
  sus dependencias y finalidad.
- Proponer actualización de FAQ cuando se concreten cambios para estudiantes:
  información necesaria para incorporar una PPS, diferencias de horas y estado
  de revisión. Presentar texto al responsable antes de incorporarlo, según AGENTS.md.

Cierre: nuevas inconsistencias se detectan sin depender de que una IA las encuentre
casualmente, y existe un procedimiento verificable para corregirlas.

## Orden y decisiones de implementación

Orden recomendado: contención y lecturas completas → reparación puntual y FK
nullable → resoluciones atómicas → vínculo y referencia en solicitudes → limpieza
histórica priorizada → seguimiento operativo. La migración de tipo/FK no debe
frenar las RPC si aparecen dependencias SQL que requieran una transición mayor.
Las pruebas se escriben en cada entrega, no se postergan hasta el final.

Cada reparación exige resolver la identidad de esa fila; los casos ambiguos no
bloquean la protección estructural ni la corrección de casos inequívocos. Antes
de habilitar nuevas referencias académicas debe confirmarse si hay valores por
orientación o excepciones de cohorte. El diseño técnico no debe inventar esas reglas.

No se considera terminado por quitar `recInstMock_nuevo`. Se considera terminado
cuando la base rechaza relaciones inválidas, las resoluciones son indivisibles,
las excepciones tienen evidencia, los clientes no eluden las reglas y las pruebas
demuestran esos comportamientos.

## Referencias técnicas

- [PostgreSQL: restricciones e integridad referencial](https://www.postgresql.org/docs/current/ddl-constraints.html).
- [PostgreSQL: bloqueos de filas y concurrencia](https://www.postgresql.org/docs/17/explicit-locking.html).
- [Supabase: funciones de base de datos](https://supabase.com/docs/guides/database/functions).
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: límite de respuesta y paginación](https://supabase.com/docs/reference/python/select).
