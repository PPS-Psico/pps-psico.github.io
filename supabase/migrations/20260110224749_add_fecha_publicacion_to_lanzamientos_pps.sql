ALTER TABLE public.lanzamientos_pps ADD COLUMN IF NOT EXISTS fecha_publicacion text;
NOTIFY pgrst, 'reload schema';
