-- Catálogo Moodle y relación explícita lanzamiento ↔ tarea.
-- Relevamiento visual del curso 3615 realizado el 2026-08-10.
-- Es aditivo: conserva codigo_tarjeta_campus como compatibilidad legacy.

alter table public.aula_entregas
  add column if not exists course_id bigint not null default 3615,
  add column if not exists academic_year smallint,
  add column if not exists moodle_name text,
  add column if not exists source_synced_at timestamptz;

comment on column public.aula_entregas.course_id is
  'ID numérico del curso Moodle que contiene la tarea.';
comment on column public.aula_entregas.academic_year is
  'Año de la pestaña Moodle donde fue inventariada la tarea; no implica año de inicio de la PPS.';
comment on column public.aula_entregas.moodle_name is
  'Nombre visible exacto de la tarea al momento del último inventario.';
comment on column public.aula_entregas.source_synced_at is
  'Fecha del último inventario confirmado contra la interfaz Moodle.';

create unique index if not exists aula_entregas_course_moodle_id_uidx
  on public.aula_entregas (course_id, moodle_id);

insert into public.aula_entregas
  (course_id, academic_year, area, institucion, moodle_id)
values
  (3615, 2024, 'clinica', 'C.R.E.A', '668671'),
  (3615, 2024, 'clinica', 'Informes de las Entrevistas a Psicólogos Clínicos', '263128'),
  (3615, 2024, 'clinica', 'Practicas Clinicas Antiguas', '614156'),
  (3615, 2024, 'clinica', 'PPS Gestión de emociones- CLINICA', '569009'),
  (3615, 2024, 'clinica', 'Centro de Psicoterapia Corporal PATAGONIA', '631039'),
  (3615, 2024, 'clinica', 'CENTRO DE REHABILITACIÓN Y BIENESTAR EMOCIONAL (CRYBE)', '627701'),
  (3615, 2024, 'clinica', 'Informes PPS Asociación PENSAR', '275376'),
  (3615, 2024, 'clinica', 'Psicoterapias Corporales', '268135'),
  (3615, 2024, 'clinica', 'Centro de Inclusión Social y Laboral A.Pa.Si.Do', '630832'),
  (3615, 2024, 'clinica', 'LIENS', '629950'),
  (3615, 2024, 'clinica', 'PPS con Orientación Clínica - Fundación Tiempo', '631041'),
  (3615, 2024, 'clinica', 'Centro de Salud Parque Industrial', '631037'),
  (3615, 2024, 'clinica', 'ASER', '623565'),
  (3615, 2024, 'clinica', 'Mindfulness y Compasión', '635182'),
  (3615, 2024, 'educacional', 'Practicas Educacional', '614159'),
  (3615, 2024, 'educacional', 'PPS SAU', '273606'),
  (3615, 2024, 'educacional', 'Informes de PPS Educacional 2024 antiguos', '522953'),
  (3615, 2024, 'educacional', 'PPS Proyecto de Vida- EDUCACIONAL', '569006'),
  (3615, 2024, 'educacional', 'IFD N6', '625787'),
  (3615, 2024, 'educacional', 'Colegio San José Obrero - 2', '625361'),
  (3615, 2024, 'laboral', 'Banco Provincia de Neuquén', '690928'),
  (3615, 2024, 'laboral', 'Practicas Socio-Comunitaria', '614155'),
  (3615, 2024, 'laboral', 'Crianza Responsable', '301534'),
  (3615, 2024, 'laboral', 'Municipalidad de Fernández Oro - Área de Recursos Humanos', '626240'),
  (3615, 2024, 'laboral', 'Consumos Problemáticos', '641298'),
  (3615, 2024, 'laboral', 'Subsecretaria de Trabajo', '623118'),
  (3615, 2025, 'clinica', 'Centro Sensus', '927369'),
  (3615, 2025, 'clinica', 'Ateneos Ulloa', '926287'),
  (3615, 2025, 'clinica', 'Centro de Psicoterapia Corporal-Patagonia', '925555'),
  (3615, 2025, 'clinica', 'Junta Evaluadora Centenario', '924909'),
  (3615, 2025, 'clinica', 'Entrevistas Ulloa', '920727'),
  (3615, 2025, 'clinica', 'Alma Comahue', '918630'),
  (3615, 2025, 'clinica', 'Kano', '914852'),
  (3615, 2025, 'clinica', 'CPAVZO', '908739'),
  (3615, 2025, 'clinica', 'Centro DAT', '906851'),
  (3615, 2025, 'clinica', 'Relevamiento del Ejercicio Profesional en Psicología', '906164'),
  (3615, 2025, 'clinica', 'Apasido - 4', '877154'),
  (3615, 2025, 'clinica', 'CRYBE - 2', '818025'),
  (3615, 2025, 'clinica', 'Fundación Austral - 2', '817894'),
  (3615, 2025, 'clinica', 'Fundación Tiempo de Niños - 5', '805655'),
  (3615, 2025, 'clinica', 'Instituto Liens - 4', '780221'),
  (3615, 2025, 'clinica', 'Parque Industrial', '805656'),
  (3615, 2025, 'clinica', 'Barriletes en Bandada - 14', '805657'),
  (3615, 2025, 'clinica', 'Programa Aser - 10', '805658'),
  (3615, 2025, 'clinica', 'San Rafael', '946364'),
  (3615, 2025, 'clinica', 'Hogar Convivencia', '946365'),
  (3615, 2025, 'clinica', 'Cita Salud', '946366'),
  (3615, 2025, 'laboral', 'Hospital Lopez Lima', '927629'),
  (3615, 2025, 'laboral', 'Clínica Fava', '923396'),
  (3615, 2025, 'laboral', 'III Jornadas de Salud Mental', '919158'),
  (3615, 2025, 'laboral', 'Subsecretaría de Familia - Soporte a la Discapacidad', '907836'),
  (3615, 2025, 'laboral', 'Juan XXIII', '907748'),
  (3615, 2025, 'laboral', 'Relevamiento del Ejercicio Profesional en Psicología', '906166'),
  (3615, 2025, 'laboral', 'Camioneros', '906141'),
  (3615, 2025, 'laboral', 'Camioneros', '906079'),
  (3615, 2025, 'laboral', 'Guardia de Vulnerabilidad', '906061'),
  (3615, 2025, 'laboral', 'Sanatorio Juan XXIII', '903035'),
  (3615, 2025, 'laboral', 'CPAVZO - 8', '817710'),
  (3615, 2025, 'laboral', 'Randstad - 4', '806963'),
  (3615, 2025, 'laboral', 'Consumos Problemáticos', '795721'),
  (3615, 2025, 'laboral', 'SLB Rentada', '793540'),
  (3615, 2025, 'laboral', 'Consumos Problemáticos - 5', '752521'),
  (3615, 2025, 'laboral', 'Municipalidad de Fernández Oro - 9', '769021'),
  (3615, 2025, 'laboral', 'Ministerio de Trabajo - 32', '805659'),
  (3615, 2025, 'laboral', 'Corporate Resources', '906050'),
  (3615, 2025, 'laboral', 'Las Lilas', '925556'),
  (3615, 2025, 'laboral', 'ACUCADES', '946363'),
  (3615, 2025, 'educacional', 'ISI College', '953117'),
  (3615, 2025, 'educacional', 'Escuela Vida', '915629'),
  (3615, 2025, 'educacional', 'IFD 4', '907745'),
  (3615, 2025, 'educacional', 'Relevamiento del Ejercicio Profesional en Psicología', '906167'),
  (3615, 2025, 'educacional', 'Nuestra Señora de Fátima -4', '878269'),
  (3615, 2025, 'educacional', 'Colegio San José Obrero -2', '806110'),
  (3615, 2025, 'educacional', 'Ministerio de Trabajo -20', '802079'),
  (3615, 2025, 'educacional', 'Supervisión de nivel inicial Alto Valle Oeste - 1', '799867'),
  (3615, 2025, 'educacional', 'ETAP', '792855'),
  (3615, 2025, 'educacional', 'EIAJD N°7 - 2', '794670'),
  (3615, 2025, 'educacional', 'Ruca Suyai', '903037'),
  (3615, 2025, 'educacional', 'Virgen de Luján', '903038'),
  (3615, 2025, 'educacional', 'IFD N6', '905705'),
  (3615, 2026, 'clinica', 'Colegio Psicólogos CPAVZO', '1162535'),
  (3615, 2026, 'clinica', 'Apasido', '1108217'),
  (3615, 2026, 'clinica', 'Fundación Austral', '1097081'),
  (3615, 2026, 'clinica', 'Centro DAT', '1093762'),
  (3615, 2026, 'clinica', 'Liens', '1087582'),
  (3615, 2026, 'clinica', 'Sensus', '1086464'),
  (3615, 2026, 'clinica', 'Fundación Tiempo', '1085731'),
  (3615, 2026, 'clinica', 'Dige', '1014110'),
  (3615, 2026, 'clinica', 'Ruca Suyay', '1109586'),
  (3615, 2026, 'laboral', 'Fundación Kano', '1179652'),
  (3615, 2026, 'laboral', 'Subsecretaria de Emergencias y Gestión de Riesgos', '1162541'),
  (3615, 2026, 'laboral', 'Ministerio de Trabajo y Desarrollo Laboral', '1162538'),
  (3615, 2026, 'laboral', 'Subsecretaria de Ciudades Saludables y Prevención de Consumos problemáticos Neuquén', '1162537'),
  (3615, 2026, 'laboral', 'Colegio Psicólogos CPAVZO', '1162536'),
  (3615, 2026, 'laboral', 'Barriletes en Bandada', '1111226'),
  (3615, 2026, 'laboral', 'Juan XXIII', '1109584'),
  (3615, 2026, 'laboral', 'Municipalidad de Fernandez Oro', '1102510'),
  (3615, 2026, 'laboral', 'Entrevistas a Profesionales', '1097090'),
  (3615, 2026, 'laboral', 'Randstad', '1085736'),
  (3615, 2026, 'laboral', 'Prevención en Colonias', '1009867'),
  (3615, 2026, 'laboral', 'Human', '1074975'),
  (3615, 2026, 'laboral', 'Ruca Suyay', '1109614'),
  (3615, 2026, 'educacional', 'Supervisión de Educación Primaria (Alto Valle Este I - Zona I)', '1166409'),
  (3615, 2026, 'educacional', 'Escuela Integral de Jóvenes y Adolescentes N.° 1', '1162587'),
  (3615, 2026, 'educacional', 'Colegio San José Obrero de Neuquén', '1162540'),
  (3615, 2026, 'educacional', 'Ministerio de Trabajo y Desarrollo Laboral', '1162539'),
  (3615, 2026, 'educacional', 'IFD N6', '1110106'),
  (3615, 2026, 'educacional', 'Ministerio de Juventud, Deportes y Cultura', '1109159')
