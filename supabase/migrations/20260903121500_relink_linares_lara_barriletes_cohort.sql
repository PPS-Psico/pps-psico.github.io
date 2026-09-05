begin;

-- Linares Lara (legajo 30923) quedó vinculada al lanzamiento de Barriletes
-- equivocado. Se resuelve con el anuncio original del grupo de WhatsApp de
-- convocatorias PPS (export "_chat.txt", verificado a mano):
--
--   [2/7/25] "¡Nueva Convocatoria PPS: Asociación Civil Pensar (Neuquén Cap.)!"
--   Institución: PENSAR Asociación Civil - Barriletes en Bandada.
--   Acredita: 80 hs totales (Orientación Clínica).
--   Inicio de Prácticas: MARTES 22 de Julio [2025].
--
-- Coincide exacto con su práctica: horas_realizadas=80, especialidad=Clínica,
-- fecha_inicio=2025-07-22. El lanzamiento 76ff00a2 tiene esas mismas fechas
-- (2025-07-22 → 2025-11-22). Su práctica estaba apuntando en cambio a
-- 368ca720, un lanzamiento 2024 cuyos propios datos no coinciden ni con el
-- anuncio real de esa cohorte: el mensaje del 17/4/24 para el mismo dispositivo
-- dice "Orientación: Socio Comunitaria" y "desde abril hasta noviembre",
-- mientras que 368ca720 está cargado como Clínica y con fechas
-- 2024-08-05 → 2024-12-06 -- ninguna de las dos cosas sale del chat. Es un
-- registro de baja calidad, no la fuente real de esa cohorte.
--
-- El efecto práctico: su práctica apuntaba a la tarea de Moodle
-- "Informes PPS Asociación PENSAR" (cmid 275376, 2024) en vez de
-- "Barriletes en Bandada" (cmid 805657, 2025) -- la misma tarea que resultó
-- clave en el caso de Florencia García Panetta el mismo día. Si alguna vez
-- entregó el informe, el barrido nunca podía encontrarlo.

update public.practicas
set lanzamiento_id = '76ff00a2-6791-4990-8589-ee43c2fbff80'
where id = '7229f15c-3fb6-4e8a-a13a-65a57b5b3844'
  and lanzamiento_id = '368ca720-145f-408f-b2f7-9454f0076b3f';

commit;
