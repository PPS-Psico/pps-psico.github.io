
-- Agregar columna horario_asignado a la tabla convocatorias
ALTER TABLE convocatorias 
ADD COLUMN IF NOT EXISTS horario_asignado text;

-- Comentario para documentación
COMMENT ON COLUMN convocatorias.horario_asignado IS 'Horario final asignado por el administrador (puede ser diferente de horario_seleccionado)';
