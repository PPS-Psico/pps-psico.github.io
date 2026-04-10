# Inventario de base y seguridad Supabase

## Alcance

Documento de trabajo de la Sesion 2 del plan maestro.

Fecha de relevamiento: 2026-04-09
Proyecto Supabase auditado: `qxnxtnhtbpsgzprqtrjl`

Fuentes usadas:

- MCP Supabase: `list_tables`, `list_migrations`, `get_advisors`, `execute_sql`
- politicas reales desde `pg_policies`
- funciones reales desde `pg_proc`
- triggers reales desde `information_schema.triggers`
- documentacion oficial de Supabase sobre RLS:
  - [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
  - [RLS Simplified](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8)
  - [Hardening the Data API](https://supabase.com/docs/guides/database/hardening-data-api)

## Resumen ejecutivo

La base ya esta bastante madura y refleja el dominio real de PPS. El problema principal no es falta de estructura sino una mezcla de:

- politicas RLS demasiado amplias en tablas criticas;
- una tabla publica sensible de logs (`debug_logs`) que ya fue contenida con RLS y acceso admin-only;
- funciones `security definer` en `public` con `search_path` incompleto o mutable;
- politicas duplicadas o demasiado permisivas que degradan seguridad y performance.

Conclusion operativa:

- la base esta lista para endurecimiento incremental;
- no conviene hacer una reescritura;
- la siguiente fase correcta es una Sesion 3 enfocada en endurecimiento inicial de RLS y cierre de RPC privilegiadas expuestas.

## Inventario de tablas de negocio

| Tabla                          | Uso principal                 | Ownership esperado                       | Estado actual                  | Riesgo   |
| ------------------------------ | ----------------------------- | ---------------------------------------- | ------------------------------ | -------- |
| `estudiantes`                  | perfil, rol, vinculo con auth | propio + admin global                    | RLS activo                     | Alto     |
| `convocatorias`                | inscripciones y seleccion     | propio + admin + lectura parcial publica | RLS activo                     | Alto     |
| `lanzamientos_pps`             | oferta de PPS                 | lectura publica + admin escritura        | RLS activo                     | Alto     |
| `practicas`                    | practicas activas/finalizadas | propio + admin global                    | RLS activo                     | Alto     |
| `penalizaciones`               | sanciones/incumplimientos     | propio lectura + admin global            | RLS activo                     | Alto     |
| `finalizacion_pps`             | cierre y documentacion final  | propio + admin global                    | RLS activo                     | Medio    |
| `solicitudes_pps`              | solicitudes de PPS            | propio + admin global                    | RLS activo                     | Alto     |
| `solicitudes_modificacion_pps` | pedidos sobre practicas       | propio + admin global                    | RLS activo                     | Medio    |
| `solicitudes_nueva_pps`        | pedido de nueva PPS           | propio + admin global                    | RLS activo                     | Medio    |
| `compromisos_pps`              | compromiso digital            | propio + admin global                    | RLS activo                     | Medio    |
| `instituciones`                | catalogo institucional        | admin escritura, lectura a definir       | RLS activo                     | Alto     |
| `email_templates`              | plantillas de correo          | admin global                             | RLS activo                     | Medio    |
| `fcm_tokens`                   | push notifications            | propio + admin tecnico                   | RLS activo                     | Medio    |
| `reminders`                    | recordatorios                 | propio + admin tecnico                   | RLS activo                     | Medio    |
| `backup_config`                | config de backups             | admin tecnico                            | RLS activo                     | Bajo     |
| `backup_history`               | historial de backups          | admin tecnico                            | RLS activo                     | Bajo     |
| `debug_logs`                   | logs auxiliares               | privado o admin tecnico                  | RLS activo, lectura solo admin | Mitigado |

## Hallazgos confirmados

### 1. `debug_logs` contenida con RLS

Estado verificado en Sesion 3:

- `public.debug_logs` ya tiene RLS activado;
- `anon` y `authenticated` ya no tienen permisos directos de escritura;
- existe una sola policy de `SELECT` para `authenticated` admins;
- el trigger interno sigue pudiendo insertar porque corre como `security definer`.

Riesgo original:

- cualquier exposicion via Data API sobre `public` dejaba esta tabla mal protegida.

Decision aplicada:

1. se activo RLS;
2. se dejo lectura solo para admins autenticados;
3. se revoco escritura directa desde clientes.

Pendiente posterior:

1. decidir si conviene moverla a schema privado, o
2. eliminarla junto con `log_practica_update()` y `trg_debug_practica` si deja de aportar valor operativo.

Prioridad actual: contenida.

### 2. Politicas demasiado amplias en tablas criticas

Estado actual:

- `convocatorias` ya fue endurecida en Sesion 3:
  - se elimino el `DELETE` abierto para cualquier `authenticated`;
  - se elimino el `UPDATE` abierto para cualquier `authenticated`;
  - se reemplazo por `UPDATE` de inscripcion propia para conservar autogestion estudiantil sin abrir filas ajenas.

Estas tablas tambien ya fueron endurecidas en Sesion 3:

- `estudiantes`
- `instituciones`
- `lanzamientos_pps`
- `penalizaciones`

Ejemplos reales:

- `Permitir editar todo a usuarios autenticados`
- `Permitir borrar ... a usuarios autenticados`

Esto contradice la recomendacion oficial de separar por operacion y restringir por ownership o rol.

Pendiente especifico en `convocatorias`:

- a futuro conviene mover acciones sensibles de cambio de estado a RPC o Edge Function si se quiere evitar que el estudiante pueda modificar cualquier columna de su propia inscripcion.

Pendiente fino:

- `estudiantes` todavia conserva una policy de `UPDATE` propia amplia a nivel fila, por lo que conviene revisar si `notas_internas` debe seguir editable desde la vista del estudiante antes de endurecer por columnas o RPC.

Prioridad actual: media, concentrada en `estudiantes`.

### 3. Uso de politicas `ALL` admin en tablas sensibles

Se observaron politicas del estilo:

- `Admin todo estudiantes`
- `Admin todo convocatorias`
- `Admin todo practicas`
- `Admin todo solicitudes`
- `Admin lanzamientos`

No son automaticamente incorrectas, pero hoy concentran mucho permiso y vuelven menos legible el modelo de autorizacion.

Decision recomendada:

- migrar gradualmente de `ALL` a politicas separadas por `SELECT`, `INSERT`, `UPDATE`, `DELETE` para mantener trazabilidad y menor ambiguedad.

Estado actual:

- en Sesion 3 ya se reemplazaron los `ALL` admin de:
  - `convocatorias`
  - `estudiantes`
  - `finalizacion_pps`
  - `instituciones`
  - `lanzamientos_pps`
  - `penalizaciones`
  - `practicas`
  - `solicitudes_pps`
- el comportamiento se mantuvo, pero las politicas ahora quedaron separadas por operacion.

Nota importante:

- esto mejora legibilidad, auditoria y control fino;
- no elimina por si solo los warnings de `multiple_permissive_policies`, porque siguen coexistiendo reglas admin y reglas del estudiante para la misma accion.

Prioridad actual: mitigada en legibilidad, media en performance.

### 4. Funciones `security definer` en `public`

Se confirmaron varias funciones `security definer` en schema `public`, entre ellas:

- `is_admin()`
- `admin_reset_password(...)`
- `register_new_student(...)`
- `get_student_details_by_legajo(...)`
- `get_student_for_signup(...)`
- `save_fcm_token(...)`
- `delete_fcm_token(...)`
- `delete_fcm_token_user(...)`
- `get_all_fcm_tokens()`

Riesgos observados:

- varias no fijan `search_path`;
- la skill y la documentacion oficial recomiendan no dejar este tipo de funciones en schemas expuestos salvo con mucho control;
- algunas consultan o modifican `auth.users`, lo que exige revisar con mucho cuidado permisos y superficie de ataque.

Prioridad: alta.

### 5. `search_path` mutable en funciones

El advisor reporta multiples warnings `function_search_path_mutable`.

Hallazgos relevantes para este repo:

- `is_admin` ya corregida con `search_path` fijo;
- tambien quedaron corregidas en Sesion 3:
  - `get_student_for_signup`
  - `get_student_email_by_legajo`
  - `get_seleccionados`
  - `save_fcm_token`
  - `delete_fcm_token`
  - `delete_fcm_token_user`
  - `get_all_fcm_tokens`
  - `set_compromisos_pps_updated_at`
  - `check_practica_updates`
  - `log_practica_update`
  - `update_updated_at_column`
  - `update_fcm_tokens_updated_at`
  - `update_push_subscriptions_updated_at`

Decision recomendada:

- fijar `search_path` explicito en cada funcion;
- evaluar mover funciones privilegiadas a un schema no expuesto, por ejemplo `private`.

Pendiente actual:

- quedan warnings de `search_path` mutable en funciones no vinculadas al dominio PPS de este repo;
- no son el foco inmediato mientras no formen parte del flujo real de la app.

Prioridad: media.

### 5.b. RPC de FCM endurecidas

Estado verificado en Sesion 3:

- `save_fcm_token(...)`, `check_fcm_token_exists(...)`, `delete_fcm_token_user(...)` y `delete_fcm_token(...)` ya no quedan ejecutables por `anon` ni por `PUBLIC`;
- `get_all_fcm_tokens()` quedo restringida a `service_role`, que es el caso real usado por la Edge Function `send-fcm-notification`;
- las funciones sensibles de FCM ahora validan contexto y `uid` antes de operar;
- todas quedaron con `search_path` fijo.

Riesgo original:

- `save_fcm_token(...)` era `security definer`, expuesta por RPC y aceptaba cualquier `uid`;
- `get_all_fcm_tokens()` tambien era `security definer` y quedaba ejecutable desde clientes comunes;
- esto abria superficie innecesaria sobre `fcm_tokens` aunque la tabla tuviera RLS.

Decision aplicada:

1. restringir `EXECUTE` por rol;
2. validar ownership o `service_role` dentro de la funcion;
3. fijar `search_path` explicito.

Prioridad actual: mitigada.

### 6. Politicas duplicadas o superpuestas

El advisor de performance reporta multiples `multiple_permissive_policies` en:

- `practicas`
- `penalizaciones`
- `solicitudes_pps`
- `solicitudes_modificacion_pps`
- `solicitudes_nueva_pps`

Esto no siempre es un bug de seguridad, pero hoy indica dos problemas:

- el modelo de autorizacion no esta consolidado;
- el costo por evaluacion de politicas crece sin necesidad.

Prioridad: media-alta.

### 7. Politicas RLS que no usan `(select auth.uid())`

El advisor de performance detecta varias politicas donde `auth.uid()` se evalua por fila.

Tablas afectadas confirmadas:

- `fcm_tokens`
- `solicitudes_modificacion_pps`
- `solicitudes_nueva_pps`
- `backup_history`
- `convocatorias`
- `finalizacion_pps`
- `reminders`
- `penalizaciones`
- `practicas`
- `email_templates`

La documentacion oficial de Supabase recomienda envolver estas llamadas en `select` para permitir `initPlan` y mejorar performance.

Prioridad: media.

### 8. FK sin indice de cobertura

Hallazgo confirmado:

- `backup_history.created_by` no tiene indice de cobertura para su foreign key.

Prioridad: baja.

## Ownership esperado por tabla

### Propias del estudiante + admin

- `estudiantes`
- `convocatorias`
- `practicas`
- `penalizaciones`
- `finalizacion_pps`
- `solicitudes_pps`
- `solicitudes_modificacion_pps`
- `solicitudes_nueva_pps`
- `compromisos_pps`

Regla sugerida:

- `SELECT` propio por `estudiante_id -> estudiantes.user_id = auth.uid()`
- `INSERT` propio solo si el `estudiante_id` pertenece al usuario autenticado
- `UPDATE` propio solo donde el flujo funcional realmente lo requiera
- `DELETE` propio solo si el caso de uso existe de verdad; si no, eliminarlo
- acceso admin separado y explicito

### Publicas de lectura + admin de escritura

- `lanzamientos_pps`

Regla sugerida:

- `SELECT` publico o autenticado segun necesidad real
- `INSERT/UPDATE/DELETE` solo admin

### Catalogo o administradas globalmente

- `instituciones`
- `email_templates`
- `app_config`
- `backup_config`
- `backup_history`

Regla sugerida:

- sin permisos de escritura para estudiantes
- lectura publica solo cuando el frontend realmente lo necesite

### Tecnicas

- `fcm_tokens`
- `reminders`
- `debug_logs`

Regla sugerida:

- ownership estricto por usuario para tokens y reminders
- `debug_logs` fuera de `public` o con acceso admin tecnico solamente

## Funciones y triggers relevantes

### Funciones de autenticacion / vinculacion

- `admin_reset_password`
- `register_new_student`
- `get_student_details_by_legajo`
- `get_student_for_signup`
- `get_student_email_by_legajo`
- `is_admin`

Observacion:

- son piezas core del sistema y deben entrar en la auditoria de seguridad server-side de la Fase 2.

### Funciones de push / tokens

- `save_fcm_token`
- `delete_fcm_token`
- `delete_fcm_token_user`
- `get_all_fcm_tokens`

Observacion:

- necesitan endurecimiento de `search_path` y una segunda revision de roles.

### Triggers relevantes

- `compromisos_pps`: `trg_compromisos_pps_updated_at`
- `fcm_tokens`: `update_fcm_tokens_timestamp`
- `lanzamientos_pps`: `tr_lanzamientos_pps_updated_at`
- `practicas`: `trg_check_practica_updates`
- `practicas`: `trg_debug_practica`

Observacion:

- `trg_debug_practica` merece revision directa porque hoy existe una tabla `debug_logs` sin RLS.

## Riesgos priorizados

### Criticos

1. `debug_logs` sin RLS en schema `public`
2. `UPDATE/DELETE` abiertos con `true` en tablas de negocio criticas

### Altos

1. funciones `security definer` en `public`
2. funciones con `search_path` mutable
3. politicas `ALL` admin demasiado amplias
4. `instituciones` con permisos de escritura amplios para `authenticated`

### Medios

1. politicas duplicadas o superpuestas
2. performance deficiente por uso directo de `auth.uid()`
3. falta de indice sobre `backup_history.created_by`

## Orden recomendado para la Sesion 3

1. endurecer `debug_logs`
2. cerrar `UPDATE/DELETE` abiertos en:
   - `estudiantes`
   - `convocatorias`
   - `lanzamientos_pps`
   - `instituciones`
   - `penalizaciones`
3. revisar `practicas` y `solicitudes_pps` para consolidar politicas duplicadas
4. fijar `search_path` en funciones criticas
5. mover funciones privilegiadas a schema privado si el impacto es razonable

## Criterio de cierre de esta sesion

La Sesion 2 puede considerarse cerrada porque ahora existe:

- un inventario real de tablas y ownership esperado;
- un mapa de politicas RLS concretas;
- un listado de riesgos priorizados;
- una base clara para iniciar el endurecimiento de permisos sin seguir explorando a ciegas.

## Avance adicional de la Sesion 3

- `debug_logs` ya no es una exposicion abierta:
  - RLS activo;
  - lectura solo para admins autenticados;
  - sin escritura directa desde clientes.
- `backup_history` y `fcm_tokens` ya no dependen de checks legacy con claims editables:
  - ahora usan `public.is_admin()` para acceso admin;
  - las policies de usuario quedaron en `to authenticated`;
  - `auth.uid()` paso a evaluarse via `(select auth.uid())`.
- `convocatorias`, `finalizacion_pps`, `penalizaciones`, `solicitudes_modificacion_pps`, `solicitudes_nueva_pps` y `solicitudes_pps` ya fueron optimizadas en RLS:
  - wrappers `(select auth.uid())` agregados donde faltaban;
  - policies de ownership movidas a `authenticated` cuando correspondia;
  - se elimino la policy duplicada `Estudiante ver propias` en `practicas`.

## Estado actual de riesgos

### Ya mitigados

1. `debug_logs` expuesta sin RLS
2. `UPDATE/DELETE` amplios en tablas PPS criticas
3. `fcm_tokens` con lectura admin basada en `raw_user_meta_data`
4. `backup_history` con checks admin legacy sobre JWT
5. funciones sensibles con `search_path` mutable ya corregidas en el bloque principal de la app
6. `email_templates` abierta a cualquier `authenticated` con policy `ALL`
7. `backup_config` con policies admin legacy sobre JWT
8. `reminders` y `compromisos_pps` con `auth_rls_initplan` en sus policies principales
9. funciones `security definer` ajenas al proyecto (`pareja`) residiendo en esta base
10. `get_user_creation_dates` y `get_dashboard_metrics` ejecutables por `PUBLIC/anon`
11. `increment_snooze_count` y `get_user_creation_dates` con `search_path` mutable
12. RPCs sensibles de auth con grants demasiado amplios y validacion critica delegada al frontend

### Riesgos que siguen vigentes

1. warnings de `multiple_permissive_policies` en tablas donde conviven permisos de admin y permisos del propio estudiante
2. `backup_history.created_by` ya tiene indice, pero todavia no muestra uso en advisors por falta de trafico observado
3. quedan warnings de extensiones instaladas en `public` (`pg_net`, `pg_trgm`)
4. la proteccion contra claves filtradas en Supabase Auth sigue desactivada

## Criterio actualizado para el siguiente paso

- no priorizar endurecimientos que contradigan el uso interno/no oficial del panel;
- priorizar tablas o funciones que mezclen permisos admin con criterios legacy;
- aceptar warnings de `multiple_permissive_policies` cuando reflejen una necesidad real del dominio y no una duplicacion accidental.

## Avance adicional de la Sesion 3B

- `backup_config` ahora quedo restringida a admins autenticados via `public.is_admin()`.
- `email_templates` paso de una policy `ALL` para cualquier autenticado a policies admin explicitas por operacion.
- `reminders` quedo optimizada como tabla de autogestion por usuario:
  - `to authenticated`;
  - `(select auth.uid())`;
  - ownership explicito en `select/insert/update/delete`.
- `compromisos_pps` mantuvo su modelo actual:
  - el estudiante puede gestionar su propio compromiso;
  - roles operativos pueden leer o gestionar segun la policy existente;
  - `Reportero` se preserva solo en lectura;
  - se eliminaron llamados directos a `auth.uid()` para evitar `auth_rls_initplan`.
- `backup_history.created_by` ya tiene indice de cobertura:
  - `idx_backup_history_created_by`.

## Avance adicional de la auditoria de funciones privilegiadas

- se eliminaron funciones `security definer` arrastradas del proyecto `pareja`:
  - `get_coin_history`
  - `get_expense_stats_by_category`
  - `get_member_activity_stats`
  - `get_task_stats_by_category`
  - `get_weekly_task_summary`
  - `get_xp_history`
- se endurecieron funciones de reporting:
  - `get_user_creation_dates()` ahora exige rol operativo valido o `service_role`;
  - `get_dashboard_metrics()` ahora exige rol operativo valido o `service_role`;
  - ambas dejaron de estar ejecutables por `PUBLIC/anon`.
- se corrigio `search_path` en:
  - `increment_snooze_count()`
  - `get_user_creation_dates()`
- se endurecio el flujo auth orientado a estudiantes:
  - `verify_student_identity(...)` y `reset_student_password_verified(...)` ahora hacen la verificacion sensible del lado servidor;
  - `register_new_student(...)` ya no vincula usuarios por `legajo` solo: exige `auth.uid() = userid_input` y coincidencia de `dni`;
  - `admin_reset_password(...)` y `get_student_details_by_legajo(...)` dejaron de estar disponibles para `anon/authenticated`;
  - `get_my_role()` y `mark_password_changed()` dejaron de estar abiertas a `anon`;
  - `get_student_email_by_legajo(...)` y `get_student_for_signup(...)` conservan uso operativo para flujos previos al login, pero sin `PUBLIC`.
