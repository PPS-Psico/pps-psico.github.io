# Tablero verificable · Moodle Task Automation v2

Última actualización: 29 de agosto de 2026
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
