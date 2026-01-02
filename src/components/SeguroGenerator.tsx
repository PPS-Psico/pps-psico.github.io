
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/db';
import { supabase } from '../lib/supabaseClient';
import { formatDate, normalizeStringForComparison, simpleNameSplit, safeGetId } from '../utils/formatters';
import type { Convocatoria } from '../types';
import {
    FIELD_NOMBRE_PPS_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_FECHA_INICIO_CONVOCATORIAS,
    FIELD_FECHA_FIN_CONVOCATORIAS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_DNI_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_TELEFONO_ESTUDIANTES,
    FIELD_NOMBRE_SEPARADO_ESTUDIANTES,
    FIELD_APELLIDO_SEPARADO_ESTUDIANTES,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_DIRECCION_LANZAMIENTOS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_FECHA_FIN_LANZAMIENTOS,
    FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_DIRECCION_CONVOCATORIAS,
    FIELD_HORARIO_FORMULA_CONVOCATORIAS,
    FIELD_ORIENTACION_CONVOCATORIAS,
} from '../constants';
import Loader from './Loader';
import EmptyState from './EmptyState';
import Checkbox from './Checkbox';
import Toast from './Toast';
import Card from './Card';

interface SeguroGeneratorProps {
    showModal: (title: string, message: string) => void;
    isTestingMode?: boolean;
    preSelectedLanzamientoId?: string | null;
}

interface StudentForReview {
    studentId: string;
    nombre: string;
    apellido: string;
    dni: string;
    legajo: string;
    correo: string;
    telefono: string;
    institucion: string;
    direccion: string;
    periodo: string;
    horario: string;
    // Campos calculados para el Excel de Seguro
    cargo: string;
    lugarCompleto: string;
    duracionCompleta: string; 
    tutor: string;
    orientacion: string;
}

function formatPhoneNumber(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/^\+54\s?9?\s?/, '').trim();
}

