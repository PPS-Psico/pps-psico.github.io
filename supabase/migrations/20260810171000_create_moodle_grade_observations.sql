-- Observaciones de calificaciones leídas desde la sesión Moodle del estudiante.
-- No modifica practicas.nota: conserva el dato legacy para conciliación.

alter table public.aula_entregas
  add column if not exists moodle_grade_item_id bigint,
  add column if not exists moodle_grade_max numeric,
  add column if not exists gradebook_position integer;

comment on column public.aula_entregas.moodle_grade_item_id is
  'ID interno del item de calificación Moodle asociado al course_module_id.';
comment on column public.aula_entregas.moodle_grade_max is
  'Calificación máxima observada en la configuración del libro Moodle.';
comment on column public.aula_entregas.gradebook_position is
  'Posición observada en el libro de calificaciones; permite validar exportaciones masivas.';

create unique index if not exists aula_entregas_course_grade_item_uidx
  on public.aula_entregas (course_id, moodle_grade_item_id)
  where moodle_grade_item_id is not null;

with grade_catalog(moodle_id, grade_item_id, grade_max, gradebook_position) as (
  values
    ('263128', 42289, 2, 2),
    ('268135', 43073, 2, 3),
    ('273606', 44300, 2, 4),
    ('275376', 44691, 2, 5),
    ('301534', 48711, 2, 6),
    ('522953', 75171, 2, 7),
    ('569006', 79847, 2, 8),
    ('569009', 79848, 2, 9),
    ('614155', 83517, 100, 10),
    ('614156', 83518, 100, 11),
    ('614159', 83519, 100, 12),
    ('623118', 84086, 100, 13),
    ('623565', 84139, 100, 14),
    ('630832', 84832, 100, 15),
    ('629950', 84737, 100, 16),
    ('627701', 84495, 100, 17),
    ('626240', 84367, 100, 18),
    ('625361', 84289, 100, 19),
    ('625787', 84323, 100, 20),
    ('631037', 84859, 100, 21),
    ('631039', 84860, 100, 22),
    ('631041', 84861, 100, 23),
    ('635182', 85421, 100, 24),
    ('641298', 86350, 100, 25),
    ('668671', 89479, 100, 26),
    ('690928', 91087, 100, 27),
    ('752521', 97120, 100, 28),
    ('769021', 98558, 100, 29),
    ('780221', 99304, 100, 30),
    ('792855', 100540, 100, 31),
    ('793540', 100630, 100, 32),
    ('794670', 100739, 100, 33),
    ('795721', 100846, 100, 34),
    ('799867', 101339, 100, 35),
    ('802079', 101599, 100, 36),
    ('805655', 102168, 100, 37),
    ('805656', 102169, 100, 38),
    ('805657', 102170, 100, 39),
    ('805658', 102171, 100, 40),
    ('805659', 102172, 100, 41),
    ('806110', 102263, 100, 42),
    ('806963', 102389, 100, 43),
    ('817710', 103451, 100, 44),
    ('817894', 103475, 100, 45),
    ('818025', 103488, 100, 46),
    ('877154', 108718, 100, 47),
    ('878269', 108829, 100, 48),
    ('903035', 110547, 100, 49),
    ('903037', 110548, 100, 50),
    ('903038', 110549, 100, 51),
    ('905705', 110711, 100, 52),
    ('906050', 110748, 2, 53),
    ('906061', 110750, 2, 54),
    ('906079', 110751, 100, 55),
    ('906141', 110756, 100, 56),
    ('906164', 110761, 100, 57),
    ('906166', 110763, 100, 58),
    ('906167', 110764, 100, 59),
    ('906851', 110820, 100, 60),
    ('907745', 110886, 100, 61),
    ('907748', 110888, 100, 62),
    ('907836', 110895, 100, 63),
    ('908739', 110966, 100, 64),
    ('914852', 111572, 100, 65),
    ('915629', 111671, 100, 66),
    ('918630', 111992, 100, 67),
    ('919158', 112059, 100, 68),
    ('920727', 112254, 100, 69),
    ('923396', 112609, 100, 70),
    ('924909', 112838, 100, 71),
    ('925555', 112979, 100, 72),
    ('925556', 112980, 100, 73),
    ('926287', 113132, 100, 74),
    ('927369', 113249, 100, 75),
    ('927629', 113311, 2, 76),
    ('946363', 114020, 2, 77),
    ('946364', 114021, 100, 78),
    ('946365', 114022, 100, 79),
    ('946366', 114023, 100, 80),
    ('953117', 114677, 100, 81),
    ('1009867', 120337, 100, 82),
    ('1014110', 120682, 100, 83),
    ('1074975', 125722, 100, 84),
    ('1085731', 126575, 100, 85),
    ('1085736', 126577, 100, 86),
    ('1086464', 126644, 100, 87),
    ('1087582', 126742, 100, 88),
    ('1093762', 127359, 100, 89),
    ('1097081', 127722, 100, 90),
    ('1097090', 127725, 100, 91),
    ('1102510', 128273, 100, 92),
    ('1108217', 128978, 100, 93),
    ('1109159', 129136, 100, 94),
    ('1109584', 129238, 100, 95),
    ('1109586', 129240, 100, 96),
    ('1109614', 129242, 100, 97),
    ('1110106', 129309, 100, 98),
    ('1111226', 129407, 100, 99),
    ('1162535', 135186, 100, 100),
    ('1162536', 135187, 100, 101),
    ('1162537', 135188, 100, 102),
    ('1162538', 135189, 100, 103),
    ('1162539', 135190, 100, 104),
    ('1162540', 135191, 100, 105),
    ('1162541', 135192, 100, 106),
    ('1162587', 135205, 100, 107),
    ('1166409', 135572, 100, 108),
    ('1179652', 136642, 100, 109)
)
update public.aula_entregas a
set moodle_grade_item_id = g.grade_item_id,
    moodle_grade_max = g.grade_max,
    gradebook_position = g.gradebook_position,
    source_synced_at = now()
