
import { ALL_ORIENTACIONES } from '../types';

// Helper for consistent dates
const NOW = new Date();
const currentYear = NOW.getFullYear();
const STR_NOW = NOW.toISOString();
const STR_FUTURE = new Date(NOW.getTime() + 86400000 * 30).toISOString(); // +30 days
const STR_PAST = new Date(NOW.getTime() - 86400000 * 30).toISOString(); // -30 days
const STR_FAR_PAST = new Date(NOW.getTime() - 86400000 * 365).toISOString(); // -1 year

// Instituciones Reales (Ámbito Psicología)
export const MOCK_INSTITUCIONES = [
    { id: 'inst_1', created_at: STR_PAST, nombre: 'Hospital Garrahan', direccion: 'Pichincha 1890', telefono: '4122-6000', convenio_nuevo: true, tutor: 'Lic. Peralta' },
    { id: 'inst_2', created_at: STR_PAST, nombre: 'Clínica San Jorge', direccion: 'Av. Maipú 1234', telefono: '4790-1000', convenio_nuevo: false, tutor: 'Lic. Fernandez' },
    { id: 'inst_3', created_at: STR_PAST, nombre: 'Fundación Sí', direccion: 'Ángel Carranza 1962', telefono: '4775-6900', convenio_nuevo: true, tutor: 'Lic. Gomez' },
    { id: 'inst_4', created_at: STR_PAST, nombre: 'ManpowerGroup', direccion: 'F. Alcorta 3351', telefono: '4809-5100', convenio_nuevo: true, tutor: 'Lic. Martinez' },
    { id: 'inst_5', created_at: STR_PAST, nombre: 'Centro de Salud Mental N°1', direccion: 'Manuela Pedraza 1558', telefono: '4702-7489', convenio_nuevo: true, tutor: 'Lic. Lopez' },
];

// Alumnos
export const MOCK_ESTUDIANTES = [
    // Usuario de Prueba (Tú)
    { 
        id: 'st_999', 
        created_at: STR_PAST,
        legajo: '99999', 
        nombre: 'Usuario de Prueba', 
        dni: 12345678, 
        correo: 'tester@uflo.edu.ar', 
        telefono: '11-9999-9999',
        orientacion_elegida: 'Clinica', 
        total_horas: 260, // Listo para acreditar
        finalizaron: false,
        notas_internas: 'Alumno para demostración de flujos.'
    }, 
    // Compañeros para rellenar listas
    { id: 'st_1', created_at: STR_PAST, legajo: '35123', nombre: 'Sofía Martínez', dni: 38111, correo: 'sofia@test.com', orientacion_elegida: 'Clinica', total_horas: 180, finalizaron: false }, 
    { id: 'st_2', created_at: STR_PAST, legajo: '36451', nombre: 'Lucas Pérez', dni: 40222, correo: 'lucas@test.com', orientacion_elegida: 'Laboral', total_horas: 40, finalizaron: false }, 
    { id: 'st_3', created_at: STR_PAST, legajo: '33999', nombre: 'Camila López', dni: 37333, correo: 'cami@test.com', orientacion_elegida: 'Educacional', total_horas: 260, finalizaron: false }, 
    { id: 'st_4', created_at: STR_PAST, legajo: '31000', nombre: 'Martín Garcia', dni: 35444, correo: 'martin@test.com', orientacion_elegida: 'Comunitaria', total_horas: 100, finalizaron: false }, 
    { id: 'st_5', created_at: STR_PAST, legajo: '32555', nombre: 'Ana Torres', dni: 39555, correo: 'ana@test.com', orientacion_elegida: 'Clinica', total_horas: 250, finalizaron: true, fecha_finalizacion: STR_PAST }, 
];

