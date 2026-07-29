-- Tabla para solicitudes de modificación de prácticas existentes
CREATE TABLE IF NOT EXISTS solicitudes_modificacion_pps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  practica_id UUID NOT NULL REFERENCES practicas(id) ON DELETE CASCADE,
  tipo_modificacion VARCHAR(50) NOT NULL CHECK (tipo_modificacion IN ('horas', 'eliminacion')),
  horas_nuevas INTEGER CHECK (horas_nuevas IS NULL OR (horas_nuevas > 0 AND horas_nuevas <= 120)),
  planilla_asistencia_url TEXT,
  estado VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  comentario_rechazo TEXT,
  notas_admin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_solicitudes_mod_estudiante ON solicitudes_modificacion_pps(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_mod_practica ON solicitudes_modificacion_pps(practica_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_mod_estado ON solicitudes_modificacion_pps(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_mod_created ON solicitudes_modificacion_pps(created_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_solicitudes_modificacion_updated_at ON solicitudes_modificacion_pps;
CREATE TRIGGER update_solicitudes_modificacion_updated_at
  BEFORE UPDATE ON solicitudes_modificacion_pps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Políticas de seguridad (RLS)
ALTER TABLE solicitudes_modificacion_pps ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver sus propias solicitudes
CREATE POLICY "Users can view own modification requests" ON solicitudes_modificacion_pps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM estudiantes e 
      WHERE e.id = solicitudes_modificacion_pps.estudiante_id 
      AND e.user_id = auth.uid()
    )
  );

-- Política: usuarios pueden crear sus propias solicitudes
CREATE POLICY "Users can create own modification requests" ON solicitudes_modificacion_pps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM estudiantes e 
      WHERE e.id = estudiante_id 
      AND e.user_id = auth.uid()
    )
  );

-- Política: admins pueden ver todas las solicitudes
CREATE POLICY "Admins can view all modification requests" ON solicitudes_modificacion_pps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM estudiantes e 
      WHERE e.user_id = auth.uid() 
      AND e.role = 'admin'
    )
  );

-- Política: admins pueden actualizar todas las solicitudes
CREATE POLICY "Admins can update all modification requests" ON solicitudes_modificacion_pps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM estudiantes e 
      WHERE e.user_id = auth.uid() 
      AND e.role = 'admin'
    )
  );