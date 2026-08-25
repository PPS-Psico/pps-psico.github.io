begin;

-- Guarda el comentario de retroalimentacion de la tarea Moodle.
--
-- Cuando una tarea recibe DOS informes de la misma persona (Fundacion Tiempo
-- con Clinica de Adultos y de Ninos, Ateneos Ulloa con los dos ateneos), Moodle
-- tiene un unico campo de nota: la catedra pone un numero cualquiera -a veces
-- 0- y escribe la nota real de cada PPS en el comentario:
--
--   "Clinica de Ninos: 7 (Siete) / Clinica de Adultos: 7 (Siete)"
--
-- Hasta ahora ese texto no se guardaba, asi que repartir esas notas exigia
-- entrar a Campus a mano, alumno por alumno. Guardarlo no decide nada por si
-- solo: deja el dato disponible para que coordinacion lo revise.

alter table public.moodle_grade_observations
  add column if not exists feedback_comment text;

alter table public.moodle_grade_snapshots
  add column if not exists feedback_comment text;

comment on column public.moodle_grade_observations.feedback_comment is
  'Comentario de retroalimentacion leido de Campus, sin interpretar. En tareas con dos informes contiene la nota de cada PPS.';

comment on column public.moodle_grade_snapshots.feedback_comment is
  'Ultimo comentario de retroalimentacion observado para esta tarea.';

commit;
