
import '@testing-library/jest-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// @ts-ignore
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ModalProvider } from '@/contexts/ModalContext';
import LanzadorView from '../LanzadorView';
import * as supabaseService from '@/services/supabaseService';
import {
    TABLE_NAME_LANZAMIENTOS_PPS,
    TABLE_NAME_CONVOCATORIAS,
    TABLE_NAME_ESTUDIANTES,
    TABLE_NAME_PRACTICAS,
    TABLE_NAME_PENALIZACIONES,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS
} from '@/constants';

// Mock Supabase Service
jest.mock('@/services/supabaseService');
const mockedSupabase = supabaseService as jest.Mocked<typeof supabaseService>;

// Mock Data
const mockLanzamiento = {
    id: 'lanz123',
    created_at: '',
    [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'Hospital Test',
    [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Abierta',
    cupos_disponibles: 5,
    orientacion: 'Clinica'
};

const mockStudent = {
    id: 'est123',
    created_at: '',
    [FIELD_NOMBRE_ESTUDIANTES]: 'Estudiante Candidato',
    [FIELD_LEGAJO_ESTUDIANTES]: '12345',
    correo: 'test@mail.com'
};

const mockEnrollment = {
    id: 'conv123',
    created_at: '',
    [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: ['est123'], // Legacy array format support
    [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: 'Inscripto',
    lanzamiento_id: 'lanz123'
};

describe('Seleccionador de Convocatorias (Integration)', () => {

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock fetchAllData responses dynamically based on table name
        mockedSupabase.fetchAllData.mockImplementation(async (tableName: any, fields?: any, filters?: any): Promise<any> => {
            if (tableName === TABLE_NAME_LANZAMIENTOS_PPS) {
                return { records: [mockLanzamiento], error: null };
            }
            if (tableName === TABLE_NAME_CONVOCATORIAS) {
                return { records: [mockEnrollment], error: null };
            }
            if (tableName === TABLE_NAME_ESTUDIANTES) {
                return { records: [mockStudent], error: null };
            }
            if (tableName === TABLE_NAME_PRACTICAS || tableName === TABLE_NAME_PENALIZACIONES) {
                return { records: [], error: null };
            }
            return { records: [], error: null };
        });

        // Mock updateRecord specifically for the toggle action
        mockedSupabase.updateRecord.mockResolvedValue({ record: {} as any, error: null });
    });

    it('permite seleccionar un alumno postulante y actualiza su estado', async () => {
        const user = userEvent.setup();
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        render(
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <ModalProvider>
                        {/* Renderizamos directamente la vista del Lanzador en modo producción (isTestingMode=false para usar los mocks de servicio) */}
                        <LanzadorView isTestingMode={false} />
                    </ModalProvider>
                </AuthProvider>
            </QueryClientProvider>
        );

        // 1. Cambiar a la pestaña "Seleccionador"
        const tabSeleccionador = await screen.findByText('Seleccionador');
        await user.click(tabSeleccionador);

        // 2. Ver la convocatoria abierta y hacer clic
        const convocatoriaCard = await screen.findByText('Hospital Test');
        expect(convocatoriaCard).toBeInTheDocument();
        await user.click(convocatoriaCard);

        // 3. Ver al candidato en la lista
        const studentName = await screen.findByText('Estudiante Candidato');
        expect(studentName).toBeInTheDocument();

        // 4. Encontrar el botón "Elegir" y hacer clic
        // Buscamos el botón dentro de la fila del estudiante para ser precisos
        const elegirButton = await screen.findByRole('button', { name: /Elegir/i });
        await user.click(elegirButton);

        // 5. Verificar Optimistic UI: El botón debe cambiar a "Listo" o "Seleccionado" instantáneamente
        // Nota: El hook usa "Listo" cuando no está en modo revisión
        await screen.findByText(/Listo/i);

        // 6. Verificar que se llamó a la API para actualizar el estado a 'Seleccionado'
        expect(mockedSupabase.updateRecord).toHaveBeenCalledWith(
            TABLE_NAME_CONVOCATORIAS,
            'conv123',
            expect.objectContaining({
                [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: 'Seleccionado'
            })
        );
    });
});