on conflict (course_id, moodle_id) do update
set academic_year = excluded.academic_year,
    area = excluded.area,
    moodle_name = excluded.institucion,
    source_synced_at = now(),
    activo = true;

update public.aula_entregas
set moodle_name = institucion,
    source_synced_at = now(),
    activo = true
where course_id = 3615
  and academic_year in (2024, 2025, 2026);

create table if not exists public.lanzamiento_moodle_tareas (
  id bigint generated always as identity primary key,
  lanzamiento_id uuid not null references public.lanzamientos_pps(id) on delete cascade,
  orientacion_key text not null
    check (orientacion_key in ('clinica', 'laboral', 'comunitaria', 'educacional', 'otra')),
  aula_entrega_id bigint not null references public.aula_entregas(id) on delete restrict,
  validation_status text not null default 'review'
    check (validation_status in ('confirmed', 'review', 'rejected')),
  link_source text not null
    check (link_source in ('legacy_confirmed', 'legacy_cross_year', 'catalog_exact', 'catalog_alias', 'manual')),
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references auth.users(id) on delete set null,
  unique (lanzamiento_id, orientacion_key)
);

comment on table public.lanzamiento_moodle_tareas is
  'Relación canónica entre un lanzamiento/orientación y una tarea Moodle. Varios lanzamientos pueden reutilizar la misma tarea anual.';
