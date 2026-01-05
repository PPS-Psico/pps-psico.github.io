import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCorrectionPanelData } from '../../services/dataService';
import { db } from '../../lib/db';
import Loader from '../Loader';
import EmptyState from '../EmptyState';
import Toast from '../ui/Toast';
import SubTabs from '../SubTabs';
import InformeCorreccionCard from '../InformeCorreccionCard';
import CorreccionRapidaView from '../CorreccionRapidaView';
// FIX: Added InformeCorreccionPPS to imports from types to enable proper typing
import type { InformeCorreccionStudent, FlatCorreccionStudent, InformeCorreccionPPS } from '../../types';

interface CorreccionPanelProps {
    isTestingMode?: boolean;
}

const CorreccionPanel: React.FC<CorreccionPanelProps> = ({ isTestingMode = false }) => {
    const [activeTab, setActiveTab] = useState('grouped');
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingNotaId, setUpdatingNotaId] = useState<string | null>(null);
    // FIX: Updated toastInfo type to include 'warning' which is supported by the Toast component and fixes assignment errors
    const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
    const [isBatchUpdating, setIsBatchUpdating] = useState(false);

    const queryClient = useQueryClient();

    // Fetch reporting/grading data instead of student criteria
    const { data: ppsGroupsMap, isLoading, error } = useQuery({
        queryKey: ['correctionPanelData', isTestingMode],
        queryFn: fetchCorrectionPanelData,
        staleTime: 1000 * 60 * 5,
    });

    const updateNotaMutation = useMutation({
        mutationFn: async ({ student, nota }: { student: InformeCorreccionStudent, nota: string }) => {
            const valueToSend = nota === 'Sin calificar' ? null : nota;
            if (student.practicaId) {
                return db.practicas.update(student.practicaId, { nota: valueToSend });
            }
            return null;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['correctionPanelData'] });
        },
    });

    const handleNotaChange = async (student: InformeCorreccionStudent, newNota: string) => {
        setUpdatingNotaId(student.practicaId || `creating-${student.studentId}`);
        try {
            await updateNotaMutation.mutateAsync({ student, nota: newNota });
        } catch (e) {
            setToastInfo({ message: 'Error al actualizar nota', type: 'error' });
        } finally {
            setUpdatingNotaId(null);
        }
    };

    // FIX: Explicitly typed ppsGroups as InformeCorreccionPPS[] to ensure type safety when accessing group properties and fix 'unknown' errors
    const ppsGroups = useMemo<InformeCorreccionPPS[]>(() => Array.from(ppsGroupsMap?.values() || []), [ppsGroupsMap]);

    // Transformation for Flat View
    const flatStudents = useMemo(() => {
        const list: FlatCorreccionStudent[] = [];
        ppsGroups.forEach(group => {
            group.students.forEach(s => {
                // Filter by search term locally for performance
                const matchesSearch = !searchTerm ||
                    s.studentName.toLowerCase().includes(searchTerm.toLowerCase());

                if (matchesSearch) {
                    list.push({
                        ...s,
                        ppsName: group.ppsName,
                        informeLink: group.informeLink || undefined
                    });
                }
            });
        });
        return list;
    }, [ppsGroups, searchTerm]);

    if (isLoading) return <div className="py-12"><Loader /></div>;
    if (error) return <EmptyState icon="error" title="Error" message="No se pudieron cargar los datos de corrección." />;

    return (
        <div className="space-y-6 animate-fade-in">
            {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <SubTabs
                    tabs={[
                        { id: 'grouped', label: 'Por Institución', icon: 'account_tree' },
                        { id: 'flat', label: 'Vista Rápida', icon: 'view_list' }
                    ]}
                    activeTabId={activeTab}
                    onTabChange={setActiveTab}
                />

                <div className="relative w-full md:w-72 group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-400 group-focus-within:text-blue-500 transition-colors !text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar alumno..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

            {activeTab === 'grouped' ? (
                <div className="grid grid-cols-1 gap-6">
                    {ppsGroups.length > 0 ? ppsGroups.map(group => (
                        <InformeCorreccionCard
                            key={group.lanzamientoId}
                            ppsGroup={group}
                            onNotaChange={handleNotaChange}
                            updatingNotaId={updatingNotaId}
                            selectedStudents={selectedStudents}
                            onSelectionChange={(id) => {
                                const newSet = new Set(selectedStudents);
                                if (newSet.has(id)) newSet.delete(id);
                                else newSet.add(id);
                                setSelectedStudents(newSet);
                            }}
                            onSelectAll={(ids, select) => {
                                const newSet = new Set(selectedStudents);
                                ids.forEach(id => select ? newSet.add(id) : newSet.delete(id));
                                setSelectedStudents(newSet);
                            }}
                            onBatchUpdate={async (nota) => {
                                setIsBatchUpdating(true);
                                try {
                                    // Batch update logic would iterate selected IDs and call API
                                    // FIX: Changed 'info' to 'warning' which is a valid type for the Toast component
                                    setToastInfo({ message: 'Funcionalidad de actualización por lote próximamente disponible.', type: 'warning' });
                                } finally { setIsBatchUpdating(false); }
                            }}
                            isBatchUpdating={isBatchUpdating}
                            searchTerm={searchTerm}
                        />
                    )) : (
                        <EmptyState icon="task_alt" title="Sin Pendientes" message="No hay informes para corregir actualmente." />
                    )}
                </div>
            ) : (
                <CorreccionRapidaView
                    students={flatStudents}
                    onNotaChange={handleNotaChange}
                    updatingNotaId={updatingNotaId}
                    searchTerm={searchTerm}
                />
            )}
        </div>
    );
};

export default React.memo(CorreccionPanel);
