
import React from 'react';
import { useModal } from '../contexts/ModalContext';
import Modal from './ui/Modal';
import { EnrollmentForm } from './EnrollmentForm';
import SeleccionadosModal from './SeleccionadosModal';
import SolicitudPPSForm from './SolicitudPPSForm'; // Import the new form
import {
    FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
    FIELD_PERMITE_CERTIFICADO_LANZAMIENTOS,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS,
    FIELD_REQ_CV_LANZAMIENTOS
} from '../constants';

const AppModals: React.FC = () => {
    const {
        modalInfo,
        closeModal,
        isEnrollmentFormOpen,
        closeEnrollmentForm,
        selectedLanzamientoForEnrollment,
        studentProfileForEnrollment,
        isSeleccionadosModalOpen,
        closeSeleccionadosModal,
        seleccionadosData,
        convocatoriaForModal,
        isSubmittingEnrollment,
        onSubmitEnrollment,

        // New Solicitud Props
        isSolicitudPPSModalOpen,
        closeSolicitudPPSModal,
        onSubmitSolicitudPPS
    } = useModal();

    const horariosStr = selectedLanzamientoForEnrollment?.[FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS] || '';
    const horariosArray = horariosStr ? horariosStr.split(';').map(h => h.trim()).filter(Boolean) : [];
    const permiteCertificado = !!selectedLanzamientoForEnrollment?.[FIELD_PERMITE_CERTIFICADO_LANZAMIENTOS];

    // New Config Flags
    const reqCertificadoTrabajo = selectedLanzamientoForEnrollment?.[FIELD_REQ_CERTIFICADO_TRABAJO_LANZAMIENTOS] !== false; // Default true for legacy
    const reqCv = !!selectedLanzamientoForEnrollment?.[FIELD_REQ_CV_LANZAMIENTOS];

    // Fix: Use constant key instead of hardcoded string to ensure compatibility with snake_case DB response
    const convocatoriaName = selectedLanzamientoForEnrollment?.[FIELD_NOMBRE_PPS_LANZAMIENTOS] || 'Convocatoria';

    return (
        <>
            <Modal
                isOpen={!!modalInfo}
                title={modalInfo?.title || ''}
                message={modalInfo?.message || ''}
                onClose={closeModal}
            />

            <EnrollmentForm
                isOpen={isEnrollmentFormOpen}
                onClose={closeEnrollmentForm}
                onSubmit={onSubmitEnrollment || (() => Promise.resolve())} // Proporciona una función vacía como fallback
                convocatoriaName={convocatoriaName}
                horariosDisponibles={horariosArray}
                isSubmitting={isSubmittingEnrollment}
                permiteCertificado={permiteCertificado}
                studentProfile={studentProfileForEnrollment}
                reqCertificadoTrabajo={reqCertificadoTrabajo}
                reqCv={reqCv}
            />

            <SeleccionadosModal
                isOpen={isSeleccionadosModalOpen}
                onClose={closeSeleccionadosModal}
                seleccionados={seleccionadosData}
                convocatoriaName={convocatoriaForModal}
            />

            <SolicitudPPSForm
                isOpen={isSolicitudPPSModalOpen}
                onClose={closeSolicitudPPSModal}
                onSubmit={onSubmitSolicitudPPS || (() => Promise.resolve())}
            />
        </>
    );
};

export default AppModals;