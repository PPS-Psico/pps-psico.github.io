# Tablero verificable · Moodle Task Automation v2

Última actualización: 6 de septiembre de 2026

## Corte operativo del 6 de septiembre

Este corte prevalece sobre la tabla de fundación del 29 de agosto conservada
debajo. La reconciliación de entregas se publicó en PR #19 y #20; el despliegue
`34036803616` terminó correctamente sobre `7f18efc`.

### Barrido real posterior, 6/9 a las 14:02 UTC

El responsable abrió las jefaturas y se comprobó su persistencia en la base:
Clínica 51/51 tareas, Educacional 33/33 y Laboral/Comunitaria 57/57, todas con
estado `ok`. Son **112 tareas distintas**, con solapamientos entre áreas.
Quedaron 1.121 casos (174 más que el corte previo) y cero aplicaciones manuales.
El contrato de lectura común volvió a pasar después de esta ingesta.

Esto supera el pendiente de cero filas de cobertura del corte previo conservado
en la tabla de abajo. Certifica el recorrido del catálogo; no certifica la
ausencia individual de entrega: el puente instalado conserva sólo filas
positivas. La extensión preparada agrega `negativeRows` sin alterar `rows` v1,
guarda cada tarea en una petición de evidencia y excluye las negativas del
proyector académico. No hay nota borrada por una ausencia observada.
Los estados desconocidos producen cobertura parcial; no se inventa una ausencia.
**Esta extensión necesita instalación y relectura real en Campus.**

`20260906142427_moodle_expected_negative_observations` quedó aplicada con SQL
exacto y ledger en la misma transacción, después de ensayo con `ROLLBACK` y
contrato PostgreSQL 17 aislado. La captura negativa exige evidencia previa de
esa persona/tarea o un vínculo confirmado de su práctica (incluido el fallback
confirmado de lanzamiento por orientación). No convierte el padrón completo del
curso en obligaciones para todas las tareas. La captura positiva sin vínculo
continúa habilitada. Se verificaron permisos privados, aislamiento por alumno y
curso, rechazo de vínculos sin confirmar y conservación de la nota académica.

La PR #21 (`d94c8cb`) y el despliegue `34038086581` terminaron correctamente:
arranque cancelable sin bloqueo, espera restante del throttle y reanudación
aunque la cola devuelva los mismos datos. Seis regresiones nuevas, TypeScript,
lint, suite completa, e2e y build aprobados.

El corte de evidencia documental posterior al barrido tiene 941 snapshots
clasificados y 33 entregados/calificados sin observación de archivos. La
acreditación híbrida continúa en `shadow`: esos conteos no sustituyen la muestra
académica revisada ni autorizan el paso a `active`.

### Corte anterior al barrido (conservado para trazabilidad)

| Circuito               | Estado comprobado                                                                                                    | Pendiente para su aceptación operativa                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Captura y conservación | Publicado: cuatro migraciones verificadas, puente instalado y Edge Function desplegada; 947 casos en el corte actual | El total de casos no demuestra cobertura completa                                                            |
| Aplicación y reversión | Publicado, probado con transacción revertida y datos sintéticos; 0 aplicaciones académicas reales                    | Decisiones del responsable sobre casos ambiguos                                                              |
| Lectura común          | Estudiante, bandeja y filas de jefatura conectadas; contrato SQL real aprobado nuevamente el 6/9                     | Última inspección del conjunto publicado dentro de Campus                                                    |
| Cola persistente       | Código y SQL publicados; conserva resultados parciales y rota mientras Campus está abierto                           | **0 filas de cobertura en la base**: ejecutar el primer barrido real de jefatura y comprobar su persistencia |
| Escritor dedicado      | 1 intención verificada y 212 legacy; scripts de claim/confirm y planner disponibles                                  | No hay worker autónomo ni evidencia del ciclo completo de creación, entrega, nota y reentrega                |
| Acreditación híbrida   | `shadow` confirmado en vivo                                                                                          | Reescaneo, muestra revisada y decisión operativa antes de activar                                            |

La intención dedicada existente enlaza el catálogo interno 151, cuyo CMID real
es **1222866**, curso 3615. No confundir la PK del catálogo con el CMID.
Tiene cuatro participantes y `provisioning_evidence` nulo; `verified` y hashes
iguales no prueban por sí solos el piloto completo. No modificarla ni crear otra
por semejanza de nombre para completar esta lista.

La revisión del arranque del observer añadió regresiones para StrictMode con
cola en cache, tandas `4 + 4 + 4 + 1`, fallo parcial, remonte tras un error,
rotación persistente, error de consulta y modo fuera de Campus. La cancelación
del timer ya no deja el arranque marcado como ejecutado; el throttle no anuncia
una lectura exitosa que no ocurrió.

La última comprobación visual y el piloto real requieren control del navegador
integrado autenticado. Una captura de pantalla prueba la presentación visible,
pero no sustituye las acciones ni la evidencia persistida de esos recorridos.
El rediseño solicitado de «Estado en Campus»/«Entrega» queda pospuesto por
indicación del responsable hasta terminar la aceptación funcional.

