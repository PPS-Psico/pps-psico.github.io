
-- Tabla de configuración de backups
CREATE TABLE IF NOT EXISTS backup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
  backup_time TIME DEFAULT '02:00:00',
  retain_count INTEGER DEFAULT 7,
  include_tables TEXT[] DEFAULT ARRAY[
    'estudiantes', 'instituciones', 'lanzamientos_pps', 'convocatorias', 
    'practicas', 'solicitudes_pps', 'finalizacion_pps', 'penalizaciones'
  ],
  storage_bucket TEXT DEFAULT 'backups',
  last_backup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de historial de backups
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL DEFAULT 'automatic' CHECK (backup_type IN ('automatic', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  tables_backed_up TEXT[],
  storage_path TEXT,
  file_size_bytes BIGINT,
  record_count INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Insertar configuración por defecto
INSERT INTO backup_config (enabled, frequency, retain_count)
VALUES (true, 'daily', 7)
ON CONFLICT DO NOTHING;

-- Políticas RLS para backup_config
ALTER TABLE backup_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin read backup_config"
  ON backup_config FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin update backup_config"
  ON backup_config FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas RLS para backup_history
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin read backup_history"
  ON backup_history FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin insert backup_history"
  ON backup_history FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin delete backup_history"
  ON backup_history FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');
