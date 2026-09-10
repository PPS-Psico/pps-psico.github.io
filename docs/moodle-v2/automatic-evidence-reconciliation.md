# Reprocesamiento de correcciones capturadas

Desde 2026-09-09, la carga y la actualización de las entregas ejecutan
`reconcile_student_moodle_evidence_v1` antes de leer la proyección canónica.
También procesa tareas cuyo escaneo ya se cerró: no hace falta una entrega nueva.
El cliente sólo envía el identificador del estudiante, nunca la nota a aplicar.
La RPC autoriza al propio estudiante o a coordinación; los lectores de jefatura
y dirección conservan sus permisos de lectura.

## Cierre del circuito de escritura — 9/9/2026

La migración `20260909235159_moodle_single_grade_authority` elimina las dos
escrituras paralelas que todavía subsistían. El trigger de observaciones legacy
y el de cambios de escala delegan en `reconcile_moodle_case_v1`; ninguno actualiza
directamente `practicas`. Las capturas originales de estudiante y jefatura
reconcilian al guardarse, sin esperar a que el alumno abra el panel.

`plan_moodle_case_v1` es una función `STABLE` de solo lectura: contiene las reglas
de atribución y protección de decisiones humanas. El reconciliador consume ese
plan después de bloquear los expedientes y el caso. La decisión manual de
coordinación mantiene su circuito explícito, autenticado y auditado.

El número de una tarea sin atribución ya no funciona como nota de respaldo en
la proyección canónica. El expediente conserva la nota histórica para revisión
administrativa; el estudiante ve `En corrección` cuando hay entrega, hasta que
se confirme una nota para esa PPS. No se declara incorrecta ni se borra una nota
por falta de evidencia, por una fecha temprana o por un fallo de lectura.

### Revisión histórica operativa

```sh
node scripts/moodle-grade-history.mjs preview output/moodle-history/primera-revision
node scripts/moodle-grade-history.mjs apply output/moodle-history/primera-revision
```

El primer comando abre transacciones `READ ONLY`, pagina hasta completar los
casos conservados y escribe un manifiesto local con el diagnóstico y los
expedientes previos. No llama al reconciliador ni modifica la base. Los archivos
contienen información académica y deben permanecer fuera de Git.

El segundo comando exige ese diagnóstico completo del mismo proyecto. Cada lote
vuelve a comparar la evidencia, la escala, las proyecciones y el expediente con
la fotografía previa. Si cambió algo, registra `stale_preview` y no fuerza la
aplicación. Un nuevo diagnóstico puede procesar esos casos. Los reintentos con
el mismo identificador de corrida devuelven el resultado ya registrado.

`private.moodle_history_reviews` conserva cada diagnóstico y resultado. Las
aplicaciones aceptadas guardan el antes/después en
`private.moodle_evidence_applications`; las ambigüedades permanecen en
`private.moodle_evidence_reconciliation` y en la bandeja de evidencia de
coordinación, sin crear estados adicionales para estudiantes. Un diagnóstico
de ambigüedad es una solicitud de revisión, no una prueba de nota incorrecta.

Para consultar el resultado de una corrida desde una sesión SQL administrativa:

```sql
select outcome->>'reason' as reason, count(*)
from private.moodle_history_reviews
where run_id = '<run del manifiesto>'::uuid
group by 1;
```

La revisión de expedientes no crea, cierra ni cambia tareas Moodle: los nuevos
lanzamientos siguen usando `dedicated` y los históricos conservan `legacy_shared`.

## Reglas automáticas v1

- Identidad sin conflictos, curso 3615, captura original `student` o `jefe`.
  Conserva el modelo de confianza de la captura autenticada existente; no es una
  firma del servidor de Moodle. Las copias `legacy` no generan notas automáticas.
- Vinculación confirmada y única. Un vínculo directo a la práctica prevalece
  sobre el del lanzamiento. No se vincula por semejanza del nombre de la tarea.
- Para tareas de una sola unidad, aplica la escala explícita del catálogo.
  `direct_10` mantiene 8 como 8 aunque Moodle use un máximo de 100.
- En tareas compartidas, sólo se admite el patrón explícito
  `Informe <identificador>: <nota> (<nota escrita>)`, con número y texto
  concordantes. Cada identificador debe corresponder a un único lanzamiento
  del estudiante. No se copia el número global a todas las prácticas.
  La migración `20260910000709` excluye comentarios terminados en `...` o `…`:
  una vista recortada de la tabla de calificaciones requiere la lectura completa
  antes de atribuir informes (`incomplete_allocation_feedback`).
- Sólo notas numéricas de 4 a 10 en tareas posteriores a 2024. Los comentarios
  libres, escalas ambiguas y aprobaciones cualitativas continúan en revisión.
  El criterio de 2024 `Aprobado`/`Desaprobado` permanece sin equivalencias nuevas.

La selección de evidencia toma la observación válida más reciente y prefiere la
captura original ante una copia legacy de la misma observación. No combina el
comentario antiguo con una nota posterior. Errores de acceso o parseo no borran
una corrección confirmada.

## Aplicación y auditoría

La reconciliación calcula primero la atribución completa de la tarea compartida.
Escribe decisiones `origin=automatic/v1`, aplicaciones con el antes/después y
la proyección utilizada por el panel. El actor conservado identifica quién
capturó la evidencia; `origin` distingue el cálculo automático de una decisión
humana. Repetir la misma evidencia no crea otra aplicación.

Una edición manual, revocación o decisión humana prevalece. Una corrección nueva
puede reemplazar una aplicación automática sólo mientras su expediente no haya
sido modificado después. No se borran notas por lecturas incompletas.

Los resultados técnicos están en `private.moodle_evidence_reconciliation` y los
casos conservan su historia en la bandeja administrativa. Para el estudiante:
`Pendiente de entrega`, `En corrección` o la nota, sin diagnósticos ni tooltips
de conciliación. El botón Actualizar conserva su función de reintento.

## Verificación

- Contratos: `supabase/tests/moodle_auto_evidence.sql` y
  `supabase/tests/moodle_grade_authority.sql`. El segundo cubre observaciones
  legacy, cambio de escala con/sin proyección, protección de notas ambiguas,
  vista canónica, permisos, diagnóstico obsoleto y reintento de lote.
- Prueba transaccional con correcciones reales y rollback: atribución separada,
  escala directa, proyección, repetición, corrección posterior con notas distintas,
  respeto de edición manual, comentario ambiguo y fallo de lectura.
- Pruebas de presentación y de consulta de la proyección tras reconciliar.

Propuesta de FAQ, pendiente de aprobación (no incorporada a la vista):
«¿Qué significa el estado de mi informe?» — «Pendiente de entrega: todavía no
figura una entrega. En corrección: tu informe fue entregado y está pendiente de
nota. Cuando se registra la corrección, aparece la nota. Actualizar vuelve a
consultar tus entregas.»
