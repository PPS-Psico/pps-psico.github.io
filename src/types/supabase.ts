export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      app_config: {
        Row: {
          created_at: string;
          horas_objetivo_orientacion: number;
          horas_objetivo_total: number;
          id: number;
          rotacion_objetivo: number;
        };
        Insert: {
          created_at?: string;
          horas_objetivo_orientacion?: number;
          horas_objetivo_total?: number;
          id?: number;
          rotacion_objetivo?: number;
        };
        Update: {
          created_at?: string;
          horas_objetivo_orientacion?: number;
          horas_objetivo_total?: number;
          id?: number;
          rotacion_objetivo?: number;
        };
        Relationships: [];
      };
      convocatorias: {
        Row: {
          airtable_id: string | null;
          certificado_trabajo: string | null;
          certificado_url: string | null;
          correo: string | null;
          created_at: string | null;
          cursando_electivas: string | null;
          cv_url: string | null;
          direccion: string | null;
          dni: number | null;
          estado_inscripcion: string | null;
          estudiante_id: string | null;
          fecha_entrega_informe: string | null;
          fecha_finalizacion: string | null;
          fecha_inicio: string | null;
          fecha_nacimiento: string | null;
          finales_adeuda: string | null;
          horario_seleccionado: string | null;
          horas_acreditadas: number | null;
          id: string;
          informe_subido: boolean | null;
          lanzamiento_id: string | null;
          legajo: number | null;
          nombre_pps: string | null;
          orientacion: string | null;
          otra_situacion_academica: string | null;
          telefono: string | null;
          termino_cursar: string | null;
          trabaja: boolean | null;
        };
        Insert: {
          airtable_id?: string | null;
          certificado_trabajo?: string | null;
          certificado_url?: string | null;
          correo?: string | null;
          created_at?: string | null;
          cursando_electivas?: string | null;
          cv_url?: string | null;
          direccion?: string | null;
          dni?: number | null;
          estado_inscripcion?: string | null;
          estudiante_id?: string | null;
          fecha_entrega_informe?: string | null;
          fecha_finalizacion?: string | null;
          fecha_inicio?: string | null;
          fecha_nacimiento?: string | null;
          finales_adeuda?: string | null;
          horario_seleccionado?: string | null;
          horas_acreditadas?: number | null;
          id?: string;
          informe_subido?: boolean | null;
          lanzamiento_id?: string | null;
          legajo?: number | null;
          nombre_pps?: string | null;
          orientacion?: string | null;
          otra_situacion_academica?: string | null;
          telefono?: string | null;
          termino_cursar?: string | null;
          trabaja?: boolean | null;
        };
        Update: {
          airtable_id?: string | null;
          certificado_trabajo?: string | null;
          certificado_url?: string | null;
          correo?: string | null;
          created_at?: string | null;
          cursando_electivas?: string | null;
          cv_url?: string | null;
          direccion?: string | null;
          dni?: number | null;
          estado_inscripcion?: string | null;
          estudiante_id?: string | null;
          fecha_entrega_informe?: string | null;
          fecha_finalizacion?: string | null;
          fecha_inicio?: string | null;
          fecha_nacimiento?: string | null;
          finales_adeuda?: string | null;
          horario_seleccionado?: string | null;
          horas_acreditadas?: number | null;
          id?: string;
          informe_subido?: boolean | null;
          lanzamiento_id?: string | null;
          legajo?: number | null;
          nombre_pps?: string | null;
          orientacion?: string | null;
          otra_situacion_academica?: string | null;
          telefono?: string | null;
          termino_cursar?: string | null;
          trabaja?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "convocatorias_estudiante_id_fkey";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convocatorias_lanzamiento_id_fkey";
            columns: ["lanzamiento_id"];
            isOneToOne: false;
            referencedRelation: "lanzamientos_pps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_convocatoria_estudiante";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_convocatoria_lanzamiento";
            columns: ["lanzamiento_id"];
            isOneToOne: false;
            referencedRelation: "lanzamientos_pps";
            referencedColumns: ["id"];
          },
        ];
      };
      debug_logs: {
        Row: {
          created_at: string | null;
          data: Json | null;
          id: string;
          msg: string | null;
        };
        Insert: {
          created_at?: string | null;
          data?: Json | null;
          id?: string;
          msg?: string | null;
        };
        Update: {
          created_at?: string | null;
          data?: Json | null;
          id?: string;
          msg?: string | null;
        };
        Relationships: [];
      };
      email_templates: {
        Row: {
          body: string;
          id: string;
          is_active: boolean | null;
          subject: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          body: string;
          id: string;
          is_active?: boolean | null;
          subject: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          body?: string;
          id?: string;
          is_active?: boolean | null;
          subject?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      estudiantes: {
        Row: {
          airtable_id: string | null;
          apellido_separado: string | null;
          certificado_trabajo: string | null;
          correo: string | null;
          created_at: string | null;
          dni: number | null;
          estado: string | null;
          fecha_finalizacion: string | null;
          fecha_nacimiento: string | null;
          genero: string | null;
          id: string;
          legajo: string | null;
          must_change_password: boolean | null;
          nombre: string | null;
          nombre_separado: string | null;
          notas_internas: string | null;
          orientacion_elegida: string | null;
          role: string | null;
          telefono: string | null;
          trabaja: boolean | null;
          user_id: string | null;
        };
        Insert: {
          airtable_id?: string | null;
          apellido_separado?: string | null;
          certificado_trabajo?: string | null;
          correo?: string | null;
          created_at?: string | null;
          dni?: number | null;
          estado?: string | null;
          fecha_finalizacion?: string | null;
          fecha_nacimiento?: string | null;
          genero?: string | null;
          id?: string;
          legajo?: string | null;
          must_change_password?: boolean | null;
          nombre?: string | null;
          nombre_separado?: string | null;
          notas_internas?: string | null;
          orientacion_elegida?: string | null;
          role?: string | null;
          telefono?: string | null;
          trabaja?: boolean | null;
          user_id?: string | null;
        };
        Update: {
          airtable_id?: string | null;
          apellido_separado?: string | null;
          certificado_trabajo?: string | null;
          correo?: string | null;
          created_at?: string | null;
          dni?: number | null;
          estado?: string | null;
          fecha_finalizacion?: string | null;
          fecha_nacimiento?: string | null;
          genero?: string | null;
          id?: string;
          legajo?: string | null;
          must_change_password?: boolean | null;
          nombre?: string | null;
          nombre_separado?: string | null;
          notas_internas?: string | null;
          orientacion_elegida?: string | null;
          role?: string | null;
          telefono?: string | null;
          trabaja?: boolean | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      fcm_tokens: {
        Row: {
          created_at: string | null;
          fcm_token: string;
          id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          fcm_token: string;
          id?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          fcm_token?: string;
          id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      finalizacion_pps: {
        Row: {
          airtable_id: string | null;
          certificado_url: Json | null;
          created_at: string | null;
          estado: string | null;
          estudiante_id: string | null;
          fecha_solicitud: string | null;
          id: string;
          informe_final_url: Json | null;
          planilla_asistencia_url: Json | null;
          planilla_horas_url: Json | null;
          sugerencias_mejoras: string | null;
        };
        Insert: {
          airtable_id?: string | null;
          certificado_url?: Json | null;
          created_at?: string | null;
          estado?: string | null;
          estudiante_id?: string | null;
          fecha_solicitud?: string | null;
          id?: string;
          informe_final_url?: Json | null;
          planilla_asistencia_url?: Json | null;
          planilla_horas_url?: Json | null;
          sugerencias_mejoras?: string | null;
        };
        Update: {
          airtable_id?: string | null;
          certificado_url?: Json | null;
          created_at?: string | null;
          estado?: string | null;
          estudiante_id?: string | null;
          fecha_solicitud?: string | null;
          id?: string;
          informe_final_url?: Json | null;
          planilla_asistencia_url?: Json | null;
          planilla_horas_url?: Json | null;
          sugerencias_mejoras?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "finalizacion_pps_estudiante_id_fkey";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_finalizacion_estudiante";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
        ];
      };
      instituciones: {
        Row: {
          airtable_id: string | null;
          codigo_tarjeta_campus: string | null;
          convenio_nuevo: string | null;
          created_at: string | null;
          direccion: string | null;
          id: string;
          logo_invert_dark: boolean | null;
          logo_url: string | null;
          nombre: string | null;
          orientaciones: string | null;
          telefono: string | null;
          tutor: string | null;
        };
        Insert: {
          airtable_id?: string | null;
          codigo_tarjeta_campus?: string | null;
          convenio_nuevo?: string | null;
          created_at?: string | null;
          direccion?: string | null;
          id?: string;
          logo_invert_dark?: boolean | null;
          logo_url?: string | null;
          nombre?: string | null;
          orientaciones?: string | null;
          telefono?: string | null;
          tutor?: string | null;
        };
        Update: {
          airtable_id?: string | null;
          codigo_tarjeta_campus?: string | null;
          convenio_nuevo?: string | null;
          created_at?: string | null;
          direccion?: string | null;
          id?: string;
          logo_invert_dark?: boolean | null;
          logo_url?: string | null;
          nombre?: string | null;
          orientaciones?: string | null;
          telefono?: string | null;
          tutor?: string | null;
        };
        Relationships: [];
      };
      lanzamientos_pps: {
        Row: {
          actividades_label: string | null;
          actividades_lista: string[] | null;
          airtable_id: string | null;
          codigo_tarjeta_campus: string | null;
          created_at: string | null;
          cupos_disponibles: number | null;
          descripcion_larga: string | null;
          direccion: string | null;
          estado_convocatoria: string | null;
          estado_gestion: string | null;
          fecha_encuentro_inicial: string | null;
          fecha_fin_inscripcion: string | null;
          fecha_finalizacion: string | null;
          fecha_inicio: string | null;
          fecha_inicio_inscripcion: string | null;
          fecha_publicacion: string | null;
          fecha_relanzamiento: string | null;
          horario_seleccionado: string | null;
          horarios_fijos: boolean | null;
          horas_acreditadas: number | null;
          id: string;
          informe: string | null;
          institucion_id: string | null;
          mensaje_whatsapp: string | null;
          nombre_pps: string | null;
          notas_gestion: string | null;
          orientacion: string | null;
          permite_certificado: boolean | null;
          plantilla_seguro_url: string | null;
          plazo_inscripcion_dias: number | null;
          req_certificado_trabajo: boolean | null;
          req_cv: boolean | null;
          requisito_obligatorio: string | null;
        };
        Insert: {
          actividades_label?: string | null;
          actividades_lista?: string[] | null;
          airtable_id?: string | null;
          codigo_tarjeta_campus?: string | null;
          created_at?: string | null;
          cupos_disponibles?: number | null;
          descripcion_larga?: string | null;
          direccion?: string | null;
          estado_convocatoria?: string | null;
          estado_gestion?: string | null;
          fecha_encuentro_inicial?: string | null;
          fecha_fin_inscripcion?: string | null;
          fecha_finalizacion?: string | null;
          fecha_inicio?: string | null;
          fecha_inicio_inscripcion?: string | null;
          fecha_publicacion?: string | null;
          fecha_relanzamiento?: string | null;
          horario_seleccionado?: string | null;
          horarios_fijos?: boolean | null;
          horas_acreditadas?: number | null;
          id?: string;
          informe?: string | null;
          institucion_id?: string | null;
          mensaje_whatsapp?: string | null;
          nombre_pps?: string | null;
          notas_gestion?: string | null;
          orientacion?: string | null;
          permite_certificado?: boolean | null;
          plantilla_seguro_url?: string | null;
          plazo_inscripcion_dias?: number | null;
          req_certificado_trabajo?: boolean | null;
          req_cv?: boolean | null;
          requisito_obligatorio?: string | null;
        };
        Update: {
          actividades_label?: string | null;
          actividades_lista?: string[] | null;
          airtable_id?: string | null;
          codigo_tarjeta_campus?: string | null;
          created_at?: string | null;
          cupos_disponibles?: number | null;
          descripcion_larga?: string | null;
          direccion?: string | null;
          estado_convocatoria?: string | null;
          estado_gestion?: string | null;
          fecha_encuentro_inicial?: string | null;
          fecha_fin_inscripcion?: string | null;
          fecha_finalizacion?: string | null;
          fecha_inicio?: string | null;
          fecha_inicio_inscripcion?: string | null;
          fecha_publicacion?: string | null;
          fecha_relanzamiento?: string | null;
          horario_seleccionado?: string | null;
          horarios_fijos?: boolean | null;
          horas_acreditadas?: number | null;
          id?: string;
          informe?: string | null;
          institucion_id?: string | null;
          mensaje_whatsapp?: string | null;
          nombre_pps?: string | null;
          notas_gestion?: string | null;
          orientacion?: string | null;
          permite_certificado?: boolean | null;
          plantilla_seguro_url?: string | null;
          plazo_inscripcion_dias?: number | null;
          req_certificado_trabajo?: boolean | null;
          req_cv?: boolean | null;
          requisito_obligatorio?: string | null;
        };
        Relationships: [];
      };
      penalizaciones: {
        Row: {
          airtable_id: string | null;
          convocatoria_afectada: string | null;
          created_at: string | null;
          estudiante_id: string | null;
          fecha_incidente: string | null;
          id: string;
          notas: string | null;
          puntaje_penalizacion: number | null;
          tipo_incumplimiento: string | null;
        };
        Insert: {
          airtable_id?: string | null;
          convocatoria_afectada?: string | null;
          created_at?: string | null;
          estudiante_id?: string | null;
          fecha_incidente?: string | null;
          id?: string;
          notas?: string | null;
          puntaje_penalizacion?: number | null;
          tipo_incumplimiento?: string | null;
        };
        Update: {
          airtable_id?: string | null;
          convocatoria_afectada?: string | null;
          created_at?: string | null;
          estudiante_id?: string | null;
          fecha_incidente?: string | null;
          id?: string;
          notas?: string | null;
          puntaje_penalizacion?: number | null;
          tipo_incumplimiento?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_penalizacion_estudiante";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "penalizaciones_estudiante_id_fkey";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
        ];
      };
      practicas: {
        Row: {
          airtable_id: string | null;
          created_at: string | null;
          especialidad: string | null;
          estado: string | null;
          estudiante_id: string | null;
          fecha_finalizacion: string | null;
          fecha_inicio: string | null;
          horas_realizadas: number | null;
          id: string;
          lanzamiento_id: string | null;
          nombre_institucion: string | null;
          nota: string | null;
        };
        Insert: {
          airtable_id?: string | null;
          created_at?: string | null;
          especialidad?: string | null;
          estado?: string | null;
          estudiante_id?: string | null;
          fecha_finalizacion?: string | null;
          fecha_inicio?: string | null;
          horas_realizadas?: number | null;
          id?: string;
          lanzamiento_id?: string | null;
          nombre_institucion?: string | null;
          nota?: string | null;
        };
        Update: {
          airtable_id?: string | null;
          created_at?: string | null;
          especialidad?: string | null;
          estado?: string | null;
          estudiante_id?: string | null;
          fecha_finalizacion?: string | null;
          fecha_inicio?: string | null;
          horas_realizadas?: number | null;
          id?: string;
          lanzamiento_id?: string | null;
          nombre_institucion?: string | null;
          nota?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_practica_estudiante";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_practica_lanzamiento";
            columns: ["lanzamiento_id"];
            isOneToOne: false;
            referencedRelation: "lanzamientos_pps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practicas_estudiante_id_fkey";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practicas_lanzamiento_id_fkey";
            columns: ["lanzamiento_id"];
            isOneToOne: false;
            referencedRelation: "lanzamientos_pps";
            referencedColumns: ["id"];
          },
        ];
      };
      reminders: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          due_date: string;
          id: string;
          institution_phone: string | null;
          pps_id: string | null;
          pps_name: string | null;
          priority: string;
          snooze_count: number;
          snoozed_until: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_date: string;
          id?: string;
          institution_phone?: string | null;
          pps_id?: string | null;
          pps_name?: string | null;
          priority?: string;
          snooze_count?: number;
          snoozed_until?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string;
          id?: string;
          institution_phone?: string | null;
          pps_id?: string | null;
          pps_name?: string | null;
          priority?: string;
          snooze_count?: number;
          snoozed_until?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      solicitudes_modificacion_pps: {
        Row: {
          comentario_rechazo: string | null;
          created_at: string | null;
          estado: string;
          estudiante_id: string;
          horas_nuevas: number | null;
          id: string;
          notas_admin: string | null;
          planilla_asistencia_url: string | null;
          practica_id: string;
          tipo_modificacion: string;
          updated_at: string | null;
        };
        Insert: {
          comentario_rechazo?: string | null;
          created_at?: string | null;
          estado?: string;
          estudiante_id: string;
          horas_nuevas?: number | null;
          id?: string;
          notas_admin?: string | null;
          planilla_asistencia_url?: string | null;
          practica_id: string;
          tipo_modificacion: string;
          updated_at?: string | null;
        };
        Update: {
          comentario_rechazo?: string | null;
          created_at?: string | null;
          estado?: string;
          estudiante_id?: string;
          horas_nuevas?: number | null;
          id?: string;
          notas_admin?: string | null;
          planilla_asistencia_url?: string | null;
          practica_id?: string;
          tipo_modificacion?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "solicitudes_modificacion_pps_estudiante_id_fkey";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_modificacion_pps_practica_id_fkey";
            columns: ["practica_id"];
            isOneToOne: false;
            referencedRelation: "practicas";
            referencedColumns: ["id"];
          },
        ];
      };
      solicitudes_nueva_pps: {
        Row: {
          comentario_rechazo: string | null;
          created_at: string | null;
          es_online: boolean;
          estado: string;
          estudiante_id: string;
          fecha_finalizacion: string;
          fecha_inicio: string;
          horas_estimadas: number;
          id: string;
          informe_final_url: string;
          institucion_id: string | null;
          nombre_institucion_manual: string | null;
          notas_admin: string | null;
          orientacion: string;
          planilla_asistencia_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          comentario_rechazo?: string | null;
          created_at?: string | null;
          es_online?: boolean;
          estado?: string;
          estudiante_id: string;
          fecha_finalizacion: string;
          fecha_inicio: string;
          horas_estimadas: number;
          id?: string;
          informe_final_url: string;
          institucion_id?: string | null;
          nombre_institucion_manual?: string | null;
          notas_admin?: string | null;
          orientacion: string;
          planilla_asistencia_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          comentario_rechazo?: string | null;
          created_at?: string | null;
          es_online?: boolean;
          estado?: string;
          estudiante_id?: string;
          fecha_finalizacion?: string;
          fecha_inicio?: string;
          horas_estimadas?: number;
          id?: string;
          informe_final_url?: string;
          institucion_id?: string | null;
          nombre_institucion_manual?: string | null;
          notas_admin?: string | null;
          orientacion?: string;
          planilla_asistencia_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "solicitudes_nueva_pps_estudiante_id_fkey";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_nueva_pps_institucion_id_fkey";
            columns: ["institucion_id"];
            isOneToOne: false;
            referencedRelation: "instituciones";
            referencedColumns: ["id"];
          },
        ];
      };
      solicitudes_pps: {
        Row: {
          actualizacion: string | null;
          airtable_id: string | null;
          contacto_tutor: string | null;
          convenio_uflo: string | null;
          created_at: string | null;
          descripcion_institucion: string | null;
          direccion_completa: string | null;
          email: string | null;
          email_institucion: string | null;
          estado_seguimiento: string | null;
          estudiante_id: string | null;
          id: string;
          legajo: string | null;
          localidad: string | null;
          nombre_alumno: string | null;
          nombre_institucion: string | null;
          notas: string | null;
          orientacion_sugerida: string | null;
          referente_institucion: string | null;
          telefono_institucion: string | null;
          tipo_practica: string | null;
          tutor_disponible: string | null;
        };
        Insert: {
          actualizacion?: string | null;
          airtable_id?: string | null;
          contacto_tutor?: string | null;
          convenio_uflo?: string | null;
          created_at?: string | null;
          descripcion_institucion?: string | null;
          direccion_completa?: string | null;
          email?: string | null;
          email_institucion?: string | null;
          estado_seguimiento?: string | null;
          estudiante_id?: string | null;
          id?: string;
          legajo?: string | null;
          localidad?: string | null;
          nombre_alumno?: string | null;
          nombre_institucion?: string | null;
          notas?: string | null;
          orientacion_sugerida?: string | null;
          referente_institucion?: string | null;
          telefono_institucion?: string | null;
          tipo_practica?: string | null;
          tutor_disponible?: string | null;
        };
        Update: {
          actualizacion?: string | null;
          airtable_id?: string | null;
          contacto_tutor?: string | null;
          convenio_uflo?: string | null;
          created_at?: string | null;
          descripcion_institucion?: string | null;
          direccion_completa?: string | null;
          email?: string | null;
          email_institucion?: string | null;
          estado_seguimiento?: string | null;
          estudiante_id?: string | null;
          id?: string;
          legajo?: string | null;
          localidad?: string | null;
          nombre_alumno?: string | null;
          nombre_institucion?: string | null;
          notas?: string | null;
          orientacion_sugerida?: string | null;
          referente_institucion?: string | null;
          telefono_institucion?: string | null;
          tipo_practica?: string | null;
          tutor_disponible?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_solicitud_estudiante";
            columns: ["estudiante_id"];
            isOneToOne: false;
            referencedRelation: "estudiantes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_reset_password: {
        Args: { legajo_input: string; new_password: string };
        Returns: undefined;
      };
      auth_email: { Args: never; Returns: string };
      check_fcm_token_exists: { Args: { uid: string }; Returns: boolean };
      clean_dirty_text: { Args: { val: string }; Returns: string };
      delete_fcm_token: { Args: { p_user_id: string }; Returns: undefined };
      delete_fcm_token_user: { Args: { uid: string }; Returns: boolean };
      get_all_fcm_tokens: {
        Args: never;
        Returns: {
          fcm_token: string;
        }[];
      };
      get_dashboard_metrics: { Args: { target_year: number }; Returns: Json };
      get_my_role: { Args: never; Returns: string };
      get_postulantes_seleccionados: {
        Args: { lanzamiento_uuid: string };
        Returns: {
          horario: string;
          legajo: string;
          nombre: string;
        }[];
      };
      get_seleccionados: {
        Args: { lanzamiento_id_input: string };
        Returns: {
          horario: string;
          legajo: string;
          nombre: string;
        }[];
      };
      get_student_details_by_legajo: {
        Args: { legajo_input: string };
        Returns: {
          correo: string;
          dni: number;
          id: string;
          legajo: string;
          must_change_password: boolean;
          nombre: string;
          role: string;
          telefono: string;
          user_id: string;
        }[];
      };
      get_student_email_by_legajo: {
        Args: { legajo_input: string };
        Returns: Json;
      };
      get_student_for_signup: {
        Args: { legajo_input: string };
        Returns: {
          apellido_separado: string;
          id: string;
          nombre: string;
          nombre_separado: string;
          user_id: string;
        }[];
      };
      increment_snooze_count: { Args: { reminder_id: string }; Returns: number };
      is_admin: { Args: never; Returns: boolean };
      mark_password_changed: { Args: never; Returns: undefined };
      register_new_student: {
        Args: {
          correo_input: string;
          dni_input: number;
          legajo_input: string;
          telefono_input: string;
          userid_input: string;
        };
        Returns: undefined;
      };
      save_fcm_token: { Args: { tok: string; uid: string }; Returns: boolean };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
