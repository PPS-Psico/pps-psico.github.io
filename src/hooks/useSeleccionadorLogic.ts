
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import { mockDb } from '../services/mockDb';
import { toggleStudentSelection } from '../services/dataService';
import {
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_TERMINO_CURSAR_CONVOCATORIAS,
    FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS,
    FIELD_FINALES_ADEUDA_CONVOCATORIAS,
    FIELD_OTRA_SITUACION_CONVOCATORIAS,
    FIELD_HORARIO_FORMULA_CONVOCATORIAS,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_ESTUDIANTE_LINK_PRACTICAS,
    FIELD_HORAS_PRACTICAS,
    FIELD_PENALIZACION_ESTUDIANTE_LINK,
    FIELD_PENALIZACION_PUNTAJE,
    FIELD_TRABAJA_CONVOCATORIAS,
    FIELD_TRABAJA_ESTUDIANTES,
    FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES,
    FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS,
    FIELD_CV_CONVOCATORIAS
} from '../constants';
import { normalizeStringForComparison, cleanDbValue } from '../utils/formatters';
import type { LanzamientoPPS, AirtableRecord, EnrichedStudent, ConvocatoriaFields } from '../types';
import { sendSmartEmail } from '../utils/emailService';

const SCORE_WEIGHTS = {
    TERMINO_CURSAR: 100,
    CURSANDO_ELECTIVAS: 50,
    BASE_FINALES: 30,
    PER_HOUR: 0.5,
    TRABAJA: 20,
};

const calculateScore = (
    enrollment: AirtableRecord<ConvocatoriaFields>,
    hours: number,
    penalties: number,
    works: boolean
): number => {
    let academicScore = 0;
    const termino = enrollment[FIELD_TERMINO_CURSAR_CONVOCATORIAS] === 'Sí';
    const electivas = enrollment[FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS] === 'Sí';

    if (termino) {
        academicScore = SCORE_WEIGHTS.TERMINO_CURSAR;
    } else if (electivas) {
        academicScore = SCORE_WEIGHTS.CURSANDO_ELECTIVAS;
    } else {
        academicScore = SCORE_WEIGHTS.BASE_FINALES;
    }

    const hoursScore = hours * SCORE_WEIGHTS.PER_HOUR;
    const workScore = works ? SCORE_WEIGHTS.TRABAJA : 0;
    const penaltyScore = penalties;

    return Math.round(academicScore + hoursScore + workScore - penaltyScore);
};

