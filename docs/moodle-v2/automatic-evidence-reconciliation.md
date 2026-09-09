# Reprocesamiento de correcciones capturadas

Desde 2026-09-09, la carga y la actualización de las entregas ejecutan
`reconcile_student_moodle_evidence_v1` antes de leer la proyección canónica.
También procesa tareas cuyo escaneo ya se cerró: no hace falta una entrega nueva.
El cliente sólo envía el identificador del estudiante, nunca la nota a aplicar.
La RPC autoriza al propio estudiante o a coordinación; los lectores de jefatura
y dirección conservan sus permisos de lectura.

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

- Contrato portable: `supabase/tests/moodle_auto_evidence.sql`.
- Prueba transaccional con correcciones reales y rollback: atribución separada,
  escala directa, proyección, repetición, corrección posterior con notas distintas,
  respeto de edición manual, comentario ambiguo y fallo de lectura.
- Pruebas de presentación y de consulta de la proyección tras reconciliar.

Propuesta de FAQ, pendiente de aprobación (no incorporada a la vista):
«¿Qué significa el estado de mi informe?» — «Pendiente de entrega: todavía no
figura una entrega. En corrección: tu informe fue entregado y está pendiente de
nota. Cuando se registra la corrección, aparece la nota. Actualizar vuelve a
consultar tus entregas.»
