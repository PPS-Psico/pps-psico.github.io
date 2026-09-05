begin;

-- Script consolidado: dedupe de los 7 grupos de practicas repetidas detectados
-- por igualdad exacta (estudiante + institución + fechas + horas) y el
-- re-vínculo de Linares Lara a su cohorte real de Barriletes, con evidencia
-- del grupo de WhatsApp de convocatorias (ver 20260903121500).
--
-- Bianca Latrichiana (32700) se investigó por separado y queda AFUERA a
-- propósito: tiene 3 filas de "Ateneos Ulloa" con fecha_inicio distinta por
-- 1-2 días (por eso el detector automático no la agarró), pero el anuncio
-- real del 10/9/25 dice "Acredita 25 hs de Clínica *por cada comisión*" y
-- "podés anotarte en una, dos o las tres" -- el programa está diseñado para
-- acreditar hasta 75 hs si se cursan las tres. No es necesariamente un
-- duplicado y no se toca sin confirmar con Coordinación cuántas comisiones
-- cursó realmente. Sí se le limpia el audit table (ver abajo) para poder
-- investigarla sin el bloqueo de FK cuando haga falta.
--
-- Esto también deja una pregunta abierta: como el detector automático exigía
-- fecha_inicio idéntica, es probable que existan más duplicados reales
-- ocultos por una diferencia de uno o dos días -- falta una revisión con
-- ventana de fechas en vez de igualdad exacta.
--
-- Bloqueo nuevo encontrado al aplicar por REST: `private.moodle_practice_link
-- _repair_audit` referencia casi todas estas filas (auditoría del arreglo de
-- vínculos de esta misma sesión) con un FK sin CASCADE, así que había que
-- limpiarla antes de poder borrar la práctica. Sólo se puede tocar por
-- conexión directa a Postgres -- la API REST no expone el esquema `private`
-- bajo ninguna cabecera -- por eso quedó pendiente hasta ahora.

with losers as (
  select unnest(array[
    '04b6e91c-a5c0-4340-9c79-f31befe65727','8e617d5b-3b00-42a3-8fdf-234e6045d536',
    '6fd6b0fd-480c-42d8-9200-87b9f5812189',
    '2d1e9a03-af82-47cd-b763-49e4ca749b9c',
    'eee2b66b-cd33-4efe-8440-ed37f0a56c34','3441fbc1-ed89-4e15-8a1f-dac37f0fd059',
    '3fdf2b47-cfe9-4d86-b218-a30b1d40ff69',
    'bbd62582-389f-48e2-9aa6-28c7fa15b8d4',
    'b7b4c24e-2b1d-4c90-974c-201bc0871bfb',
    '6e4ff9f7-ba4d-4cf0-8c00-701823ed3a60','a8313856-4883-4ca2-8a7e-d27c1fdc5e3e'
  ]::uuid[]) as id
)
delete from private.moodle_practice_link_repair_audit
where practice_id in (select id from losers);

with pares as (
  select * from (values
    ('edaaa90b-1f30-4143-9f38-53319514dc82'::uuid, array['04b6e91c-a5c0-4340-9c79-f31befe65727','8e617d5b-3b00-42a3-8fdf-234e6045d536']::uuid[]), -- Correa María Josefina
    ('18840f7f-963d-4955-aaa4-b6f685c544b9'::uuid, array['6fd6b0fd-480c-42d8-9200-87b9f5812189']::uuid[]),                                          -- Lucrecia Rezzónico
    ('668aebcb-693a-48e5-88a4-491cca2174bd'::uuid, array['2d1e9a03-af82-47cd-b763-49e4ca749b9c']::uuid[]),                                          -- Mara Suste
    ('d2fba419-7a9b-49d1-841f-9b97aea4e666'::uuid, array['eee2b66b-cd33-4efe-8440-ed37f0a56c34','3441fbc1-ed89-4e15-8a1f-dac37f0fd059']::uuid[]),   -- Laila Aedo
    ('7e093e69-2bd6-4799-b290-91fa962fc57c'::uuid, array['3fdf2b47-cfe9-4d86-b218-a30b1d40ff69']::uuid[]),                                          -- Parra Candela Dolores
    ('7229f15c-3fb6-4e8a-a13a-65a57b5b3844'::uuid, array['bbd62582-389f-48e2-9aa6-28c7fa15b8d4']::uuid[]),                                          -- Linares Lara
    ('c37e069b-fa4f-46a9-b275-649b819a9f1b'::uuid, array['b7b4c24e-2b1d-4c90-974c-201bc0871bfb']::uuid[])                                          -- María Agustina Garcia
    -- Bianca Latrichiana (32700) queda AFUERA a proposito. El anuncio de
    -- WhatsApp del 10/9/25 dice 'Acredita 25 hs de Clinica por cada comision'
    -- y 'podes anotarte en una, dos o las tres': no es necesariamente un
    -- duplicado, puede ser 75 hs legitimas. Falta confirmar con Coordinacion
    -- cuantas comisiones curso realmente antes de tocar sus filas.
  ) as t(survivor, losers)
)
update public.moodle_grade_observations o
set practica_id = p.survivor
from pares p
where o.practica_id = any(p.losers)
  and not exists (
    select 1 from public.moodle_grade_observations keep
    where keep.practica_id = p.survivor
      and keep.request_id = o.request_id
      and keep.cmid = o.cmid
  );

delete from public.practicas
where id in (select unnest(losers) from pares);

update public.practicas
set lanzamiento_id = '76ff00a2-6791-4990-8589-ee43c2fbff80'
where id = '7229f15c-3fb6-4e8a-a13a-65a57b5b3844'
  and lanzamiento_id = '368ca720-145f-408f-b2f7-9454f0076b3f';

commit;