## Fotografía de fundación del 29 de agosto (histórica)

Estado general: fundación productiva y lectura 2026 reforzada; escritura Moodle
dedicada pendiente de piloto

Una tarea sólo se marca `DONE` si su resultado operativo está conectado. Tener
una función pura o un componente aislado no equivale a tener un agente en
producción.

| Paquete                     | Estado                 | Entrega comprobable                                                                                          | Pendiente real                                                              |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| WP-00 Baseline y decisiones | `DONE`                 | contratos, ADR, casos y plan versionados                                                                     | mantenerlos sincronizados                                                   |
| WP-01 Schema y seguridad    | `DONE`                 | migración productiva, RLS, leases, RPC y contrato SQL                                                        | monitorear advisors                                                         |
| WP-02 Backfill 2024–2026    | `DONE_WITH_EXCEPTIONS` | 212 intenciones, 1.409 participantes, 0 cruces de orientación, 0 ambigüedades                                | resolver 3 prácticas históricas contradictorias sin inferir                 |
| WP-03 Dominio TypeScript    | `FOUNDATION_READY`     | estados y escalas con pruebas unitarias                                                                      | adoptar el mismo read model en todas las vistas legacy                      |
| WP-04 Provisioner           | `WRITE_AGENT_PENDING`  | planner, hash, lease y confirmación estricta                                                                 | conectar agente navegador, dry-run, creación, verificación y auditoría real |
| WP-05 Observer incremental  | `PARTIAL`              | cola pura, matching estricto y batching                                                                      | scheduler, checkpoints, backoff y cierre persistente                        |
| WP-06 Jefatura v2           | `PARTIAL`              | lectura anual en lotes de 4, fallos parciales y críticos primero                                             | validar en Campus, health/frescura por unidad y migrar a cola persistente   |
| WP-07 Lanzador v2           | `READ_PATH_DONE`       | tarjeta por orientación con conteos reales y reintento permitido                                             | habilitar sólo cuando exista worker de escritura                            |
| WP-08 Estudiante/Admin v2   | `PARTIAL`              | FAQ corregida y presentación canónica disponible                                                             | integración total del nuevo estado en cada superficie                       |
| WP-09 Seguridad y QA        | `IN_PROGRESS`          | RLS, grants, contrato SQL y tipos generados                                                                  | gates completos y revisión de advisors                                      |
| WP-10 Release y operación   | `IN_PROGRESS`          | plan, contratos y documentación central                                                                      | commit/push y validación funcional en Campus                                |
| WP-11 Acreditación híbrida  | `SHADOW_PILOT`         | puente instalado, reescaneo versionado, tareas compartidas fail-closed, evaluación anual, backfill, UI y E2E | completar reescaneo real, auditar muestra y autorizar el paso a `active`    |

## Deuda declarada

`desired_grading_due_at` existe en la tabla, en el contrato TypeScript y en el
planner, pero **todavía no participa** de `private.moodle_v2_config_hash` ni de
la firma de `confirm_moodle_task_intent_v1`. Fue deliberado: incluirlo en el
hash cambiaría el `desired_config_hash` de las 212 intenciones legacy vigentes
y la regla de on-conflict las pasaría a `needs_attention` en la próxima
reconciliación, sin beneficio mientras no exista ninguna intención
`dedicated`. Ambos cambios corresponden al mismo trabajo que construya el
worker de escritura, que es quien va a observar y reportar el campo.

## Próxima secuencia obligatoria

1. Validar en el simulador admin que 13 tareas ejecutan `4 + 4 + 4 + 1` sin
   timeout global y que un fallo deja estado parcial.
2. Elegir una plantilla Moodle y registrar todas sus opciones materiales,
   incluyendo Recordarme calificar en.
3. Conectar un worker en dry-run a `claim_moodle_task_intent_lease_v1`.
4. Ejecutar piloto `dedicated` sin entregas previas; nunca sobre una tarea 2026
   compartida.
5. Verificar creación, reejecución idempotente, entrega, corrección y reentrega.
6. Recién después habilitar escritura para nuevos lanzamientos 2027.

La acreditación híbrida tiene un rollout independiente: debe permanecer en
`shadow` hasta completar el reescaneo de archivos, medir la distribución real y
auditar los casos `auto_started` predichos. Las tareas compartidas presenciales
son siempre asistidas, nunca automáticas. Ver
[moodle-accreditation-hybrid.md](../moodle-accreditation-hybrid.md).

## Regla de handoff para varias IA

Cada paquete debe entregar: alcance, archivos tocados, migración productiva si
corresponde, comandos/tests ejecutados, salida relevante, riesgos, rollback y
commit. Ninguna conversación reemplaza esta evidencia. Una IA que sólo escribió
código no puede declarar completo el paso operativo.
