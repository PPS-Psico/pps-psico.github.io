export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          created_at: string
          horas_objetivo_orientacion: number
          horas_objetivo_total: number
          id: number
          rotacion_objetivo: number
        }
        Insert: {
          created_at?: string
          horas_objetivo_orientacion?: number
          horas_objetivo_total?: number
          id?: number
          rotacion_objetivo?: number
        }
        Update: {
          created_at?: string
          horas_objetivo_orientacion?: number
          horas_objetivo_total?: number
          id?: number
          rotacion_objetivo?: number
        }
        Relationships: []
      }
      convocatorias: {
        Row: {
          airtable_id: string | null
          certificado_trabajo: string | null
          certificado_url: string | null
          correo: string | null
          created_at: string | null
          cursando_electivas: string | null
          cv_url: string | null
          direccion: string | null
          dni: number | null
          estado_inscripcion: string | null
          estudiante_id: string | null
          fecha_entrega_informe: string | null
          fecha_finalizacion: string | null
          fecha_inicio: string | null
          fecha_nacimiento: string | null
          finales_adeuda: string | null
          horario_seleccionado: string | null
          horas_acreditadas: number | null
          id: string
          informe_subido: boolean | null
          lanzamiento_id: string | null
          legajo: number | null
          nombre_pps: string | null
          orientacion: string | null
          otra_situacion_academica: string | null
          telefono: string | null
          termino_cursar: string | null
          trabaja: boolean | null
        }
        Insert: {
          airtable_id?: string | null
          certificado_trabajo?: string | null
          certificado_url?: string | null
          correo?: string | null
          created_at?: string | null
          cursando_electivas?: string | null
          cv_url?: string | null
          direccion?: string | null
          dni?: number | null
          estado_inscripcion?: string | null
          estudiante_id?: string | null
          fecha_entrega_informe?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          fecha_nacimiento?: string | null
          finales_adeuda?: string | null
          horario_seleccionado?: string | null
          horas_acreditadas?: number | null
          id?: string
          informe_subido?: boolean | null
          lanzamiento_id?: string | null
          legajo?: number | null
          nombre_pps?: string | null
          orientacion?: string | null
          otra_situacion_academica?: string | null
          telefono?: string | null
          termino_cursar?: string | null
          trabaja?: boolean | null
        }
        Update: {
          airtable_id?: string | null
          certificado_trabajo?: string | null
          certificado_url?: string | null
          correo?: string | null
          created_at?: string | null
          cursando_electivas?: string | null
          cv_url?: string | null
          direccion?: string | null
          dni?: number | null
          estado_inscripcion?: string | null
          estudiante_id?: string | null
          fecha_entrega_informe?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          fecha_nacimiento?: string | null
          finales_adeuda?: string | null
          horario_seleccionado?: string | null
          horas_acreditadas?: number | null
          id?: string
          informe_subido?: boolean | null
          lanzamiento_id?: string | null
          legajo?: number | null
          nombre_pps?: string | null
          orientacion?: string | null
          otra_situacion_academica?: string | null
          telefono?: string | null
          termino_cursar?: string | null
          trabaja?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "convocatorias_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocatorias_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          subject: string
          updated_at: string
          updated_by: string | null
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          subject: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          subject?: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
      estudiantes: {
        Row: {
          apellido_separado: string | null
          certificado_trabajo: string | null
          correo: string | null
          created_at: string
          dni: number | null
          estado: string | null
          fecha_finalizacion: string | null
          fecha_nacimiento: string | null
          genero: string | null
          id: string
          legajo: string
          must_change_password: boolean | null
          nombre: string | null
          nombre_separado: string | null
          notas_internas: string | null
          orientacion_elegida: string | null
          role: string | null
          telefono: string | null
          trabaja: boolean | null
          user_id: string | null
        }
        Insert: {
          apellido_separado?: string | null
          certificado_trabajo?: string | null
          correo?: string | null
          created_at?: string
          dni?: number | null
          estado?: string | null
          fecha_finalizacion?: string | null
          fecha_nacimiento?: string | null
          genero?: string | null
          id?: string
          legajo: string
          must_change_password?: boolean | null
          nombre?: string | null
          nombre_separado?: string | null
          notas_internas?: string | null
          orientacion_elegida?: string | null
          role?: string | null
          telefono?: string | null
          trabaja?: boolean | null
          user_id?: string | null
        }
        Update: {
          apellido_separado?: string | null
          certificado_trabajo?: string | null
          correo?: string | null
          created_at?: string
          dni?: number | null
          estado?: string | null
          fecha_finalizacion?: string | null
          fecha_nacimiento?: string | null
          genero?: string | null
          id?: string
          legajo?: string
          must_change_password?: boolean | null
          nombre?: string | null
          nombre_separado?: string | null
          notas_internas?: string | null
          orientacion_elegida?: string | null
          role?: string | null
          telefono?: string | null
          trabaja?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      finalizacion_pps: {
        Row: {
          certificado_url: string | null
          created_at: string
          estado: string | null
          estudiante_id: string | null
          fecha_solicitud: string | null
          id: string
          informe_final_url: string | null
          planilla_asistencia_url: string | null
          planilla_horas_url: string | null
          sugerencias_mejoras: string | null
        }
        Insert: {
          certificado_url?: string | null
          created_at?: string
          estado?: string | null
          estudiante_id?: string | null
          fecha_solicitud?: string | null
          id?: string
          informe_final_url?: string | null
          planilla_asistencia_url?: string | null
          planilla_horas_url?: string | null
          sugerencias_mejoras?: string | null
        }
        Update: {
          certificado_url?: string | null
          created_at?: string
          estado?: string | null
          estudiante_id?: string | null
          fecha_solicitud?: string | null
          id?: string
          informe_final_url?: string | null
          planilla_asistencia_url?: string | null
          planilla_horas_url?: string | null
          sugerencias_mejoras?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finalizacion_pps_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
        ]
      }
      instituciones: {
        Row: {
          codigo_tarjeta_campus: string | null
          convenio_nuevo: string | null
          created_at: string
          direccion: string | null
          id: string
          nombre: string | null
          orientaciones: string | null
          telefono: string | null
          tutor: string | null
        }
        Insert: {
          codigo_tarjeta_campus?: string | null
          convenio_nuevo?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string | null
          orientaciones?: string | null
          telefono?: string | null
          tutor?: string | null
        }
        Update: {
          codigo_tarjeta_campus?: string | null
          convenio_nuevo?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string | null
          orientaciones?: string | null
          telefono?: string | null
          tutor?: string | null
        }
        Relationships: []
      }
      lanzamientos_pps: {
        Row: {
          codigo_tarjeta_campus: string | null
          created_at: string
          cupos_disponibles: number | null
          direccion: string | null
          estado_convocatoria: string | null
          estado_gestion: string | null
          fecha_finalizacion: string | null
          fecha_inicio: string | null
          fecha_relanzamiento: string | null
          horario_seleccionado: string | null
          horas_acreditadas: number | null
          id: string
          informe: string | null
          nombre_pps: string | null
          notas_gestion: string | null
          orientacion: string | null
          permite_certificado: boolean | null
          plantilla_seguro_url: string | null
          req_certificado_trabajo: boolean | null
          req_cv: boolean | null
          vigencia_convenio: string | null
        }
        Insert: {
          codigo_tarjeta_campus?: string | null
          created_at?: string
          cupos_disponibles?: number | null
          direccion?: string | null
          estado_convocatoria?: string | null
          estado_gestion?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          fecha_relanzamiento?: string | null
          horario_seleccionado?: string | null
          horas_acreditadas?: number | null
          id?: string
          informe?: string | null
          nombre_pps?: string | null
          notas_gestion?: string | null
          orientacion?: string | null
          permite_certificado?: boolean | null
          plantilla_seguro_url?: string | null
          req_certificado_trabajo?: boolean | null
          req_cv?: boolean | null
          vigencia_convenio?: string | null
        }
        Update: {
          codigo_tarjeta_campus?: string | null
          created_at?: string
          cupos_disponibles?: number | null
          direccion?: string | null
          estado_convocatoria?: string | null
          estado_gestion?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          fecha_relanzamiento?: string | null
          horario_seleccionado?: string | null
          horas_acreditadas?: number | null
          id?: string
          informe?: string | null
          nombre_pps?: string | null
          notas_gestion?: string | null
          orientacion?: string | null
          permite_certificado?: boolean | null
          plantilla_seguro_url?: string | null
          req_certificado_trabajo?: boolean | null
          req_cv?: boolean | null
          vigencia_convenio?: string | null
        }
        Relationships: []
      }
      penalizaciones: {
        Row: {
          convocatoria_afectada: string | null
          created_at: string
          estudiante_id: string | null
          fecha_incidente: string | null
          id: string
          notas: string | null
          puntaje_penalizacion: number | null
          tipo_incumplimiento: string | null
        }
        Insert: {
          convocatoria_afectada?: string | null
          created_at?: string
          estudiante_id?: string | null
          fecha_incidente?: string | null
          id?: string
          notas?: string | null
          puntaje_penalizacion?: number | null
          tipo_incumplimiento?: string | null
        }
        Update: {
          convocatoria_afectada?: string | null
          created_at?: string
          estudiante_id?: string | null
          fecha_incidente?: string | null
          id?: string
          notas?: string | null
          puntaje_penalizacion?: number | null
          tipo_incumplimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "penalizaciones_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
        ]
      }
      practicas: {
        Row: {
          created_at: string
          especialidad: string | null
          estado: string | null
          estudiante_id: string | null
          fecha_finalizacion: string | null
          fecha_inicio: string | null
          horas_realizadas: number | null
          id: string
          institucion_id: string | null
          lanzamiento_id: string | null
          legajo_busqueda: string[] | null
          nombre_institucion: string[] | null
          nota: string | null
          tutor_evaluacion: string | null
        }
        Insert: {
          created_at?: string
          especialidad?: string | null
          estado?: string | null
          estudiante_id?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          horas_realizadas?: number | null
          id?: string
          institucion_id?: string | null
          lanzamiento_id?: string | null
          legajo_busqueda?: string[] | null
          nombre_institucion?: string[] | null
          nota?: string | null
          tutor_evaluacion?: string | null
        }
        Update: {
          created_at?: string
          especialidad?: string | null
          estado?: string | null
          estudiante_id?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          horas_realizadas?: number | null
          id?: string
          institucion_id?: string | null
          lanzamiento_id?: string | null
          legajo_busqueda?: string[] | null
          nombre_institucion?: string[] | null
          nota?: string | null
          tutor_evaluacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practicas_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practicas_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practicas_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: number
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: number
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      solicitudes_pps: {
        Row: {
          actualizacion: string | null
          contacto_tutor: string | null
          convenio_uflo: string | null
          created_at: string
          descripcion_institucion: string | null
          direccion_completa: string | null
          email: string | null
          email_institucion: string | null
          estado_seguimiento: string | null
          estudiante_id: string | null
          id: string
          legajo: string | null
          localidad: string | null
          nombre_alumno: string | null
          nombre_institucion: string | null
          notas: string | null
          orientacion_sugerida: string | null
          referente_institucion: string | null
          telefono_institucion: string | null
          tipo_practica: string | null
          tutor_disponible: string | null
          web_institucion: string | null
        }
        Insert: {
          actualizacion?: string | null
          contacto_tutor?: string | null
          convenio_uflo?: string | null
          created_at?: string
          descripcion_institucion?: string | null
          direccion_completa?: string | null
          email?: string | null
          email_institucion?: string | null
          estado_seguimiento?: string | null
          estudiante_id?: string | null
          id?: string
          legajo?: string | null
          localidad?: string | null
          nombre_alumno?: string | null
          nombre_institucion?: string | null
          notas?: string | null
          orientacion_sugerida?: string | null
          referente_institucion?: string | null
          telefono_institucion?: string | null
          tipo_practica?: string | null
          tutor_disponible?: string | null
          web_institucion?: string | null
        }
        Update: {
          actualizacion?: string | null
          contacto_tutor?: string | null
          convenio_uflo?: string | null
          created_at?: string
          descripcion_institucion?: string | null
          direccion_completa?: string | null
          email?: string | null
          email_institucion?: string | null
          estado_seguimiento?: string | null
          estudiante_id?: string | null
          id?: string
          legajo?: string | null
          localidad?: string | null
          nombre_alumno?: string | null
          nombre_institucion?: string | null
          notas?: string | null
          orientacion_sugerida?: string | null
          referente_institucion?: string | null
          telefono_institucion?: string | null
          tipo_practica?: string | null
          tutor_disponible?: string | null
          web_institucion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_pps_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_email: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      clean_dirty_text: {
        Args: {
          dirty_text: string
        }
        Returns: string
      }
      get_dashboard_metrics: {
        Args: {
          p_anio?: number
        }
        Returns: Json
      }
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_postulantes_seleccionados: {
        Args: {
          lanzamiento_uuid: string
        }
        Returns: Json
      }
      get_seleccionados: {
        Args: {
          lanzamiento_id_input: string
        }
        Returns: Json
      }
      get_student_email_by_legajo: {
        Args: {
          legajo_input: string
        }
        Returns: string
      }
      gtrgm_compress: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      gtrgm_in: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      gtrgm_options: {
        Args: {
          "": unknown
        }
        Returns: undefined
      }
      gtrgm_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      handle_seleccion_alumno: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      mark_password_changed: {
        Args: {
          user_uuid: string
        }
        Returns: undefined
      }
      set_limit: {
        Args: {
          "": number
        }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: {
          "": string
        }
        Returns: string[]
      }
      similarity: {
        Args: {
          "": string
          "": string
        }
        Returns: number
      }
      similarity_dist: {
        Args: {
          "": string
          "": string
        }
        Returns: number
      }
      strict_word_similarity: {
        Args: {
          "": string
          "": string
        }
        Returns: number
      }
      strict_word_similarity_dist: {
        Args: {
          "": string
          "": string
        }
        Returns: number
      }
      word_similarity: {
        Args: {
          "": string
          "": string
        }
        Returns: number
      }
      word_similarity_dist: {
        Args: {
          "": string
          "": string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
  | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
    PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
    PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
  | keyof PublicSchema["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
  | keyof PublicSchema["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
  | keyof PublicSchema["Enums"]
  | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof PublicSchema["CompositeTypes"]
  | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
  ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never
