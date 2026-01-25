
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useModal } from '../contexts/ModalContext';
import { fetchConvocatoriasData } from '../services/dataService';
import { db } from '../lib/db';
import { mockDb } from '../services/mockDb';
import type { LanzamientoPPS, InformeTask, AirtableRecord, ConvocatoriaFields, Estudiante } from '../types';
import {
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_NOMBRE_PPS_CONVOCATORIAS,
    FIELD_FECHA_INICIO_CONVOCATORIAS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_LEGAJO_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_TERMINO_CURSAR_CONVOCATORIAS,
    FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS,
    FIELD_FINALES_ADEUDA_CONVOCATORIAS,
    FIELD_OTRA_SITUACION_CONVOCATORIAS,
    FIELD_HORARIO_FORMULA_CONVOCATORIAS,
    FIELD_FECHA_FIN_LANZAMIENTOS,
    FIELD_DIRECCION_LANZAMIENTOS,
    FIELD_ORIENTACION_CONVOCATORIAS,
    FIELD_HORAS_ACREDITADAS_CONVOCATORIAS,
    FIELD_CORREO_CONVOCATORIAS,
    FIELD_TELEFONO_CONVOCATORIAS,
    FIELD_DNI_CONVOCATORIAS,
    FIELD_INFORME_SUBIDO_CONVOCATORIAS,
    FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS,
    FIELD_NOTA_PRACTICAS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_HORAS_ACREDITADAS_LANZAMIENTOS,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_TELEFONO_ESTUDIANTES,
    FIELD_DNI_ESTUDIANTES,
    FIELD_FECHA_FIN_CONVOCATORIAS,
    FIELD_DIRECCION_CONVOCATORIAS,
    FIELD_TRABAJA_ESTUDIANTES,
    FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES,
    FIELD_TRABAJA_CONVOCATORIAS,
    FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS,
    FIELD_CV_CONVOCATORIAS,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
    FIELD_ESTADO_GESTION_LANZAMIENTOS
} from '../constants';
import { normalizeStringForComparison, cleanInstitutionName, safeGetId } from '../utils/formatters';

