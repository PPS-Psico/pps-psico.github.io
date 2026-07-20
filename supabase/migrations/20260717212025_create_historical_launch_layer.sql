-- Capa histórica canónica y privada. Conserva la oferta publicada y su
-- procedencia sin reemplazar ni borrar las filas legacy de lanzamientos_pps.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.historical_launch_sources (
  source_id text primary key,
  source_type text not null check (source_type in ('whatsapp_export', 'manual_record', 'database_reconciliation')),
  source_sha256 text not null unique check (source_sha256 ~ '^[0-9A-F]{64}$'),
  coverage_start date not null,
  coverage_end date not null,
  imported_at timestamptz not null default statement_timestamp(),
  privacy_notes text not null,
  check (coverage_end >= coverage_start)
);

create table private.historical_launch_offers (
  offer_id text primary key check (offer_id ~ '^WA[0-9]{2}-[0-9]{3}$'),
  source_id text not null references private.historical_launch_sources(source_id) on delete restrict,
  source_year smallint not null check (source_year between 2000 and 2100),
  announcement_at timestamptz not null,
  evidence_ref text not null,
  relaunch_ref text,
  canonical_name text not null,
  orientation text not null,
  capacity_mode text not null check (capacity_mode in ('fijo', 'realizado', 'desconocido')),
  offered_capacity integer,
  credited_hours_text text not null,
  start_date_note text not null,
  reconciliation_status text not null,
  field_issues text not null,
  recommended_action text not null,
  source_confidence text not null default 'high' check (source_confidence in ('high', 'medium', 'review')),
  review_status text not null check (review_status in ('verified', 'needs_review')),
  count_in_offer_metrics boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  check (offered_capacity is null or offered_capacity > 0),
  check (capacity_mode <> 'fijo' or offered_capacity is not null)
);

create table private.historical_launch_slots (
  slot_id text primary key,
  offer_id text not null references private.historical_launch_offers(offer_id) on delete cascade,
  label text not null,
  orientation text,
  offered_capacity integer,
  credited_hours numeric,
  schedule_note text,
  created_at timestamptz not null default statement_timestamp(),
  unique (offer_id, label),
  check (offered_capacity is null or offered_capacity > 0),
  check (credited_hours is null or credited_hours >= 0)
);

create table private.historical_launch_members (
  offer_id text not null references private.historical_launch_offers(offer_id) on delete cascade,
  lanzamiento_id uuid not null references public.lanzamientos_pps(id) on delete restrict,
  match_confidence text not null check (match_confidence in ('high', 'medium', 'review')),
  use_for_outcomes boolean not null default false,
  notes text,
  primary key (offer_id, lanzamiento_id)
);

create table private.historical_launch_events (
  event_id text primary key,
  offer_id text not null references private.historical_launch_offers(offer_id) on delete cascade,
  event_type text not null check (event_type in ('relaunch', 'capacity_change', 'date_correction', 'clarification')),
  event_at timestamptz not null,
  evidence_ref text not null,
  offered_capacity integer,
  start_date_note text,
  notes text not null,
  check (offered_capacity is null or offered_capacity > 0)
);

create index historical_launch_offers_year_announcement_idx
  on private.historical_launch_offers (source_year, announcement_at);
create index historical_launch_offers_review_idx
  on private.historical_launch_offers (review_status, source_year);
create index historical_launch_slots_offer_idx
  on private.historical_launch_slots (offer_id);
create index historical_launch_members_launch_idx
  on private.historical_launch_members (lanzamiento_id);
create index historical_launch_events_offer_at_idx
  on private.historical_launch_events (offer_id, event_at);

revoke all on all tables in schema private from public, anon, authenticated;

comment on table private.historical_launch_sources is
  'Fuentes documentales usadas para reconstrucción histórica, sin contenido personal crudo.';
comment on table private.historical_launch_offers is
  'Una fila por oferta PPS histórica canónica; no equivale a una fila legacy ni a un slot.';
comment on table private.historical_launch_slots is
  'Opciones seleccionables de una oferta: turno, grupo, dupla o actividad con capacidad/horas propias.';
comment on table private.historical_launch_members is
  'Conciliación auditable entre una oferta canónica y filas legacy de lanzamientos_pps.';
comment on table private.historical_launch_events is
  'Relanzamientos y correcciones posteriores que no incrementan el conteo de ofertas.';

insert into private.historical_launch_sources (
  source_id,
  source_type,
  source_sha256,
  coverage_start,
  coverage_end,
  privacy_notes
) values (
  'whatsapp-pps-2024',
  'whatsapp_export',
  '4546FE38C5976458AED7B7D55C424E49F16282289B36227A252420B9072FBA28',
  date '2024-01-01',
  date '2024-12-31',
  'Sólo se persisten atributos de convocatoria y referencias de línea; no se guardan remitentes, teléfonos, correos ni mensajes completos.'
);