export const useSeleccionadorLogic = (isTestingMode = false, onNavigateToInsurance?: (id: string) => void, initialLaunchId?: string | null) => {
    const [selectedLanzamiento, setSelectedLanzamiento] = useState<LanzamientoPPS | null>(null);
    const [viewMode, setViewMode] = useState<'selection' | 'review'>('selection');
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [isClosingTable, setIsClosingTable] = useState(false);

    const queryClient = useQueryClient();

    const { data: openLaunches = [], isLoading: isLoadingLaunches } = useQuery({
        queryKey: ['openLaunchesForSelector', isTestingMode],
        queryFn: async () => {
            let records: any[] = [];
            if (isTestingMode) {
                records = await mockDb.getAll('lanzamientos_pps');
            } else {
                records = await db.lanzamientos.getAll();
            }

            return records
                .map(r => {
                    // PRE-CLEAN DATA ON FETCH
                    const cleaned = { ...r };
                    cleaned[FIELD_NOMBRE_PPS_LANZAMIENTOS] = cleanDbValue(r[FIELD_NOMBRE_PPS_LANZAMIENTOS]);
                    return cleaned as LanzamientoPPS;
                })
                .filter(l => {
                    const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
                    return status === 'abierta' || status === 'abierto';
                });
        }
    });

    useEffect(() => {
        if (initialLaunchId && openLaunches.length > 0 && !selectedLanzamiento) {
            const target = openLaunches.find(l => l.id === initialLaunchId);
            if (target) {
                setSelectedLanzamiento(target);
            }
        }
    }, [initialLaunchId, openLaunches, selectedLanzamiento]);

    const candidatesQueryKey = ['candidatesForLaunch', selectedLanzamiento?.id, isTestingMode];

    const { data: candidates = [], isLoading: isLoadingCandidates, refetch: refetchCandidates } = useQuery({
        queryKey: candidatesQueryKey,
        queryFn: async () => {
            if (!selectedLanzamiento) return [];
            const launchId = selectedLanzamiento.id;

            let allEnrollments: any[] = [];
            if (isTestingMode) {
                allEnrollments = await mockDb.getAll('convocatorias');
            } else {
                allEnrollments = await db.convocatorias.getAll();
            }

            // FILTER: Enrollments for this launch
            const enrollments = allEnrollments.filter(c => c[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS] === launchId);

            if (enrollments.length === 0) return [];

            const studentIds = enrollments.map(e => e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]).filter(Boolean) as string[];

            let studentsRes: any[] = [], practicasRes: any[] = [], penaltiesRes: any[] = [];
            if (isTestingMode) {
                [studentsRes, practicasRes, penaltiesRes] = await Promise.all([
                    mockDb.getAll('estudiantes', { id: studentIds }),
                    mockDb.getAll('practicas', { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds }),
                    mockDb.getAll('penalizaciones', { [FIELD_PENALIZACION_ESTUDIANTE_LINK]: studentIds })
                ]);
            } else {
                // Using 'in' filter for array of IDs
                [studentsRes, practicasRes, penaltiesRes] = await Promise.all([
                    db.estudiantes.getAll({ filters: { id: studentIds } }),
                    db.practicas.getAll({ filters: { [FIELD_ESTUDIANTE_LINK_PRACTICAS]: studentIds } }),
                    db.penalizaciones.getAll({ filters: { [FIELD_PENALIZACION_ESTUDIANTE_LINK]: studentIds } })
                ]);
            }

            const studentMap = new Map(studentsRes.map(s => [s.id, s]));

            const enrichedList: EnrichedStudent[] = enrollments.map(enrollment => {
                const sId = enrollment[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string;
                const studentDetails = sId ? studentMap.get(sId) : null;

                if (!studentDetails) return null;

                // Calc total hours & count
                const studentPractices = practicasRes.filter(p => p[FIELD_ESTUDIANTE_LINK_PRACTICAS] === sId);
                const totalHoras = studentPractices.reduce((sum: number, p: any) => sum + (p[FIELD_HORAS_PRACTICAS] || 0), 0);
                const cantPracticas = studentPractices.length;

                // Calc penalties
                const studentPenalties = penaltiesRes.filter(p => p[FIELD_PENALIZACION_ESTUDIANTE_LINK] === sId);
                const penalizacionAcumulada = studentPenalties.reduce((sum: number, p: any) => sum + (p[FIELD_PENALIZACION_PUNTAJE] || 0), 0);

                const works = !!enrollment[FIELD_TRABAJA_CONVOCATORIAS] || !!studentDetails[FIELD_TRABAJA_ESTUDIANTES];
                const cert = enrollment[FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS] || studentDetails[FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES];
                const cvUrl = enrollment[FIELD_CV_CONVOCATORIAS] as string | null;

                const puntajeTotal = calculateScore(enrollment, totalHoras, penalizacionAcumulada, works);

                return {
                    enrollmentId: enrollment.id,
                    studentId: sId,
                    nombre: studentDetails[FIELD_NOMBRE_ESTUDIANTES] || 'Desconocido',
                    legajo: String(studentDetails[FIELD_LEGAJO_ESTUDIANTES] || ''),
                    correo: studentDetails[FIELD_CORREO_ESTUDIANTES] || '',
                    status: enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || 'Inscripto',
                    terminoCursar: enrollment[FIELD_TERMINO_CURSAR_CONVOCATORIAS] === 'Sí',
                    cursandoElectivas: enrollment[FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS] === 'Sí',
                    finalesAdeuda: enrollment[FIELD_FINALES_ADEUDA_CONVOCATORIAS] || '',
                    notasEstudiante: enrollment[FIELD_OTRA_SITUACION_CONVOCATORIAS] || '',
                    horarioSeleccionado: enrollment[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || '',
                    totalHoras,
                    cantPracticas,
                    penalizacionAcumulada,
                    puntajeTotal,
                    trabaja: works,
                    certificadoTrabajo: cert as string,
                    cvUrl: cvUrl
                };
            }).filter((item): item is EnrichedStudent => item !== null);

            return enrichedList.sort((a, b) => b.puntajeTotal - a.puntajeTotal);
        },
        enabled: !!selectedLanzamiento
    });

    const selectedCandidates = useMemo(() =>
        candidates.filter(c => normalizeStringForComparison(c.status) === 'seleccionado'),
        [candidates]);

    const toggleMutation = useMutation({
        mutationFn: async (student: EnrichedStudent) => {
            if (!selectedLanzamiento) return;
            const isCurrentlySelected = normalizeStringForComparison(student.status) === 'seleccionado';

            if (isTestingMode) {
                await new Promise(resolve => setTimeout(resolve, 300));
                const newStatus = isCurrentlySelected ? 'Inscripto' : 'Seleccionado';
                await mockDb.update('convocatorias', student.enrollmentId, { [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: newStatus });
                return { success: true, student };
            }

            const result = await toggleStudentSelection(
                student.enrollmentId,
                !isCurrentlySelected,
                student.studentId,
                selectedLanzamiento
            );
            return { ...result, student };
        },
        onMutate: async (student) => {
            await queryClient.cancelQueries({ queryKey: candidatesQueryKey });
            const previousCandidates = queryClient.getQueryData<EnrichedStudent[]>(candidatesQueryKey);

            // Optimistic Update
            queryClient.setQueryData(candidatesQueryKey, (old: EnrichedStudent[] | undefined) => {
                if (!old) return [];
                return old.map(c => {
                    if (c.enrollmentId === student.enrollmentId) {
                        const newStatus = normalizeStringForComparison(c.status) === 'seleccionado' ? 'Inscripto' : 'Seleccionado';
                        return { ...c, status: newStatus };
                    }
                    return c;
                });
            });
            return { previousCandidates };
        },
        onSuccess: (data, vars, context) => {
            if (!data?.success) {
                setToastInfo({ message: `Error: ${data?.error}`, type: 'error' });
                if (context?.previousCandidates) queryClient.setQueryData(candidatesQueryKey, context.previousCandidates);
            }
            queryClient.invalidateQueries({ queryKey: candidatesQueryKey });
        },
        onError: (err, vars, context) => {
            setToastInfo({ message: `Error: ${err.message}`, type: 'error' });
            if (context?.previousCandidates) queryClient.setQueryData(candidatesQueryKey, context.previousCandidates);
        },
        onSettled: () => setUpdatingId(null)
    });

    const scheduleMutation = useMutation({
        mutationFn: async ({ id, schedule }: { id: string, schedule: string }) => {
            if (isTestingMode) return mockDb.update('convocatorias', id, { [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: schedule });
            return db.convocatorias.update(id, { [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: schedule });
        },
        onSuccess: () => {
            setToastInfo({ message: 'Horario actualizado.', type: 'success' });
            refetchCandidates();
        }
    });

    const closeLaunchMutation = useMutation({
        mutationFn: async () => {
            if (!selectedLanzamiento) return;
            if (isTestingMode) return mockDb.update('lanzamientos_pps', selectedLanzamiento.id, { [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Cerrado' });
            return db.lanzamientos.update(selectedLanzamiento.id, { [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Cerrado' });
        },
        onSuccess: () => {
            setToastInfo({ message: 'Convocatoria cerrada exitosamente.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['openLaunchesForSelector'] });
            queryClient.invalidateQueries({ queryKey: ['launchHistory'] });
            setSelectedLanzamiento(null);
        },
        onError: (err: Error) => setToastInfo({ message: `Error al cerrar: ${err.message}`, type: 'error' })
    });

    const handleToggle = (student: EnrichedStudent) => {
        setUpdatingId(student.enrollmentId);
        toggleMutation.mutate(student);
    };

    const handleUpdateSchedule = (id: string, newSchedule: string) => {
        scheduleMutation.mutate({ id, schedule: newSchedule });
    };

    const handleConfirmAndCloseTable = async () => {
        if (!selectedLanzamiento) return;
        setIsClosingTable(true);
        try {
            if (!isTestingMode) {
                // Email notification loop
                const emailPromises = selectedCandidates.map(async (student) => {
                    return sendSmartEmail('seleccion', {
                        studentName: student.nombre,
                        studentEmail: student.correo,
                        ppsName: selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS],
                        schedule: (student.horarioSeleccionado || 'A confirmar') as string // Ensure string type
                    });
                });
                await Promise.all(emailPromises);

                // Close Launch
                await db.lanzamientos.update(selectedLanzamiento.id, { [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Cerrado' });
            } else {
                await mockDb.update('lanzamientos_pps', selectedLanzamiento.id, { [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Cerrado' });
            }
            setToastInfo({ message: `Mesa cerrada.`, type: 'success' });
            if (onNavigateToInsurance) setTimeout(() => onNavigateToInsurance(selectedLanzamiento.id), 1500);
            else {
                queryClient.invalidateQueries({ queryKey: ['openLaunchesForSelector'] });
                queryClient.invalidateQueries({ queryKey: ['launchHistory'] });
                setSelectedLanzamiento(null);
            }
        } catch (e: any) {
            setToastInfo({ message: `Error: ${e.message}`, type: 'error' });
        } finally {
            setIsClosingTable(false);
        }
    };

    return {
        selectedLanzamiento, setSelectedLanzamiento,
        viewMode, setViewMode,
        toastInfo, setToastInfo,
        updatingId,
        isClosingTable,
        openLaunches, isLoadingLaunches,
        candidates, isLoadingCandidates,
        selectedCandidates,
        handleToggle,
        handleUpdateSchedule,
        handleConfirmAndCloseTable,
        closeLaunchMutation
    };
};
