import React, { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import PageWrapper from '../../components/layout/PageWrapper';
import SolicitudesList from '../../components/student/SolicitudesList';
import PreSolicitudCheckModal from '../../components/PreSolicitudCheckModal';
import FinalizacionForm from '../../components/student/FinalizacionForm';
import { useStudentPanel } from '../../contexts/StudentPanelContext';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { db } from '../../lib/db';
import {
    FIELD_LEGAJO_PPS,
    FIELD_SOLICITUD_LEGAJO_ALUMNO,
    FIELD_SOLICITUD_NOMBRE_ALUMNO,
    FIELD_SOLICITUD_EMAIL_ALUMNO,
    FIELD_EMPRESA_PPS_SOLICITUD,
    FIELD_SOLICITUD_LOCALIDAD,
    FIELD_SOLICITUD_DIRECCION,
    FIELD_SOLICITUD_EMAIL_INSTITUCION,
    FIELD_SOLICITUD_TELEFONO_INSTITUCION,
    FIELD_SOLICITUD_REFERENTE,
    FIELD_SOLICITUD_TIENE_CONVENIO,
    FIELD_SOLICITUD_TIENE_TUTOR,
    FIELD_SOLICITUD_CONTACTO_TUTOR,
    FIELD_SOLICITUD_TIPO_PRACTICA,
    FIELD_SOLICITUD_DESCRIPCION,
    FIELD_ESTADO_PPS,
    FIELD_ULTIMA_ACTUALIZACION_PPS,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_NOMBRE_PPS_LANZAMIENTOS
} from '../../constants';
import { parseToUTCDate, normalizeStringForComparison } from '../../utils/formatters';

const SolicitudesView: React.FC = () => {
    const { solicitudes, studentDetails, criterios, allLanzamientos, finalizacionRequest } = useStudentPanel();
    const { openSolicitudPPSModal } = useModal();
    const { authenticatedUser } = useAuth();
    const { showToast } = useNotifications();
    const queryClient = useQueryClient();
    const [isFinalizationModalOpen, setIsFinalizationModalOpen] = useState(false);
    const [isPreCheckModalOpen, setIsPreCheckModalOpen] = useState(false);

    const getStudentId = () => {
        if (studentDetails && (studentDetails as any).id) return (studentDetails as any).id;
        return authenticatedUser?.id || null;
    };

    const existingInstitutions = useMemo(() => {
        const namesSet = new Set<string>();
        const currentYear = new Date().getFullYear();
        const excludedTerms = [
            "relevamiento del ejercicio profesional",
            "jornada universitaria de salud mental"
        ];

        allLanzamientos.forEach(l => {
            const name = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];
            const dateStr = l[FIELD_FECHA_INICIO_LANZAMIENTOS];

            if (name && dateStr) {
                const date = parseToUTCDate(dateStr);
                if (date && date.getUTCFullYear() === currentYear) {
                    const lowerName = normalizeStringForComparison(name);

                    if (!excludedTerms.some(term => lowerName.includes(term))) {
                        const groupName = name.split(' - ')[0].trim();
                        namesSet.add(groupName);
                    }
                }
            }
        });

        return Array.from(namesSet)
            .map(name => name.charAt(0).toUpperCase() + name.slice(1))
            .sort((a, b) => a.localeCompare(b));
    }, [allLanzamientos]);

    const createSolicitudMutation = useMutation({
        mutationFn: async (formData: any) => {
            const studentId = getStudentId();
            if (!studentId) throw new Error("Error identificando al estudiante.");

            const newRecord = {
                [FIELD_LEGAJO_PPS]: studentId,
                [FIELD_SOLICITUD_LEGAJO_ALUMNO]: studentDetails?.[FIELD_LEGAJO_ESTUDIANTES],
                [FIELD_SOLICITUD_NOMBRE_ALUMNO]: studentDetails?.[FIELD_NOMBRE_ESTUDIANTES],
                [FIELD_SOLICITUD_EMAIL_ALUMNO]: studentDetails?.[FIELD_CORREO_ESTUDIANTES],

                [FIELD_EMPRESA_PPS_SOLICITUD]: formData.nombreInstitucion,
                [FIELD_SOLICITUD_LOCALIDAD]: formData.localidad,
                [FIELD_SOLICITUD_DIRECCION]: formData.direccion,
                [FIELD_SOLICITUD_EMAIL_INSTITUCION]: formData.emailInstitucion,
                [FIELD_SOLICITUD_TELEFONO_INSTITUCION]: formData.telefonoInstitucion,
                [FIELD_SOLICITUD_REFERENTE]: formData.referente,
                [FIELD_SOLICITUD_TIENE_CONVENIO]: formData.tieneConvenio,
                [FIELD_SOLICITUD_TIENE_TUTOR]: formData.tieneTutor,
                [FIELD_SOLICITUD_CONTACTO_TUTOR]: formData.contactoTutor,
                [FIELD_SOLICITUD_TIPO_PRACTICA]: formData.tipoPractica,
                [FIELD_SOLICITUD_DESCRIPCION]: formData.descripcion,

                [FIELD_ESTADO_PPS]: 'Pendiente',
                [FIELD_ULTIMA_ACTUALIZACION_PPS]: new Date().toISOString().split('T')[0]
            };

            await db.solicitudes.create(newRecord as any);
        },
        onSuccess: () => {
            showToast('Tu solicitud de PPS ha sido registrada. Te notificaremos cuando haya novedades.', 'success');
            queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
        },
        onError: (err: any) => {
            showToast(`Hubo un problema al enviar la solicitud: ${err.message}`, 'error');
        }
    });

    const handleStartSolicitud = useCallback(() => {
        setIsPreCheckModalOpen(true);
    }, []);

    const handleProceedToForm = useCallback(() => {
        setIsPreCheckModalOpen(false);
        openSolicitudPPSModal(async (data) => {
            await createSolicitudMutation.mutateAsync(data);
        });
    }, [openSolicitudPPSModal, createSolicitudMutation]);

    return (
        <>
            <PageWrapper
                icon="list_alt"
                title={<span>Mis <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Solicitudes</span></span>}
                description="Seguimiento del estado de las PPS que has solicitado."
            >
                <SolicitudesList
                    solicitudes={solicitudes}
                    onCreateSolicitud={handleStartSolicitud}
                    onRequestFinalization={() => setIsFinalizationModalOpen(true)}
                    criterios={criterios}
                    finalizacionRequest={finalizacionRequest}
                />
            </PageWrapper>

            <PreSolicitudCheckModal
                isOpen={isPreCheckModalOpen}
                onClose={() => setIsPreCheckModalOpen(false)}
                onContinue={handleProceedToForm}
                existingInstitutions={existingInstitutions}
            />

            {isFinalizationModalOpen && (
                <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
                        <button
                            onClick={() => setIsFinalizationModalOpen(false)}
                            className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-slate-700/80 rounded-full hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-50 dark:text-slate-300 transition-colors shadow-sm backdrop-blur-sm"
                        >
                            <span className="material-icons">close</span>
                        </button>
                        <FinalizacionForm
                            studentAirtableId={getStudentId()}
                            onClose={() => setIsFinalizationModalOpen(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default SolicitudesView;
