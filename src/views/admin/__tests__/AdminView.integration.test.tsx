// FIX: Imported '@testing-library/jest-dom' to provide custom matchers like 'toBeInTheDocument' and resolve TypeScript errors.
import '@testing-library/jest-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// @ts-ignore
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import App from '@/App'; // Renderizar App es más fácil para obtener todos los contextos
import * as airtableService from '@/services/airtableService';
import {
    TABLE_NAME_ESTUDIANTES,
    TABLE_NAME_PRACTICAS,
    TABLE_NAME_PPS,
    TABLE_NAME_CONVOCATORIAS,
    TABLE_NAME_LANZAMIENTOS_PPS,
    TABLE_NAME_INSTITUCIONES,
    TABLE_NAME_FINALIZACION,
} from '@/constants';

// Simular todo el módulo de airtableService
jest.mock('@/services/airtableService');
const mockedAirtable = airtableService as jest.Mocked<typeof airtableService>;

// Mock exceljs to prevent ESM issues in Jest
jest.mock('exceljs', () => ({
    Workbook: jest.fn().mockImplementation(() => ({
        xlsx: {
            writeBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        },
        addWorksheet: jest.fn().mockReturnValue({
            columns: [],
            addRows: jest.fn(),
            getRow: jest.fn().mockReturnValue({
                eachCell: jest.fn(),
            }),
        }),
    })),
}));

// --- Datos Simulados ---
const mockAdminUser = { legajo: 'admin', nombre: 'Super Usuario', role: 'SuperUser' };

const mockStudentForSearch = {
    id: 'recStudent123',
    createdTime: '2023-01-01T00:00:00.000Z',
    fields: {
        'Legajo': '12345',
        'Nombre': 'Juana Molina',
    }
};

const mockStudentDetails = {
    id: 'recStudent123',
    createdTime: '2023-01-01T00:00:00.000Z',
    fields: {
        'Legajo': '12345',
        'Nombre': 'Juana Molina',
        'Orientación Elegida': 'Clinica',
        'DNI': 12345678,
        'Correo': 'juana.m@test.com'
    }
};

const mockPracticas = [
    {
        id: 'recPracticaABC',
        createdTime: '2023-01-01T00:00:00.000Z',
        fields: {
            'Nombre (de Institución)': ['Hospital Central'],
            'Especialidad': 'Clinica',
            'Horas Realizadas': 100,
            'Fecha de Inicio': '2023-01-01',
            'Fecha de Finalización': '2023-03-01',
            'Estado': 'Finalizada',
            'Nota': 'Sin calificar',
            'Legajo Busqueda': ['12345'],
            'Estudiante Inscripto': ['recStudent123'],
        }
    }
];

describe('Flujo de Integración del Administrador', () => {

    jest.setTimeout(20000);

    beforeEach(() => {
        // Limpiar mocks antes de cada prueba
        jest.clearAllMocks();

        // Simular sessionStorage para AuthContext para que el usuario admin esté logueado
        Storage.prototype.getItem = jest.fn((key) => {
            if (key === 'authenticatedUser') {
                return JSON.stringify(mockAdminUser);
            }
            return null;
        });

        // Configurar la simulación de la API para todas las llamadas esperadas
        mockedAirtable.fetchAllAirtableData.mockImplementation(async (tableName: string, zodSchema: any, fields?: string[], filterByFormula?: string): Promise<any> => {
            // useStudentPracticas
            if (tableName === TABLE_NAME_PRACTICAS && filterByFormula?.includes('12345')) {
                return { records: mockPracticas, error: null };
            }
            // Llamadas para solicitudes, convocatorias, etc., que pueden estar vacías para esta prueba
            if ([TABLE_NAME_PPS, TABLE_NAME_CONVOCATORIAS, TABLE_NAME_LANZAMIENTOS_PPS, TABLE_NAME_INSTITUCIONES, TABLE_NAME_FINALIZACION].includes(tableName)) {
                return { records: [], error: null };
            }
            // Respuesta por defecto para las métricas iniciales y otras llamadas no especificadas
            return { records: [], error: null };
        });

        mockedAirtable.fetchAirtableData.mockImplementation(async (tableName: string, zodSchema: any, fields?: string[], filterByFormula?: string): Promise<any> => {
            // Búsqueda de AdminSearch
            if (tableName === TABLE_NAME_ESTUDIANTES && filterByFormula?.includes('juana molina')) {
                return { records: [mockStudentForSearch], error: null };
            }
            // useStudentData para el dashboard del alumno
            if (tableName === TABLE_NAME_ESTUDIANTES && filterByFormula?.includes("'12345'")) {
                return { records: [mockStudentDetails], error: null };
            }
            return { records: [], error: null };
        });

        // Simular la operación de actualización de la nota
        mockedAirtable.updateAirtableRecord.mockResolvedValue({ record: { id: 'recPracticaABC', createdTime: '2023-01-01T00:00:00.000Z', fields: { 'Nota': '10' } }, error: null });
    });

    it('permite a un admin buscar un alumno, abrir su panel y editar una nota', async () => {
        const user = userEvent.setup();
        const queryClient = new QueryClient();
        render(
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </QueryClientProvider>
        );

        // 1. Navegar a la herramienta de búsqueda
        const herramientasTab = await screen.findByRole('tab', { name: /Herramientas/i }, { timeout: 10000 });
        await user.click(herramientasTab);

        // 2. Buscar al alumno
        const searchInput = await screen.findByPlaceholderText(/Buscar por Legajo o Nombre.../i);
        await user.type(searchInput, 'Juana Molina');

        // 3. Hacer clic en el resultado de la búsqueda
        const searchResult = await screen.findByRole('button', { name: /Juana Molina/i });
        await user.click(searchResult);

        // 4. Esperar a que la pestaña del alumno y su dashboard aparezcan
        const studentTab = await screen.findByRole('tab', { name: /Juana Molina/i, selected: true });
        expect(studentTab).toBeInTheDocument();

        // Find the associated tabpanel using the aria-controls attribute.
        const panelId = studentTab.getAttribute('aria-controls');
        expect(panelId).not.toBeNull();
        const studentDashboard = document.getElementById(panelId!);
        if (!studentDashboard) throw new Error("No se encontró el panel del dashboard del alumno.");

        // Verificar que el banner de bienvenida se renderizó para el alumno correcto
        await within(studentDashboard).findByRole('heading', { name: /Juana/i, level: 1 });

        // 5. Navegar a la pestaña "Mis Prácticas" dentro del panel del alumno
        const practicasTab = await within(studentDashboard).findByRole('tab', { name: /Mis Prácticas/i });
        await user.click(practicasTab);

        // 6. Encontrar el selector de nota y cambiarlo
        const gradeSelector = await within(studentDashboard).findByLabelText('Calificación para Hospital Central');
        expect(gradeSelector).toHaveValue('Sin calificar');

        await user.selectOptions(gradeSelector, '10');

        // 7. Verificar que la API de actualización fue llamada y la UI refleja el cambio
        await waitFor(() => {
            expect(mockedAirtable.updateAirtableRecord).toHaveBeenCalledTimes(1);
            expect(mockedAirtable.updateAirtableRecord).toHaveBeenCalledWith(
                TABLE_NAME_PRACTICAS,
                'recPracticaABC',
                { 'Nota': '10' }
            );
        });

        // La UI debería mostrar una confirmación de "Guardado ✓"
        const savedConfirmation = await within(studentDashboard).findByText('Guardado ✓');
        expect(savedConfirmation).toBeInTheDocument();
    });
});