-- Incidente 2026-08-19: al seleccionar un alumno en un lanzamiento con
-- opciones/franjas (multi-orientación), quedaban DOS prácticas creadas por
-- una misma selección — una fantasma (estado incorrecto, especialidad cruda
-- sin separar "Laboral, Educacional", nombre_institucion corrupto) y la real
-- (con opcion_id, creada por la RPC de franjas). 41 alumnos afectados en el
-- lanzamiento "Ministerio de Trabajo y Desarrollo Humano" (limpiados a mano
-- vía service role, no por esta migración).
--
-- Causa raíz — dos mecanismos independientes crean la práctica sobre el
-- mismo evento de selección:
--   1. Los triggers legacy `trigger_gestion_automatica_practicas` (AFTER
--      UPDATE OF estado_inscripcion) y `trigger_gestion_automatica_practicas_insert`
--      (AFTER INSERT) sobre `convocatorias`, ambos disparando
--      `handle_seleccion_alumno()`.
--   2. La RPC `seleccionar_convocatoria_opcion_horario()` (soporte de
--      franjas/opciones, 20260812160113 en adelante), que además de su
--      propio insert/update de `practicas` hace un
--      `UPDATE convocatorias SET estado_inscripcion = 'Seleccionado' ...`
--      — ese UPDATE dispara el trigger legacy EN LA MISMA TRANSACCIÓN, antes
--      de que la RPC llegue a su propio manejo de `practicas`.
--
-- Para lanzamientos con finalización por horas, `handle_seleccion_alumno()`
-- insertaba `horas_realizadas = datos_lanzamiento.horas_acreditadas` (el
-- total, no 0). Esa fila nace con las horas ya completas, así que
-- `trg_finish_hour_based_practice` la cierra como 'Finalizada' al instante.
-- Cuando la RPC después busca una práctica 'en curso' para actualizar, no la
-- encuentra (ya quedó Finalizada) y crea una segunda fila — la fantasma con
-- datos crudos porque el trigger legacy no conoce opciones/franjas, la real
-- con opcion_id porque la crea la RPC. Para lanzamientos con fecha fija el
-- duplicado no se nota tanto (la RPC termina actualizando esa misma fila en
-- vez de duplicarla), pero el problema de fondo — dos escritores para el
-- mismo evento — es el mismo en cualquier lanzamiento con opciones.
--
-- Bug aparte, mismo insert: `nombre_institucion` (columna `text`) se cargaba
-- como `ARRAY[datos_lanzamiento.nombre_pps]` (un `text[]` de un elemento),
-- forzando el cast implícito a texto que produce el formato corrupto
-- `{"Ministerio de Trabajo y Desarrollo Humano"}` visible en las fantasma.
--
-- Fix:
--   1. `handle_seleccion_alumno()` deja de actuar sobre lanzamientos que
--      tienen opciones activas — esos ya están 100% cubiertos por
--      `seleccionar_convocatoria_opcion_horario()`. Sigue siendo la única
--      vía para lanzamientos simples (sin franjas) y para el alta manual
--      directa del Lanzador (que inserta la convocatoria ya como
--      'Seleccionado' sin pasar por ninguna RPC).
--   2. `horas_realizadas` arranca en 0, igual que en todos los demás
--      caminos de creación de práctica (RPC y servicio JS) — sembrar con el
--      total ya causaba el mismo cierre instantáneo indebido incluso sin el
--      duplicado, para lanzamientos simples con finalización por horas.
--   3. `nombre_institucion` se inserta como texto plano, no como array.

create or replace function public.handle_seleccion_alumno()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
DECLARE
    datos_lanzamiento RECORD;
BEGIN
    -- CASO 1: El alumno fue SELECCIONADO
    IF NEW.estado_inscripcion = 'Seleccionado' AND (OLD.estado_inscripcion IS DISTINCT FROM 'Seleccionado') THEN

        -- Lanzamientos con franjas/opciones: la práctica la crea y mantiene
        -- seleccionar_convocatoria_opcion_horario(), no este trigger.
        IF EXISTS (
            SELECT 1
            FROM public.lanzamiento_opciones o
            WHERE o.lanzamiento_id = NEW.lanzamiento_id
              AND o.activa
        ) THEN
            RETURN NEW;
        END IF;

        -- Obtenemos datos del lanzamiento
        SELECT * INTO datos_lanzamiento
        FROM public.lanzamientos_pps
        WHERE id = NEW.lanzamiento_id;

        -- Creamos la práctica automáticamente
        INSERT INTO public.practicas (
            estudiante_id,
            lanzamiento_id,
            estado,
            fecha_inicio,
            fecha_finalizacion,
            especialidad,
            horas_realizadas,
            nombre_institucion,
            nota
        )
        VALUES (
            NEW.estudiante_id,
            NEW.lanzamiento_id,
            'En curso',
            datos_lanzamiento.fecha_inicio,
            datos_lanzamiento.fecha_finalizacion,
            datos_lanzamiento.orientacion,
            0,
            datos_lanzamiento.nombre_pps,
            'Sin calificar'
        )
        ON CONFLICT DO NOTHING;

    -- CASO 2: El alumno fue DESELECCIONADO
    ELSIF OLD.estado_inscripcion = 'Seleccionado' AND NEW.estado_inscripcion != 'Seleccionado' THEN

        -- Borramos la práctica asociada
        DELETE FROM public.practicas
        WHERE estudiante_id = NEW.estudiante_id
        AND lanzamiento_id = NEW.lanzamiento_id
        AND estado = 'En curso';

    END IF;

    RETURN NEW;
END;
$function$;
