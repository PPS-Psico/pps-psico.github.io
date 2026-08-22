-- Elimina las foreign keys duplicadas hacia `lanzamientos_pps`.
--
-- QUE HABIA
--
-- `convocatorias.lanzamiento_id` y `practicas.lanzamiento_id` tenian DOS foreign
-- keys cada una, apuntando a la misma columna de la misma tabla:
--
--   convocatorias : fk_convocatoria_lanzamiento + convocatorias_lanzamiento_id_fkey
--   practicas     : fk_practica_lanzamiento     + practicas_lanzamiento_id_fkey
--
-- Verificado con `pg_get_constraintdef` antes de tocar nada: las definiciones
-- son identicas -- `FOREIGN KEY (lanzamiento_id) REFERENCES lanzamientos_pps(id)`,
-- sin ON DELETE/UPDATE explicito (NO ACTION), no deferrables, ambas validadas.
-- Postgres valida las dos en cada INSERT y UPDATE, o sea el doble de trabajo
-- para exactamente la misma garantia.
--
-- POR QUE SE CONSERVA JUSTO ESTA Y NO LA OTRA
--
-- No es indistinto. Cuando una tabla tiene mas de una FK hacia la misma tabla,
-- PostgREST no puede resolver solo el embedding y hay que nombrarle la
-- constraint. El frontend ya lo hace, en cuatro lugares:
--
--   practicasService.ts        lanzamientos_pps!fk_practica_lanzamiento
--   DesaprobacionPPSModal.tsx  lanzamientos_pps!fk_practica_lanzamiento
--   EgresoTab.tsx              lanzamientos_pps!fk_practica_lanzamiento
--   correccionService.ts       lanzamientos_pps!fk_convocatoria_lanzamiento
--
-- Dropear las `fk_*` romperia esas cuatro queries con un PGRST200
-- ("Could not find a relationship..."). Por eso se van las `*_lanzamiento_id_fkey`,
-- que no las nombra nadie.
--
-- Nota: al quedar una sola FK, el hint deja de ser obligatorio, pero se conserva
-- porque sigue siendo valido y explicito. No hace falta tocar el frontend.
--
-- Se verifico ademas que ninguna funcion, vista ni policy de la base mencione
-- los nombres que se eliminan.

alter table public.convocatorias
  drop constraint if exists convocatorias_lanzamiento_id_fkey;

alter table public.practicas
  drop constraint if exists practicas_lanzamiento_id_fkey;