comment on column public.lanzamiento_moodle_tareas.validation_status is
  'Solo confirmed puede alimentar lecturas automáticas de entrega o calificación.';

alter table public.lanzamiento_moodle_tareas enable row level security;

drop policy if exists "Authenticated read lanzamiento moodle tareas"
  on public.lanzamiento_moodle_tareas;
create policy "Authenticated read lanzamiento moodle tareas"
  on public.lanzamiento_moodle_tareas
  for select to authenticated
  using (true);

drop policy if exists "Admin insert lanzamiento moodle tareas"
  on public.lanzamiento_moodle_tareas;
create policy "Admin insert lanzamiento moodle tareas"
  on public.lanzamiento_moodle_tareas
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admin update lanzamiento moodle tareas"
  on public.lanzamiento_moodle_tareas;
create policy "Admin update lanzamiento moodle tareas"
  on public.lanzamiento_moodle_tareas
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin delete lanzamiento moodle tareas"
  on public.lanzamiento_moodle_tareas;
create policy "Admin delete lanzamiento moodle tareas"
  on public.lanzamiento_moodle_tareas
  for delete to authenticated
  using ((select public.is_admin()));

with seed (
  nombre_pps,
  fecha_inicio,
  fecha_finalizacion,
  orientacion_key,
  moodle_id,
  validation_status,
  link_source,
  rationale
) as (
 values
  ('Ministerio de Trabajo y Desarrollo Laboral', '2024-11-07', '2025-01-16', 'laboral', '805659', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Centro de Psicoterapia Corporal PATAGONIA', '2025-03-08', '2025-07-10', 'clinica', '925555', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Ministerio de Trabajo y Desarrollo Laboral', '2025-03-10', '2025-07-10', 'laboral', '805659', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Ministerio de Trabajo y Desarrollo Laboral', '2025-03-14', '2025-07-09', 'educacional', '802079', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Instituto Liens', '2025-03-19', '2025-04-19', 'clinica', '780221', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Tiempo de Niños', '2025-03-24', '2025-07-03', 'clinica', '805655', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Supervisión Educación Primaria - ETAP -  Zona IV Mainqué', '2025-03-25', '2025-05-25', 'educacional', '792855', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Centro Salud Parque Industrial', '2025-03-26', NULL, 'clinica', '805656', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Tiempo de Niños', '2025-03-26', '2025-07-03', 'clinica', '805655', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Randstad', '2025-03-26', '2025-06-19', 'laboral', '806963', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Supervisión de nivel inicial Alto Valle Oeste', '2025-04-01', '2025-06-01', 'educacional', '799867', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Randstad', '2025-04-03', '2025-06-19', 'laboral', '806963', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colegio Psicólogos CPAVZO', '2025-04-10', '2025-08-10', 'comunitaria', '817710', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Centro de Inclusión Social y Laboral APASIDO', '2025-05-19', '2025-07-20', 'clinica', '877154', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colegio Nuestra Señora de Fátima', '2025-05-19', '2025-07-19', 'educacional', '878269', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Instituto Liens', '2025-05-28', '2025-06-28', 'clinica', '780221', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colegio San José Obrero de Neuquén', '2025-06-02', '2025-07-03', 'educacional', '806110', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Asociación Civil Programa Aser', '2025-06-06', '2025-07-06', 'clinica', '805658', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Austral de Salud Integral', '2025-06-10', '2025-07-10', 'clinica', '817894', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Lanna - Centro DAT', '2025-06-13', '2025-08-13', 'clinica', '906851', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Kano', '2025-06-24', '2025-08-24', 'clinica', '914852', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Randstad', '2025-07-01', '2025-09-01', 'laboral', '806963', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Ministerio de Trabajo y Desarrollo Laboral', '2025-07-21', '2025-11-21', 'educacional', '802079', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Ministerio de Trabajo y Desarrollo Laboral', '2025-07-22', '2025-11-22', 'laboral', '805659', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colegio San José Obrero de Neuquén', '2025-07-28', '2025-08-28', 'educacional', '806110', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Centro Salud Parque Industrial', '2025-07-30', '2025-08-28', 'clinica', '805656', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colegio Virgen de Luján', '2025-08-05', '2025-09-24', 'educacional', '903038', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Relevamiento del Ejercicio Profesional en Psicología', '2025-08-05', '2025-12-09', 'laboral', '906166', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colegio Virgen de Luján', '2025-08-06', '2025-09-24', 'educacional', '903038', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Centro de Inclusión Social y Laboral APASIDO', '2025-08-08', '2025-10-08', 'clinica', '877154', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colegio Psicólogos CPAVZO', '2025-08-11', '2025-12-12', 'comunitaria', '817710', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Hospital Lopez Lima', '2025-08-11', NULL, 'comunitaria', '927629', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Ministerio de Trabajo y Desarrollo Laboral', '2025-08-12', '2025-12-12', 'educacional', '802079', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colegio Virgen de Luján', '2025-08-13', '2025-09-24', 'educacional', '903038', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Relevamiento del Ejercicio Profesional en Psicología', '2025-08-13', '2025-09-24', 'clinica', '906164', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Corporate Resources', '2025-08-25', '2025-10-27', 'laboral', '906050', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Subsecretaría de Familia - Guardia de Vulnerabilidad', '2025-08-26', '2025-11-26', 'comunitaria', '906061', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Lanna - Centro DAT', '2025-08-28', '2025-10-28', 'clinica', '906851', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Subsecretaría de Familia - Soporte a la Discapacidad', '2025-09-01', '2025-12-01', 'comunitaria', '907836', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Kano', '2025-09-03', '2025-12-03', 'clinica', '914852', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Subsecretaría de Familia - Guardia de Vulnerabilidad', '2025-09-03', '2025-12-03', 'comunitaria', '906061', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Consultorios Las Lilas', '2025-09-04', '2025-10-07', 'laboral', '925556', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Clínica Fava', '2025-09-15', '2025-11-01', 'laboral', '923396', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Subsecretaría de Familia - Hogar Convivencia', '2025-09-15', '2025-11-14', 'clinica', '946365', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Centro SENSUS', '2025-09-17', '2025-11-01', 'clinica', '927369', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Instituto Liens', '2025-09-17', '2025-10-17', 'clinica', '780221', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('ISI College', '2025-10-06', '2025-12-01', 'educacional', '953117', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Randstad', '2025-10-06', '2025-12-06', 'laboral', '806963', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('III Jornada Universitaria de Salud Mental', '2025-10-07', '2025-10-09', 'comunitaria', '919158', 'confirmed', 'catalog_alias', 'Alias institucional validado en el inventario visible de Moodle.'),
  ('ACUCADES', '2025-10-27', '2025-12-15', 'comunitaria', '946363', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Cita Salud', '2025-10-29', '2025-12-24', 'clinica', '946366', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Instituto Liens', '2025-11-05', '2025-12-05', 'clinica', '780221', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Lanna - Centro DAT', '2025-11-10', '2026-01-10', 'clinica', '1093762', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Asociación Civil Programa Aser', '2025-11-11', '2025-12-15', 'clinica', '805658', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Dige Espacio Terapéutico', '2025-12-01', '2026-01-01', 'clinica', '1014110', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Randstad', '2025-12-17', '2026-03-16', 'laboral', '1085736', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Colonia de Verano - Consumos problemáticos', '2025-12-22', '2026-01-30', 'comunitaria', '1009867', 'confirmed', 'catalog_alias', 'Alias institucional validado en el inventario visible de Moodle.'),
  ('Colegio San José Obrero de Neuquén', '2026-01-29', '2026-03-01', 'educacional', '1162540', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Colegio San José Obrero de Neuquén', '2026-01-31', '2026-03-06', 'educacional', '1162540', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Instituto Liens', '2026-01-31', '2026-03-29', 'clinica', '1087582', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Dige Espacio Terapéutico', '2026-02-04', '2026-04-04', 'clinica', '1014110', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Tiempo - PPS con Orientación Clínica Adultos', '2026-02-04', '2026-03-25', 'clinica', '1085731', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Tiempo - PPS con Orientación Clínica Niños', '2026-02-06', '2026-03-27', 'clinica', '1085731', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Instituto Liens', '2026-02-11', '2026-03-11', 'clinica', '1087582', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Centro SENSUS', '2026-02-18', '2026-05-30', 'clinica', '1086464', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Fundación Lanna - Centro DAT', '2026-02-27', '2026-04-28', 'clinica', '1093762', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Colegio Psicólogos CPAVZO', '2026-03-02', '2026-07-02', 'comunitaria', '1162536', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Colegio Psicólogos CPAVZO', '2026-03-02', '2026-07-02', 'clinica', '1162535', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Centro de Inclusión Social y Laboral APASIDO', '2026-03-09', '2026-05-09', 'clinica', '1108217', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Sanatorio Juan XXIII', '2026-03-16', '2026-06-16', 'laboral', '1109584', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Fundación Austral de Salud Integral', '2026-03-17', '2026-04-17', 'clinica', '1097081', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Ministerio de Juventud, Deportes y Cultura', '2026-03-17', '2026-06-17', 'educacional', '1109159', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Fundación Kano', '2026-04-06', '2026-07-06', 'clinica', '914852', 'review', 'legacy_cross_year', 'El vínculo existente apunta a una sección anual distinta y requiere revisión.'),
  ('Fundación Kano', '2026-04-06', '2026-07-06', 'laboral', '1179652', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Instituto Ruca Suyay', '2026-04-06', '2026-06-06', 'clinica', '1109586', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Instituto Ruca Suyay', '2026-04-06', '2026-06-06', 'comunitaria', '1109614', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Asociación Civil Pensar - Barriletes', '2026-04-07', '2026-07-10', 'comunitaria', '1111226', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Municipalidad de General Fernandez Oro', '2026-04-07', '2026-06-07', 'laboral', '1102510', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Fundación Tiempo - PPS con Orientación Clínica Adultos', '2026-04-22', '2026-07-08', 'clinica', '1085731', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Ministerio de Trabajo y Desarrollo Laboral', '2026-04-22', '2026-08-01', 'laboral', '1162538', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Ministerio de Trabajo y Desarrollo Laboral', '2026-04-22', '2026-08-01', 'educacional', '1162539', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Fundación Tiempo - PPS con Orientación Clínica Niños', '2026-04-24', '2026-07-17', 'clinica', '1085731', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Instituto de Formación Docente N6', '2026-05-04', '2026-07-04', 'educacional', '1110106', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Supervisión de Educación Primaria (Alto Valle Este I - Zona I)', '2026-05-14', '2026-07-14', 'educacional', '1166409', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Dige Espacio Terapéutico', '2026-05-18', '2026-07-18', 'clinica', '1014110', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Centro SENSUS', '2026-06-03', '2026-08-15', 'clinica', '1086464', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Instituto Ruca Suyay', '2026-06-08', '2026-08-08', 'clinica', '1109586', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Municipalidad de General Fernandez Oro', '2026-06-09', '2026-08-09', 'laboral', '1102510', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Human Res', '2026-06-11', '2026-08-25', 'laboral', '1074975', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Subsecretaria de Ciudades Saludables y Prevención de Consumos problemáticos Neuquén', '2026-06-17', '2026-07-22', 'comunitaria', '1162537', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Ministerio de Juventud, Deportes y Cultura', '2026-06-30', '2026-09-30', 'educacional', '1109159', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Ministerio de Juventud, Deportes y Cultura', '2026-07-02', '2026-10-02', 'educacional', '1109159', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Instituto Ruca Suyay', '2026-07-03', '2026-09-03', 'comunitaria', '1109614', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Randstad', '2026-07-07', '2026-10-06', 'laboral', '1085736', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Subsecretaria de Emergencias y Gestión de Riesgos', '2026-07-13', '2026-09-06', 'comunitaria', '1162541', 'confirmed', 'legacy_confirmed', 'Vínculo existente validado contra catálogo y año de entrega.'),
  ('Subsecretaria de Ciudades Saludables y Prevención de Consumos problemáticos Neuquén', '2026-07-23', '2026-10-23', 'comunitaria', '1162537', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Asociación Civil Pensar - Barriletes', '2026-07-28', '2026-11-26', 'comunitaria', '1111226', 'confirmed', 'catalog_alias', 'Alias institucional validado en el inventario visible de Moodle.'),
  ('Sanatorio Juan XXIII', '2026-08-17', '2026-11-17', 'laboral', '1109584', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Tiempo - PPS con Orientación Clínica Adultos', '2026-08-19', '2026-11-04', 'clinica', '1085731', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.'),
  ('Fundación Tiempo - PPS con Orientación Clínica Niños', '2026-08-21', '2026-11-06', 'clinica', '1085731', 'confirmed', 'catalog_exact', 'Coincidencia unívoca por año, institución y orientación.')
),
resolved as (
  select
    l.id as lanzamiento_id,
    s.orientacion_key,
    a.id as aula_entrega_id,
    s.validation_status,
    s.link_source,
    s.rationale
  from seed s
  join public.lanzamientos_pps l
    on l.nombre_pps = s.nombre_pps
   and l.fecha_inicio is not distinct from s.fecha_inicio
   and l.fecha_finalizacion is not distinct from s.fecha_finalizacion
  join public.aula_entregas a
    on a.course_id = 3615
   and a.moodle_id = s.moodle_id
)
insert into public.lanzamiento_moodle_tareas
  (lanzamiento_id, orientacion_key, aula_entrega_id, validation_status, link_source,
   rationale, validated_at)
select
  lanzamiento_id,
  orientacion_key,
  aula_entrega_id,
  validation_status,
  link_source,
  rationale,
  case when validation_status = 'confirmed' then now() else null end
from resolved
on conflict (lanzamiento_id, orientacion_key) do update
set aula_entrega_id = excluded.aula_entrega_id,
    validation_status = excluded.validation_status,
    link_source = excluded.link_source,
    rationale = excluded.rationale,
    validated_at = excluded.validated_at,
    updated_at = now();