// Lanzamientos (Las 3 situaciones + 1 nueva para inscribirse)
export const MOCK_LANZAMIENTOS = [
    // ESCENARIO 1: Seleccionado (Conjunto)
    { 
        id: 'lanz_1', 
        created_at: STR_NOW,
        nombre_pps: 'Hospital Garrahan - Guardia Pediátrica', 
        fecha_inicio: `${currentYear}-03-15`, 
        fecha_fin: `${currentYear}-07-15`, 
        orientacion: 'Clinica', 
        cupos_disponibles: 3, 
        estado_convocatoria: 'Abierta', // Aún abierta pero ya seleccionado
        estado_gestion: 'Relanzamiento Confirmado',
        horario_seleccionado: 'Lunes 8 a 12hs; Miércoles 8 a 12hs',
        direccion: 'Pichincha 1890',
        horas_acreditadas: 80,
        req_certificado_trabajo: true
    },
    // ESCENARIO 2: Lista Visible (No Seleccionado / Cerrada)
    { 
        id: 'lanz_2', 
        created_at: STR_PAST,
        nombre_pps: 'Clínica San Jorge - Admisiones', 
        fecha_inicio: `${currentYear}-04-01`, 
        fecha_fin: `${currentYear}-08-01`, 
        orientacion: 'Clinica', 
        cupos_disponibles: 5, 
        estado_convocatoria: 'Cerrado', // Cerrada, muestra lista
        estado_gestion: 'Relanzamiento Confirmado',
        horario_seleccionado: 'Martes 14 a 18hs',
        direccion: 'Av. Maipú 1234',
        horas_acreditadas: 60,
        req_cv: true
    },
    // ESCENARIO 3: Inscripto (Esperando)
    { 
        id: 'lanz_3', 
        created_at: STR_NOW,
        nombre_pps: 'Fundación Sí - Abordaje Comunitario', 
        fecha_inicio: `${currentYear}-05-01`, 
        fecha_fin: `${currentYear}-09-01`, 
        orientacion: 'Comunitaria', 
        cupos_disponibles: 10, 
        estado_convocatoria: 'Abierta',
        estado_gestion: 'Relanzamiento Confirmado',
        horario_seleccionado: 'Sábados 10 a 14hs',
        direccion: 'Ángel Carranza 1962',
        horas_acreditadas: 40
    },
    // Historial (Archivada) - Año Pasado
    { 
        id: 'lanz_4', 
        created_at: STR_FAR_PAST,
        nombre_pps: 'ManpowerGroup - Selección IT', 
        fecha_inicio: `${currentYear - 1}-08-01`, 
        fecha_fin: `${currentYear - 1}-12-01`, 
        orientacion: 'Laboral', 
        cupos_disponibles: 4, 
        estado_convocatoria: 'Cerrado',
        estado_gestion: 'Archivado', 
        horario_seleccionado: 'Full time',
        direccion: 'Remoto',
        horas_acreditadas: 120
    },
    // ESCENARIO 4: DISPONIBLE PARA INSCRIBIRSE (NUEVA)
    { 
        id: 'lanz_5', 
        created_at: STR_NOW,
        nombre_pps: 'Centro de Salud Mental N°1 - Consultorios Externos', 
        fecha_inicio: `${currentYear}-06-01`, 
        fecha_fin: `${currentYear}-11-01`, 
        orientacion: 'Clinica', 
        cupos_disponibles: 8, 
        estado_convocatoria: 'Abierta',
        estado_gestion: 'Relanzamiento Confirmado',
        horario_seleccionado: 'Jueves 8 a 13hs',
        direccion: 'Manuela Pedraza 1558',
        horas_acreditadas: 60
    }
];

// Convocatorias (Vínculos)
export const MOCK_CONVOCATORIAS = [
    // Escenario 1: Tester Seleccionado con otros
    { id: 'conv_1', lanzamiento_id: 'lanz_1', estudiante_id: 'st_999', estado_inscripcion: 'Seleccionado', horario_seleccionado: 'Lunes 8 a 12hs', created_at: STR_NOW },
    { id: 'conv_2', lanzamiento_id: 'lanz_1', estudiante_id: 'st_1', estado_inscripcion: 'Seleccionado', horario_seleccionado: 'Miércoles 8 a 12hs', created_at: STR_NOW },
    { id: 'conv_3', lanzamiento_id: 'lanz_1', estudiante_id: 'st_2', estado_inscripcion: 'Inscripto', horario_seleccionado: 'Lunes 8 a 12hs', created_at: STR_NOW }, // Uno en espera

    // Escenario 2: Tester No Quedó (o no se inscribió, pero ve lista), Otros sí
    { id: 'conv_4', lanzamiento_id: 'lanz_2', estudiante_id: 'st_3', estado_inscripcion: 'Seleccionado', horario_seleccionado: 'Martes 14 a 18hs', created_at: STR_PAST },
    { id: 'conv_5', lanzamiento_id: 'lanz_2', estudiante_id: 'st_4', estado_inscripcion: 'Seleccionado', horario_seleccionado: 'Martes 14 a 18hs', created_at: STR_PAST },

    // Escenario 3: Tester Inscripto (Esperando acción del Admin)
    { id: 'conv_6', lanzamiento_id: 'lanz_3', estudiante_id: 'st_999', estado_inscripcion: 'Inscripto', horario_seleccionado: 'Sábados 10 a 14hs', created_at: STR_NOW },
    { id: 'conv_7', lanzamiento_id: 'lanz_3', estudiante_id: 'st_2', estado_inscripcion: 'Inscripto', horario_seleccionado: 'Sábados 10 a 14hs', created_at: STR_NOW },
    
    // Escenario 4: lanz_5 está libre (sin convocatoria para st_999)
];