insert into private.historical_launch_offers (
  offer_id,
  source_id,
  source_year,
  announcement_at,
  evidence_ref,
  relaunch_ref,
  canonical_name,
  orientation,
  capacity_mode,
  offered_capacity,
  credited_hours_text,
  start_date_note,
  reconciliation_status,
  field_issues,
  recommended_action,
  source_confidence,
  review_status,
  count_in_offer_metrics
) values
  ('WA24-001', 'whatsapp-pps-2024', 2024, timestamptz '2024-02-15 11:51:50-03', 'lines 535-543', null, 'Centro de Salud Progreso', 'No informada', 'fijo', 2, '120', 'marzo 2024', 'missing_launch', 'No existe lanzamiento ni práctica 2024 con este nombre y tampoco hay institución maestra exacta.', 'Crear institución/candidato solo tras validar el nombre legal; crear lanzamiento histórico y marcar resultado desconocido.', 'high', 'needs_review', true),
  ('WA24-002', 'whatsapp-pps-2024', 2024, timestamptz '2024-03-02 13:08:09-03', 'lines 545-550', 'lines 571', 'Centro de Salud Parque Industrial — primer período', 'Clínica', 'fijo', 9, '85', 'marzo-noviembre 2024', 'missing_launch_with_practices', 'Hay 8 prácticas desde 2024-03-12, pero el único lanzamiento del nombre comienza en agosto.', 'Crear lanzamiento histórico de primer período y vincular las 8 prácticas de marzo tras validar el alcance temporal.', 'high', 'needs_review', true),
  ('WA24-003', 'whatsapp-pps-2024', 2024, timestamptz '2024-03-02 15:15:22-03', 'lines 551-561', null, 'Fundación Tiempo de Niños — Grupos de Madres', 'Clínica', 'fijo', 6, '70', 'marzo-julio 2024', 'split_or_duplicate', 'El mensaje copiado dice 2023; la fecha de publicación y las prácticas son 2024. Los dos lanzamientos actuales no preservan claramente los dos subprogramas.', 'Consolidar como oferta clínica separada y conservar el error de año como nota de fuente.', 'high', 'needs_review', true),
  ('WA24-004', 'whatsapp-pps-2024', 2024, timestamptz '2024-03-02 15:15:22-03', 'lines 562-569', null, 'Fundación Tiempo de Niños — Grupo de Personal', 'Laboral', 'fijo', 3, '20', 'marzo-junio 2024', 'split_or_duplicate', 'El mensaje copiado dice 2023 y el subprograma laboral no está representado limpiamente en lanzamientos.', 'Crear oferta laboral separada o modelarla como slot con orientación y horas propias.', 'high', 'needs_review', true),
  ('WA24-005', 'whatsapp-pps-2024', 2024, timestamptz '2024-03-14 13:26:43-03', 'lines 572-576', 'lines 687-692|593', 'Asociación PENSAR — Barriletes en Bandada', 'Comunitaria', 'fijo', 12, 'variable', 'marzo-noviembre 2024', 'one_offer_many_rows', 'El relanzamiento de abril baja las vacantes a 6. La base contiene varias filas/cohortes y una orientación clínica incompatible en agosto.', 'Crear una oferta canónica con slots mañana/tarde; registrar abril como relanzamiento, no como lanzamiento nuevo.', 'high', 'needs_review', true),
  ('WA24-006', 'whatsapp-pps-2024', 2024, timestamptz '2024-03-14 15:05:14-03', 'lines 577-582', null, 'Fundación Lanna — Centro DAT', 'Comunitaria', 'fijo', 4, '120', '2024-03-21', 'strong_match', 'La base inicia 2024-03-20, un día antes que el anuncio, y guarda 2 cupos.', 'Vincular fuente y corregir capacidad ofrecida; revisar fecha efectiva con planillas.', 'high', 'verified', true),
  ('WA24-007', 'whatsapp-pps-2024', 2024, timestamptz '2024-03-14 15:17:19-03', 'lines 583-589', null, 'Investigación — Relaciones de Pareja y Sexualidad en Adultos Mayores', 'Clínica', 'fijo', 4, '30', '2024-04-06', 'missing_launch_with_practices', 'Existe práctica UFLO Investigación el 2024-04-06, pero no lanzamiento.', 'Crear lanzamiento histórico y vincular la práctica de abril.', 'high', 'needs_review', true),
  ('WA24-008', 'whatsapp-pps-2024', 2024, timestamptz '2024-03-20 14:25:21-03', 'lines 596-607', null, 'Jardín Maternal Jacarandá', 'Laboral', 'fijo', 3, '25', '2024-04-05', 'strong_match', 'La base comienza 2024-04-04 y guarda 2 cupos.', 'Vincular fuente y conservar capacidad ofrecida 3; usar prácticas para ocupación.', 'high', 'verified', true),
  ('WA24-009', 'whatsapp-pps-2024', 2024, timestamptz '2024-03-21 16:06:33-03', 'lines 608-614', null, 'Colegio Santa Teresa de Jesús — Nivel Medio', 'Educacional', 'fijo', 2, '48', '2024-04-04', 'strong_match', 'La base comienza 2024-04-03, registra 74 horas y 1 cupo.', 'Validar fecha/horas efectivas; separar capacidad ofrecida 2 de realización.', 'high', 'verified', true),
  ('WA24-010', 'whatsapp-pps-2024', 2024, timestamptz '2024-04-04 17:49:56-03', 'lines 635-642', null, 'Jóvenes en Salud Integral', 'Clínica', 'fijo', 2, '80', 'lunes posterior a publicación', 'strong_match', 'La base comienza 2024-04-08, registra 23 horas y 1 cupo.', 'Vincular fuente; mantener 80 como horas previstas y 23 como horas realizadas solo si la granularidad lo permite.', 'high', 'verified', true),
  ('WA24-011', 'whatsapp-pps-2024', 2024, timestamptz '2024-04-04 18:21:00-03', 'lines 644-650', null, 'UFLO — Entrevistas a Psicólogos', 'Mixta', 'realizado', null, '20', 'abierta hasta fin de 2024', 'missing_launch_with_practices', 'Hay 12 prácticas UFLO Entrevista a Profesionales entre abril y octubre sin lanzamiento.', 'Crear lanzamiento continuo con cupo realizado y vincular las 12 prácticas.', 'high', 'needs_review', true),
  ('WA24-012', 'whatsapp-pps-2024', 2024, timestamptz '2024-04-08 14:17:57-03', 'lines 656-668', null, 'UFLO — SAU/PAOS', 'Educacional', 'fijo', 5, 'variable', 'marzo-julio 2024', 'missing_launch_with_practices', 'Hay 5 prácticas del primer período y una adicional en agosto; existen tres instituciones maestras duplicadas con el mismo nombre.', 'Deduplicar/seleccionar institución UFLO, crear lanzamiento del primer período y revisar por separado la práctica de agosto.', 'high', 'needs_review', true),
  ('WA24-013', 'whatsapp-pps-2024', 2024, timestamptz '2024-04-14 19:05:21-03', 'lines 679-685', null, 'Instituto LIENS — primer período', 'Clínica', 'fijo', 4, '50', '2024-04-17', 'strong_match_date_conflict', 'La base inicia 2024-04-26, registra 28 horas y 1 cupo.', 'Vincular fuente; validar fecha efectiva con planilla antes de corregir.', 'high', 'verified', true),
  ('WA24-014', 'whatsapp-pps-2024', 2024, timestamptz '2024-04-24 11:57:27-03', 'lines 695-702', null, 'Programa Provincial de Becas Dr. Gregorio Álvarez', 'Educacional', 'fijo', 4, '45', 'tres semanas desde fin de abril', 'strong_match', 'La base inicia 2024-05-03, registra 53 horas y 4 cupos.', 'Vincular fuente; capacidad coincide. Conservar horas previstas y realizadas como conceptos distintos.', 'high', 'verified', true),
  ('WA24-015', 'whatsapp-pps-2024', 2024, timestamptz '2024-04-25 12:10:25-03', 'lines 704-708', null, 'Asociación PENSAR — Dispositivo AYUN', 'Comunitaria', 'desconocido', null, 'variable', 'abril-noviembre 2024', 'missing_launch', 'Existe institución maestra única, pero no lanzamiento ni práctica con nombre AYUN.', 'Crear lanzamiento histórico con capacidad desconocida y resultado desconocido.', 'high', 'needs_review', true),
  ('WA24-016', 'whatsapp-pps-2024', 2024, timestamptz '2024-05-06 15:06:45-03', 'lines 709-714', null, 'CRYBE General Roca — primer período', 'Clínica', 'fijo', 2, '120', '2024-05-08', 'strong_match', 'La base guarda 4 cupos, que parece mezclar participantes de ambos períodos.', 'Vincular fuente y separar primer y segundo período.', 'high', 'verified', true),
  ('WA24-017', 'whatsapp-pps-2024', 2024, timestamptz '2024-05-16 16:37:27-03', 'lines 716-728', null, 'Jornadas de Fútbol Valorado', 'Comunitaria', 'realizado', null, '10', '2024-05-30 o 2024-05-31', 'duplicate_and_invalid_date', 'La aclaración final permite acreditar solo una jornada de 10 horas. La base guarda 20 horas por fila y una tercera fila 2024-08-31 que finaliza 2024-05-31.', 'Corregir/eliminar lógicamente la fila imposible tras revisar planillas; modelar dos opciones bajo una oferta.', 'high', 'needs_review', true),
  ('WA24-018', 'whatsapp-pps-2024', 2024, timestamptz '2024-05-27 12:34:50-03', 'lines 731-737', null, 'Programa Mindfulness y Compasión M-PBI', 'Clínica', 'fijo', 21, '25', '2024-06-28/29', 'missing_launch', 'No hay coincidencia temporal/nominativa clara en lanzamientos o prácticas.', 'Crear candidato histórico; confirmar institución y si llegó a realizarse.', 'high', 'needs_review', true),
  ('WA24-019', 'whatsapp-pps-2024', 2024, timestamptz '2024-05-27 18:53:04-03', 'lines 738-744', null, 'Centro SENSUS — Hospital de Día', 'Clínica', 'fijo', 2, '120', 'junio-julio 2024', 'strong_match', 'La base inicia 2024-06-03, registra 204 horas y 1 cupo.', 'Vincular fuente y separar oferta de realización.', 'high', 'verified', true),
  ('WA24-020', 'whatsapp-pps-2024', 2024, timestamptz '2024-05-29 14:37:27-03', 'lines 757-764', null, 'Hospital Fernández Oro', 'Clínica', 'fijo', 2, '65', 'primera semana de junio 2024', 'strong_match', 'La base inicia 2024-06-06 y guarda 1 cupo.', 'Vincular fuente; capacidad ofrecida 2.', 'high', 'verified', true),
  ('WA24-021', 'whatsapp-pps-2024', 2024, timestamptz '2024-06-04 17:04:08-03', 'lines 768-779', null, 'Sol Mapu — Proyecto de Vida Escuela 294', 'Educacional', 'fijo', 9, '15', '2024-06-14', 'one_offer_many_rows', 'La base divide la oferta en tres filas con 7 cupos totales.', 'Consolidar oferta y modelar tres grupos como slots.', 'high', 'needs_review', true),
  ('WA24-022', 'whatsapp-pps-2024', 2024, timestamptz '2024-06-05 16:25:57-03', 'lines 780-791', null, 'Sol Mapu — Gestión de Emociones Escuela 294', 'Clínica', 'fijo', 12, '20', 'junio-julio 2024', 'one_offer_many_rows', 'La base divide la oferta en cuatro filas con 11 cupos totales.', 'Consolidar oferta y modelar cuatro grupos como slots.', 'high', 'needs_review', true),
  ('WA24-023', 'whatsapp-pps-2024', 2024, timestamptz '2024-06-06 10:32:55-03', 'lines 792-800', null, 'Sol Mapu — Crianza Respetuosa Jardín 49', 'Comunitaria', 'fijo', 6, '12', '2024-06-14', 'ambiguous_split', 'Las filas genéricas de Crianza Respetuosa y Sol Mapu no identifican inequívocamente el Jardín 49.', 'Resolver con planillas/tutor y luego consolidar turnos mañana/tarde.', 'high', 'needs_review', true),
  ('WA24-024', 'whatsapp-pps-2024', 2024, timestamptz '2024-06-13 12:44:19-03', 'lines 802-809', null, 'Sol Mapu — Crianza Respetuosa Jardín 50', 'Comunitaria', 'fijo', 4, '12', '2024-06-26', 'strong_match_with_split_risk', 'La fila exacta guarda 3 cupos y hay filas genéricas potencialmente relacionadas.', 'Vincular la fila exacta y revisar planillas antes de reasignar filas genéricas.', 'high', 'verified', true),
  ('WA24-025', 'whatsapp-pps-2024', 2024, timestamptz '2024-07-24 14:33:29-03', 'lines 829-847', null, 'Prevención de Consumos Problemáticos — primer período', 'Comunitaria', 'fijo', 12, '40', '2024-07-29', 'strong_match', 'La base guarda 13 cupos.', 'Vincular fuente y revisar si el cupo 13 fue reemplazo/sobreasignación.', 'high', 'verified', true),
  ('WA24-026', 'whatsapp-pps-2024', 2024, timestamptz '2024-08-05 10:23:21-03', 'lines 853-858', null, 'Investigación — Relaciones de Pareja y Sexualidad 50-70', 'A elección', 'fijo', 4, '30', '2024-08-24', 'missing_launch_with_practices', 'Hay prácticas UFLO Investigación en agosto y una institución maestra específica, pero no lanzamiento.', 'Crear lanzamiento histórico y vincular las prácticas del segundo período.', 'high', 'needs_review', true),
  ('WA24-027', 'whatsapp-pps-2024', 2024, timestamptz '2024-08-05 18:09:45-03', 'lines 859-868', null, 'Centro de Salud Parque Industrial — segundo período', 'Clínica', 'fijo', 3, '60/30 por slot', '2024-08-12/14', 'strong_match', 'La base agrega ambos dispositivos en una fila con 4 cupos y 69 horas.', 'Modelar dos slots y vincular las 3 prácticas; mantener las horas por slot.', 'high', 'verified', true),
  ('WA24-028', 'whatsapp-pps-2024', 2024, timestamptz '2024-08-08 11:41:03-03', 'lines 870-888', null, 'Centro de Psicoterapia Corporal PATAGONIA', 'Clínica', 'fijo', 6, '42', '2024-08-16', 'exact_match', 'Nombre, inicio, capacidad y horas coinciden.', 'Vincular fuente e institución; candidato de referencia para validar el método.', 'high', 'verified', true),
  ('WA24-029', 'whatsapp-pps-2024', 2024, timestamptz '2024-08-12 12:35:49-03', 'lines 902-916', null, 'Fundación Tiempo — Orientación Clínica Adultos', 'Clínica', 'realizado', null, '30', '2024-08-14', 'probable_match', 'El chat confirma dos convocatorias sin límite y luego Fundación Tiempo, pero no detalla Adultos/Niños en el mensaje.', 'Vincular como evidencia secundaria; conservar cupo realizado.', 'medium', 'needs_review', true),
  ('WA24-030', 'whatsapp-pps-2024', 2024, timestamptz '2024-08-12 12:35:49-03', 'lines 902-916', null, 'Fundación Tiempo — Orientación Clínica Niños', 'Clínica', 'realizado', null, '30', '2024-08-16', 'probable_match', 'El chat confirma dos convocatorias sin límite y luego Fundación Tiempo, pero no detalla Adultos/Niños en el mensaje.', 'Vincular como evidencia secundaria; conservar cupo realizado.', 'medium', 'needs_review', true),
  ('WA24-031', 'whatsapp-pps-2024', 2024, timestamptz '2024-08-26 11:27:38-03', 'lines 929-945', 'lines 995-1005', 'Subsecretaría de Trabajo — Sistema Público de Empleo', 'Laboral', 'fijo', 50, '70', '2024-09-04', 'one_offer_many_rows', 'El anuncio dice por error 2025, pero inscripción, recordatorio, base y prácticas indican 2024. La base divide el período en tres filas y 34 cupos.', 'Corregir año por evidencia convergente y consolidar cohortes/slots del mismo programa.', 'high', 'needs_review', true),
  ('WA24-032', 'whatsapp-pps-2024', 2024, timestamptz '2024-08-27 10:13:30-03', 'lines 946-959', null, 'ASER — Tratamiento de Adicciones y Alcoholismo', 'Clínica', 'desconocido', null, 'variable', '2024-09-02', 'strong_match', 'Existe otra fila ASER iniciada 2024-08-02 sin anuncio asociado y dos prácticas comienzan 2024-09-05.', 'Vincular el lanzamiento de septiembre; tratar la fila de agosto como oferta no documentada separada.', 'high', 'verified', true),
  ('WA24-033', 'whatsapp-pps-2024', 2024, timestamptz '2024-08-27 16:37:10-03', 'lines 960-988', 'lines 1071-1088', 'Colegio Secundario Virgen del Luján', 'Educacional', 'fijo', 6, '24', '2024-09-10', 'missing_launch', 'El relanzamiento mueve la fecha al 10/09; no hay lanzamiento ni práctica 2024 con este nombre.', 'Crear lanzamiento histórico con resultado sin prácticas y registrar el relanzamiento como evento.', 'high', 'needs_review', true),
  ('WA24-034', 'whatsapp-pps-2024', 2024, timestamptz '2024-09-03 13:34:40-03', 'lines 1006-1043', null, 'Colegio San José Obrero', 'Educacional', 'fijo', 8, '60/24/16 por slot', '2024-09-09 probable', 'one_offer_many_rows_date_conflict', 'La corrección dice lunes 8/09, pero ese día fue domingo; la base y las prácticas apoyan 9/09. Hay tres actividades con horas distintas.', 'Modelar tres slots y usar 9/09 como fecha corregida con nota de inferencia.', 'high', 'needs_review', true),
  ('WA24-035', 'whatsapp-pps-2024', 2024, timestamptz '2024-09-04 20:13:18-03', 'lines 1044-1070', null, 'IFD N°6 — Nivel Medio', 'Educacional', 'fijo', 8, '24', '2024-09-06/07', 'strong_match_date_conflict', 'El anuncio dice 7/09 y el recordatorio del 5/09 dice que comienza al día siguiente; la base y prácticas usan 6/09 y guardan 6 cupos.', 'Adoptar 6/09 como fecha efectiva con nota de corrección; modelar turnos mañana/tarde.', 'high', 'verified', true),
  ('WA24-036', 'whatsapp-pps-2024', 2024, timestamptz '2024-09-06 15:27:56-03', 'lines 1089-1112', null, 'Municipalidad de Fernández Oro — Recursos Humanos', 'Laboral', 'fijo', 9, '50', '2024-09-10', 'strong_match', 'La base guarda 8 cupos y 7 prácticas.', 'Vincular fuente; capacidad ofrecida 9 y ocupación observada 7.', 'high', 'verified', true),
  ('WA24-037', 'whatsapp-pps-2024', 2024, timestamptz '2024-09-12 08:02:20-03', 'lines 1114-1134', null, 'CRYBE General Roca — segundo período', 'Clínica', 'fijo', 2, '120', '2024-09-16', 'exact_match', 'Nombre, inicio, capacidad y horas coinciden.', 'Vincular fuente e institución.', 'high', 'verified', true),
  ('WA24-038', 'whatsapp-pps-2024', 2024, timestamptz '2024-09-23 13:48:38-03', 'lines 1136-1153', null, 'Instituto LIENS — segundo período', 'Clínica', 'fijo', 4, '50', '2024-09-25', 'strong_match_date_conflict', 'La base y prácticas comienzan 2024-09-28 y guardan 2 cupos.', 'Validar fecha efectiva; separar capacidad ofrecida 4 de ocupación 2.', 'high', 'verified', true),
  ('WA24-039', 'whatsapp-pps-2024', 2024, timestamptz '2024-09-26 17:44:19-03', 'lines 1156-1169', null, 'Centro de Inclusión Social y Laboral APASIDO', 'Clínica', 'fijo', 4, '56', '2024-10-01', 'strong_match', 'La base guarda 1 cupo y hay 2 prácticas; el recordatorio menciona jueves aunque los slots originales son martes/viernes.', 'Vincular fuente; revisar el recordatorio y modelar dos duplas como slots.', 'high', 'verified', true),
  ('WA24-040', 'whatsapp-pps-2024', 2024, timestamptz '2024-10-10 20:11:22-03', 'lines 1173-1185', null, 'Centro de Psicoterapia Corporal PATAGONIA — Mindfulness y Compasión', 'Clínica', 'fijo', 14, '25', '2024-10-25', 'strong_match_capacity_conflict', 'Fechas y horas coinciden; la base guarda 22 cupos y hay 21 prácticas, por encima de los 14 ofrecidos.', 'Auditar sobreasignación/ampliación de cupo antes de corregir; conservar ambos valores con procedencia.', 'high', 'verified', true),
  ('WA24-041', 'whatsapp-pps-2024', 2024, timestamptz '2024-10-17 09:07:48-03', 'lines 1186-1204', null, 'Prevención de Consumos Problemáticos — segundo período', 'Comunitaria', 'fijo', 8, '24', '2024-10-23', 'strong_match_hours_conflict', 'La base guarda 40 horas y 6 cupos; el anuncio suma 9 horas de capacitación y 15 de talleres.', 'Validar si existieron horas adicionales; conservar 24 previstas del anuncio hasta contar con planilla.', 'high', 'verified', true),
  ('WA24-042', 'whatsapp-pps-2024', 2024, timestamptz '2024-11-05 08:28:33-03', 'lines 1217-1238', null, 'Subsecretaría de Promoción de Empleo y Formación Profesional', 'Laboral', 'fijo', 14, '48', '2024-11-07', 'strong_match_capacity_conflict', 'La base guarda 4 cupos bajo Ministerio de Trabajo y Desarrollo Laboral.', 'Vincular fuente; modelar Intermediación Laboral (10) y Atención al Ciudadano (4) como slots.', 'high', 'verified', true);

