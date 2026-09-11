-- Una segunda aprobacion ya no pisa a la primera en silencio.
--
-- El arnes de concurrencia dejo esto como observado: dos solicitudes DISTINTAS
-- sobre la misma practica se aplican una despues de la otra sin que la segunda
-- se entere de la primera. No es el mismo problema que la idempotencia —esa ya
-- esta resuelta para una misma solicitud— sino el de resolver desde una pantalla
-- que se quedo vieja. Y no es hipotetico: hoy hay una practica con dos pedidos
-- de horas esperando en la cola.
--
-- Se resuelve con el valor que se esta decidiendo como testigo, en vez de una
-- columna de version: `practicas` no tiene updated_at y ya carga diez triggers.
-- Quien aprueba manda las horas que su pantalla mostraba; si al guardar la
-- practica ya no las tiene, la RPC rechaza diciendo cuantas tiene ahora. El
-- chequeo ocurre adentro de la transaccion, con la practica bloqueada, asi que
-- tambien cubre el cambio que entra entre que se mira y se confirma.
--
-- Sin el parametro se comporta igual que antes: no rompe a quien ya la llama.
--
-- El 45001 es un codigo propio, distinto del P0001 de "ya fue procesada": el
-- panel necesita distinguir "alguien la cambio, revisala" de "esto ya se
-- resolvio", porque la primera se puede confirmar y la segunda no.

drop function if exists public.aprobar_solicitud_modificacion_pps(uuid, integer, text);

create or replace function public.aprobar_solicitud_modificacion_pps(
  p_solicitud_id uuid,
  p_horas_aprobadas integer default null,
  p_notas text default null,
  p_horas_vistas integer default null
)
returns public.solicitudes_modificacion_pps
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_sol public.solicitudes_modificacion_pps%rowtype;
  v_practica public.practicas%rowtype;
  v_horas integer;
begin
  if not public.is_admin() then
    raise exception 'Solo coordinacion puede resolver solicitudes de PPS.'
      using errcode = '42501';
  end if;

  -- Mismo orden de bloqueo que la aprobacion de alta: primero la solicitud,
  -- despues la practica. Dos solicitudes sobre la misma practica se serializan.
  select s.* into v_sol
  from public.solicitudes_modificacion_pps as s
  where s.id = p_solicitud_id
  for update;

  if not found then
    raise exception 'No se encontro la solicitud indicada.' using errcode = 'P0002';
  end if;

  if v_sol.tipo_modificacion = 'eliminacion' then
    raise exception 'Las solicitudes de baja se resuelven con su penalizacion asociada.'
      using errcode = 'P0001';
  end if;

  if v_sol.estado = 'aprobada' then
    if p_horas_aprobadas is not null
       and p_horas_aprobadas is distinct from v_sol.horas_aprobadas then
      raise exception
        'La solicitud ya fue aprobada con % h y no se puede cambiar por esta via. Recarga la pantalla.',
        coalesce(v_sol.horas_aprobadas::text, 'sin registro de')
        using errcode = 'P0001';
    end if;
    return v_sol;
  end if;

  if v_sol.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue procesada (estado: %).', v_sol.estado
      using errcode = 'P0001';
  end if;

  if v_sol.tipo_modificacion = 'horas' then
    v_horas := coalesce(p_horas_aprobadas, v_sol.horas_nuevas);

    if v_horas is null or v_horas <= 0 then
      raise exception 'Las horas a acreditar deben ser mayores a cero.'
        using errcode = '22023';
    end if;

    if v_sol.practica_id is null then
      raise exception 'La solicitud de horas ya no tiene una practica asociada.'
        using errcode = 'P0001';
    end if;

    select p.* into v_practica
    from public.practicas as p
    where p.id = v_sol.practica_id
    for update;

    if not found then
      raise exception 'La practica que se quiere modificar ya no existe.'
        using errcode = 'P0002';
    end if;

    -- Con la practica ya bloqueada: si cambio desde que se miro, no se resuelve.
    if p_horas_vistas is not null
       and v_practica.horas_realizadas is distinct from p_horas_vistas::numeric then
      raise exception
        'La practica cambio desde que abriste la solicitud: ahora tiene % h. Revisa el cambio antes de aprobar.',
        v_practica.horas_realizadas
        using errcode = '45001';
    end if;

    update public.practicas
    set horas_realizadas = v_horas
    where id = v_practica.id;
  end if;

  update public.solicitudes_modificacion_pps
  set estado = 'aprobada',
      notas_admin = nullif(btrim(p_notas), ''),
      horas_aprobadas = case when v_sol.tipo_modificacion = 'horas' then v_horas else null end,
      resuelta_at = now(),
      resuelta_por = auth.uid()
  where id = v_sol.id
  returning * into v_sol;

  return v_sol;
end;
$fn$;

revoke all on function public.aprobar_solicitud_modificacion_pps(uuid, integer, text, integer)
  from public, anon;
grant execute on function public.aprobar_solicitud_modificacion_pps(uuid, integer, text, integer)
  to authenticated;

comment on function public.aprobar_solicitud_modificacion_pps(uuid, integer, text, integer) is
  'Aprobacion atomica de modificacion: aplica las horas que define coordinacion y resuelve la solicitud en una transaccion. Con p_horas_vistas rechaza (45001) si la practica cambio desde que se abrio la pantalla. Las bajas van por su propia RPC.';
