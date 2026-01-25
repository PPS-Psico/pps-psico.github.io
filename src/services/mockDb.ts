
import { MOCK_ESTUDIANTES, MOCK_INSTITUCIONES, MOCK_LANZAMIENTOS, MOCK_PRACTICAS, MOCK_SOLICITUDES, MOCK_CONVOCATORIAS, MOCK_PENALIZACIONES, MOCK_FINALIZACIONES } from '../data/mockData';


// Simulación de base de datos en memoria (Singleton)
class MockDatabase {
    private data: any = {
        estudiantes: [...MOCK_ESTUDIANTES],
        instituciones: [...MOCK_INSTITUCIONES],
        lanzamientos_pps: [...MOCK_LANZAMIENTOS],
        practicas: [...MOCK_PRACTICAS],
        solicitudes_pps: [...MOCK_SOLICITUDES],
        convocatorias: [...MOCK_CONVOCATORIAS],
        penalizaciones: [...MOCK_PENALIZACIONES],
        finalizacion_pps: [...MOCK_FINALIZACIONES]
    };

    // Resetear a estado inicial (útil para tests o logout si quisiéramos)
    reset() {
        this.data = {
            estudiantes: [...MOCK_ESTUDIANTES],
            instituciones: [...MOCK_INSTITUCIONES],
            lanzamientos_pps: [...MOCK_LANZAMIENTOS],
            practicas: [...MOCK_PRACTICAS],
            solicitudes_pps: [...MOCK_SOLICITUDES],
            convocatorias: [...MOCK_CONVOCATORIAS],
            penalizaciones: [...MOCK_PENALIZACIONES],
            finalizacion_pps: [...MOCK_FINALIZACIONES]
        };
    }

    async getAll(table: string, filters?: Record<string, any>) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simular latencia de red
        let rows = this.data[table] || [];

        if (filters) {
            rows = rows.filter((row: any) => {
                return Object.entries(filters).every(([key, value]) => {
                    // Check array containment
                    if (Array.isArray(value)) {
                        return value.includes(row[key]);
                    }
                    // Handle comma-separated values in DB (legacy airtable style simulation)
                    if (typeof row[key] === 'string' && row[key].includes(',')) {
                        return row[key].split(',').map((s: string) => s.trim()).includes(value);
                    }
                    // Normal equality
                    return String(row[key]) === String(value);
                });
            });
        }
        return JSON.parse(JSON.stringify(rows)); // Return copy to avoid ref mutation issues
    }

    async create(table: string, fields: any) {
        await new Promise(resolve => setTimeout(resolve, 400));
        const newRecord = {
            id: `mock_${table}_${Date.now()}`,
            created_at: new Date().toISOString(),
            ...fields
        };
        // Ensure array if it doesn't exist
        if (!this.data[table]) this.data[table] = [];

        this.data[table] = [newRecord, ...this.data[table]];
        return newRecord;
    }

    async update(table: string, id: string, fields: any) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const index = this.data[table].findIndex((r: any) => r.id === id);
        if (index === -1) throw new Error(`Record ${id} not found in mock db table ${table}`);

        this.data[table][index] = { ...this.data[table][index], ...fields };
        return this.data[table][index];
    }

    async delete(table: string, id: string) {
        await new Promise(resolve => setTimeout(resolve, 300));
        this.data[table] = this.data[table].filter((r: any) => r.id !== id);
        return { success: true };
    }
}

export const mockDb = new MockDatabase();
