import React from 'react';
import { useModal } from '../../contexts/ModalContext';
import { 
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS, 
  FIELD_ESPECIALIDAD_PRACTICAS, 
  FIELD_HORAS_PRACTICAS,
  FIELD_LEGAJO_ESTUDIANTES
} from '../../constants';
import type { Practica, CriteriosCalculados, Orientacion, EstudianteFields } from '../../types';

interface WhatsAppExportButtonProps {
    practicas: Practica[];
    criterios: CriteriosCalculados;
    isLoading: boolean;
    selectedOrientacion: Orientacion | "";
    studentNameForPanel: string;
    studentDetails: EstudianteFields | null;
}

const WhatsAppExportButton: React.FC<WhatsAppExportButtonProps> = ({ practicas, criterios, isLoading, selectedOrientacion, studentNameForPanel, studentDetails }) => {
  const { showModal } = useModal();

  const handleExport = () => {
    if (isLoading || !criterios || !practicas || !studentNameForPanel || !studentDetails) {
      showModal('Error', 'Los datos del estudiante aún se están cargando. Inténtalo de nuevo en un momento.');
      return;
    }

    const legajo = studentDetails[FIELD_LEGAJO_ESTUDIANTES] || 'N/A';

    const practicasText = practicas.length > 0
      ? practicas.map(p => {
          const institucionRaw = p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
          const institucion = Array.isArray(institucionRaw) ? institucionRaw.join(', ') : institucionRaw;
          const orientacion = p[FIELD_ESPECIALIDAD_PRACTICAS] || 'N/A';
          const horas = p[FIELD_HORAS_PRACTICAS] || 0;
          return `- *${institucion}* (${orientacion}): ${horas} hs.`;
        }).join('\n')
      : 'No hay prácticas registradas.';
      
    const orientacionElegidaText = selectedOrientacion
      ? `*Horas en ${selectedOrientacion}:* ${Math.round(criterios.horasOrientacionElegida)} / 70 hs`
      : 'No se ha seleccionado una orientación principal.';

    const textoCopiado = `*Resumen Académico - ${studentNameForPanel}*
*Legajo:* ${legajo}

*Avance de PPS:*
- *Horas Totales:* ${Math.round(criterios.horasTotales)} / 250 hs
- ${orientacionElegidaText}
- *Rotación de Orientaciones:* ${criterios.orientacionesCursadasCount} / 3 (${criterios.orientacionesUnicas.join(', ') || 'N/A'})

*Historial de Prácticas:*
${practicasText}
`;

    navigator.clipboard.writeText(textoCopiado).then(() => {
      showModal('Copiado', 'El resumen del alumno ha sido copiado al portapapeles.');
    }, (err) => {
      console.error('Error al copiar: ', err);
      showModal('Error', 'No se pudo copiar el texto. Revisa los permisos del navegador.');
    });
  };

  return (
    <button
      onClick={handleExport}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center
                 transition-all duration-300 ease-in-out transform hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300"
      aria-label="Exportar resumen a WhatsApp"
    >
      <span className="material-icons !text-2xl">share</span>
    </button>
  );
};

export default WhatsAppExportButton;
