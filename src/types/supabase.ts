
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      email_templates: {
        Row: {
          id: string
          subject: string
          body: string
          is_active: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id: string
          subject: string
          body: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          subject?: string
          body?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
      }
      push_subscriptions: {
        Row: {
          id: number
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
      }
      estudiantes: {
        Row: {
          id: string
          created_at: string
          legajo: string
          nombre: string | null
          dni: number | null
          correo: string | null
          telefono: string | null
          orientacion_elegida: string | null
          notas_internas: string | null
          fecha_finalizacion: string | null
          estado: string | null
          user_id: string | null
          must_change_password: boolean | null
          role: string | null
          genero: string | null
          nombre_separado: string | null
          apellido_separado: string | null
          fecha_nacimiento: string | null
          // Add missing fields to Row
          trabaja: boolean | null
          certificado_trabajo: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          legajo: string
          nombre?: string | null
          dni?: number | null
          correo?: string | null
          telefono?: string | null
          orientacion_elegida?: string | null
          notas_internas?: string | null
          fecha_finalizacion?: string | null
          estado?: string | null
          user_id?: string | null
          must_change_password?: boolean | null
          role?: string | null
          genero?: string | null
          nombre_separado?: string | null
          apellido_separado?: string | null
          fecha_nacimiento?: string | null
          // Add missing fields to Insert
          trabaja?: boolean | null
          certificado_trabajo?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          legajo?: string
          nombre?: string | null
          dni?: number | null
          correo?: string | null
          telefono?: string | null
          orientacion_elegida?: string | null
          notas_internas?: string | null
          fecha_finalizacion?: string | null
          estado?: string | null
          user_id?: string | null
          must_change_password?: boolean | null
          role?: string | null
          genero?: string | null
          nombre_separado?: string | null
          apellido_separado?: string | null
          fecha_nacimiento?: string | null
          // Add missing fields to Update
          trabaja?: boolean | null
          certificado_trabajo?: string | null
        }
      }
      practicas: {
        Row: {
          id: string
          created_at: string
          estudiante_id: string | null
          lanzamiento_id: string | null
          institucion_id: string | null
          nombre_institucion: string | null
          horas_realizadas: number | null
          fecha_inicio: string | null
          fecha_finalizacion: string | null
          estado: string | null
          especialidad: string | null
          nota: string | null
          legajo_busqueda: string[] | null
        }
        Insert: {
          id?: string
          created_at?: string
          estudiante_id?: string | null
          lanzamiento_id?: string | null
          institucion_id?: string | null
          nombre_institucion?: string | null
          horas_realizadas?: number | null
          fecha_inicio?: string | null
          fecha_finalizacion?: string | null
          estado?: string | null
          especialidad?: string | null
          nota?: string | null
          legajo_busqueda?: string[] | null
        }
        Update: {
          id?: string
          created_at?: string
          estudiante_id?: string | null
          lanzamiento_id?: string | null
          institucion_id?: string | null
          nombre_institucion?: string | null
          horas_realizadas?: number | null
          fecha_inicio?: string | null
          fecha_finalizacion?: string | null
          estado?: string | null
          especialidad?: string | null
          nota?: string | null
          legajo_busqueda?: string[] | null
        }
      }
      lanzamientos_pps: {
        Row: {
          id: string
          created_at: string
          nombre_pps: string | null
          fecha_inicio: string | null
          fecha_finalizacion: string | null
          direccion: string | null
          horario_seleccionado: string | null
          orientacion: string | null
          horas_acreditadas: number | null
          cupos_disponibles: number | null
          estado_convocatoria: string | null
          informe: string | null
          estado_gestion: string | null
          notas_gestion: string | null
          fecha_relanzamiento: string | null
          permite_certificado: boolean | null
          airtable_id: string | null
          req_certificado_trabajo: boolean | null
          req_cv: boolean | null
          codigo_tarjeta_campus: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          nombre_pps?: string | null
          fecha_inicio?: string | null
          fecha_finalizacion?: string | null
          direccion?: string | null
          horario_seleccionado?: string | null
          orientacion?: string | null
          horas_acreditadas?: number | null
          cupos_disponibles?: number | null
          estado_convocatoria?: string | null
          informe?: string | null
          estado_gestion?: string | null
          notas_gestion?: string | null
          fecha_relanzamiento?: string | null
          permite_certificado?: boolean | null
          airtable_id?: string | null
          req_certificado_trabajo?: boolean | null
          req_cv?: boolean | null
          codigo_tarjeta_campus?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          nombre_pps?: string | null
          fecha_inicio?: string | null
          fecha_finalizacion?: string | null
          direccion?: string | null
          horario_seleccionado?: string | null
          orientacion?: string | null
          horas_acreditadas?: number | null
          cupos_disponibles?: number | null
          estado_convocatoria?: string | null
          informe?: string | null
          estado_gestion?: string | null
          notas_gestion?: string | null
          fecha_relanzamiento?: string | null
          permite_certificado?: boolean | null
          airtable_id?: string | null
          req_certificado_trabajo?: boolean | null
          req_cv?: boolean | null
          codigo_tarjeta_campus?: string | null
        }
      }
      convocatorias: {
        Row: {
          id: string
          created_at: string
          lanzamiento_id: string | null
          estudiante_id: string | null
          estado_inscripcion: string | null
          informe_subido: boolean | null
          fecha_entrega_informe: string | null
          horario_seleccionado: string | null
          termino_cursar: string | null
          cursando_electivas: string | null
          finales_adeuda: string | null
          otra_situacion_academica: string | null
          certificado_url: Json | null
          airtable_id: string | null
          // Snapshot fields
          nombre_pps: string | null
          fecha_inicio: string | null
          fecha_finalizacion: string | null
          direccion: string | null
          orientacion: string | null
          horas_acreditadas: number | null
          legajo: number | null
          dni: number | null
          correo: string | null
          telefono: string | null
          trabaja: boolean | null
          certificado_trabajo: string | null
          cv_url: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          lanzamiento_id?: string | null
          estudiante_id?: string | null
          estado_inscripcion?: string | null
          informe_subido?: boolean | null
          fecha_entrega_informe?: string | null
          horario_seleccionado?: string | null
          termino_cursar?: string | null
          cursando_electivas?: string | null
          finales_adeuda?: string | null
          otra_situacion_academica?: string | null
          certificado_url?: Json | null
          airtable_id?: string | null
          nombre_pps?: string | null
          fecha_inicio?: string | null
          fecha_finalizacion?: string | null
          direccion?: string | null
          orientacion?: string | null
          horas_acreditadas?: number | null
          legajo?: number | null
          dni?: number | null
          correo?: string | null
          telefono?: string | null
          trabaja?: boolean | null
          certificado_trabajo?: string | null
          cv_url?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          lanzamiento_id?: string | null
          estudiante_id?: string | null
          estado_inscripcion?: string | null
          informe_subido?: boolean | null
          fecha_entrega_informe?: string | null
          horario_seleccionado?: string | null
          termino_cursar?: string | null
          cursando_electivas?: string | null
          finales_adeuda?: string | null
          otra_situacion_academica?: string | null
          certificado_url?: Json | null
          airtable_id?: string | null
          nombre_pps?: string | null
          fecha_inicio?: string | null
          fecha_finalizacion?: string | null
          direccion?: string | null
          orientacion?: string | null
          horas_acreditadas?: number | null
          legajo?: number | null
          dni?: number | null
          correo?: string | null
          telefono?: string | null
          trabaja?: boolean | null
          certificado_trabajo?: string | null
          cv_url?: string | null
        }
      }
      instituciones: {
        Row: {
          id: string
          created_at: string
          nombre: string | null
          direccion: string | null
          telefono: string | null
          convenio_nuevo: string | boolean | null
          tutor: string | null
          codigo_tarjeta_campus: string | null
          orientaciones: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          nombre?: string | null
          direccion?: string | null
          telefono?: string | null
          convenio_nuevo?: string | boolean | null
          tutor?: string | null
          codigo_tarjeta_campus?: string | null
          orientaciones?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          nombre?: string | null
          direccion?: string | null
          telefono?: string | null
          convenio_nuevo?: string | boolean | null
          tutor?: string | null
          codigo_tarjeta_campus?: string | null
          orientaciones?: string | null
        }
      }
      solicitudes_pps: {
        Row: {
          id: string
          created_at: string
          estudiante_id: string | null
          nombre_institucion: string | null
          estado_seguimiento: string | null
          actualizacion: string | null
          notas: string | null
          nombre_alumno: string | null
          legajo: string | null
          email: string | null
          orientacion_sugerida: string | null
          localidad: string | null
          direccion_completa: string | null
          email_institucion: string | null
          telefono_institucion: string | null
          referente_institucion: string | null
          convenio_uflo: string | null
          tutor_disponible: string | null
          contacto_tutor: string | null
          tipo_practica: string | null
          descripcion_institucion: string | null
          airtable_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          estudiante_id?: string | null
          nombre_institucion?: string | null
          estado_seguimiento?: string | null
          actualizacion?: string | null
          notas?: string | null
          nombre_alumno?: string | null
          legajo?: string | null
          email?: string | null
          orientacion_sugerida?: string | null
          localidad?: string | null
          direccion_completa?: string | null
          email_institucion?: string | null
          telefono_institucion?: string | null
          referente_institucion?: string | null
          convenio_uflo?: string | null
          tutor_disponible?: string | null
          contacto_tutor?: string | null
          tipo_practica?: string | null
          descripcion_institucion?: string | null
          airtable_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          estudiante_id?: string | null
          nombre_institucion?: string | null
          estado_seguimiento?: string | null
          actualizacion?: string | null
          notas?: string | null
          nombre_alumno?: string | null
          legajo?: string | null
          email?: string | null
          orientacion_sugerida?: string | null
          localidad?: string | null
          direccion_completa?: string | null
          email_institucion?: string | null
          telefono_institucion?: string | null
          referente_institucion?: string | null
          convenio_uflo?: string | null
          tutor_disponible?: string | null
          contacto_tutor?: string | null
          tipo_practica?: string | null
          descripcion_institucion?: string | null
          airtable_id?: string | null
        }
      }
      finalizacion_pps: {
        Row: {
          id: string
          created_at: string
          estudiante_id: string | null
          fecha_solicitud: string | null
          estado: string | null
          informe_final_url: Json | null
          planilla_horas_url: Json | null
          planilla_asistencia_url: Json | null
          sugerencias_mejoras: string | null
          airtable_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          estudiante_id?: string | null
          fecha_solicitud?: string | null
          estado?: string | null
          informe_final_url?: Json | null
          planilla_horas_url?: Json | null
          planilla_asistencia_url?: Json | null
          sugerencias_mejoras?: string | null
          airtable_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          estudiante_id?: string | null
          fecha_solicitud?: string | null
          estado?: string | null
          informe_final_url?: Json | null
          planilla_horas_url?: Json | null
          planilla_asistencia_url?: Json | null
          sugerencias_mejoras?: string | null
          airtable_id?: string | null
        }
      }
      penalizaciones: {
        Row: {
          id: string
          created_at: string
          estudiante_id: string | null
          tipo_incumplimiento: string | null
          fecha_incidente: string | null
          notas: string | null
          puntaje_penalizacion: number | null
          convocatoria_afectada: string | null
          airtable_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          estudiante_id?: string | null
          tipo_incumplimiento?: string | null
          fecha_incidente?: string | null
          notas?: string | null
          puntaje_penalizacion?: number | null
          convocatoria_afectada?: string | null
          airtable_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          estudiante_id?: string | null
          tipo_incumplimiento?: string | null
          fecha_incidente?: string | null
          notas?: string | null
          puntaje_penalizacion?: number | null
          convocatoria_afectada?: string | null
          airtable_id?: string | null
        }
      }
      app_config: {
        Row: {
          id: number
          horas_objetivo_total: number
          horas_objetivo_orientacion: number
          rotacion_objetivo: number
          created_at: string
        }
        Insert: {
          id?: number
          horas_objetivo_total?: number
          horas_objetivo_orientacion?: number
          rotacion_objetivo?: number
          created_at?: string
        }
        Update: {
          id?: number
          horas_objetivo_total?: number
          horas_objetivo_orientacion?: number
          rotacion_objetivo?: number
          created_at?: string
        }
      }
      auth_users: {
        Row: {
          id: string
          created_at: string
          legajo: string | null
          nombre: string | null
          password_hash: string | null
          salt: string | null
          role: string | null
          orientaciones: string[] | null
        }
        Insert: {
          id?: string
          created_at?: string
          legajo?: string | null
          nombre?: string | null
          password_hash?: string | null
          salt?: string | null
          role?: string | null
          orientaciones?: string[] | null
        }
        Update: {
          id?: string
          created_at?: string
          legajo?: string | null
          nombre?: string | null
          password_hash?: string | null
          salt?: string | null
          role?: string | null
          orientaciones?: string[] | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