export const MOCK_PRACTICAS = [
    // Práctica Histórica del Tester
    { 
        id: 'prac_1', 
        created_at: STR_FAR_PAST,
        estudiante_id: 'st_999', 
        lanzamiento_id: 'lanz_4', 
        nombre_institucion: 'ManpowerGroup - Selección IT', 
        horas_realizadas: 120, 
        estado: 'Finalizada', 
        nota: '9', 
        especialidad: 'Laboral', 
        fecha_inicio: `${currentYear - 1}-08-01`,
        fecha_finalizacion: `${currentYear - 1}-12-01`
    },
    // Práctica en Curso (Vinculada al escenario 1)
    {
        id: 'prac_2',
        created_at: STR_PAST,
        estudiante_id: 'st_999',
        lanzamiento_id: 'lanz_1', // Vinculada al Garrahan
        nombre_institucion: 'Hospital Garrahan - Guardia Pediátrica',
        horas_realizadas: 40,
        estado: 'En curso',
        nota: 'Sin calificar',
        especialidad: 'Clinica',
        fecha_inicio: `${currentYear}-03-15`,
        fecha_finalizacion: `${currentYear}-07-15`
    },
    // Prácticas para otros alumnos (para métricas y penalizaciones)
    { id: 'prac_3', created_at: STR_PAST, estudiante_id: 'st_1', lanzamiento_id: 'lanz_1', nombre_institucion: 'Hosp. Garrahan', horas_realizadas: 80, estado: 'En curso', nota: 'Sin calificar', especialidad: 'Clinica', fecha_inicio: `${currentYear}-03-15` },
    { id: 'prac_4', created_at: STR_FAR_PAST, estudiante_id: 'st_2', lanzamiento_id: 'lanz_4', nombre_institucion: 'Manpower', horas_realizadas: 40, estado: 'Finalizada', nota: '4', especialidad: 'Laboral', fecha_inicio: `${currentYear - 1}-08-01` },
];

export const MOCK_SOLICITUDES = [
    {
        id: 'sol_1',
        created_at: STR_PAST,
        estudiante_id: 'st_999',
        nombre_alumno: 'Usuario de Prueba',
        legajo: '99999',
        email: 'tester@uflo.edu.ar',
        nombre_institucion: 'Centro Racker',
        estado_seguimiento: 'Realizando convenio',
        tipo_practica: 'Individual',
        actualizacion: STR_NOW,
        notas: 'En espera de la firma del convenio específico.'
    },
    {
        id: 'sol_2',
        created_at: STR_NOW,
        estudiante_id: 'st_2',
        nombre_alumno: 'Lucas Pérez',
        legajo: '36451',
        email: 'lucas@test.com',
        nombre_institucion: 'Clínica de la Esperanza',
        estado_seguimiento: 'Pendiente',
        tipo_practica: 'Individual',
        actualizacion: STR_NOW,
        notas: 'Nueva solicitud.'
    }
];

export const MOCK_PENALIZACIONES = [
    {
        id: 'pen_1',
        created_at: STR_FAR_PAST,
        estudiante_id: 'st_2', // Lucas Pérez
        tipo_incumplimiento: 'Baja Anticipada',
        fecha_incidente: `${currentYear - 1}-10-15`,
        notas: 'Dejó la práctica sin aviso previo.',
        puntaje_penalizacion: 50,
        convocatoria_afectada: 'lanz_4' // Manpower
    }
];

export const MOCK_FINALIZACIONES = [
    {
        id: 'fin_1',
        created_at: STR_NOW,
        estudiante_id: 'st_3', // Camila López (Tiene muchas horas)
        fecha_solicitud: STR_NOW,
        estado: 'Pendiente',
        informe_final_url: 'mock_url_informe.pdf',
        planilla_horas_url: 'mock_url_horas.xlsx',
        sugerencias_mejoras: 'Todo muy bien, gracias.'
    }
];
