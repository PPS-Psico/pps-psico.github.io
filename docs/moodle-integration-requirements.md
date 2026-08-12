# Integración profesional entre Mi Panel y Moodle

## Objetivo

Convertir a Moodle en la fuente autoritativa de tareas, entregas, devoluciones y
calificaciones de informes PPS, sin perder en Mi Panel el dominio que le
corresponde: convocatorias, selección, instituciones, horas, rotación,
consentimiento y solicitudes.

La primera etapa ya funciona mediante un puente de sesión dentro del iframe de
Campus y una importación administrativa normalizada. Las notas dejaron de ser
autodeclaradas: Moodle es la fuente visible, cada observación queda auditada y
el estudiante no tiene permisos para escribir calificaciones. El servicio web
servidor-a-servidor descrito en este documento sigue siendo el objetivo de
mayor confianza.

## Propiedad de los datos

| Dato                                          | Fuente autoritativa futura               | Comportamiento transitorio          |
| --------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| Convocatoria, institución, área y período PPS | Mi Panel                                 | Sin cambios                         |
| Horas y rotación                              | Mi Panel, con validación de coordinación | Sin cambios                         |
| Consentimiento digital                        | Mi Panel                                 | Sin cambios                         |
| Tarea de informe y sus fechas                 | Moodle                                   | Vínculo confirmado en Mi Panel      |
| Estado de entrega y archivos                  | Moodle                                   | Snapshot observado/importado        |
| Nota y devolución docente                     | Moodle                                   | Nota Moodle auditada                |
| Acreditación académica final                  | Circuito institucional/SAC               | Solicitud y seguimiento referencial |

La interfaz conserva siempre la procedencia (`source`) y la fecha del dato. Una
nota Moodle no se reemplaza silenciosamente: la primera lectura terminal cierra
el escaneo y cualquier nueva corrección exige una reapertura administrativa
auditada.

## Pedido mínimo a Sistemas

### 1. Datos de la instalación

- URL base y versión exacta de Moodle.
- Identificador estable del curso o espacio PPS.
- Confirmación de los campos disponibles para vincular estudiantes:
  `idnumber`, `username`, correo y Moodle user ID.
- Identificadores estables de las tareas: idealmente `idnumber` con una
  convención PPS que no dependa del nombre visible.
- Ambiente de prueba separado de producción.

### 2. Servicio web restringido

Solicitar un servicio externo dedicado, por REST y HTTPS, con:

- usuario técnico exclusivo para Mi Panel;
- funciones permitidas explícitamente;
- permisos de mínimo privilegio;
- token con rotación y revocación;
- restricción de red/IP si la infraestructura lo permite;
- descarga de archivos deshabilitada en la primera etapa;
- registro auditable de accesos y cambios.

El token debe vivir únicamente como secreto de una Supabase Edge Function.
Nunca debe enviarse al navegador ni almacenarse en variables `VITE_*`.

Moodle documenta su framework de servicios externos y la documentación concreta
de cada instalación en `Administración del sitio > Servidor > Servicios web >
Documentación API`.

### 3. Funciones estándar requeridas

La lista final debe validarse contra la versión instalada y su documentación API.
El primer alcance de solo lectura necesita, como mínimo:

| Capacidad                            | Funciones candidatas                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| Verificar sitio y usuario técnico    | `core_webservice_get_site_info`                                    |
| Resolver usuario Moodle              | `core_user_get_users_by_field`                                     |
| Resolver cursos/matrículas           | `core_enrol_get_users_courses`, `core_course_get_courses_by_field` |
| Resolver módulos y enlaces           | `core_course_get_contents`, `core_course_get_course_module`        |
| Leer tareas, apertura y vencimientos | `mod_assign_get_assignments`                                       |
| Leer estado de entrega               | `mod_assign_get_submission_status`, `mod_assign_get_submissions`   |
| Leer notas y devoluciones            | `mod_assign_get_grades`, `gradereport_user_get_grade_items`        |
| Leer eventos de calendario           | `core_calendar_get_calendar_events`                                |

Si en una segunda etapa Mi Panel ofrece una experiencia propia de entrega:

