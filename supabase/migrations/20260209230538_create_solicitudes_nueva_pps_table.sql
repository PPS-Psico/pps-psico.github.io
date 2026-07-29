-- Tabla para solicitudes de nueva PPS manual
CREATE TABLE IF NOT EXISTS solicitudes_nueva_pps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  institucion_id UUID REFERENCES instituciones(id) ON DELETE SET NULL,
  nombre_institucion_manual TEXT,
  orientacion VARCHAR(100) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_finalizacion DATE NOT NULL,
  horas_estimadas INTEGER NOT NULL CHECK (horas_estimadas > 0 AND horas_estimadas <= 120),
  planilla_asistencia_url TEXT,
  informe_final_url TEXT NOT NULL,
  es_online BOOLEAN NOT NULL DEFAULT FALSE,
  estado VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  comentario_rechazo TEXT,
  notas_admin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint para asegurar que tenga institución (por ID o manual)
  CONSTRAINT chk_institucion CHECK (
    (institucion_id IS NOT NULL) OR (nombre_institucion_manual IS NOT NULL AND LENGTH(nombre_institucion_manual) > 0)
  )
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_solicitudes_nueva_estudiante ON solicitudes_nueva_pps(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_nueva_institucion ON solicitudes_nueva_pps(institucion_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_nueva_estado ON solicitudes_nueva_pps(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_nueva_created ON solicitudes_nueva_pps(created_at DESC);

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_solicitudes_nueva_updated_at ON solicitudes_nueva_pps;
CREATE TRIGGER update_solicitudes_nueva_updated_at
  BEFORE UPDATE ON solicitudes_nueva_pps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Políticas de seguridad (RLS)
ALTER TABLE solicitudes_nueva_pps ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver sus propias solicitudes
CREATE POLICY "Users can view own new pps requests" ON solicitudes_nueva_pps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM estudiantes e 
      WHERE e.id = solicitudes_nueva_pps.estudiante_id 
      AND e.user_id = auth.uid()
    )
  );

-- Política: usuarios pueden crear sus propias solicitudes
CREATE POLICY "Users can create own new pps requests" ON solicitudes_nueva_pps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM estudiantes e 
      WHERE e.id = estudiante_id 
      AND e.user_id = auth.uid()
    )
  );

-- Política: admins pueden ver todas las solicitudes
CREATE POLICY "Admins can view all new pps requests" ON solicitudes_nueva_pps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM estudiantes e 
      WHERE e.user_id = auth.uid() 
      AND e.role = 'admin'
    )
  );

-- Política: admins pueden actualizar todas las solicitudes
CREATE POLICY "Admins can update all new pps requests" ON solicitudes_nueva_pps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM estudiantes e 
      WHERE e.user_id = auth.uid() 
      AND e.role = 'admin'
    )
  );