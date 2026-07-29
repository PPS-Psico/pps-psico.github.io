ALTER TABLE lanzamientos_pps 
ADD COLUMN IF NOT EXISTS archivo_descargable_nombre TEXT,
ADD COLUMN IF NOT EXISTS archivo_descargable_url TEXT;