- subir el archivo al área borrador mediante `/webservice/upload.php`;
- enviar el `itemid` a `mod_assign_save_submission`;
- completar el envío con `mod_assign_submit_for_grading`;
- descargar archivos autorizados mediante `/webservice/pluginfile.php`.

Moodle recomienda el endpoint dedicado de upload para evitar codificar archivos
grandes en base64.

### 4. Plugin local necesario para automatización completa

Los servicios estándar de `mod_assign` permiten leer tareas, entregas y notas,
pero no ofrecen una operación general de creación de actividades. Para crear y
actualizar automáticamente una tarea por institución/período se debe solicitar
un plugin local pequeño, versionado y auditable.

Contrato sugerido:

#### `local_pps_upsert_assignment`

Entrada:

- `external_id`: ID inmutable generado por Mi Panel;
- `course_id` o `course_idnumber`;
- nombre y descripción;
- fecha de apertura, vencimiento y corte;
- tipo y cantidad máxima de archivos;
- plantilla/rúbrica;
- visibilidad;
- agrupamiento o cohorte, si corresponde.

Salida:

- `assignment_id`;
- `course_module_id`;
- URL canónica;
- fechas efectivas aplicadas;
- `created` o `updated`;
- versión de la configuración.

Debe ser idempotente: repetir la misma solicitud no puede crear tareas
duplicadas.

#### `local_pps_get_student_snapshot`

Una lectura compacta y estable para Mi Panel:

- usuario y curso;
- tarea;
- estado de entrega;
- intento;
- timestamps de primera y última entrega;
- vencimiento efectivo, incluidas extensiones individuales;
- nota, escala y devolución;
- fecha de calificación;
- URL de la tarea;
- archivos como metadatos, sin descargarlos por defecto.

Este endpoint evita acoplar Mi Panel a estructuras internas distintas entre
versiones o plugins de entrega.

### 5. Eventos o sincronización

La integración profesional no debería depender únicamente de consultas desde el
frontend.

Orden recomendado:

1. Sincronización programada desde una Edge Function cada 10–15 minutos.
2. Reconciliación nocturna completa para reparar eventos perdidos.
3. Plugin Moodle con observadores de eventos que notifique a un webhook firmado:
   entrega creada/actualizada, entrega enviada, nota publicada, fecha extendida
   y tarea modificada.

Cada mensaje debe incluir un `event_id` único. Mi Panel debe procesarlo de forma
idempotente, registrar el resultado y poder reintentarlo.

## Modelo de datos preparado para sincronización

La implementación actual ya separa observaciones append-only, snapshots,
ejecuciones de sincronización, lotes de importación, reaperturas y aplicaciones
de nota. Al incorporar la API se reutiliza ese ledger y se eleva la confianza de
la fuente a `api_verified`. El contrato debe contemplar:

- `moodle_user_id`;
- `moodle_course_id`;
- `moodle_assignment_id`;
- `moodle_course_module_id`;
- `moodle_assignment_url`;
- `submission_status`;
- `submitted_at`;
- `due_at`;
- `cutoff_at`;
- `grade_value`;
- `grade_scale`;
- `graded_at`;
- `feedback_text`;
- `data_source`: `moodle_session_observed | export_verified | api_verified | coordination`;
- `synced_at`;
- `sync_status`: `pending | synced | conflict | error`;
- `source_updated_at`;
- `source_version`.

Las notas legacy permanecen auditables, pero Moodle prevalece visualmente y en
los flujos de finalización. Ningún dato enviado por el formulario estudiantil se
usa como fuente académica.

## Reglas de interfaz cuando exista la API

- Mostrar `Sincronizado con Campus` y hora de la última actualización.
- Diferenciar `Borrador`, `Entregado`, `Entregado fuera de término`,
  `En corrección`, `Corregido` y `Requiere cambios`.
- Usar el vencimiento efectivo del alumno, incluidas prórrogas.
- Enlazar siempre a la tarea canónica de Moodle.
- No marcar una entrega solo porque exista un archivo en Mi Panel.
- No considerar una nota oficial hasta que Moodle la publique.
- Mostrar fallas de sincronización sin convertirlas en estados académicos.
- Dar a coordinación una vista de conflictos y reintentos.

## Seguridad y privacidad