insert into private.historical_launch_slots (
  slot_id,
  offer_id,
  label,
  orientation,
  offered_capacity,
  credited_hours,
  schedule_note
) values
  ('WA24-002-S1', 'WA24-002', 'La Casita - turno tarde', 'Clínica', 4, 85, 'Lunes de 13:30 a 17:00'),
  ('WA24-002-S2', 'WA24-002', 'La Casita - turno mañana', 'Clínica', 4, 85, 'Martes de 09:00 a 12:30'),
  ('WA24-002-S3', 'WA24-002', 'Grupo de mujeres', 'Clínica', 1, 85, 'Miércoles de 13:30 a 16:30, quincenal'),
  ('WA24-003-S1', 'WA24-003', 'Grupo de madres 1', 'Clínica', 3, 70, 'Martes de 15:00 a 17:30'),
  ('WA24-003-S2', 'WA24-003', 'Grupo de madres 2', 'Clínica', 3, 70, 'Jueves de 15:00 a 17:30'),
  ('WA24-005-S1', 'WA24-005', 'Turno mañana', 'Comunitaria', 4, null, 'Martes y jueves de 09:00 a 13:00'),
  ('WA24-005-S2', 'WA24-005', 'Turno tarde', 'Comunitaria', 8, null, 'Martes y jueves de 13:30 a 16:45'),
  ('WA24-017-S1', 'WA24-017', 'Jornada Cipolletti', 'Comunitaria', null, 10, '30 de mayo por la mañana'),
  ('WA24-017-S2', 'WA24-017', 'Jornada Allen', 'Comunitaria', null, 10, '31 de mayo; sólo se acredita una jornada'),
  ('WA24-018-S1', 'WA24-018', 'Viernes', 'Clínica', 17, 25, 'Viernes de 18:00 a 20:00'),
  ('WA24-018-S2', 'WA24-018', 'Sábados', 'Clínica', 4, 25, 'Sábados de 10:00 a 12:00'),
  ('WA24-021-S1', 'WA24-021', 'Séptimo grado - grupo 1', 'Educacional', 3, 15, 'Viernes de 13:30 a 14:10'),
  ('WA24-021-S2', 'WA24-021', 'Séptimo grado - grupo 2', 'Educacional', 3, 15, 'Viernes de 14:25 a 15:05'),
  ('WA24-021-S3', 'WA24-021', 'Séptimo grado - grupo 3', 'Educacional', 3, 15, 'Viernes de 15:05 a 15:50'),
  ('WA24-022-S1', 'WA24-022', 'Grupo 1 turno mañana', 'Clínica', 3, 20, '08:00 a 09:25'),
  ('WA24-022-S2', 'WA24-022', 'Grupo 2 turno mañana', 'Clínica', 3, 20, '10:40 a 12:00'),
  ('WA24-022-S3', 'WA24-022', 'Grupo 3 turno tarde', 'Clínica', 3, 20, '13:30 a 15:05'),
  ('WA24-022-S4', 'WA24-022', 'Grupo 4 turno tarde', 'Clínica', 3, 20, '16:55 a 17:30'),
  ('WA24-023-S1', 'WA24-023', 'Turno mañana', 'Comunitaria', 3, 12, 'Viernes 14/06 de 08:30 a 10:00'),
  ('WA24-023-S2', 'WA24-023', 'Turno tarde', 'Comunitaria', 3, 12, 'Viernes 14/06 de 14:00 a 15:30'),
  ('WA24-027-S1', 'WA24-027', 'Dispositivo de niños', 'Clínica', 2, 60, 'Lunes de 13:30 a 17:30'),
  ('WA24-027-S2', 'WA24-027', 'Grupo de mujeres', 'Clínica', 1, 30, 'Miércoles de 13:30 a 17:30, quincenal'),
  ('WA24-034-S1', 'WA24-034', 'Asesoría institucional', 'Educacional', 2, 60, 'Lunes a viernes de 14:00 a 17:00'),
  ('WA24-034-S2', 'WA24-034', 'Acompañamiento en clases', 'Educacional', 2, 24, 'Jueves o viernes de 13:30 a 15:40'),
  ('WA24-034-S3', 'WA24-034', 'Espacio de tutorías', 'Educacional', 4, 16, 'Dos duplas con horarios diferenciados'),
  ('WA24-035-S1', 'WA24-035', 'Turno mañana', 'Educacional', 4, 24, 'Lunes, miércoles y viernes de 10:20 a 12:20'),
  ('WA24-035-S2', 'WA24-035', 'Turno tarde', 'Educacional', 4, 24, 'Lunes, miércoles y viernes de 15:00 a 17:00'),
  ('WA24-039-S1', 'WA24-039', 'Dupla martes', 'Clínica', 2, 56, 'Martes de 08:00 a 12:00'),
  ('WA24-039-S2', 'WA24-039', 'Dupla viernes', 'Clínica', 2, 56, 'Viernes de 08:00 a 12:00'),
  ('WA24-042-S1', 'WA24-042', 'Intermediación laboral', 'Laboral', 10, 48, 'Cuatro horas semanales'),
  ('WA24-042-S2', 'WA24-042', 'Atención al ciudadano', 'Laboral', 4, 48, 'Cuatro horas semanales');

