
import React from 'react';
import type { Convocatoria, LanzamientoPPS, EstudianteFields, InformeTask, TabId, CriteriosCalculados, FinalizacionPPS } from '../../types';
import {
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_DIRECCION_LANZAMIENTOS,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_HORARIO_FORMULA_CONVOCATORIAS
} from '../../constants';
import { normalizeStringForComparison } from '../../utils/formatters';
import ConvocatoriaCard from '../ConvocatoriaCard';
import EmptyState from '../EmptyState';
import { useModal } from '../../contexts/ModalContext';
import { fetchSeleccionados } from '../../services/dataService';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { mockDb } from '../../services/mockDb';

interface HomeViewProps {
  myEnrollments: Convocatoria[];
  allLanzamientos: LanzamientoPPS[];
  lanzamientos: LanzamientoPPS[]; 
  student: EstudianteFields | null;
  onInscribir: (lanzamiento: LanzamientoPPS) => void;
  institutionAddressMap: Map<string, string>;
  enrollmentMap: Map<string, Convocatoria>;
  completedLanzamientoIds: Set<string>;
  informeTasks: InformeTask[];
  onNavigate: (tabId: TabId) => void;
  criterios: CriteriosCalculados;
  onOpenFinalization: () => void;
  finalizacionRequest?: FinalizacionPPS | null; 
}

const HomeView: React.FC<HomeViewProps> = ({ 
    lanzamientos, 
    student, 
    onInscribir, 
    institutionAddressMap, 
    enrollmentMap, 
    completedLanzamientoIds
}) => {
    const { openSeleccionadosModal, showModal } = useModal();
    const { authenticatedUser } = useAuth();
    const isTesting = authenticatedUser?.legajo === '99999';

    const seleccionadosMutation = useMutation({
        mutationFn: async (lanzamiento: LanzamientoPPS) => {
            if (isTesting) {
                 // DYNAMIC MOCK: Fetch real mock enrollments for this launch
                 const enrollments = await mockDb.getAll('convocatorias', { [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzamiento.id });
                 const selected = enrollments.filter((e: any) => normalizeStringForComparison(e[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) === 'seleccionado');
                 
                 if (selected.length === 0) return null;

                 const studentIds = selected.map((e: any) => e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
                 const students = await mockDb.getAll('estudiantes', { id: studentIds });
                 const studentMap = new Map(students.map((s: any) => [s.id, s]));

                 const grouped: any = {};
                 selected.forEach((e: any) => {
                     const horario = e[FIELD_HORARIO_FORMULA_CONVOCATORIAS] || 'No especificado';
                     const s = studentMap.get(e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]);
                     if (s) {
                         if (!grouped[horario]) grouped[horario] = [];
                         grouped[horario].push({ nombre: s[FIELD_NOMBRE_ESTUDIANTES], legajo: s[FIELD_LEGAJO_ESTUDIANTES] });
                     }
                 });
                 return grouped;
            }
            return fetchSeleccionados(lanzamiento);
        },
        onSuccess: (data, lanzamiento) => {
            const title = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || 'Convocatoria';
            openSeleccionadosModal(data, title);
        },
        onError: (error) => showModal('Error', error.message),
    });

    return (
        <div className="space-y-10 animate-fade-in">
            {/* Active Convocatorias */}
            {lanzamientos.length > 0 ? (
                <div>
                     <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 pl-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Convocatorias Abiertas
                     </h3>
                     <div className="grid grid-cols-1 gap-6">
                        {lanzamientos.map((lanzamiento) => {
                            const enrollment = enrollmentMap.get(lanzamiento.id);
                            const enrollmentStatus = enrollment ? enrollment[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] : null;
                            const ppsName = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '';
                            const isCompleted = completedLanzamientoIds.has(lanzamiento.id) || completedLanzamientoIds.has(normalizeStringForComparison(ppsName));
                            const groupName = ppsName.split(' - ')[0].trim();
                            const finalDireccion = lanzamiento[FIELD_DIRECCION_LANZAMIENTOS] || 
                                                   institutionAddressMap.get(normalizeStringForComparison(ppsName)) ||
                                                   institutionAddressMap.get(normalizeStringForComparison(groupName));
                            
                            return (
                                <ConvocatoriaCard 
                                    key={lanzamiento.id} 
                                    lanzamiento={lanzamiento}
                                    enrollmentStatus={enrollmentStatus}
                                    onInscribir={onInscribir}
                                    onVerSeleccionados={(l) => seleccionadosMutation.mutate(l)}
                                    isVerSeleccionadosLoading={seleccionadosMutation.isPending && seleccionadosMutation.variables?.id === lanzamiento.id}
                                    isCompleted={isCompleted}
                                    userGender={student?.genero as any} 
                                    direccion={finalDireccion}
                                />
                            );
                        })}
                     </div>
                </div>
            ) : (
                <EmptyState 
                    icon="upcoming"
                    title="No hay convocatorias abiertas"
                    message="Por el momento, no hay procesos de inscripción disponibles. ¡Vuelve a consultar pronto!"
                />
            )}
        </div>
    );
};

export default HomeView;
