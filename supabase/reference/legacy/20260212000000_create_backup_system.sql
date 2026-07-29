-- ============================================
-- SISTEMA DE BACKUP AUTOMATICO
-- Ejecutar este script para configurar las tablas necesarias
-- ============================================

-- Tabla de configuración de backups
CREATE TABLE IF NOT EXISTS backup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
  backup_time TIME DEFAULT '02:00:00',
  retain_count INTEGER DEFAULT 7,
  include_tables TEXT[] DEFAULT ARRAY[
    'estudiantes', 'instituciones', 'lanzamientos_pps', 'convocatorias', 
    'practicas', 'solicitudes_pps', 'finalizacion_pps', 'penalizaciones',
    'solicitudes_nueva_pps', 'solicitudes_modificacion_pps'
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

-- Insertar configuración por defecto (2 backups = ~10MB para tu base de datos)
INSERT INTO backup_config (enabled, frequency, retain_count)
VALUES (true, 'daily', 2)
ON CONFLICT DO NOTHING;

-- ============================================
-- POLITICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS
ALTER TABLE backup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- Politicas para backup_config
CREATE POLICY "Allow admin read backup_config"
  ON backup_config FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin update backup_config"
  ON backup_config FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Politicas para backup_history
CREATE POLICY "Allow admin read backup_history"
  ON backup_history FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin insert backup_history"
  ON backup_history FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin delete backup_history"
  ON backup_history FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- INDICES PARA MEJOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_backup_type ON backup_history(backup_type);

-- ============================================
-- COMENTARIOS DE DOCUMENTACION
-- ============================================

COMMENT ON TABLE backup_config IS 'Configuración del sistema de backups automáticos';
COMMENT ON TABLE backup_history IS 'Historial de operaciones de backup y restore';

COMMENT ON COLUMN backup_config.enabled IS 'Activa o desactiva los backups automáticos';
COMMENT ON COLUMN backup_config.frequency IS 'Frecuencia de backup: hourly, daily, weekly, monthly';
COMMENT ON COLUMN backup_config.backup_time IS 'Hora del día para ejecutar el backup (HH:MM:SS)';
COMMENT ON COLUMN backup_config.retain_count IS 'Número de backups a mantener (los más antiguos se eliminan)';
COMMENT ON COLUMN backup_config.include_tables IS 'Array con nombres de tablas a respaldar';

COMMENT ON COLUMN backup_history.backup_type IS 'Tipo de operación: automatic o manual';
COMMENT ON COLUMN backup_history.status IS 'Estado: pending, running, completed, failed';
COMMENT ON COLUMN backup_history.metadata IS 'Datos adicionales en formato JSON (usado en restauraciones)';