- Llamadas Moodle exclusivamente desde backend.
- Validación de contexto y capabilities en cada función Moodle.
- Cifrado de secretos y rotación documentada.
- Mínima retención de archivos; preferir enlaces temporales o proxy autorizado.
- Logs sin tokens, documentos ni datos personales innecesarios.
- Trazabilidad: quién originó el cambio, fuente, fecha y correlación.
- Revisión institucional sobre finalidad, retención y acceso a producciones
  académicas.

El autoingreso mediante parámetros FilterCodes fue retirado porque esos valores
no están firmados y no constituyen una identidad verificable. Actualmente solo
se usan para precargar el alta de estudiantes sin cuenta; las cuentas existentes
usan el login normal. Un ingreso federado automático deberá implementarse con
LTI 1.3/OIDC o el mecanismo institucional equivalente.

## Entrega por fases

### Fase 0 — Descubrimiento

- Confirmar versión, IDs, permisos y ambiente de prueba.
- Exportar la documentación API del Moodle real.
- Probar el vínculo por legajo/DNI sin depender del correo.

### Fase 1 — Solo lectura

- Sincronizar tareas, vencimientos, entregas y notas.
- Mantener Moodle como fuente autoritativa.
- Mostrar procedencia y última sincronización.

### Fase 2 — Creación automática

- Instalar el plugin local.
- Crear/actualizar tareas de forma idempotente desde cada PPS.
- Registrar IDs y URLs canónicas en Mi Panel.

### Fase 3 — Entrega integrada

- Permitir cargar desde Mi Panel hacia el borrador Moodle.
- Confirmar el envío y mostrar archivos/feedback autorizados.
- Mantener un enlace directo de recuperación a Moodle.

### Fase 4 — Eventos e identidad

- Webhooks firmados y reconciliación.
- LTI 1.3/OIDC o SSO institucional.
- Métricas de latencia, errores, conflictos y cobertura.

## Criterios de aceptación

- Una nota publicada en Moodle aparece en Mi Panel sin intervención del alumno.
- Una extensión individual modifica la fecha visible correcta.
- Una entrega real se distingue de un borrador.
- Reintentar una creación no duplica la tarea.
- Un token Moodle nunca llega al cliente.
- La caída de Moodle no cambia estados académicos ni borra datos previos.
- Toda divergencia conserva ambas fuentes y puede auditarse.

## Texto sugerido para el ticket a Sistemas

> Solicitamos evaluar una integración oficial, segura y auditable entre Mi
> Panel PPS y el Moodle institucional. Como primera etapa necesitamos un
> ambiente de prueba y un servicio web REST restringido, con usuario técnico y
> permisos de solo lectura, que permita resolver estudiantes por identificador
> estable y consultar cursos, tareas `assign`, vencimientos efectivos,
> entregas, notas y devoluciones. El token será consumido exclusivamente desde
> una Supabase Edge Function y no llegará al navegador.
>
> Para una segunda etapa necesitamos confirmar si Sistemas puede instalar un
> plugin local versionado que exponga una operación idempotente para
> crear/actualizar las tareas PPS y observadores de eventos para notificar
> entregas, calificaciones y extensiones. Necesitamos conocer la versión exacta
> de Moodle, URL y curso de prueba, campos disponibles (`idnumber`, `username`,
> correo), política de tokens y la documentación API generada por la propia
> instalación.
>
> Proponemos comenzar sin descarga de archivos y con mínimo privilegio. Antes de
> producción se validarán trazabilidad, revocación, privacidad, manejo de
> errores y reconciliación.

## Referencias oficiales

- [External Services — Moodle Developer Resources](https://moodledev.io/docs/5.0/apis/subsystems/external)
- [Function Definitions — Moodle Developer Resources](https://moodledev.io/docs/5.0/apis/subsystems/external/functions)
- [File handling — Moodle Developer Resources](https://moodledev.io/docs/5.0/apis/subsystems/external/files)
- [External service security — Moodle Developer Resources](https://moodledev.io/docs/5.2/apis/subsystems/external/security)
- [Servicios `mod_assign` en Moodle 5.0](https://github.com/moodle/moodle/blob/MOODLE_500_STABLE/mod/assign/db/services.php)