from grade_catalog g
where a.course_id = 3615
  and a.moodle_id = g.moodle_id;

create table public.moodle_grade_observations (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  observed_at timestamptz not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  practica_id uuid not null references public.practicas(id) on delete cascade,
  lanzamiento_id uuid not null references public.lanzamientos_pps(id) on delete cascade,
  aula_entrega_id bigint not null references public.aula_entregas(id) on delete restrict,
  course_id bigint not null,
  cmid bigint not null,
  moodle_user_id bigint,
  moodle_username text,
  task_status text not null
    check (task_status in ('no_access', 'not_submitted', 'submitted', 'graded', 'parse_error')),
  submitted boolean not null default false,
  grade_value numeric,
  grade_max numeric,
  grade_display text,
  graded_at_display text,
  request_id uuid not null,
  bridge_version text not null,
  parser_version text not null,
  confidence text not null default 'moodle_session_observed'
    check (confidence in ('moodle_session_observed', 'moodle_export_verified', 'moodle_api_verified')),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint moodle_grade_observation_grade_check check (
    (task_status = 'graded' and grade_value is not null and grade_max is not null and grade_max > 0 and grade_value between 0 and grade_max)
    or
    (task_status <> 'graded' and grade_value is null)
  ),
  unique (request_id, practica_id, cmid)
);

comment on table public.moodle_grade_observations is
  'Ledger append-only de estados y notas observados desde Moodle. Las observaciones del navegador no reemplazan por sí solas practicas.nota.';

create index moodle_grade_observations_practice_latest_idx
  on public.moodle_grade_observations (practica_id, observed_at desc);
create index moodle_grade_observations_student_latest_idx
  on public.moodle_grade_observations (estudiante_id, observed_at desc);

alter table public.moodle_grade_observations enable row level security;
revoke all on table public.moodle_grade_observations from anon, authenticated;
grant select on table public.moodle_grade_observations to authenticated;
grant select, insert, update, delete on table public.moodle_grade_observations to service_role;

create policy "Students read own Moodle observations"
  on public.moodle_grade_observations
  for select to authenticated
  using (
    exists (
      select 1
      from public.estudiantes e
      where e.id = estudiante_id
        and e.user_id = (select auth.uid())
    )
  );

create policy "Admins read Moodle observations"
  on public.moodle_grade_observations
  for select to authenticated
  using ((select public.is_admin()));

create table public.moodle_grade_snapshots (
  practica_id uuid not null references public.practicas(id) on delete cascade,
  cmid bigint not null,
  latest_observation_id uuid not null references public.moodle_grade_observations(id) on delete restrict,
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  lanzamiento_id uuid not null references public.lanzamientos_pps(id) on delete cascade,
  aula_entrega_id bigint not null references public.aula_entregas(id) on delete restrict,
  task_status text not null
    check (task_status in ('no_access', 'not_submitted', 'submitted', 'graded', 'parse_error')),
  submitted boolean not null default false,
  grade_value numeric,
  grade_max numeric,
  grade_display text,
  graded_at_display text,
  observed_at timestamptz not null,
  received_at timestamptz not null,
  confidence text not null,
  primary key (practica_id, cmid)
);

comment on table public.moodle_grade_snapshots is
  'Última observación Moodle por práctica y tarea para lectura eficiente del panel.';

create index moodle_grade_snapshots_student_idx
  on public.moodle_grade_snapshots (estudiante_id, observed_at desc);

alter table public.moodle_grade_snapshots enable row level security;
revoke all on table public.moodle_grade_snapshots from anon, authenticated;
grant select on table public.moodle_grade_snapshots to authenticated;
grant select, insert, update, delete on table public.moodle_grade_snapshots to service_role;

create policy "Students read own Moodle snapshots"
  on public.moodle_grade_snapshots
  for select to authenticated
  using (
    exists (
      select 1
      from public.estudiantes e
      where e.id = estudiante_id
        and e.user_id = (select auth.uid())
    )
  );

create policy "Admins read Moodle snapshots"
  on public.moodle_grade_snapshots
  for select to authenticated
  using ((select public.is_admin()));