const SeguroGenerator: React.FC<SeguroGeneratorProps> = ({ showModal, isTestingMode = false, preSelectedLanzamientoId }) => {
    const [step, setStep] = useState<'selection' | 'review'>('selection');
    
    const [convocatorias, setConvocatorias] = useState<any[]>([]); // Use any[] for aggregated objects
    const [selectedConvocatorias, setSelectedConvocatorias] = useState<Set<string>>(new Set());
    const [studentsForReview, setStudentsForReview] = useState<StudentForReview[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // --- PASO 1: Cargar Convocatorias ---
    const handleFetchConvocatorias = useCallback(async () => {
        setIsLoading(true);
        setLoadingMessage('Cargando convocatorias...');
        setConvocatorias([]);

        if (isTestingMode) {
             setConvocatorias([{
                id: 'mock_conv_1',
                createdTime: '',
                [FIELD_NOMBRE_PPS_CONVOCATORIAS]: 'Hospital Mock',
                [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: 'Seleccionado',
                [FIELD_FECHA_INICIO_CONVOCATORIAS]: '2024-01-01',
                [FIELD_FECHA_FIN_CONVOCATORIAS]: '2024-06-01',
                [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: 'student_1'
            } as any]);
            setIsLoading(false);
            return;
        }
        
        try {
            // Filter directly using new filters API (Native Supabase ILIKE/EQ)
            const records = await db.convocatorias.getAll({
                filters: { [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: 'Seleccionado' },
                sort: [{ field: FIELD_FECHA_INICIO_CONVOCATORIAS, direction: 'desc' }]
            });

            const groupedConvocatorias = new Map<string, any>();

            records.forEach(record => {
                const lanzId = record[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                const name = record[FIELD_NOMBRE_PPS_CONVOCATORIAS];
                const date = record[FIELD_FECHA_INICIO_CONVOCATORIAS];
                
                // Usamos el ID de lanzamiento como clave primaria si existe, sino fallback
                const key = lanzId || `${name}||${date}`; 
                
                if (!groupedConvocatorias.has(key)) {
                    groupedConvocatorias.set(key, { 
                        ...record, 
                        id: key, // Usamos la key como ID del grupo para la UI
                        [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: [], // Array for aggregated students
                        [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzId
                    });
                }

                const group = groupedConvocatorias.get(key)!;
                const studentId = record[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
                
                if (studentId) {
                     const currentStudents = group[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string[] || [];
                     if (!currentStudents.includes(studentId)) {
                         currentStudents.push(studentId);
                         group[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] = currentStudents;
                     }
                }
            });

            const finalConvocatorias = Array.from(groupedConvocatorias.values())
                .sort((a, b) => new Date(b[FIELD_FECHA_INICIO_CONVOCATORIAS] || '').getTime() - new Date(a[FIELD_FECHA_INICIO_CONVOCATORIAS] || '').getTime())
                .slice(0, 20); 

            setConvocatorias(finalConvocatorias);

        } catch (error: any) {
             showModal('Error de Carga', `No se pudieron cargar las convocatorias: ${error.message}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [isTestingMode, showModal]);

    useEffect(() => {
        handleFetchConvocatorias().then(() => {
            // Si venimos de cerrar una mesa, pre-seleccionar y avanzar
            if (preSelectedLanzamientoId) {
                // Buscar en los grupos cargados si alguno corresponde al ID
                // Nota: En nuestra lógica de arriba, usamos lanzID como key
                setSelectedConvocatorias(new Set([preSelectedLanzamientoId]));
                // Pequeño delay para asegurar que el estado se asiente antes de procesar
                setTimeout(() => handleProceedToReview(new Set([preSelectedLanzamientoId])), 500);
            }
        });
    }, [handleFetchConvocatorias, preSelectedLanzamientoId]);

    // --- PASO 2: Procesar Datos ---
    const handleProceedToReview = async (overrideSelection?: Set<string>) => {
        const selectionToUse = overrideSelection || selectedConvocatorias;
        
        setIsLoading(true);
        setLoadingMessage('Procesando estudiantes...');

        if (isTestingMode) {
             setStudentsForReview([{
                 studentId: 's1', nombre: 'Juan', apellido: 'Test', dni: '123', legajo: '111', correo: 'j@t.com', telefono: '111', institucion: 'Hosp Test', direccion: 'Calle 1', periodo: 'Ene-Jun', horario: '9-18', cargo: 'Estudiante', lugarCompleto: 'Hosp Test - Calle 1', duracionCompleta: 'Periodo: Ene-Jun. Horario: 9-18', tutor: 'Tutor 1', orientacion: 'Clinica'
             }]);
             setStep('review');
             setIsLoading(false);
             return;
        }

        // Filter convocatorias based on selection ID
        const selectedGroups = convocatorias.filter(c => selectionToUse.has(c.id));
        
        const studentIds = new Set<string>();
        
        selectedGroups.forEach(group => {
            (group[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string[] || []).forEach(id => studentIds.add(id));
        });

        if (studentIds.size === 0) {
            // Si se llamó automáticamente pero no se encontraron estudiantes (raro pero posible si falló carga), no avanzar
            if (!overrideSelection) showModal('Sin Estudiantes', 'No hay estudiantes en las convocatorias seleccionadas.');
            setIsLoading(false);
            return;
        }

        try {
            const [estudiantesRes, lanzamientosRes, convocatoriasRes] = await Promise.all([
                db.estudiantes.getAll(),
                db.lanzamientos.getAll(),
                db.convocatorias.getAll()
            ]);

            const studentMap = new Map(estudiantesRes.map(r => [r.id, r]));
            const lanzamientoMap = new Map(lanzamientosRes.map(r => [r.id, r]));
            
            // Map studentID-launchID to specific fields like 'Horario'
            const convMap = new Map<string, any>();
            convocatoriasRes.forEach(c => {
                 const sId = c[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS];
                 const lId = c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                 
                 if(sId && lId) convMap.set(`${sId}-${lId}`, c);
            });

            const compiledList: StudentForReview[] = [];

            for (const group of selectedGroups) {
                const groupLanzamientoId = group[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                const ppsData = groupLanzamientoId ? lanzamientoMap.get(groupLanzamientoId) : undefined;
                const groupStudents = group[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string[] || [];

                for (const sId of groupStudents) {
                    const student = studentMap.get(sId);
                    if (!student) continue;

                    const specificConv = convMap.get(`${sId}-${groupLanzamientoId}`);
                    
                    const institucion = ppsData?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] || group[FIELD_NOMBRE_PPS_CONVOCATORIAS] || 'N/A';
                    const direccion = ppsData?.[FIELD_DIRECCION_LANZAMIENTOS] || group[FIELD_DIRECCION_CONVOCATORIAS] || '';
                    const fechaInicio = ppsData?.[FIELD_FECHA_INICIO_LANZAMIENTOS] || group[FIELD_FECHA_INICIO_CONVOCATORIAS];
                    const fechaFin = ppsData?.[FIELD_FECHA_FIN_LANZAMIENTOS] || group[FIELD_FECHA_FIN_CONVOCATORIAS];
                    
                    const horario = specificConv?.[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || ppsData?.[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] || 'A definir';
                    const orientacion = ppsData?.[FIELD_ORIENTACION_LANZAMIENTOS] || group[FIELD_ORIENTACION_CONVOCATORIAS] || 'General';

                    const fullName = student[FIELD_NOMBRE_ESTUDIANTES] || '';
                    let nombre = String(student[FIELD_NOMBRE_SEPARADO_ESTUDIANTES] ?? '');
                    let apellido = String(student[FIELD_APELLIDO_SEPARADO_ESTUDIANTES] ?? '');

                    if (!nombre || !apellido) {
                        const split = simpleNameSplit(fullName);
                        nombre = split.nombre;
                        apellido = split.apellido;
                    }

                    const periodoValue = `Del ${formatDate(fechaInicio)} al ${formatDate(fechaFin)}`;

                    let tutor = 'N/A';
                    const normOrientacion = normalizeStringForComparison(orientacion);
                    if (normOrientacion.includes('clinica')) tutor = 'Selva Estrella';
                    else if (normOrientacion.includes('educacional')) tutor = 'Franco Pedraza';
                    else if (normOrientacion.includes('laboral') || normOrientacion.includes('comunitaria')) tutor = 'Cynthia Rossi';

                    // Formato limpio para lugar y duración
                    const lugarCompleto = direccion ? `${institucion} - ${direccion}` : institucion;
                    const duracionCompleta = `Período: ${periodoValue}. Horario: ${horario}`;

                    compiledList.push({
                        studentId: sId,
                        nombre, apellido,
                        dni: String(student[FIELD_DNI_ESTUDIANTES] || 'N/A'),
                        legajo: String(student[FIELD_LEGAJO_ESTUDIANTES] || 'N/A'),
                        correo: String(student[FIELD_CORREO_ESTUDIANTES] || 'N/A'),
                        telefono: formatPhoneNumber(String(student[FIELD_TELEFONO_ESTUDIANTES] || '')),
                        institucion,
                        direccion,
                        periodo: periodoValue,
                        horario,
                        // CAMPOS ESPECÍFICOS PARA SEGURO ART (Requerimiento del usuario)
                        cargo: 'Estudiante',
                        lugarCompleto,
                        duracionCompleta,
                        tutor,
                        orientacion
                    });
                }
            }

            setStudentsForReview(compiledList);
            setStep('review');

        } catch (e: any) {
            console.error(e);
            showModal('Error', 'Ocurrió un error al procesar los datos.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    // --- Generar Excel (Lista Institución) ---
    const handleGenerateSelectionExcel = async () => {
        if (studentsForReview.length === 0) return;

        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            
            const studentsByInstitution = studentsForReview.reduce((acc, student) => {
                const key = student.institucion;
                if (!acc[key]) acc[key] = [];
                acc[key].push(student);
                return acc;
            }, {} as Record<string, StudentForReview[]>);

            for (const institucion in studentsByInstitution) {
                const group = studentsByInstitution[institucion];
                let baseSheetName = institucion.replace(/[\\/?*[\]]/g, "").substring(0, 25) || 'PPS';
                const worksheet = workbook.addWorksheet(baseSheetName);

                worksheet.columns = [
                    { header: 'APELLIDO', key: 'apellido', width: 25 },
                    { header: 'NOMBRE', key: 'nombre', width: 25 },
                    { header: 'DNI', key: 'dni', width: 15 },
                    { header: 'LEGAJO', key: 'legajo', width: 15 },
                    { header: 'CORREO', key: 'correo', width: 30 },
                    { header: 'TELEFONO', key: 'telefono', width: 20 },
                    { header: 'HORARIO', key: 'horario', width: 30 },
                ];
                
                worksheet.addRows(group);
                
                worksheet.getRow(1).font = { bold: true };
                worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
            }
            
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Listado_Alumnos_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setToastInfo({ message: 'Excel generado correctamente.', type: 'success' });

        } catch (e: any) {
            showModal('Error', 'No se pudo generar el Excel: ' + e.message);
        }
    };

    // --- Descargar Plantilla de Seguro ---
    const handleDownloadTemplate = async (institutionName: string) => {
        try {
            setIsLoading(true);
            setLoadingMessage('Descargando plantilla...');
            
            const { data, error } = await supabase
                .storage
                .from('documentos_seguros')
                .download('Seguro (2).xlsx');

            if (error) throw error;
            if (!data) throw new Error('El archivo descargado está vacío.');

            const blob = data;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const cleanName = institutionName.replace(/[\\/?*[\]]/g, "").substring(0, 50);
            link.download = `Seguro - ${cleanName}.xlsx`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setToastInfo({ message: 'Plantilla descargada. Ahora copia los datos.', type: 'success' });

        } catch (e: any) {
            console.error('Error detallado descarga:', e);
            let errorMessage = 'Error desconocido al descargar la plantilla.';
            if (e.message) errorMessage = e.message;
            else if (e.error_description) errorMessage = e.error_description;
            else if (e.error) errorMessage = typeof e.error === 'string' ? e.error : JSON.stringify(e.error);
            
            showModal('Error de Descarga', `No se pudo descargar la plantilla.\n\nDetalle: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    // --- Copiar al Portapapeles ---
    const handleCopyToClipboard = (students: StudentForReview[]) => {
        const rows = students.map(s => [
            s.apellido,
            s.nombre,
            s.dni,
            s.legajo,
            s.cargo,
            s.lugarCompleto,
            s.duracionCompleta
        ].join('\t'));

        const text = rows.join('\n');
        
        navigator.clipboard.writeText(text).then(() => {
            setToastInfo({ message: `${students.length} filas copiadas. Pegar en el Excel de Seguro (celda A2).`, type: 'success' });
        }).catch(err => {
            console.error('Failed to copy', err);
            setToastInfo({ message: 'Error al copiar los datos.', type: 'error' });
        });
    };

    // --- Enviar a Administración (Step 3) ---
    const handleSendToAdmin = (institutionName: string) => {
        const subject = `Reporte de Seguro - ${institutionName}`;
        const body = `Hola Sergio,\n\nTe adjunto el seguro de la PPS.\n\nSaludos.`;
        const mailto = `mailto:mesadeayuda.patagonia@uflouniversidad.edu.ar?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        window.open(mailto, '_blank');
        setToastInfo({ message: 'Ventana de correo abierta. Adjunta el Excel generado.', type: 'success' });
    };

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedConvocatorias);
        newSelection.has(id) ? newSelection.delete(id) : newSelection.add(id);
        setSelectedConvocatorias(newSelection);
    };

    const renderSelectionStep = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Paso 1: Seleccionar Convocatorias</h3>
                <p className="text-slate-600 dark:text-slate-400">Seleccione las convocatorias con alumnos seleccionados para procesar.</p>
            </div>

            {isLoading ? <Loader /> : convocatorias.length === 0 ? (
                <EmptyState icon="event_busy" title="Sin Convocatorias" message="No se encontraron convocatorias recientes con alumnos seleccionados." />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="p-3 w-10"><span className="sr-only">Select</span></th>
                                <th className="p-3">Institución (Lanzamiento)</th>
                                <th className="p-3 text-center">Alumnos</th>
                                <th className="p-3">Fecha Inicio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {convocatorias.map(conv => (
                                <tr key={conv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="p-3">
                                        <Checkbox 
                                            id={`conv-${conv.id}`} 
                                            name="conv" 
                                            checked={selectedConvocatorias.has(conv.id)} 
                                            onChange={() => toggleSelection(conv.id)}
                                            label=""
                                        />
                                    </td>
                                    <td className="p-3 font-medium text-slate-900 dark:text-white">
                                        {conv[FIELD_NOMBRE_PPS_CONVOCATORIAS]}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-blue-100 bg-blue-600 rounded-full">
                                            {(conv[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as any[])?.length || 0}
                                        </span>
                                    </td>
                                    <td className="p-3 text-slate-500 dark:text-slate-400">
                                        {formatDate(conv[FIELD_FECHA_INICIO_CONVOCATORIAS])}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            <div className="flex justify-end mt-4">
                 <button 
                    onClick={() => handleProceedToReview()} 
                    disabled={selectedConvocatorias.size === 0 || isLoading}
                    className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <span>Continuar</span>
                    <span className="material-icons !text-base">arrow_forward</span>
                </button>
            </div>
        </div>
    );

    const renderReviewStep = () => {
        const grouped = studentsForReview.reduce((acc, curr) => {
            if (!acc[curr.institucion]) acc[curr.institucion] = [];
            acc[curr.institucion].push(curr);
            return acc;
        }, {} as Record<string, StudentForReview[]>);

        return (
            <div className="space-y-6">
                 <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Paso 2: Generar Documentación</h3>
                        <p className="text-slate-600 dark:text-slate-400">1. Descarga plantilla. 2. Copia datos. 3. Envía a Administración.</p>
                    </div>
                    <button onClick={() => setStep('selection')} className="text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1">
                        <span className="material-icons !text-base">arrow_back</span> Volver
                    </button>
                </div>

                {Object.entries(grouped).map(([institucion, students]: [string, StudentForReview[]], idx) => (
                    <Card key={idx} title={institucion} description={`${students.length} alumnos asignados`}>
                        <div className="mt-4 space-y-4">
                             <div className="flex flex-wrap gap-3 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700">
                                 <button 
                                    onClick={() => handleDownloadTemplate(institucion)}
                                    disabled={isLoading}
                                    className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
                                 >
                                     <span className="material-icons !text-lg">download</span>
                                     1. Descargar Plantilla
                                 </button>
                                 <button 
                                    onClick={() => handleCopyToClipboard(students)}
                                    className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
                                 >
                                     <span className="material-icons !text-lg">content_copy</span>
                                     2. Copiar Datos
                                 </button>
                                 <button 
                                    onClick={() => handleSendToAdmin(institucion)}
                                    className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
                                 >
                                     <span className="material-icons !text-lg">send</span>
                                     3. Enviar a Sergio
                                 </button>
                             </div>
                             
                             <details className="group">
                                <summary className="cursor-pointer text-sm font-medium text-slate-500 dark:text-slate-400 list-none flex items-center gap-2">
                                    <span className="material-icons transition-transform group-open:rotate-90">chevron_right</span>
                                    Ver lista de alumnos ({students.length})
                                </summary>
                                <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm mt-2 pl-6 border-l-2 border-slate-200 dark:border-slate-700">
                                    {students.map(s => (
                                        <li key={s.studentId} className="py-2">
                                            <span className="font-semibold">{s.apellido}, {s.nombre}</span>
                                            <span className="text-slate-500 ml-2">DNI: {s.dni}</span>
                                        </li>
                                    ))}
                                </ul>
                             </details>
                        </div>
                    </Card>
                ))}
                
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={handleGenerateSelectionExcel}
                        className="bg-slate-600 text-white font-bold py-2.5 px-6 rounded-lg shadow-md hover:bg-slate-700 flex items-center gap-2"
                    >
                        <span className="material-icons !text-base">table_view</span>
                        Descargar Listado General
                    </button>
                </div>
            </div>
        );
    };

    return (
        <Card title="Generador de Seguros y Listas" icon="shield">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                {step === 'selection' ? renderSelectionStep() : renderReviewStep()}
            </div>
        </Card>
    );
};

export default SeguroGenerator;
