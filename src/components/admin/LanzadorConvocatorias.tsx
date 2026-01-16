import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../lib/db';
import type { InstitucionFields, LanzamientoPPSFields, AirtableRecord, LanzamientoPPS } from '../../types';

const LanzadorConvocatorias: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [lanzamientos, setLanzamientos] = useState([]);
    const [formData, setFormData] = useState({
        nombre_pps: '',
        descripcion: '',
        orientacion: 'Todos',
        institucion_id: '',
        horarios_disponibles: '',
        cupos_disponibles: '10',
        requisitos: '',
        fecha_inicio: '',
        fecha_fin: '',
        estado: 'borrador',
        fecha_lanzamiento: '',
        hora_inicio: '',
        hora_fin: ''
    });

    const [activeTabId, setActiveTabId] = useState('general');
    const [showNewForm, setShowNewForm] = useState(false);
    const [editingConvocatoria, setEditingConvocatoria] = useState<string | null>(null);

    const queryClient = useQueryClient();
    
    const { data: instituciones = [], isLoading: institucionesLoading } = useQuery({
        queryKey: ['instituciones'],
        queryFn: () => db.instituciones.getAll()
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            return await db.lanzamientos.create(data);
        },
        onSuccess: () => {
            setShowNewForm(false);
            setFormData({
                nombre_pps: '',
                descripcion: '',
                orientacion: 'Todos',
                institucion_id: '',
                horarios_disponibles: '',
                cupos_disponibles: '10',
                requisitos: '',
                fecha_inicio: '',
                fecha_fin: '',
                estado: 'borrador',
                fecha_lanzamiento: '',
                hora_inicio: '',
                hora_fin: ''
            });
            setLanzamientos(prev => [...prev, data]);
            queryClient.invalidateQueries({ queryKey: ['lanzamientos'] });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, ...data }: { id: string, data: any }) => {
            return await db.lanzamientos.update(id, data);
        },
        onSuccess: () => {
            setEditingConvocatoria(null);
            queryClient.invalidateQueries({ queryKey: ['lanzamientos', 'instituciones'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await db.lanzamientos.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lanzamientos', 'instituciones'] });
        }
    });

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        try {
            const lanzamientoData = {
                ...formData,
                estado: 'borrador',
                fecha_lanzamiento: new Date().toISOString().split('T')[0],
                hora_inicio: new Date().toTimeString().split(':').slice(0, 5),
                hora_fin: new Date().toTimeString().split(':').slice(0, 5)
            };

            if (editingConvocatoria) {
                await updateMutation({ id: editingConvocatoria, ...lanzamientoData });
            } else {
                await createMutation(lanzamientoData);
            }

            setFormData({
                nombre_pps: '',
                descripcion: '',
                orientacion: 'Todos',
                institucion_id: '',
                horarios_disponibles: '',
                cupos_disponibles: '10',
                requisitos: '',
                fecha_inicio: '',
                fecha_fin: '',
                estado: 'borrador',
                fecha_lanzamiento: '',
                hora_inicio: '',
                hora_fin: ''
            });
            
            setShowNewForm(false);
            setIsLoading(false);
        } catch (error) {
            console.error('Error en lanzador de convocatoria:', error);
            setIsLoading(false);
        }
    };

    const filteredInstituciones = useMemo(() => {
        return instituciones.filter(institucion => 
            institucion.estado_convocatoria !== 'inactiva'
        );
    }, [instituciones]);

    const tabs = useMemo(() => [
        { id: 'general', label: 'General', icon: 'dashboard' },
        { id: 'nuevo', label: 'Nuevo Lanzamiento', icon: 'add' }
    ], [filteredInstituciones, activeTabId]);

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                    <span className="material-icons">rocket_launch</span>
                    Lanzador de Convocatorias
                </h2>
                
                <div className="flex space-x-2">
                    <SubTabs tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
                    {showNewForm && (
                        <button 
                            onClick={() => setShowNewForm(false)}
                            className="mb-4 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <span className="material-icons">add</span>
                            Nueva Convocatoria
                        </button>
                    )}
                </div>
            </div>

            {/* Tab: General - Listado de lanzamientos */}
            {activeTabId === 'general' && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Convocatorias Activas ({lanzamientos.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {isLoading ? (
                                <div className="col-span-full">
                                    <div className="animate-pulse rounded-lg border border-gray-200 bg-gray-50 h-32"></div>
                                </div>
                            ) : lanzamientos.length === 0 ? (
                                <div className="col-span-full text-center py-12 text-gray-500">
                                    No hay lanzamientos activos
                                </div>
                            ) : (
                                lanzamientos.map((lanzamiento: LanzamientoPPS) => (
                                    <div key={lanzamiento.id} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="w-full">
                                                    <h4 className="text-lg font-semibold text-gray-900">
                                                        {lanzamiento.nombre_pps}
                                                    </h4>
                                                    <p className="text-sm text-gray-600">
                                                        <span className="font-medium">Estado:</span>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                                            lanzamiento.estado === 'abierta' ? 'bg-green-100 text-white' : 'bg-yellow-100 text-black'
                                                        }`}>
                                                            {lanzamiento.estado === 'abierta' ? 'Abierta' : lanzamiento.estado === 'cerrada' ? 'Cerrada' : 'Borrador'}
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="flex-1 space-x-4">
                                                    <span className="text-sm text-gray-500">
                                                        <span className="font-medium">Inscripción:</span>
                                                        <span className="text-sm">
                                                            {lanzamiento.estado_inscripcion === 'inscripto' ? 'Inscripto' : 
                                                             lanzamiento.estado_inscripcion === 'seleccionado' ? 'Seleccionado' : 'No seleccionado'}
                                                        }
                                                        </span>
                                                        <span className="text-sm font-medium">
                                                            ({lanzamiento.inscriptos_count || 0}/{lanzamiento.cupos_disponibles})
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                            </div>
                                            <div className="text-right space-x-4">
                                                <button
                                                    onClick={() => setEditingConvocatoria(lanzamiento)}
                                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                >
                                                    <span className="material-icons">edit</span>
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('¿Está seguro que deseas eliminar este lanzamiento?')) {
                                                            deleteMutation(lanzamiento.id);
                                                        }
                                                    }}
                                                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                                                >
                                                    <span className="material-icons">delete</span>
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Nuevo - Formulario para crear */}
            {activeTabId === 'nuevo' && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Nueva Convocatoria
                        </h3>
                        
                        <div className="max-w-2xl">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombre de la PPS
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.nombre_pps}
                                        onChange={(e) => handleInputChange('nombre_pps', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: Práctica Profesional Supervisada"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Descripción
                                    </label>
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => handleInputChange('descripcion', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                        placeholder="Describe las actividades principales..."
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Orientación
                                    </label>
                                    <select
                                        value={formData.orientacion}
                                        onChange={(e) => handleInputChange('orientacion', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="Todas">Todas las orientaciones</option>
                                        <option value="Psicología Clínica">Psicología Clínica</option>
                                        <option value="Educativa">Educativa</option>
                                        <option value="Organizacional">Organizacional</option>
                                        <option value="Tecnología">Tecnología</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Institución
                                    </label>
                                    <select
                                        value={formData.institucion_id}
                                        onChange={(e) => handleInputChange('institucion_id', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Seleccionar institución...</option>
                                        {filteredInstituciones.map(institucion => (
                                            <option key={institucion.id} value={institucion.id}>
                                                {institucion.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Cupos Disponibles
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.cupos_disponibles}
                                        onChange={(e) => handleInputChange('cupos_disponibles', e.target.value)}
                                        min="1"
                                        max="50"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Requisitos
                                    </label>
                                    <textarea
                                        value={formData.requisitos}
                                        onChange={(e) => handleInputChange('requisitos', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej: Se requiere experiencia previa, certificados, etc."
                                    />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Fecha de Inicio
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={formData.fecha_inicio}
                                                onChange={(e) => handleInputChange('fecha_inicio', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Fecha de Fin
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={formData.fecha_fin}
                                                onChange={(e) => handleInputChange('fecha_fin', e.target.value)}
                                                className="w-full px-3 py-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Hora de Inicio
                                            </label>
                                            <input
                                                type="time"
                                                value={formData.hora_inicio}
                                                onChange={(e) => handleInputChange('hora_inicio', e.target.value)}
                                                className="w-full px-3 py-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Hora de Fin
                                            </label>
                                            <input
                                                type="time"
                                                value={formData.hora_fin}
                                                onChange={(e) => handleInputChange('hora_fin', e.target.value)}
                                                className="w-full px-3 py-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <div>
                                        <button
                                            type="submit"
                                            onClick={handleSubmit}
                                            disabled={isLoading}
                                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-800 transition-colors disabled:opacity-50"
                                        >
                                            {isLoading ? (
                                                <span className="animate-spin inline-block w-4 h-4 border-2 border-transparent"></span>
                                            ) : (
                                                <span>Crear Convocatoria</span>
                                            )}
                                        </button>
                                        
                                        {showNewForm && (
                                            <button
                                                type="button"
                                                onClick={() => setShowNewForm(false)}
                                                className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-semibold"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LanzadorConvocatorias;