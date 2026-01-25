import '@testing-library/jest-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// @ts-ignore
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import App from '@/App';
import { db } from '@/lib/db';
// import * as authUtils from '@/utils/auth'; // Removed as it does not exist in current codebase
import {
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    FIELD_ORIENTACION_LANZAMIENTOS,
    FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
    FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
    FIELD_FECHA_INICIO_LANZAMIENTOS,
    FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
    FIELD_HORARIO_FORMULA_CONVOCATORIAS,
    FIELD_TERMINO_CURSAR_CONVOCATORIAS,
    FIELD_FINALES_ADEUDA_CONVOCATORIAS,
    FIELD_OTRA_SITUACION_CONVOCATORIAS,
} from '@/constants';

// Mock the entire db module
jest.mock('@/lib/db');
const mockedDb = db as jest.Mocked<typeof db>;

// Mock the auth utils module if needed by creating a dummy object
const mockedAuthUtils = {
    verifyPassword: jest.fn()
};

// --- Mock Data ---
const mockStudentDetails = {
    id: 'recStudentTest',
    created_at: '',
    legajo: '12345',
    nombre: 'Estudiante de Prueba',
};

const mockLanzamiento = {
    id: 'lanz_test_enroll',
    created_at: '',
    [FIELD_NOMBRE_PPS_LANZAMIENTOS]: 'PPS de Integración',
    [FIELD_ORIENTACION_LANZAMIENTOS]: 'Clinica',
    [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: 'Abierta',
    [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: 'Lunes 9 a 13hs; Martes 14 a 18hs',
    [FIELD_FECHA_INICIO_LANZAMIENTOS]: '2024-09-01'
} as any;

describe('Flujo de Inscripción de Estudiante (Integration Test)', () => {

    jest.setTimeout(30000); // Increase timeout for this long-running test

    beforeEach(() => {
        jest.clearAllMocks();

        // Start as logged out
        Storage.prototype.getItem = jest.fn(() => null);

        // Mock the db methods used during login and dashboard loading
        // Note: db.estudiantes is a table interface, using any casting for mocks
        (mockedDb.estudiantes.get as any).mockResolvedValue([mockStudentDetails] as any);

        // Mock password verification to always succeed for the test password
        (mockedAuthUtils.verifyPassword as any).mockResolvedValue(true);

        mockedDb.estudiantes.get.mockResolvedValue([mockStudentDetails] as any);
        (mockedDb.lanzamientos.getAll as any).mockResolvedValue([mockLanzamiento] as any);
        (mockedDb.practicas.getAll as any).mockResolvedValue([]);
        (mockedDb.solicitudes.getAll as any).mockResolvedValue([]);
        (mockedDb.convocatorias.getAll as any).mockResolvedValue([]);
        (mockedDb.instituciones.getAll as any).mockResolvedValue([]);
    });

    it('permite a un estudiante iniciar sesión, ver convocatorias e inscribirse', async () => {
        const user = userEvent.setup();
        const createRecordMock = (jest.fn() as any).mockResolvedValue({ id: 'new_conv_id', created_at: '' });
        (mockedDb.convocatorias.create as any).mockImplementation(createRecordMock);

        const queryClient = new QueryClient();
        render(
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </QueryClientProvider>
        );

        // --- 1. Login ---
        const legajoInput = await screen.findByPlaceholderText(/Número de Legajo/i);
        const passwordInput = await screen.findByPlaceholderText(/Contraseña/i);
        const loginButton = screen.getByRole('button', { name: /Ingresar/i });

        await user.type(legajoInput, '12345');
        await user.type(passwordInput, 'password123');
        await user.click(loginButton);

        // --- 2. Dashboard View ---
        await screen.findByRole('heading', { name: /Buenos (días|tardes|noches), Estudiante/i, level: 1 });
        const ppsCard = await screen.findByText(/PPS de Integración/i);
        expect(ppsCard).toBeInTheDocument();

        // --- 3. Enrollment Flow ---
        const inscribirButton = await screen.findByRole('button', { name: /Postularme/i });
        await user.click(inscribirButton);

        const modal = await screen.findByRole('dialog', { name: /Formulario de Inscripción/i });
        const modalContainer = screen.getByRole('dialog');
        const getByLabelText = (text: any) => within(modalContainer).getByLabelText(text);
        const getByRole = (role: any, options?: any) => within(modalContainer).getByRole(role, options);

        const horarioCheckbox = getByLabelText('Lunes 9 a 13hs');
        await user.click(horarioCheckbox);

        const terminoCursarRadio = getByLabelText('Sí');
        await user.click(terminoCursarRadio);

        const finalesAdeudadosRadio = await screen.findByLabelText('1 Final');
        await user.click(finalesAdeudadosRadio);

        const otraSituacionTextarea = getByLabelText(/Aclaraciones Adicionales/i);
        await user.type(otraSituacionTextarea, 'Prueba de integración E2E.');

        const submitButton = getByRole('button', { name: /Inscribirme/i });
        await user.click(submitButton);

        // --- 4. Assertions ---
        await waitFor(() => {
            expect(createRecordMock).toHaveBeenCalledTimes(1);
        });

        const [fields] = createRecordMock.mock.calls[0];

        expect(fields).toEqual(expect.objectContaining({
            [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: mockLanzamiento.id,
            [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: mockStudentDetails.id,
            [FIELD_HORARIO_FORMULA_CONVOCATORIAS]: 'Lunes 9 a 13hs',
            [FIELD_TERMINO_CURSAR_CONVOCATORIAS]: 'Sí',
            [FIELD_FINALES_ADEUDA_CONVOCATORIAS]: '1 Final',
            [FIELD_OTRA_SITUACION_CONVOCATORIAS]: 'Prueba de integración E2E.',
        }));

        expect(screen.queryByRole('dialog', { name: /Formulario de Inscripción/i })).not.toBeInTheDocument();

        const successModal = await screen.findByRole('dialog', { name: /¡Inscripción Exitosa!/i });
        expect(successModal).toBeInTheDocument();
    });
});