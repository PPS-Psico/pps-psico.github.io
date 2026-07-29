-- 1. Ensure updated_at exists in lanzamientos_pps
ALTER TABLE lanzamientos_pps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Ensure historial_gestion exists in lanzamientos_pps
ALTER TABLE lanzamientos_pps ADD COLUMN IF NOT EXISTS historial_gestion TEXT;

-- 3. Create or replace the function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Add trigger to lanzamientos_pps
DROP TRIGGER IF EXISTS tr_lanzamientos_pps_updated_at ON lanzamientos_pps;
CREATE TRIGGER tr_lanzamientos_pps_updated_at
    BEFORE UPDATE ON lanzamientos_pps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
