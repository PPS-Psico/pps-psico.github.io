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
      admin_action_log: {
        Row: {
          action_type: string
          actor_legajo: string | null
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          summary: string
          target_id: string
          target_table: string
        }
        Insert: {
          action_type: string
          actor_legajo?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          summary: string
          target_id: string
          target_table: string
        }
        Update: {
          action_type?: string
          actor_legajo?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          summary?: string
          target_id?: string
          target_table?: string
        }
        Relationships: []
      }
      agent_audit_log: {
        Row: {
          duration_ms: number | null
          error: string | null
          id: string
          input: Json | null
          invocation_id: string
          output: Json | null
          suggestion_id: string | null
          timestamp: string
          tool: string
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          invocation_id: string
          output?: Json | null
          suggestion_id?: string | null
          timestamp?: string
          tool: string
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          invocation_id?: string
          output?: Json | null
          suggestion_id?: string | null
          timestamp?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_audit_log_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "agent_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_suggestions: {
        Row: {
          contexto: Json | null
          created_at: string
          edited_payload: Json | null
          estado: string
          expires_at: string | null
          id: string
          institucion_id: string | null
          lanzamiento_id: string | null
          payload: Json
          resolved_at: string | null
          resolved_by: string | null
          tipo: string
        }
        Insert: {
          contexto?: Json | null
          created_at?: string
          edited_payload?: Json | null
          estado?: string
          expires_at?: string | null
          id?: string
          institucion_id?: string | null
          lanzamiento_id?: string | null
          payload: Json
          resolved_at?: string | null
          resolved_by?: string | null
          tipo: string
        }
        Update: {
          contexto?: Json | null
          created_at?: string
          edited_payload?: Json | null
          estado?: string
          expires_at?: string | null
          id?: string
          institucion_id?: string | null
          lanzamiento_id?: string | null
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_suggestions_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_health_checks: {
        Row: {
          checked_at: string
          details: Json
          expected_snapshot_date: string | null
          health_version: string
          id: number
          issue_count: number
          issues: Json
          latest_snapshot_date: string | null
          latest_snapshot_status: string | null
          source: string
          status: string
        }
        Insert: {
          checked_at?: string
          details?: Json
          expected_snapshot_date?: string | null
          health_version: string
          id?: never
          issue_count?: number
          issues?: Json
          latest_snapshot_date?: string | null
          latest_snapshot_status?: string | null
          source: string
          status: string
        }
        Update: {
          checked_at?: string
          details?: Json
          expected_snapshot_date?: string | null
          health_version?: string
          id?: never
          issue_count?: number
          issues?: Json
          latest_snapshot_date?: string | null
          latest_snapshot_status?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      analytics_metric_snapshots: {
        Row: {
          denominator: number | null
          dimension_key: string
          id: number
          metric_key: string
          metric_version: string
          numerator: number | null
          quality: Json
          snapshot_date: string
          taken_at: string
          value: number
        }
        Insert: {
          denominator?: number | null
          dimension_key?: string
          id?: never
          metric_key: string
          metric_version: string
          numerator?: number | null
          quality?: Json
          snapshot_date: string
          taken_at?: string
          value: number
        }
        Update: {
          denominator?: number | null
          dimension_key?: string
          id?: never
          metric_key?: string
          metric_version?: string
          numerator?: number | null
          quality?: Json
          snapshot_date?: string
          taken_at?: string
          value?: number
        }
        Relationships: []
      }
      analytics_snapshot_runs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: number
          rows_written: number
          started_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: never
          rows_written?: number
          started_at?: string
          status: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: never
          rows_written?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
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
      aula_entregas: {
        Row: {
          academic_year: number | null
          activo: boolean
          area: string
          course_id: number
          created_at: string
          grade_conversion_mode: string
          gradebook_position: number | null
          id: number
          institucion: string
          moodle_grade_item_id: number | null
          moodle_grade_max: number | null
          moodle_id: string
          moodle_name: string | null
          orden: number | null
          source_synced_at: string | null
        }
        Insert: {
          academic_year?: number | null
          activo?: boolean
          area: string
          course_id?: number
          created_at?: string
          grade_conversion_mode?: string
          gradebook_position?: number | null
          id?: never
          institucion: string
          moodle_grade_item_id?: number | null
          moodle_grade_max?: number | null
          moodle_id: string
          moodle_name?: string | null
          orden?: number | null
          source_synced_at?: string | null
        }
        Update: {
          academic_year?: number | null
          activo?: boolean
          area?: string
          course_id?: number
          created_at?: string
          grade_conversion_mode?: string
          gradebook_position?: number | null
          id?: never
          institucion?: string
          moodle_grade_item_id?: number | null
          moodle_grade_max?: number | null
          moodle_id?: string
          moodle_name?: string | null
          orden?: number | null
          source_synced_at?: string | null
        }
        Relationships: []
      }
      backup_config: {
        Row: {
          backup_time: string | null
          created_at: string | null
          enabled: boolean | null
          frequency: string
          id: string
          include_tables: string[] | null
          last_backup_at: string | null
          retain_count: number | null
          storage_bucket: string | null
          updated_at: string | null
        }
        Insert: {
          backup_time?: string | null
          created_at?: string | null
          enabled?: boolean | null
          frequency?: string
          id?: string
          include_tables?: string[] | null
          last_backup_at?: string | null
          retain_count?: number | null
          storage_bucket?: string | null
          updated_at?: string | null
        }
        Update: {
          backup_time?: string | null
          created_at?: string | null
          enabled?: boolean | null
          frequency?: string
          id?: string
          include_tables?: string[] | null
          last_backup_at?: string | null
          retain_count?: number | null
          storage_bucket?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      backup_history: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_by: string | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          record_count: number | null
          started_at: string | null
          status: string
          storage_path: string | null
          tables_backed_up: string[] | null
        }
        Insert: {
          backup_type?: string
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          record_count?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          tables_backed_up?: string[] | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          record_count?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          tables_backed_up?: string[] | null
        }
        Relationships: []
      }
      compromisos_pps: {
        Row: {
          accepted_at: string | null
          acepta_compromiso: boolean
          acepta_lectura: boolean
          convocatoria_id: string
          created_at: string | null
          dni: number | null
          estado: string
          estudiante_id: string
          firma_texto: string
          id: string
          lanzamiento_id: string
          legajo: string
          nombre_completo: string
          texto_acta: string
          updated_at: string | null
          version: string
        }
        Insert: {
          accepted_at?: string | null
          acepta_compromiso?: boolean
          acepta_lectura?: boolean
          convocatoria_id: string
          created_at?: string | null
          dni?: number | null
          estado?: string
          estudiante_id: string
          firma_texto: string
          id?: string
          lanzamiento_id: string
          legajo: string
          nombre_completo: string
          texto_acta: string
          updated_at?: string | null
          version: string
        }
        Update: {
          accepted_at?: string | null
          acepta_compromiso?: boolean
          acepta_lectura?: boolean
          convocatoria_id?: string
          created_at?: string | null
          dni?: number | null
          estado?: string
          estudiante_id?: string
          firma_texto?: string
          id?: string
          lanzamiento_id?: string
          legajo?: string
          nombre_completo?: string
          texto_acta?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "compromisos_pps_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: true
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromisos_pps_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromisos_pps_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          archivo_url: string | null
          created_at: string
          es_renovacion: boolean
          fecha_firma: string
          fecha_vencimiento: string | null
          id: string
          institucion_id: string
          notas: string | null
          tipo: string
        }
        Insert: {
          archivo_url?: string | null
          created_at?: string
          es_renovacion?: boolean
          fecha_firma: string
          fecha_vencimiento?: string | null
          id?: string
          institucion_id: string
          notas?: string | null
          tipo?: string
        }
        Update: {
          archivo_url?: string | null
          created_at?: string
          es_renovacion?: boolean
          fecha_firma?: string
          fecha_vencimiento?: string | null
          id?: string
          institucion_id?: string
          notas?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenios_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
        ]
      }
      convocatoria_preferencias: {
        Row: {
          convocatoria_id: string
          created_at: string
          id: string
          opcion_horario_id: string | null
          opcion_id: string
          prioridad: number
        }
        Insert: {
          convocatoria_id: string
          created_at?: string
          id?: string
          opcion_horario_id?: string | null
          opcion_id: string
          prioridad: number
        }
        Update: {
          convocatoria_id?: string
          created_at?: string
          id?: string
          opcion_horario_id?: string | null
          opcion_id?: string
          prioridad?: number
        }
        Relationships: [
          {
            foreignKeyName: "convocatoria_preferencias_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocatoria_preferencias_opcion_horario_id_fkey"
            columns: ["opcion_horario_id"]
            isOneToOne: false
            referencedRelation: "lanzamiento_opcion_horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocatoria_preferencias_opcion_id_fkey"
            columns: ["opcion_id"]
            isOneToOne: false
            referencedRelation: "lanzamiento_opciones"
            referencedColumns: ["id"]
          },
        ]
      }
      convocatorias: {
        Row: {
          airtable_id: string | null
          baja_automatica_at: string | null
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
          final_reminder_claim_token: string | null
          final_reminder_claimed_at: string | null
          final_reminder_claimed_by: string | null
          final_reminder_sent_at: string | null
          final_reminder_sent_by: string | null
          finales_adeuda: string | null
          horario_asignado: string | null
          horario_seleccionado: string | null
          horas_acreditadas: number | null
          id: string
          informe_subido: boolean | null
          lanzamiento_id: string | null
          legajo: number | null
          nombre_pps: string | null
          opcion_asignada_id: string | null
          opcion_horario_asignado_id: string | null
          orientacion: string | null
          otra_situacion_academica: string | null
          reminder_sent_at: string | null
          selected_at: string | null
          selection_decided_at: string | null
          telefono: string | null
          termino_cursar: string | null
          trabaja: boolean | null
        }
        Insert: {
          airtable_id?: string | null
          baja_automatica_at?: string | null
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
          final_reminder_claim_token?: string | null
          final_reminder_claimed_at?: string | null
          final_reminder_claimed_by?: string | null
          final_reminder_sent_at?: string | null
          final_reminder_sent_by?: string | null
          finales_adeuda?: string | null
          horario_asignado?: string | null
          horario_seleccionado?: string | null
          horas_acreditadas?: number | null
          id?: string
          informe_subido?: boolean | null
          lanzamiento_id?: string | null
          legajo?: number | null
          nombre_pps?: string | null
          opcion_asignada_id?: string | null
          opcion_horario_asignado_id?: string | null
          orientacion?: string | null
          otra_situacion_academica?: string | null
          reminder_sent_at?: string | null
          selected_at?: string | null
          selection_decided_at?: string | null
          telefono?: string | null
          termino_cursar?: string | null
          trabaja?: boolean | null
        }
        Update: {
          airtable_id?: string | null
          baja_automatica_at?: string | null
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
          final_reminder_claim_token?: string | null
          final_reminder_claimed_at?: string | null
          final_reminder_claimed_by?: string | null
          final_reminder_sent_at?: string | null
          final_reminder_sent_by?: string | null
          finales_adeuda?: string | null
          horario_asignado?: string | null
          horario_seleccionado?: string | null
          horas_acreditadas?: number | null
          id?: string
          informe_subido?: boolean | null
          lanzamiento_id?: string | null
          legajo?: number | null
          nombre_pps?: string | null
          opcion_asignada_id?: string | null
          opcion_horario_asignado_id?: string | null
          orientacion?: string | null
          otra_situacion_academica?: string | null
          reminder_sent_at?: string | null
          selected_at?: string | null
          selection_decided_at?: string | null
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
          {
            foreignKeyName: "convocatorias_opcion_asignada_id_fkey"
            columns: ["opcion_asignada_id"]
            isOneToOne: false
            referencedRelation: "lanzamiento_opciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocatorias_opcion_horario_asignado_id_fkey"
            columns: ["opcion_horario_asignado_id"]
            isOneToOne: false
            referencedRelation: "lanzamiento_opcion_horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_convocatoria_estudiante"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_convocatoria_lanzamiento"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_logs: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          msg: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          msg?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          msg?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          id: string
          is_active: boolean | null
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          id: string
          is_active?: boolean | null
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          id?: string
          is_active?: boolean | null
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      estudiantes: {
        Row: {
          airtable_id: string | null
          apellido_separado: string | null
          certificado_trabajo: string | null
          cohorte: number | null
          correo: string | null
          created_at: string | null
          dni: number | null
          estado: string | null
          fecha_finalizacion: string | null
          fecha_nacimiento: string | null
          genero: string | null
          id: string
          legajo: string | null
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
          airtable_id?: string | null
          apellido_separado?: string | null
          certificado_trabajo?: string | null
          cohorte?: number | null
          correo?: string | null
          created_at?: string | null
          dni?: number | null
          estado?: string | null
          fecha_finalizacion?: string | null
          fecha_nacimiento?: string | null
          genero?: string | null
          id?: string
          legajo?: string | null
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
          airtable_id?: string | null
          apellido_separado?: string | null
          certificado_trabajo?: string | null
          cohorte?: number | null
          correo?: string | null
          created_at?: string | null
          dni?: number | null
          estado?: string | null
          fecha_finalizacion?: string | null
          fecha_nacimiento?: string | null
          genero?: string | null
          id?: string
          legajo?: string | null
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
      fcm_tokens: {
        Row: {
          created_at: string | null
          fcm_token: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fcm_token: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fcm_token?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      finalizacion_pps: {
        Row: {
          airtable_id: string | null
          certificado_url: Json | null
          created_at: string | null
          detalle_practicas: Json | null
          estado: string | null
          estudiante_id: string | null
          fecha_solicitud: string | null
          id: string
          informe_final_url: Json | null
          planilla_asistencia_url: Json | null
          planilla_horas_url: Json | null
          sugerencias_mejoras: string | null
        }
        Insert: {
          airtable_id?: string | null
          certificado_url?: Json | null
          created_at?: string | null
          detalle_practicas?: Json | null
          estado?: string | null
          estudiante_id?: string | null
          fecha_solicitud?: string | null
          id?: string
          informe_final_url?: Json | null
          planilla_asistencia_url?: Json | null
          planilla_horas_url?: Json | null
          sugerencias_mejoras?: string | null
        }
        Update: {
          airtable_id?: string | null
          certificado_url?: Json | null
          created_at?: string | null
          detalle_practicas?: Json | null
          estado?: string | null
          estudiante_id?: string | null
          fecha_solicitud?: string | null
          id?: string
          informe_final_url?: Json | null
          planilla_asistencia_url?: Json | null
          planilla_horas_url?: Json | null
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
          {
            foreignKeyName: "fk_finalizacion_estudiante"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_hilos: {
        Row: {
          asunto: string | null
          clasificacion: string | null
          estado: string
          ingested_at: string
          institucion_id: string | null
          participantes: Json | null
          primer_mensaje_at: string | null
          raw_mensajes: Json | null
          thread_id: string
          ultimo_mensaje_at: string | null
          ultimo_mensaje_de: string | null
          updated_at: string
        }
        Insert: {
          asunto?: string | null
          clasificacion?: string | null
          estado?: string
          ingested_at?: string
          institucion_id?: string | null
          participantes?: Json | null
          primer_mensaje_at?: string | null
          raw_mensajes?: Json | null
          thread_id: string
          ultimo_mensaje_at?: string | null
          ultimo_mensaje_de?: string | null
          updated_at?: string
        }
        Update: {
          asunto?: string | null
          clasificacion?: string | null
          estado?: string
          ingested_at?: string
          institucion_id?: string | null
          participantes?: Json | null
          primer_mensaje_at?: string | null
          raw_mensajes?: Json | null
          thread_id?: string
          ultimo_mensaje_at?: string | null
          ultimo_mensaje_de?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      institucion_resumen: {
        Row: {
          actualizado_at: string
          institucion_id: string
          pendientes_concretos: Json | null
          resumen: string
          ultimo_canal: string | null
          ultimo_contacto_at: string | null
          version_prompt: string | null
        }
        Insert: {
          actualizado_at?: string
          institucion_id: string
          pendientes_concretos?: Json | null
          resumen: string
          ultimo_canal?: string | null
          ultimo_contacto_at?: string | null
          version_prompt?: string | null
        }
        Update: {
          actualizado_at?: string
          institucion_id?: string
          pendientes_concretos?: Json | null
          resumen?: string
          ultimo_canal?: string | null
          ultimo_contacto_at?: string | null
          version_prompt?: string | null
        }
        Relationships: []
      }
      instituciones: {
        Row: {
          airtable_id: string | null
          codigo_tarjeta_campus: string | null
          convenio_nuevo: number | null
          created_at: string | null
          direccion: string | null
          id: string
          logo_invert_dark: boolean | null
          logo_url: string | null
          nombre: string | null
          orientaciones: string | null
          telefono: string | null
          tutor: string | null
        }
        Insert: {
          airtable_id?: string | null
          codigo_tarjeta_campus?: string | null
          convenio_nuevo?: number | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          logo_invert_dark?: boolean | null
          logo_url?: string | null
          nombre?: string | null
          orientaciones?: string | null
          telefono?: string | null
          tutor?: string | null
        }
        Update: {
          airtable_id?: string | null
          codigo_tarjeta_campus?: string | null
          convenio_nuevo?: number | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          logo_invert_dark?: boolean | null
          logo_url?: string | null
          nombre?: string | null
          orientaciones?: string | null
          telefono?: string | null
          tutor?: string | null
        }
        Relationships: []
      }
      lanzamiento_moodle_tareas: {
        Row: {
          aula_entrega_id: number
          created_at: string
          id: number
          lanzamiento_id: string
          link_source: string
          orientacion_key: string
          rationale: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          aula_entrega_id: number
          created_at?: string
          id?: never
          lanzamiento_id: string
          link_source: string
          orientacion_key: string
          rationale?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Update: {
          aula_entrega_id?: number
          created_at?: string
          id?: never
          lanzamiento_id?: string
          link_source?: string
          orientacion_key?: string
          rationale?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lanzamiento_moodle_tareas_aula_entrega_id_fkey"
            columns: ["aula_entrega_id"]
            isOneToOne: false
            referencedRelation: "aula_entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lanzamiento_moodle_tareas_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      lanzamiento_opcion_horarios: {
        Row: {
          activa: boolean
          created_at: string
          cupos: number
          horario: string
          id: string
          opcion_id: string
          orden: number
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          cupos: number
          horario: string
          id?: string
          opcion_id: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          cupos?: number
          horario?: string
          id?: string
          opcion_id?: string
          orden?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lanzamiento_opcion_horarios_opcion_id_fkey"
            columns: ["opcion_id"]
            isOneToOne: false
            referencedRelation: "lanzamiento_opciones"
            referencedColumns: ["id"]
          },
        ]
      }
      lanzamiento_opciones: {
        Row: {
          activa: boolean
          actividades: string[]
          created_at: string
          cupos: number
          horarios: string[]
          id: string
          lanzamiento_id: string
          nombre: string
          orden: number
          orientacion: string
          requisitos: string[]
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          actividades?: string[]
          created_at?: string
          cupos: number
          horarios?: string[]
          id?: string
          lanzamiento_id: string
          nombre: string
          orden?: number
          orientacion: string
          requisitos?: string[]
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          actividades?: string[]
          created_at?: string
          cupos?: number
          horarios?: string[]
          id?: string
          lanzamiento_id?: string
          nombre?: string
          orden?: number
          orientacion?: string
          requisitos?: string[]
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lanzamiento_opciones_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      lanzamientos_pps: {
        Row: {
          actividades_label: string | null
          actividades_lista: string[] | null
          airtable_id: string | null
          archivo_descargable_nombre: string | null
          archivo_descargable_url: string | null
          codigo_tarjeta_campus: string | null
          created_at: string | null
          cupos_disponibles: number | null
          descripcion_larga: string | null
          direccion: string | null
          estado_convocatoria: string | null
          estado_gestion: string | null
          fecha_encuentro_inicial: string | null
          fecha_fin_inscripcion: string | null
          fecha_finalizacion: string | null
          fecha_inicio: string | null
          fecha_inicio_inscripcion: string | null
          fecha_publicacion: string | null
          fecha_relanzamiento: string | null
          finalizacion_por_horas: boolean
          historial_gestion: string | null
          horario_seleccionado: string | null
          horarios_fijos: boolean | null
          horarios_obligatorios: string[] | null
          horas_acreditadas: number | null
          id: string
          informe: string | null
          institucion_id: string | null
          lista_estudiantes_entregada_at: string | null
          lista_estudiantes_entregada_por: string | null
          mensaje_whatsapp: string | null
          modalidad_cupo: string
          moodle_pilot_dedicated: boolean
          nombre_pps: string | null
          notas_gestion: string | null
          orientacion: string | null
          permite_certificado: boolean | null
          plantilla_seguro_url: string | null
          plazo_inscripcion_dias: number | null
          proximo_seguimiento: string | null
          req_certificado_trabajo: boolean | null
          req_cv: boolean | null
          requisito_obligatorio: string | null
          seguro_gestionado_at: string | null
          seguro_gestionado_por: string | null
          selection_closed_at: string | null
          selection_closed_by: string | null
          tipo_actividad: string
          updated_at: string | null
        }
        Insert: {
          actividades_label?: string | null
          actividades_lista?: string[] | null
          airtable_id?: string | null
          archivo_descargable_nombre?: string | null
          archivo_descargable_url?: string | null
          codigo_tarjeta_campus?: string | null
          created_at?: string | null
          cupos_disponibles?: number | null
          descripcion_larga?: string | null
          direccion?: string | null
          estado_convocatoria?: string | null
          estado_gestion?: string | null
          fecha_encuentro_inicial?: string | null
          fecha_fin_inscripcion?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          fecha_inicio_inscripcion?: string | null
          fecha_publicacion?: string | null
          fecha_relanzamiento?: string | null
          finalizacion_por_horas?: boolean
          historial_gestion?: string | null
          horario_seleccionado?: string | null
          horarios_fijos?: boolean | null
          horarios_obligatorios?: string[] | null
          horas_acreditadas?: number | null
          id?: string
          informe?: string | null
          institucion_id?: string | null
          lista_estudiantes_entregada_at?: string | null
          lista_estudiantes_entregada_por?: string | null
          mensaje_whatsapp?: string | null
          modalidad_cupo?: string
          moodle_pilot_dedicated?: boolean
          nombre_pps?: string | null
          notas_gestion?: string | null
          orientacion?: string | null
          permite_certificado?: boolean | null
          plantilla_seguro_url?: string | null
          plazo_inscripcion_dias?: number | null
          proximo_seguimiento?: string | null
          req_certificado_trabajo?: boolean | null
          req_cv?: boolean | null
          requisito_obligatorio?: string | null
          seguro_gestionado_at?: string | null
          seguro_gestionado_por?: string | null
          selection_closed_at?: string | null
          selection_closed_by?: string | null
          tipo_actividad?: string
          updated_at?: string | null
        }
        Update: {
          actividades_label?: string | null
          actividades_lista?: string[] | null
          airtable_id?: string | null
          archivo_descargable_nombre?: string | null
          archivo_descargable_url?: string | null
          codigo_tarjeta_campus?: string | null
          created_at?: string | null
          cupos_disponibles?: number | null
          descripcion_larga?: string | null
          direccion?: string | null
          estado_convocatoria?: string | null
          estado_gestion?: string | null
          fecha_encuentro_inicial?: string | null
          fecha_fin_inscripcion?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          fecha_inicio_inscripcion?: string | null
          fecha_publicacion?: string | null
          fecha_relanzamiento?: string | null
          finalizacion_por_horas?: boolean
          historial_gestion?: string | null
          horario_seleccionado?: string | null
          horarios_fijos?: boolean | null
          horarios_obligatorios?: string[] | null
          horas_acreditadas?: number | null
          id?: string
          informe?: string | null
          institucion_id?: string | null
          lista_estudiantes_entregada_at?: string | null
          lista_estudiantes_entregada_por?: string | null
          mensaje_whatsapp?: string | null
          modalidad_cupo?: string
          moodle_pilot_dedicated?: boolean
          nombre_pps?: string | null
          notas_gestion?: string | null
          orientacion?: string | null
          permite_certificado?: boolean | null
          plantilla_seguro_url?: string | null
          plazo_inscripcion_dias?: number | null
          proximo_seguimiento?: string | null
          req_certificado_trabajo?: boolean | null
          req_cv?: boolean | null
          requisito_obligatorio?: string | null
          seguro_gestionado_at?: string | null
          seguro_gestionado_por?: string | null
          selection_closed_at?: string | null
          selection_closed_by?: string | null
          tipo_actividad?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      moodle_grade_import_batches: {
        Row: {
          accepted_count: number
          completed_at: string | null
          created_at: string
          details: Json
          file_name: string
          id: string
          observation_count: number
          observed_at: string
          rejected_count: number
          requested_by: string
          row_count: number
          snapshot_count: number
          source_type: string
          status: string
        }
        Insert: {
          accepted_count?: number
          completed_at?: string | null
          created_at?: string
          details?: Json
          file_name: string
          id?: string
          observation_count?: number
          observed_at: string
          rejected_count?: number
          requested_by: string
          row_count: number
          snapshot_count?: number
          source_type?: string
          status?: string
        }
        Update: {
          accepted_count?: number
          completed_at?: string | null
          created_at?: string
          details?: Json
          file_name?: string
          id?: string
          observation_count?: number
          observed_at?: string
          rejected_count?: number
          requested_by?: string
          row_count?: number
          snapshot_count?: number
          source_type?: string
          status?: string
        }
        Relationships: []
      }
      moodle_grade_observations: {
        Row: {
          aula_entrega_id: number
          auth_user_id: string
          bridge_version: string
          cmid: number
          confidence: string
          course_id: number
          estudiante_id: string
          grade_display: string | null
          grade_max: number | null
          grade_value: number | null
          graded_at_display: string | null
          id: string
          lanzamiento_id: string | null
          moodle_user_id: number | null
          moodle_username: string | null
          observed_at: string
          parser_version: string
          payload_hash: string
          practica_id: string
          received_at: string
          request_id: string
          submitted: boolean
          submitted_at: string | null
          submitted_at_display: string | null
          task_status: string
        }
        Insert: {
          aula_entrega_id: number
          auth_user_id: string
          bridge_version: string
          cmid: number
          confidence?: string
          course_id: number
          estudiante_id: string
          grade_display?: string | null
          grade_max?: number | null
          grade_value?: number | null
          graded_at_display?: string | null
          id?: string
          lanzamiento_id?: string | null
          moodle_user_id?: number | null
          moodle_username?: string | null
          observed_at: string
          parser_version: string
          payload_hash: string
          practica_id: string
          received_at?: string
          request_id: string
          submitted?: boolean
          submitted_at?: string | null
          submitted_at_display?: string | null
          task_status: string
        }
        Update: {
          aula_entrega_id?: number
          auth_user_id?: string
          bridge_version?: string
          cmid?: number
          confidence?: string
          course_id?: number
          estudiante_id?: string
          grade_display?: string | null
          grade_max?: number | null
          grade_value?: number | null
          graded_at_display?: string | null
          id?: string
          lanzamiento_id?: string | null
          moodle_user_id?: number | null
          moodle_username?: string | null
          observed_at?: string
          parser_version?: string
          payload_hash?: string
          practica_id?: string
          received_at?: string
          request_id?: string
          submitted?: boolean
          submitted_at?: string | null
          submitted_at_display?: string | null
          task_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "moodle_grade_observations_aula_entrega_id_fkey"
            columns: ["aula_entrega_id"]
            isOneToOne: false
            referencedRelation: "aula_entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_grade_observations_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_grade_observations_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_grade_observations_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practicas"
            referencedColumns: ["id"]
          },
        ]
      }
      moodle_grade_reopen_events: {
        Row: {
          cmid: number
          id: string
          new_revision: number
          practica_id: string
          previous_revision: number
          reason: string
          requested_at: string
          requested_by: string
        }
        Insert: {
          cmid: number
          id?: string
          new_revision: number
          practica_id: string
          previous_revision: number
          reason: string
          requested_at?: string
          requested_by?: string
        }
        Update: {
          cmid?: number
          id?: string
          new_revision?: number
          practica_id?: string
          previous_revision?: number
          reason?: string
          requested_at?: string
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "moodle_grade_reopen_events_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practicas"
            referencedColumns: ["id"]
          },
        ]
      }
      moodle_grade_snapshots: {
        Row: {
          aula_entrega_id: number
          cmid: number
          confidence: string
          estudiante_id: string
          grade_display: string | null
          grade_max: number | null
          grade_revision: number
          grade_value: number | null
          graded_at_display: string | null
          lanzamiento_id: string | null
          last_confidence: string
          last_grade_display: string | null
          last_grade_max: number | null
          last_grade_value: number | null
          last_graded_at_display: string | null
          last_observation_id: string
          last_observed_at: string
          last_received_at: string
          last_submitted: boolean
          last_task_status: string
          latest_observation_id: string
          observed_at: string
          practica_id: string
          received_at: string
          reopened_at: string | null
          scan_closed: boolean
          submitted: boolean
          submitted_at: string | null
          submitted_at_display: string | null
          task_status: string
        }
        Insert: {
          aula_entrega_id: number
          cmid: number
          confidence: string
          estudiante_id: string
          grade_display?: string | null
          grade_max?: number | null
          grade_revision?: number
          grade_value?: number | null
          graded_at_display?: string | null
          lanzamiento_id?: string | null
          last_confidence: string
          last_grade_display?: string | null
          last_grade_max?: number | null
          last_grade_value?: number | null
          last_graded_at_display?: string | null
          last_observation_id: string
          last_observed_at: string
          last_received_at: string
          last_submitted: boolean
          last_task_status: string
          latest_observation_id: string
          observed_at: string
          practica_id: string
          received_at: string
          reopened_at?: string | null
          scan_closed?: boolean
          submitted?: boolean
          submitted_at?: string | null
          submitted_at_display?: string | null
          task_status: string
        }
        Update: {
          aula_entrega_id?: number
          cmid?: number
          confidence?: string
          estudiante_id?: string
          grade_display?: string | null
          grade_max?: number | null
          grade_revision?: number
          grade_value?: number | null
          graded_at_display?: string | null
          lanzamiento_id?: string | null
          last_confidence?: string
          last_grade_display?: string | null
          last_grade_max?: number | null
          last_grade_value?: number | null
          last_graded_at_display?: string | null
          last_observation_id?: string
          last_observed_at?: string
          last_received_at?: string
          last_submitted?: boolean
          last_task_status?: string
          latest_observation_id?: string
          observed_at?: string
          practica_id?: string
          received_at?: string
          reopened_at?: string | null
          scan_closed?: boolean
          submitted?: boolean
          submitted_at?: string | null
          submitted_at_display?: string | null
          task_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "moodle_grade_snapshots_aula_entrega_id_fkey"
            columns: ["aula_entrega_id"]
            isOneToOne: false
            referencedRelation: "aula_entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_grade_snapshots_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_grade_snapshots_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_grade_snapshots_last_observation_fkey"
            columns: ["last_observation_id"]
            isOneToOne: false
            referencedRelation: "moodle_grade_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_grade_snapshots_latest_observation_id_fkey"
            columns: ["latest_observation_id"]
            isOneToOne: false
            referencedRelation: "moodle_grade_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_grade_snapshots_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practicas"
            referencedColumns: ["id"]
          },
        ]
      }
      moodle_probe: {
        Row: {
          autologin_result: string | null
          created_at: string
          email: string | null
          email_match: boolean
          firstname: string | null
          id: number
          idnumber: string | null
          idnumber_legajo_match: boolean
          lastname: string | null
          phone1: string | null
          phone2: string | null
          username: string | null
          username_dni_match: boolean
        }
        Insert: {
          autologin_result?: string | null
          created_at?: string
          email?: string | null
          email_match?: boolean
          firstname?: string | null
          id?: never
          idnumber?: string | null
          idnumber_legajo_match?: boolean
          lastname?: string | null
          phone1?: string | null
          phone2?: string | null
          username?: string | null
          username_dni_match?: boolean
        }
        Update: {
          autologin_result?: string | null
          created_at?: string
          email?: string | null
          email_match?: boolean
          firstname?: string | null
          id?: never
          idnumber?: string | null
          idnumber_legajo_match?: boolean
          lastname?: string | null
          phone1?: string | null
          phone2?: string | null
          username?: string | null
          username_dni_match?: boolean
        }
        Relationships: []
      }
      moodle_signup_tickets: {
        Row: {
          auth_user_id: string | null
          course_id: number
          email: string
          expires_at: string
          firstname: string
          id: string
          issued_at: string
          lastname: string
          moodle_user_id: number
          moodle_username: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          course_id: number
          email: string
          expires_at: string
          firstname: string
          id?: string
          issued_at?: string
          lastname: string
          moodle_user_id: number
          moodle_username: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          course_id?: number
          email?: string
          expires_at?: string
          firstname?: string
          id?: string
          issued_at?: string
          lastname?: string
          moodle_user_id?: number
          moodle_username?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      moodle_sync_runs: {
        Row: {
          accepted_count: number
          auth_user_id: string
          bridge_version: string
          completed_at: string | null
          details: Json
          duration_ms: number | null
          error_code: string | null
          estudiante_id: string
          fetched_count: number
          observed_at: string | null
          outcome: string
          parser_version: string
          preserved_count: number
          rejected_count: number
          request_id: string
          requested_count: number
          skipped_terminal_count: number
          snapshot_updated_count: number
          started_at: string
          stored_count: number
        }
        Insert: {
          accepted_count?: number
          auth_user_id: string
          bridge_version: string
          completed_at?: string | null
          details?: Json
          duration_ms?: number | null
          error_code?: string | null
          estudiante_id: string
          fetched_count?: number
          observed_at?: string | null
          outcome?: string
          parser_version: string
          preserved_count?: number
          rejected_count?: number
          request_id: string
          requested_count?: number
          skipped_terminal_count?: number
          snapshot_updated_count?: number
          started_at?: string
          stored_count?: number
        }
        Update: {
          accepted_count?: number
          auth_user_id?: string
          bridge_version?: string
          completed_at?: string | null
          details?: Json
          duration_ms?: number | null
          error_code?: string | null
          estudiante_id?: string
          fetched_count?: number
          observed_at?: string | null
          outcome?: string
          parser_version?: string
          preserved_count?: number
          rejected_count?: number
          request_id?: string
          requested_count?: number
          skipped_terminal_count?: number
          snapshot_updated_count?: number
          started_at?: string
          stored_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "moodle_sync_runs_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
        ]
      }
      moodle_task_expected_participants: {
        Row: {
          active_from: string
          active_to: string | null
          created_at: string
          created_by: string | null
          estudiante_id: string
          id: string
          intent_id: string
          membership_status: string
          practica_id: string
          reason_code: string | null
          reason_note: string | null
          replaces_participant_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          created_by?: string | null
          estudiante_id: string
          id?: string
          intent_id: string
          membership_status?: string
          practica_id: string
          reason_code?: string | null
          reason_note?: string | null
          replaces_participant_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          created_by?: string | null
          estudiante_id?: string
          id?: string
          intent_id?: string
          membership_status?: string
          practica_id?: string
          reason_code?: string | null
          reason_note?: string | null
          replaces_participant_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moodle_task_expected_participants_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_task_expected_participants_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "moodle_task_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_task_expected_participants_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_task_expected_participants_replaces_participant_id_fkey"
            columns: ["replaces_participant_id"]
            isOneToOne: false
            referencedRelation: "moodle_task_expected_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      moodle_task_intents: {
        Row: {
          attempt_count: number
          aula_entrega_id: number | null
          created_at: string
          description_template_version: string
          desired_config_hash: string
          desired_cutoff_at: string | null
          desired_description_html: string | null
          desired_due_at: string | null
          desired_grade_max: number
          desired_grade_mode: string
          desired_grading_due_at: string | null
          desired_name: string
          desired_open_at: string | null
          desired_section_key: string | null
          desired_visibility: string
          id: string
          lanzamiento_id: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          last_observed_at: string | null
          last_verified_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          mode: string
          monitoring_status: string
          next_reconcile_at: string | null
          next_scan_at: string | null
          observed_config: Json | null
          observed_config_hash: string | null
          orientacion_key: string
          provisioning_evidence: Json | null
          provisioning_status: string
          stable_key: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          aula_entrega_id?: number | null
          created_at?: string
          description_template_version?: string
          desired_config_hash: string
          desired_cutoff_at?: string | null
          desired_description_html?: string | null
          desired_due_at?: string | null
          desired_grade_max?: number
          desired_grade_mode?: string
          desired_grading_due_at?: string | null
          desired_name: string
          desired_open_at?: string | null
          desired_section_key?: string | null
          desired_visibility?: string
          id?: string
          lanzamiento_id: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_observed_at?: string | null
          last_verified_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          mode: string
          monitoring_status?: string
          next_reconcile_at?: string | null
          next_scan_at?: string | null
          observed_config?: Json | null
          observed_config_hash?: string | null
          orientacion_key: string
          provisioning_evidence?: Json | null
          provisioning_status?: string
          stable_key: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          aula_entrega_id?: number | null
          created_at?: string
          description_template_version?: string
          desired_config_hash?: string
          desired_cutoff_at?: string | null
          desired_description_html?: string | null
          desired_due_at?: string | null
          desired_grade_max?: number
          desired_grade_mode?: string
          desired_grading_due_at?: string | null
          desired_name?: string
          desired_open_at?: string | null
          desired_section_key?: string | null
          desired_visibility?: string
          id?: string
          lanzamiento_id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_observed_at?: string | null
          last_verified_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          mode?: string
          monitoring_status?: string
          next_reconcile_at?: string | null
          next_scan_at?: string | null
          observed_config?: Json | null
          observed_config_hash?: string | null
          orientacion_key?: string
          provisioning_evidence?: Json | null
          provisioning_status?: string
          stable_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moodle_task_intents_aula_entrega_id_fkey"
            columns: ["aula_entrega_id"]
            isOneToOne: false
            referencedRelation: "aula_entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodle_task_intents_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          delivery_email_hash: string | null
          estudiante_id: string
          expires_at: string
          failure_code: string | null
          id: string
          requested_ip: string | null
          requested_ip_hash: string | null
          status: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_email_hash?: string | null
          estudiante_id: string
          expires_at: string
          failure_code?: string | null
          id?: string
          requested_ip?: string | null
          requested_ip_hash?: string | null
          status?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_email_hash?: string | null
          estudiante_id?: string
          expires_at?: string
          failure_code?: string | null
          id?: string
          requested_ip?: string | null
          requested_ip_hash?: string | null
          status?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
        ]
      }
      penalizaciones: {
        Row: {
          airtable_id: string | null
          anulacion_motivo: string | null
          anulada_at: string | null
          anulada_por: string | null
          convocatoria_afectada: string | null
          convocatoria_id: string | null
          created_at: string | null
          estado: string
          estudiante_id: string | null
          fecha_incidente: string | null
          id: string
          lanzamiento_id: string | null
          notas: string | null
          practica_id: string | null
          puntaje_penalizacion: number
          tipo_incumplimiento: string | null
        }
        Insert: {
          airtable_id?: string | null
          anulacion_motivo?: string | null
          anulada_at?: string | null
          anulada_por?: string | null
          convocatoria_afectada?: string | null
          convocatoria_id?: string | null
          created_at?: string | null
          estado?: string
          estudiante_id?: string | null
          fecha_incidente?: string | null
          id?: string
          lanzamiento_id?: string | null
          notas?: string | null
          practica_id?: string | null
          puntaje_penalizacion?: number
          tipo_incumplimiento?: string | null
        }
        Update: {
          airtable_id?: string | null
          anulacion_motivo?: string | null
          anulada_at?: string | null
          anulada_por?: string | null
          convocatoria_afectada?: string | null
          convocatoria_id?: string | null
          created_at?: string | null
          estado?: string
          estudiante_id?: string | null
          fecha_incidente?: string | null
          id?: string
          lanzamiento_id?: string | null
          notas?: string | null
          practica_id?: string | null
          puntaje_penalizacion?: number
          tipo_incumplimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_penalizacion_estudiante"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalizaciones_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalizaciones_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalizaciones_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalizaciones_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practicas"
            referencedColumns: ["id"]
          },
        ]
      }
      practica_moodle_tareas: {
        Row: {
          aula_entrega_id: number
          created_at: string
          id: number
          link_source: string
          practica_id: string
          rationale: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          aula_entrega_id: number
          created_at?: string
          id?: never
          link_source: string
          practica_id: string
          rationale?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Update: {
          aula_entrega_id?: number
          created_at?: string
          id?: never
          link_source?: string
          practica_id?: string
          rationale?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "practica_moodle_tareas_aula_entrega_id_fkey"
            columns: ["aula_entrega_id"]
            isOneToOne: false
            referencedRelation: "aula_entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practica_moodle_tareas_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: true
            referencedRelation: "practicas"
            referencedColumns: ["id"]
          },
        ]
      }
      practicas: {
        Row: {
          airtable_id: string | null
          created_at: string | null
          desaprobacion_causas: string[] | null
          desaprobacion_fecha: string | null
          desaprobacion_motivo_publico: string | null
          desaprobacion_notificado_at: string | null
          desaprobacion_registrado_por: string | null
          es_online: boolean
          especialidad: string | null
          estado: string | null
          estudiante_id: string | null
          fecha_finalizacion: string | null
          fecha_inicio: string | null
          horas_realizadas: number | null
          id: string
          informe_estado: string | null
          institucion_id: string | null
          lanzamiento_id: string | null
          nombre_institucion: string | null
          nota: string | null
          nota_actualizada_at: string | null
          nota_fuente: string | null
          nota_moodle: number | null
          nota_moodle_cmid: number | null
          opcion_horario_id: string | null
          opcion_id: string | null
          tipo_actividad: string
        }
        Insert: {
          airtable_id?: string | null
          created_at?: string | null
          desaprobacion_causas?: string[] | null
          desaprobacion_fecha?: string | null
          desaprobacion_motivo_publico?: string | null
          desaprobacion_notificado_at?: string | null
          desaprobacion_registrado_por?: string | null
          es_online?: boolean
          especialidad?: string | null
          estado?: string | null
          estudiante_id?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          horas_realizadas?: number | null
          id?: string
          informe_estado?: string | null
          institucion_id?: string | null
          lanzamiento_id?: string | null
          nombre_institucion?: string | null
          nota?: string | null
          nota_actualizada_at?: string | null
          nota_fuente?: string | null
          nota_moodle?: number | null
          nota_moodle_cmid?: number | null
          opcion_horario_id?: string | null
          opcion_id?: string | null
          tipo_actividad?: string
        }
        Update: {
          airtable_id?: string | null
          created_at?: string | null
          desaprobacion_causas?: string[] | null
          desaprobacion_fecha?: string | null
          desaprobacion_motivo_publico?: string | null
          desaprobacion_notificado_at?: string | null
          desaprobacion_registrado_por?: string | null
          es_online?: boolean
          especialidad?: string | null
          estado?: string | null
          estudiante_id?: string | null
          fecha_finalizacion?: string | null
          fecha_inicio?: string | null
          horas_realizadas?: number | null
          id?: string
          informe_estado?: string | null
          institucion_id?: string | null
          lanzamiento_id?: string | null
          nombre_institucion?: string | null
          nota?: string | null
          nota_actualizada_at?: string | null
          nota_fuente?: string | null
          nota_moodle?: number | null
          nota_moodle_cmid?: number | null
          opcion_horario_id?: string | null
          opcion_id?: string | null
          tipo_actividad?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_practica_estudiante"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_practica_lanzamiento"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "practicas_opcion_horario_id_fkey"
            columns: ["opcion_horario_id"]
            isOneToOne: false
            referencedRelation: "lanzamiento_opcion_horarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practicas_opcion_id_fkey"
            columns: ["opcion_id"]
            isOneToOne: false
            referencedRelation: "lanzamiento_opciones"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          institution_phone: string | null
          pps_id: string | null
          pps_name: string | null
          priority: string
          snooze_count: number
          snoozed_until: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          institution_phone?: string | null
          pps_id?: string | null
          pps_name?: string | null
          priority?: string
          snooze_count?: number
          snoozed_until?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          institution_phone?: string | null
          pps_id?: string | null
          pps_name?: string | null
          priority?: string
          snooze_count?: number
          snoozed_until?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      selection_cycle_events: {
        Row: {
          actor_id: string | null
          event_type: string
          from_state: string | null
          id: number
          lanzamiento_id: string | null
          occurred_at: string
          to_state: string | null
        }
        Insert: {
          actor_id?: string | null
          event_type: string
          from_state?: string | null
          id?: never
          lanzamiento_id?: string | null
          occurred_at?: string
          to_state?: string | null
        }
        Update: {
          actor_id?: string | null
          event_type?: string
          from_state?: string | null
          id?: never
          lanzamiento_id?: string | null
          occurred_at?: string
          to_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "selection_cycle_events_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      selection_decision_events: {
        Row: {
          actor_id: string | null
          convocatoria_id: string | null
          decided_at: string
          estudiante_id: string | null
          from_state: string | null
          id: number
          lanzamiento_id: string | null
          source: string
          to_state: string
        }
        Insert: {
          actor_id?: string | null
          convocatoria_id?: string | null
          decided_at?: string
          estudiante_id?: string | null
          from_state?: string | null
          id?: never
          lanzamiento_id?: string | null
          source?: string
          to_state: string
        }
        Update: {
          actor_id?: string | null
          convocatoria_id?: string | null
          decided_at?: string
          estudiante_id?: string | null
          from_state?: string | null
          id?: never
          lanzamiento_id?: string | null
          source?: string
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "selection_decision_events_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_decision_events_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_decision_events_lanzamiento_id_fkey"
            columns: ["lanzamiento_id"]
            isOneToOne: false
            referencedRelation: "lanzamientos_pps"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_modificacion_pps: {
        Row: {
          comentario_rechazo: string | null
          created_at: string | null
          estado: string
          estudiante_id: string
          horas_nuevas: number | null
          id: string
          notas_admin: string | null
          planilla_asistencia_url: string | null
          practica_id: string
          tipo_modificacion: string
          updated_at: string | null
        }
        Insert: {
          comentario_rechazo?: string | null
          created_at?: string | null
          estado?: string
          estudiante_id: string
          horas_nuevas?: number | null
          id?: string
          notas_admin?: string | null
          planilla_asistencia_url?: string | null
          practica_id: string
          tipo_modificacion: string
          updated_at?: string | null
        }
        Update: {
          comentario_rechazo?: string | null
          created_at?: string | null
          estado?: string
          estudiante_id?: string
          horas_nuevas?: number | null
          id?: string
          notas_admin?: string | null
          planilla_asistencia_url?: string | null
          practica_id?: string
          tipo_modificacion?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_modificacion_pps_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_modificacion_pps_practica_id_fkey"
            columns: ["practica_id"]
            isOneToOne: false
            referencedRelation: "practicas"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_nueva_pps: {
        Row: {
          comentario_rechazo: string | null
          created_at: string | null
          es_online: boolean
          estado: string
          estudiante_id: string
          fecha_finalizacion: string
          fecha_inicio: string
          horas_estimadas: number
          id: string
          informe_final_url: string
          institucion_id: string | null
          nombre_institucion_manual: string | null
          notas_admin: string | null
          orientacion: string
          planilla_asistencia_url: string | null
          updated_at: string | null
        }
        Insert: {
          comentario_rechazo?: string | null
          created_at?: string | null
          es_online?: boolean
          estado?: string
          estudiante_id: string
          fecha_finalizacion: string
          fecha_inicio: string
          horas_estimadas: number
          id?: string
          informe_final_url: string
          institucion_id?: string | null
          nombre_institucion_manual?: string | null
          notas_admin?: string | null
          orientacion: string
          planilla_asistencia_url?: string | null
          updated_at?: string | null
        }
        Update: {
          comentario_rechazo?: string | null
          created_at?: string | null
          es_online?: boolean
          estado?: string
          estudiante_id?: string
          fecha_finalizacion?: string
          fecha_inicio?: string
          horas_estimadas?: number
          id?: string
          informe_final_url?: string
          institucion_id?: string | null
          nombre_institucion_manual?: string | null
          notas_admin?: string | null
          orientacion?: string
          planilla_asistencia_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_nueva_pps_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_nueva_pps_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_pps: {
        Row: {
          actualizacion: string | null
          airtable_id: string | null
          contacto_tutor: string | null
          convenio_uflo: string | null
          created_at: string | null
          descripcion_institucion: string | null
          direccion_completa: string | null
          email: string | null
          email_institucion: string | null
          estado_seguimiento: string | null
          estudiante_id: string | null
          id: string
          legajo: string | null
          localidad: string | null
          motivo_no_concrecion: string | null
          motivo_no_concrecion_detalle: string | null
          nombre_alumno: string | null
          nombre_institucion: string | null
          notas: string | null
          orientacion_sugerida: string | null
          referente_institucion: string | null
          telefono_institucion: string | null
          tipo_practica: string | null
          tutor_disponible: string | null
        }
        Insert: {
          actualizacion?: string | null
          airtable_id?: string | null
          contacto_tutor?: string | null
          convenio_uflo?: string | null
          created_at?: string | null
          descripcion_institucion?: string | null
          direccion_completa?: string | null
          email?: string | null
          email_institucion?: string | null
          estado_seguimiento?: string | null
          estudiante_id?: string | null
          id?: string
          legajo?: string | null
          localidad?: string | null
          motivo_no_concrecion?: string | null
          motivo_no_concrecion_detalle?: string | null
          nombre_alumno?: string | null
          nombre_institucion?: string | null
          notas?: string | null
          orientacion_sugerida?: string | null
          referente_institucion?: string | null
          telefono_institucion?: string | null
          tipo_practica?: string | null
          tutor_disponible?: string | null
        }
        Update: {
          actualizacion?: string | null
          airtable_id?: string | null
          contacto_tutor?: string | null
          convenio_uflo?: string | null
          created_at?: string | null
          descripcion_institucion?: string | null
          direccion_completa?: string | null
          email?: string | null
          email_institucion?: string | null
          estado_seguimiento?: string | null
          estudiante_id?: string | null
          id?: string
          legajo?: string | null
          localidad?: string | null
          motivo_no_concrecion?: string | null
          motivo_no_concrecion_detalle?: string | null
          nombre_alumno?: string | null
          nombre_institucion?: string | null
          notas?: string | null
          orientacion_sugerida?: string | null
          referente_institucion?: string | null
          telefono_institucion?: string | null
          tipo_practica?: string | null
          tutor_disponible?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_solicitud_estudiante"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "estudiantes"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          legajo_input: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          legajo_input: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          legajo_input?: string
        }
        Relationships: []
      }
      whatsapp_contactos: {
        Row: {
          chat_jid: string
          clasificado_por: string
          confidence: number | null
          created_at: string
          institucion_id: string | null
          last_seen_at: string | null
          nombre_contacto: string | null
          notas: string | null
          phone: string | null
          tipo: string
          updated_at: string
          validado_at: string | null
          validado_por: string | null
        }
        Insert: {
          chat_jid: string
          clasificado_por: string
          confidence?: number | null
          created_at?: string
          institucion_id?: string | null
          last_seen_at?: string | null
          nombre_contacto?: string | null
          notas?: string | null
          phone?: string | null
          tipo: string
          updated_at?: string
          validado_at?: string | null
          validado_por?: string | null
        }
        Update: {
          chat_jid?: string
          clasificado_por?: string
          confidence?: number | null
          created_at?: string
          institucion_id?: string | null
          last_seen_at?: string | null
          nombre_contacto?: string | null
          notas?: string | null
          phone?: string | null
          tipo?: string
          updated_at?: string
          validado_at?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contactos_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensajes: {
        Row: {
          autor: string | null
          chat_jid: string
          from_me: boolean
          id: string
          ingested_at: string
          institucion_id: string | null
          media_tipo: string | null
          raw: Json | null
          texto: string | null
          timestamp: string
        }
        Insert: {
          autor?: string | null
          chat_jid: string
          from_me: boolean
          id: string
          ingested_at?: string
          institucion_id?: string | null
          media_tipo?: string | null
          raw?: Json | null
          texto?: string | null
          timestamp: string
        }
        Update: {
          autor?: string | null
          chat_jid?: string
          from_me?: boolean
          id?: string
          ingested_at?: string
          institucion_id?: string | null
          media_tipo?: string | null
          raw?: Json | null
          texto?: string | null
          timestamp?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_reset_password: {
        Args: { legajo_input: string; new_password: string }
        Returns: undefined
      }
      anular_desaprobacion_pps: {
        Args: {
          p_motivo: string
          p_nuevo_estado: string
          p_practica_id: string
        }
        Returns: {
          penalizacion_id: string
          practica_id: string
        }[]
      }
      archive_lanzamientos_after_start_grace: { Args: never; Returns: number }
      auth_email: { Args: never; Returns: string }
      calc_cohorte_estudiante: {
        Args: { p_estudiante_id: string }
        Returns: number
      }
      check_fcm_token_exists: { Args: { uid: string }; Returns: boolean }
      claim_consentimiento_final_reminder_batch: {
        Args: {
          p_actor_user_id: string
          p_claim_token: string
          p_lanzamiento_id: string
          p_requested_at: string
        }
        Returns: {
          convocatoria_id: string
          deadline_at: string
          estudiante_correo: string
          estudiante_nombre: string
          pps_nombre: string
        }[]
      }
      claim_consentimiento_timeout_baja: {
        Args: { p_convocatoria_id: string }
        Returns: boolean
      }
      claim_moodle_task_intent_lease_v1: {
        Args: {
          p_batch_size?: number
          p_lease_seconds?: number
          p_worker_token?: string
        }
        Returns: {
          attempt_count: number
          aula_entrega_id: number | null
          created_at: string
          description_template_version: string
          desired_config_hash: string
          desired_cutoff_at: string | null
          desired_description_html: string | null
          desired_due_at: string | null
          desired_grade_max: number
          desired_grade_mode: string
          desired_grading_due_at: string | null
          desired_name: string
          desired_open_at: string | null
          desired_section_key: string | null
          desired_visibility: string
          id: string
          lanzamiento_id: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          last_observed_at: string | null
          last_verified_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          mode: string
          monitoring_status: string
          next_reconcile_at: string | null
          next_scan_at: string | null
          observed_config: Json | null
          observed_config_hash: string | null
          orientacion_key: string
          provisioning_evidence: Json | null
          provisioning_status: string
          stable_key: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "moodle_task_intents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_password_reset_token: {
        Args: { p_token_hash: string }
        Returns: {
          delivery_email_hash: string
          estudiante_id: string
          request_id: string
          user_id: string
        }[]
      }
      clean_dirty_text: { Args: { val: string }; Returns: string }
      cleanup_old_verification_attempts: { Args: never; Returns: undefined }
      close_finished_practicas: { Args: never; Returns: number }
      close_selection: { Args: { p_lanzamiento_id: string }; Returns: Json }
      complete_moodle_jefe_login_v1: {
        Args: { token_hash_input: string; userid_input: string }
        Returns: string
      }
      complete_moodle_student_signup: {
        Args: {
          dni_input: number
          legajo_input: string
          telefono_input: string
          token_hash_input: string
          userid_input: string
        }
        Returns: string
      }
      complete_password_reset: {
        Args: {
          p_failure_code?: string
          p_request_id: string
          p_success: boolean
        }
        Returns: boolean
      }
      confirm_moodle_task_intent_v1: {
        Args: {
          p_cmid: number
          p_course_id: number
          p_evidence?: Json
          p_intent_id: string
          p_lease_token: string
          p_observed_cutoff_at: string
          p_observed_description_html: string
          p_observed_due_at: string
          p_observed_grade_max: number
          p_observed_grade_mode: string
          p_observed_name: string
          p_observed_open_at: string
          p_observed_section_key: string
          p_observed_stable_key: string
          p_observed_visibility: string
        }
        Returns: Json
      }
      consentimiento_deadline: {
        Args: {
          p_fecha_inicio: string
          p_lista_entregada_at?: string
          p_selected_at: string
        }
        Returns: string
      }
      consentimiento_deadline_efectivo: {
        Args: {
          p_fecha_inicio: string
          p_final_reminder_sent_at?: string
          p_lista_entregada_at?: string
          p_selected_at: string
        }
        Returns: string
      }
      create_my_solicitud_ingreso_v1: {
        Args: {
          p_contacto_tutor?: string
          p_convenio_uflo?: string
          p_descripcion_institucion?: string
          p_direccion_completa?: string
          p_email_institucion?: string
          p_localidad?: string
          p_nombre_institucion: string
          p_referente_institucion?: string
          p_telefono_institucion?: string
          p_tipo_practica?: string
          p_tutor_disponible?: string
        }
        Returns: string
      }
      create_my_solicitud_modificacion_v1: {
        Args: {
          p_horas_nuevas?: number
          p_planilla_asistencia_url?: string
          p_practica_id: string
          p_tipo_modificacion: string
        }
        Returns: string
      }
      create_my_solicitud_nueva_pps_v1: {
        Args: {
          p_es_online?: boolean
          p_fecha_finalizacion: string
          p_fecha_inicio: string
          p_horas_estimadas: number
          p_informe_final_url: string
          p_institucion_id: string
          p_nombre_institucion_manual: string
          p_orientacion: string
          p_planilla_asistencia_url: string
        }
        Returns: string
      }
      create_password_reset_request: {
        Args: {
          p_delivery_email_hash: string
          p_estudiante_id: string
          p_expires_at: string
          p_requested_ip_hash: string
          p_token_hash: string
          p_user_id: string
        }
        Returns: string
      }
      dar_baja_pps_con_penalizacion: {
        Args: {
          p_convocatoria_id: string
          p_fecha_incidente?: string
          p_notas?: string
          p_tipo_incumplimiento: string
        }
        Returns: {
          penalizacion_id: string
          practicas_eliminadas: number
        }[]
      }
      delete_fcm_token: { Args: { p_user_id: string }; Returns: undefined }
      delete_fcm_token_user: { Args: { uid: string }; Returns: boolean }
      finalize_password_reset_delivery: {
        Args: {
          p_delivered: boolean
          p_failure_code?: string
          p_request_id: string
        }
        Returns: boolean
      }
      finish_consentimiento_final_reminder: {
        Args: {
          p_claim_token: string
          p_convocatoria_id: string
          p_sent: boolean
        }
        Returns: boolean
      }
      finish_student_email_send: {
        Args: { p_event_id: string; p_sent: boolean }
        Returns: boolean
      }
      get_activos_list: { Args: { p_year: number }; Returns: Json }
      get_activos_list_impl: { Args: { p_year: number }; Returns: Json }
      get_admin_metrics_kpis: { Args: { p_year: number }; Returns: Json }
      get_all_fcm_tokens: {
        Args: never
        Returns: {
          fcm_token: string
          user_id: string
        }[]
      }
      get_analytics_health: { Args: never; Returns: Json }
      get_analytics_v1: {
        Args: { p_cutoff?: string; p_year: number }
        Returns: Json
      }
      get_analytics_v2: {
        Args: { p_cutoff?: string; p_year: number }
        Returns: Json
      }
      get_consent_counts_by_launch: {
        Args: { p_launch_ids: string[] }
        Returns: Json
      }
      get_consentimiento_timeout_candidates: {
        Args: never
        Returns: {
          convocatoria_id: string
          deadline_at: string
          estudiante_correo: string
          estudiante_id: string
          estudiante_nombre: string
          lanzamiento_id: string
          pps_nombre: string
          reminder_at: string
          reminder_sent_at: string
          selected_at: string
        }[]
      }
      get_convenios_kpis: { Args: { p_year: number }; Returns: Json }
      get_convenios_list: {
        Args: { p_kind: string; p_year: number }
        Returns: {
          fecha_firma: string
          fecha_vencimiento: string
          nombre: string
          tipo: string
        }[]
      }
      get_convenios_list_impl: {
        Args: { p_kind: string; p_year: number }
        Returns: {
          fecha_firma: string
          fecha_vencimiento: string
          nombre: string
          tipo: string
        }[]
      }
      get_convenios_por_vencer: {
        Args: { p_days?: number }
        Returns: {
          convenio_id: string
          dias_restantes: number
          fecha_firma: string
          fecha_vencimiento: string
          institucion: string
          institucion_id: string
          tipo: string
        }[]
      }
      get_convocatoria_counts_by_launch: {
        Args: { p_launch_ids: string[] }
        Returns: Json
      }
      get_dashboard_metrics: { Args: { target_year: number }; Returns: Json }
      get_director_report_v1: {
        Args: { p_snapshot_date?: string; p_year: number }
        Returns: Json
      }
      get_estudiantes_en_pps_list: { Args: { p_year: number }; Returns: Json }
      get_estudiantes_en_pps_list_impl: {
        Args: { p_year: number }
        Returns: Json
      }
      get_finalizados_list: {
        Args: { p_year: number }
        Returns: {
          id: string
          legajo: string
          nombre: string
        }[]
      }
      get_finalizados_list_impl: {
        Args: { p_year: number }
        Returns: {
          id: string
          legajo: string
          nombre: string
        }[]
      }
      get_finalization_grade_resolution: {
        Args: { p_finalizacion_id: string }
        Returns: {
          cmid: number
          fuente: string
          grade_display: string
          moodle_status: string
          nota: string
          nota_numeric: number
          nota_promedio: number
          observed_at: string
          practica_id: string
        }[]
      }
      get_haciendo_pps_list: {
        Args: { p_year: number }
        Returns: {
          id: string
          legajo: string
          nombre: string
        }[]
      }
      get_haciendo_pps_list_impl: {
        Args: { p_year: number }
        Returns: {
          id: string
          legajo: string
          nombre: string
        }[]
      }
      get_heredados_count: { Args: { p_year: number }; Returns: number }
      get_heredados_list: { Args: { p_year: number }; Returns: Json }
      get_heredados_list_impl: { Args: { p_year: number }; Returns: Json }
      get_historical_launch_offer_list: {
        Args: { p_cutoff?: string; p_year: number }
        Returns: Json
      }
      get_ingresantes_list: { Args: { p_year: number }; Returns: Json }
      get_ingresantes_list_impl: { Args: { p_year: number }; Returns: Json }
      get_interview_completion_candidates_v1: {
        Args: never
        Returns: {
          cohorte: number
          horas_especialidad: number
          horas_faltantes_especialidad: number
          horas_faltantes_total: number
          horas_total: number
          id: string
          legajo: string
          motivo: string
          motivo_codigo: string
          nombre: string
          orientacion_elegida: string
          orientaciones: number
          orientaciones_cubiertas: string[]
          orientaciones_faltantes: number
          practicas_activas: number
        }[]
      }
      get_jefe_dashboard_preview_v1: {
        Args: { p_cutoff?: string; p_dni: number; p_year: number }
        Returns: Json
      }
      get_jefe_dashboard_preview_v2: {
        Args: { p_cutoff?: string; p_preview_key: string; p_year: number }
        Returns: Json
      }
      get_jefe_dashboard_v1: {
        Args: { p_cutoff?: string; p_year?: number }
        Returns: Json
      }
      get_jefe_moodle_sync_tasks_preview_v1: {
        Args: { p_preview_key: string }
        Returns: {
          academic_year: number
          area_keys: string[]
          cmid: number
          course_id: number
          task_name: string
        }[]
      }
      get_jefe_moodle_sync_tasks_v1: {
        Args: never
        Returns: {
          academic_year: number
          area_keys: string[]
          cmid: number
          course_id: number
          task_name: string
        }[]
      }
      get_metrics_years: { Args: never; Returns: Json }
      get_moodle_grade_discrepancies: {
        Args: never
        Returns: {
          comparison_state: string
          especialidad: string
          estudiante_dni: string
          estudiante_id: string
          estudiante_nombre: string
          institucion: string
          legacy_nota: string
          moodle_grade_display: string
          moodle_grade_max: number
          moodle_grade_value: number
          moodle_status: string
          moodle_suggested_10_scale: number
          observed_at: string
          practica_id: string
        }[]
      }
      get_moodle_jefe_login_candidate_v1: {
        Args: { token_hash_input: string }
        Returns: Json
      }
      get_moodle_sync_health: { Args: never; Returns: Json }
      get_moodle_task_unit_summaries_v1: {
        Args: { p_launch_id?: string; p_orientation?: string }
        Returns: {
          cmid: number
          course_id: number
          desired_due_at: string
          desired_open_at: string
          intent_id: string
          lanzamiento_id: string
          last_error_message: string
          last_verified_at: string
          mode: string
          monitoring_status: string
          nombre_pps: string
          orientacion_key: string
          provisioning_status: string
          stable_key: string
          total_expected: number
          total_failed: number
          total_missing: number
          total_passed: number
          total_revision_required: number
          total_settled: number
          total_submitted: number
          total_under_review: number
          total_waived: number
        }[]
      }
      get_moodle_unlinked_practices: {
        Args: { p_from_year?: number }
        Returns: {
          especialidad: string
          estudiante_id: string
          estudiante_nombre: string
          fecha_inicio: string
          institucion: string
          practica_id: string
          reason_code: string
        }[]
      }
      get_my_jefe_areas_v1: {
        Args: never
        Returns: {
          area_key: string
          area_label: string
          sort_order: number
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_my_solicitudes_ingreso_v1: {
        Args: never
        Returns: {
          actualizacion: string
          contacto_tutor: string
          convenio_uflo: string
          created_at: string
          descripcion_institucion: string
          direccion_completa: string
          email_institucion: string
          estado_seguimiento: string
          id: string
          localidad: string
          motivo_no_concrecion: string
          motivo_no_concrecion_detalle: string
          nombre_institucion: string
          orientacion_sugerida: string
          referente_institucion: string
          telefono_institucion: string
          tipo_practica: string
          tutor_disponible: string
        }[]
      }
      get_my_solicitudes_modificacion_v1: {
        Args: never
        Returns: {
          comentario_rechazo: string
          created_at: string
          estado: string
          horas_nuevas: number
          id: string
          planilla_asistencia_url: string
          practica_id: string
          tipo_modificacion: string
          updated_at: string
        }[]
      }
      get_my_solicitudes_nueva_pps_v1: {
        Args: never
        Returns: {
          comentario_rechazo: string
          created_at: string
          es_online: boolean
          estado: string
          fecha_finalizacion: string
          fecha_inicio: string
          horas_estimadas: number
          id: string
          informe_final_url: string
          institucion_id: string
          nombre_institucion_manual: string
          orientacion: string
          planilla_asistencia_url: string
          updated_at: string
        }[]
      }
      get_postulantes_seleccionados: {
        Args: { lanzamiento_uuid: string }
        Returns: {
          horario: string
          legajo: string
          nombre: string
        }[]
      }
      get_postulantes_seleccionados_impl: {
        Args: { lanzamiento_uuid: string }
        Returns: {
          horario: string
          legajo: string
          nombre: string
        }[]
      }
      get_proximos_finalizar_list: {
        Args: { p_year: number }
        Returns: {
          horas_total: number
          id: string
          legajo: string
          nombre: string
        }[]
      }
      get_proximos_finalizar_list_impl: {
        Args: { p_year: number }
        Returns: {
          horas_total: number
          id: string
          legajo: string
          nombre: string
        }[]
      }
      get_seleccionados: {
        Args: { lanzamiento_id_input: string }
        Returns: {
          horario: string
          legajo: string
          nombre: string
        }[]
      }
      get_seleccionados_for_launch: {
        Args: { p_lanzamiento_id: string }
        Returns: {
          accepted_at: string
          convocatoria_id: string
          firmo: boolean
          horario: string
          legajo: string
          nombre: string
        }[]
      }
      get_seleccionados_impl: {
        Args: { lanzamiento_id_input: string }
        Returns: {
          horario: string
          legajo: string
          nombre: string
        }[]
      }
      get_sin_pps_list: {
        Args: { p_year: number }
        Returns: {
          correo: string
          id: string
          legajo: string
          nombre: string
        }[]
      }
      get_sin_pps_list_impl: {
        Args: { p_year: number }
        Returns: {
          correo: string
          id: string
          legajo: string
          nombre: string
        }[]
      }
      get_student_details_by_legajo: {
        Args: { legajo_input: string }
        Returns: {
          correo: string
          dni: number
          id: string
          legajo: string
          must_change_password: boolean
          nombre: string
          role: string
          telefono: string
          user_id: string
        }[]
      }
      get_student_email_by_legajo: {
        Args: { legajo_input: string }
        Returns: Json
      }
      get_student_for_signup: {
        Args: { legajo_input: string }
        Returns: {
          apellido_separado: string
          correo: string
          dni: number
          id: string
          legajo: string
          nombre: string
          nombre_separado: string
          telefono: string
          user_id: string
        }[]
      }
      get_student_signup_status: {
        Args: { correo_input?: string; legajo_input: string }
        Returns: {
          apellido_separado: string
          correo: string
          dni: number
          estado: string
          id: string
          legajo: string
          nombre: string
          nombre_separado: string
          signup_status: string
          status_message: string
          telefono: string
          user_id: string
        }[]
      }
      get_user_creation_dates: {
        Args: never
        Returns: {
          created_at: string
          user_id: string
        }[]
      }
      identity_ip_rate_limited: { Args: never; Returns: boolean }
      increment_snooze_count: { Args: { reminder_id: string }; Returns: number }
      inscribir_convocatoria_multiopcion: {
        Args: {
          p_datos?: Json
          p_lanzamiento_id: string
          p_opcion_ids: string[]
        }
        Returns: {
          airtable_id: string | null
          baja_automatica_at: string | null
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
          final_reminder_claim_token: string | null
          final_reminder_claimed_at: string | null
          final_reminder_claimed_by: string | null
          final_reminder_sent_at: string | null
          final_reminder_sent_by: string | null
          finales_adeuda: string | null
          horario_asignado: string | null
          horario_seleccionado: string | null
          horas_acreditadas: number | null
          id: string
          informe_subido: boolean | null
          lanzamiento_id: string | null
          legajo: number | null
          nombre_pps: string | null
          opcion_asignada_id: string | null
          opcion_horario_asignado_id: string | null
          orientacion: string | null
          otra_situacion_academica: string | null
          reminder_sent_at: string | null
          selected_at: string | null
          selection_decided_at: string | null
          telefono: string | null
          termino_cursar: string | null
          trabaja: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "convocatorias"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      inscribir_convocatoria_multiopcion_v2: {
        Args: {
          p_datos?: Json
          p_horario_ids: string[]
          p_lanzamiento_id: string
        }
        Returns: {
          airtable_id: string | null
          baja_automatica_at: string | null
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
          final_reminder_claim_token: string | null
          final_reminder_claimed_at: string | null
          final_reminder_claimed_by: string | null
          final_reminder_sent_at: string | null
          final_reminder_sent_by: string | null
          finales_adeuda: string | null
          horario_asignado: string | null
          horario_seleccionado: string | null
          horas_acreditadas: number | null
          id: string
          informe_subido: boolean | null
          lanzamiento_id: string | null
          legajo: number | null
          nombre_pps: string | null
          opcion_asignada_id: string | null
          opcion_horario_asignado_id: string | null
          orientacion: string | null
          otra_situacion_academica: string | null
          reminder_sent_at: string | null
          selected_at: string | null
          selection_decided_at: string | null
          telefono: string | null
          termino_cursar: string | null
          trabaja: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "convocatorias"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      list_jefe_preview_profiles_v1: {
        Args: never
        Returns: {
          area_labels: string[]
          name: string
          preview_key: string
        }[]
      }
      marcar_lista_estudiantes_entregada: {
        Args: { p_lanzamiento_id: string }
        Returns: string
      }
      mark_password_changed: { Args: never; Returns: undefined }
      owns_storage_folder: { Args: { object_name: string }; Returns: boolean }
      practica_computa: { Args: { p_estado: string }; Returns: boolean }
      process_consentimiento_timeouts: { Args: never; Returns: undefined }
      publish_scheduled_launches: { Args: never; Returns: number }
      reconcile_moodle_task_intents_v1: {
        Args: { p_launch_id?: string }
        Returns: Json
      }
      register_campus_student: {
        Args: {
          apellido_input?: string
          correo_input: string
          dni_input: number
          legajo_input: string
          nombre_input?: string
          telefono_input?: string
          userid_input: string
        }
        Returns: undefined
      }
      register_new_student: {
        Args: {
          correo_input?: string
          dni_input?: number
          legajo_input: string
          telefono_input?: string
          userid_input: string
        }
        Returns: undefined
      }
      registrar_desaprobacion_pps: {
        Args: {
          p_causas: string[]
          p_fecha: string
          p_informe_ref: string
          p_motivo_publico: string
          p_notificado_at: string
          p_practica_id: string
        }
        Returns: {
          penalizacion_id: string
          practica_id: string
        }[]
      }
      request_moodle_task_reconcile_v1: {
        Args: { p_intent_id: string }
        Returns: boolean
      }
      reserve_student_email_send: {
        Args: { p_user_id: string }
        Returns: string
      }
      reset_student_password_verified: {
        Args: {
          correo_input: string
          dni_input: number
          legajo_input: string
          new_password?: string
          telefono_input?: string
        }
        Returns: undefined
      }
      safe_date_cast: { Args: { val: string }; Returns: string }
      save_fcm_token: { Args: { tok: string; uid: string }; Returns: boolean }
      seleccionar_convocatoria_opcion: {
        Args: {
          p_convocatoria_id: string
          p_opcion_id: string
          p_seleccionar: boolean
        }
        Returns: boolean
      }
      seleccionar_convocatoria_opcion_horario: {
        Args: {
          p_convocatoria_id: string
          p_horario_id: string
          p_seleccionar: boolean
        }
        Returns: boolean
      }
      set_moodle_expected_participant_exception_v1: {
        Args: {
          p_new_status: string
          p_participant_id: string
          p_reason_code: string
          p_reason_note?: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_compromiso_pps: {
        Args: {
          p_acepta_compromiso: boolean
          p_acepta_lectura: boolean
          p_convocatoria_id: string
          p_dni: number
          p_firma_texto: string
          p_lanzamiento_id: string
          p_legajo: string
          p_nombre_completo: string
          p_texto_acta: string
          p_version: string
        }
        Returns: {
          accepted_at: string | null
          acepta_compromiso: boolean
          acepta_lectura: boolean
          convocatoria_id: string
          created_at: string | null
          dni: number | null
          estado: string
          estudiante_id: string
          firma_texto: string
          id: string
          lanzamiento_id: string
          legajo: string
          nombre_completo: string
          texto_acta: string
          updated_at: string | null
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "compromisos_pps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_jefe_moodle_reports_preview_v1: {
        Args: {
          p_academic_year: number
          p_actor_moodle_user_id: number
          p_actor_moodle_username: string
          p_course_id: number
          p_observed_at: string
          p_preview_key: string
          p_request_id: string
          p_tasks: Json
        }
        Returns: Json
      }
      sync_jefe_moodle_reports_v1: {
        Args: {
          p_academic_year: number
          p_actor_moodle_user_id: number
          p_actor_moodle_username: string
          p_course_id: number
          p_observed_at: string
          p_request_id: string
          p_tasks: Json
        }
        Returns: Json
      }
      update_jefe_report_grade_v1: {
        Args: { p_grade: string; p_practica_id: string }
        Returns: Json
      }
      verify_student_identity: {
        Args: {
          correo_input: string
          dni_input: number
          legajo_input: string
          telefono_input?: string
        }
        Returns: {
          correo: string
          dni: number
          id: string
          legajo: string
          must_change_password: boolean
          nombre: string
          role: string
          telefono: string
          user_id: string
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