insert into private.historical_launch_members (
  offer_id,
  lanzamiento_id,
  match_confidence,
  use_for_outcomes,
  notes
) values
  ('WA24-003', '52529872-d4b0-473c-93d4-c81f77060d40'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-003', 'fd2ccf25-6194-42e1-b9d5-7a510d847920'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-004', '52529872-d4b0-473c-93d4-c81f77060d40'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-004', 'fd2ccf25-6194-42e1-b9d5-7a510d847920'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-005', '99781c98-b5d1-4c2a-8e0f-3692538a159e'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-005', '8d5ebe0b-b0df-42a4-85af-1bcc4eaf4674'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-005', '46cb6f0c-2809-456b-9da4-4d60c750cabb'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-006', 'dd8e7460-34dd-4f4e-b164-58a6e6c18bf5'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-008', 'cb3fa3bc-881b-4409-bd8d-89c0aa3c4358'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-009', '2f52b340-ecdd-4fcb-b300-b8ead4532f6e'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-010', 'd6c82f88-adb8-46b8-b865-0d83085230d6'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-013', '1c56fcd0-20d7-4ab4-a824-4003605dbdda'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-014', 'db8903a9-d164-4005-9dc8-29bdd47b7768'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-016', '4d8f028b-5d47-492d-b3ff-ac7bdf9b91e7'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-017', 'e4e1bb77-b3a3-4eab-bbcc-bac48e57a402'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-017', '14af5638-4784-4f5e-acb9-8e5431faaea1'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-017', '918244ff-6ca9-4900-86e5-86093cf7d131'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-019', '15461705-bb1b-4fb9-be9a-20c476727bf5'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-020', '71cecfe5-08f6-49f8-aa72-ff4c8547dffc'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-021', '4f89e8d8-4ea6-4305-8c8e-d98d3f39a24e'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-021', '431dca97-c213-482a-82ea-fe773f0b48f9'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-021', '49199f73-8818-41e9-93dd-47abc5fcf573'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-022', 'bb3a3a7e-8c36-416d-ac6f-305b300414b2'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-022', '638b0f99-652c-4f09-8af1-05aff0cd6bbf'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-022', '17dd9242-4340-4142-8e21-5a606d8e0bdf'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-022', 'b125ad03-eafb-4d0e-89e2-977896bd1ece'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-023', '5284fc7c-5a9e-42ed-ad7c-916e9927d066'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-023', 'ceb7d899-b749-4ae0-8ea5-12a7594931aa'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-023', '00d132be-3bdc-488f-a8a7-80103842c9e1'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-023', '2b3cd409-bb86-444f-80e8-d406c580cbb6'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-024', '3274b5cf-1e43-4301-b137-69eda5a23c69'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-025', '0b02038b-45ba-4a25-b957-28c5dab0c78e'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-027', '01b1f503-3c97-40f3-a04c-e878fbda227e'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-028', '562d34c0-c824-4082-b25c-3cae8ea632d0'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-029', '008d1d3d-57c6-407c-98a9-99dbe9b4832b'::uuid, 'medium', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-030', 'f891c34e-a39b-45c1-8a3b-59b91b409489'::uuid, 'medium', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-031', '536749e7-3cd5-489e-a5a8-f2b1dded844d'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-031', 'ab585b01-1fb7-4db6-bd2d-868a3736284e'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-031', 'a0c86c2a-b190-4728-b176-05854cc28b11'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-032', '1ff2bb8b-cc54-4856-a922-3acf561ea7ff'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-034', '49ac73ec-45f7-4a7d-96f9-db51c8ab075b'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-034', 'ace59edc-408f-4118-a049-323b8b9c1387'::uuid, 'review', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-035', 'db2eb187-6070-4ad1-b279-f16e806ff332'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-036', '521a2f29-9387-457a-a235-acd5062cc420'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-037', '0a54cb88-cf82-4858-bf8c-35fdc4736e92'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-038', '96d776d5-3b19-4842-b253-77b3bfb366bd'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-039', 'f5542038-3816-4a12-bdbf-6df0d66395d7'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-040', 'c48bde4f-ecd8-4ae3-9ab5-c505e55a6948'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-041', 'da99f1c4-1024-4047-af42-1511f003691a'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.'),
  ('WA24-042', 'e0adbf36-e1a9-46f9-ac37-fddd788c8128'::uuid, 'high', false, 'Conciliación inicial; no usar para resultados hasta resolver grano legacy.');

insert into private.historical_launch_events (
  event_id,
  offer_id,
  event_type,
  event_at,
  evidence_ref,
  offered_capacity,
  start_date_note,
  notes
) values
  (
    'WA24-R001',
    'WA24-005',
    'relaunch',
    timestamptz '2024-04-17 16:42:15-03',
    'lines 687-692',
    6,
    'abril-noviembre 2024',
    'Nueva comunicación de Barriletes con 2 vacantes mañana y 4 tarde; no cuenta como oferta nueva.'
  ),
  (
    'WA24-R002',
    'WA24-033',
    'relaunch',
    timestamptz '2024-09-06 11:55:38-03',
    'lines 1071-1088',
    6,
    '2024-09-10',
    'Relanzamiento explícito de Virgen del Luján; reemplaza la fecha inicial y no cuenta como oferta nueva.'
  );

do $$
declare
  v_offers integer;
  v_finite_offers integer;
  v_finite_capacity integer;
  v_events integer;
  v_slots integer;
  v_members integer;
  v_bad_slot_sums integer;
begin
  select count(*),
         count(*) filter (where capacity_mode = 'fijo'),
         coalesce(sum(offered_capacity) filter (where capacity_mode = 'fijo'), 0)
    into v_offers, v_finite_offers, v_finite_capacity
  from private.historical_launch_offers
  where source_id = 'whatsapp-pps-2024';

  select count(*) into v_events
  from private.historical_launch_events
  where event_type = 'relaunch';

  select count(*) into v_slots from private.historical_launch_slots;
  select count(*) into v_members from private.historical_launch_members;

  select count(*) into v_bad_slot_sums
  from (
    select o.offer_id
    from private.historical_launch_offers as o
    join private.historical_launch_slots as s on s.offer_id = o.offer_id
    where o.capacity_mode = 'fijo'
    group by o.offer_id, o.offered_capacity
    having sum(s.offered_capacity) filter (where s.offered_capacity is not null) <> o.offered_capacity
  ) as invalid_slot_sum;

  if v_offers <> 42 or v_finite_offers <> 36 or v_finite_capacity <> 270 then
    raise exception
      'Carga histórica 2024 inválida: ofertas %, finitas %, capacidad %',
      v_offers, v_finite_offers, v_finite_capacity;
  end if;

  if v_events <> 2 then
    raise exception 'Carga histórica 2024 inválida: se esperaban 2 relanzamientos y se obtuvieron %', v_events;
  end if;

  if v_slots <> 31 or v_members <> 50 or v_bad_slot_sums <> 0 then
    raise exception
      'Carga histórica 2024 inválida: slots %, miembros %, sumas de slot inválidas %',
      v_slots, v_members, v_bad_slot_sums;
  end if;
end;
$$;

commit;