export const useConvocatorias = (legajo: string, studentAirtableId: string | null, studentDetails: Estudiante | null, isSuperUserMode: boolean) => {
    const queryClient = useQueryClient();
    const {
        showModal,
        openEnrollmentForm,
        closeEnrollmentForm,
        setIsSubmittingEnrollment,
    } = useModal();

    const {
        data: convocatoriasData,
        isLoading: isConvocatoriasLoading,
        error: convocatoriasError,
        refetch: refetchConvocatorias
    } = useQuery({
        queryKey: ['convocatorias', legajo, studentAirtableId],
        queryFn: async () => {
            if (legajo === '99999') {
                const [myConvs, allLanz] = await Promise.all([
                    mockDb.getAll('convocatorias', { [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: studentAirtableId || 'st_999' }),
                    mockDb.getAll('lanzamientos_pps')
                ]);
                const launchesMap = new Map(allLanz.map((l: any) => [l.id, l]));
                const hydratedEnrollments = myConvs.map((row: any) => {
                    const launchId = row[FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS];
                    const launch: any = launchesMap.get(launchId);
                    return {
                        ...row,
                        [FIELD_NOMBRE_PPS_CONVOCATORIAS]: cleanInstitutionName(launch?.[FIELD_NOMBRE_PPS_LANZAMIENTOS]),
                        [FIELD_FECHA_INICIO_CONVOCATORIAS]: launch?.[FIELD_FECHA_INICIO_LANZAMIENTOS],
                        [FIELD_FECHA_FIN_CONVOCATORIAS]: launch?.[FIELD_FECHA_FIN_LANZAMIENTOS],
                        [FIELD_DIRECCION_CONVOCATORIAS]: launch?.[FIELD_DIRECCION_LANZAMIENTOS],
                        [FIELD_ORIENTACION_CONVOCATORIAS]: launch?.[FIELD_ORIENTACION_LANZAMIENTOS],
                        [FIELD_HORAS_ACREDITADAS_CONVOCATORIAS]: launch?.[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS]
                    };
                });
                const availableLaunches = allLanz.filter((l: any) => {
                    const estadoConv = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
                    const estadoGestion = l[FIELD_ESTADO_GESTION_LANZAMIENTOS];
                    return estadoConv !== 'oculto' && estadoGestion !== 'Archivado' && estadoGestion !== 'No se Relanza';
                });
                const institutionAddressMap = new Map<string, string>();
                allLanz.forEach((l: any) => {
                    const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];
                    const addr = l[FIELD_DIRECCION_LANZAMIENTOS];
                    if (name && addr) institutionAddressMap.set(normalizeStringForComparison(name), addr);
                });
                return { lanzamientos: availableLaunches, myEnrollments: hydratedEnrollments, allLanzamientos: allLanz, institutionAddressMap, institutionLogoMap: new Map() };
            }
            return fetchConvocatoriasData(studentAirtableId);
        },
        enabled: !!studentAirtableId || isSuperUserMode || legajo === '99999',
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
    });

    const { lanzamientos = [], myEnrollments = [], allLanzamientos = [], institutionAddressMap = new Map(), institutionLogoMap = new Map() } = (convocatoriasData as any) || {};

    const enrollmentMutation = useMutation<AirtableRecord<ConvocatoriaFields> | null, Error, { formData: any, selectedLanzamiento: LanzamientoPPS }>({
        mutationFn: async ({ formData, selectedLanzamiento }) => {
            if (legajo === '99999') {
                await new Promise(resolve => setTimeout(resolve, 800));
                const newRecord = {
                    [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: selectedLanzamiento.id,
                    [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: 'st_999',
                    [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: 'Inscripto',
                    [FIELD_NOMBRE_PPS_CONVOCATORIAS]: cleanInstitutionName(selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]),
                    [FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS]: formData.cursandoElectivas ? "Sí" : "No",
                };
                await mockDb.create('convocatorias', newRecord);
                return newRecord as any;
            }

            if (!studentAirtableId) throw new Error("No student ID");

            if (formData.trabaja !== undefined || formData.certificadoTrabajoUrl) {
                await db.estudiantes.update(studentAirtableId, {
                    [FIELD_TRABAJA_ESTUDIANTES]: formData.trabaja,
                    [FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES]: formData.certificadoTrabajoUrl || studentDetails?.[FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES]
                });
            }

            // CRITICAL FIX: Ensure plain IDs and clean names before sending to Supabase
            // Added FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS and FIELD_FINALES_ADEUDA_CONVOCATORIAS
            const newRecordFields: any = {
                [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: safeGetId(selectedLanzamiento.id),
                [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: safeGetId(studentAirtableId),
                [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto",
                [FIELD_TERMINO_CURSAR_CONVOCATORIAS]: formData.terminoDeCursar ? "Sí" : "No",
                [FIELD_CURSANDO_ELECTIVAS_CONVOCATORIAS]: formData.cursandoElectivas ? "Sí" : "No",
                [FIELD_FINALES_ADEUDA_CONVOCATORIAS]: formData.finalesAdeudados,
                [FIELD_OTRA_SITUACION_CONVOCATORIAS]: formData.otraSituacionAcademica,
                [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: formData.horarios.join('; '),
                [FIELD_TRABAJA_CONVOCATORIAS]: formData.trabaja,
                [FIELD_CERTIFICADO_TRABAJO_CONVOCATORIAS]: formData.certificadoTrabajoUrl || studentDetails?.[FIELD_CERTIFICADO_TRABAJO_ESTUDIANTES],
                [FIELD_CV_CONVOCATORIAS]: formData.cvUrl,
                // Snapshot field cleaning
                [FIELD_NOMBRE_PPS_CONVOCATORIAS]: cleanInstitutionName(selectedLanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS]),
                [FIELD_FECHA_INICIO_CONVOCATORIAS]: selectedLanzamiento[FIELD_FECHA_INICIO_LANZAMIENTOS],
                [FIELD_FECHA_FIN_CONVOCATORIAS]: selectedLanzamiento[FIELD_FECHA_FIN_LANZAMIENTOS],
                [FIELD_ORIENTACION_CONVOCATORIAS]: selectedLanzamiento[FIELD_ORIENTACION_LANZAMIENTOS],
                [FIELD_HORAS_ACREDITADAS_CONVOCATORIAS]: selectedLanzamiento[FIELD_HORAS_ACREDITADAS_LANZAMIENTOS],
                [FIELD_DIRECCION_CONVOCATORIAS]: selectedLanzamiento[FIELD_DIRECCION_LANZAMIENTOS],
            };

            const legNum = parseInt(legajo, 10);
            if (!isNaN(legNum)) newRecordFields[FIELD_LEGAJO_CONVOCATORIAS] = legNum;
            if (studentDetails) {
                newRecordFields[FIELD_CORREO_CONVOCATORIAS] = studentDetails[FIELD_CORREO_ESTUDIANTES];
                newRecordFields[FIELD_TELEFONO_CONVOCATORIAS] = studentDetails[FIELD_TELEFONO_ESTUDIANTES];
                newRecordFields[FIELD_DNI_CONVOCATORIAS] = studentDetails[FIELD_DNI_ESTUDIANTES];
            }

            return db.convocatorias.create(newRecordFields);
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['convocatorias', legajo, studentAirtableId] });
            setIsSubmittingEnrollment(true);
        },
        onError: (err) => {
            showModal('Error', `Error: ${err.message}`);
        },
        onSuccess: () => {
            showModal('¡Inscripción Exitosa!', 'Tu solicitud ha sido registrada correctamente.');
            queryClient.invalidateQueries({ queryKey: ['convocatorias', legajo, studentAirtableId] });
            queryClient.invalidateQueries({ queryKey: ['student', legajo] });
            closeEnrollmentForm();
        },
        onSettled: () => { setIsSubmittingEnrollment(false); }
    });

    const confirmInformeMutation = useMutation({
        mutationFn: async (task: InformeTask) => {
            if (legajo === '99999') return;
            if (task.practicaId && task.convocatoriaId.startsWith('practica-')) {
                return db.practicas.update(task.practicaId, { [FIELD_NOTA_PRACTICAS]: 'Entregado (sin corregir)' });
            } else if (task.convocatoriaId) {
                return db.convocatorias.update(task.convocatoriaId, {
                    [FIELD_INFORME_SUBIDO_CONVOCATORIAS]: true,
                    [FIELD_FECHA_ENTREGA_INFORME_CONVOCATORIAS]: new Date().toISOString()
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['convocatorias', legajo, studentAirtableId] });
            queryClient.invalidateQueries({ queryKey: ['practicas', legajo] });
        }
    });

    const enrollStudent = {
        mutate: (lanzamiento: LanzamientoPPS) => {
            openEnrollmentForm(lanzamiento, studentDetails, async (fd) => { await enrollmentMutation.mutateAsync({ formData: fd, selectedLanzamiento: lanzamiento }); });
        },
        isPending: enrollmentMutation.isPending
    };

    return { lanzamientos, myEnrollments, allLanzamientos, isConvocatoriasLoading, convocatoriasError, enrollStudent, confirmInforme: confirmInformeMutation, refetchConvocatorias, institutionAddressMap, institutionLogoMap };
};
