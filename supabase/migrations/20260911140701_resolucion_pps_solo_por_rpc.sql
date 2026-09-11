-- Cierra el ultimo hueco de las resoluciones: que se puedan falsificar por fuera.
--
-- Agregar una RPC segura no obliga a los demas caminos a usarla. Un admin seguia
-- pudiendo hacer UPDATE directo sobre solicitudes_* y dejar una solicitud
-- "aprobada" sin practica, o "rechazada" con la practica ya creada.
--
-- No alcanza con revocar el permiso: las cinco RPC de resolucion son
-- `security invoker`, asi que corren con los privilegios de quien llama y se
-- romperian junto con las escrituras directas. Las dos cosas van juntas:
--
--   1. las RPC pasan a `security definer` (ya tienen is_admin() como unica
--      puerta y search_path fijado, que es lo que hace seguro el cambio);
--   2. recien entonces se revoca el UPDATE directo.
--
-- Se revoca UPDATE y nada mas. El INSERT queda intacto porque es como el
-- estudiante presenta su solicitud, y el DELETE porque cuelga de la baja de un
-- lanzamiento. `create_my_solicitud_baja_pps_v1` sigue siendo invoker a
-- proposito: no chequea rol porque se apoya en RLS para que el estudiante solo
-- pueda crear lo suyo.

alter function public.aprobar_solicitud_nueva_pps(uuid, integer, text) security definer;
alter function public.aprobar_solicitud_modificacion_pps(uuid, integer, text) security definer;
alter function public.rechazar_solicitud_nueva_pps(uuid, text, text) security definer;
alter function public.rechazar_solicitud_modificacion_pps(uuid, text, text) security definer;
alter function public.resolver_solicitud_baja_pps_v1(uuid, text, text, text, text) security definer;

revoke update on public.solicitudes_nueva_pps from authenticated, anon;
revoke update on public.solicitudes_modificacion_pps from authenticated, anon;

comment on table public.solicitudes_nueva_pps is
  'Altas de PPS pedidas por el estudiante. La resolucion se escribe solo por aprobar_/rechazar_solicitud_nueva_pps: el UPDATE directo esta revocado.';
comment on table public.solicitudes_modificacion_pps is
  'Cambios y bajas pedidos por el estudiante. La resolucion se escribe solo por las RPC (aprobar_/rechazar_solicitud_modificacion_pps y resolver_solicitud_baja_pps_v1): el UPDATE directo esta revocado.';
