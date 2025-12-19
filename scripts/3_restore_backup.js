
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- CONFIGURACIÓN ---
const SUPABASE_URL = "https://qxnxtnhtbpsgzprqtrjl.supabase.co"; 
const SUPABASE_SERVICE_KEY = "TU_SERVICE_ROLE_KEY_AQUI";
// ---------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// El orden aquí es al revés que el borrado: Primero los padres, luego los hijos.
const ORDER = [
    'estudiantes',
    'instituciones',
    'lanzamientos_pps',
    'convocatorias',
    'practicas',
    'solicitudes_pps',
    'finalizacion_pps',
    'penalizaciones'
];

async function restore() {
    console.log("♻️  Iniciando restauración de datos manuales...");

    for (const table of ORDER) {
        const filePath = path.join('./backup', `${table}.json`);
        
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            console.log(`📤 ${table}: Insertando ${data.length} registros...`);

            // Usamos UPSERT por si acaso algún registro ya existe (por ID)
            const { error } = await supabase.from(table).upsert(data);

            if (error) {
                console.error(`❌ Error en ${table}:`, error.message);
            } else {
                console.log(`   ✅ Completado.`);
            }
        }
    }
    console.log("\n🚀 PROCESO FINALIZADO. Tu base de datos tiene ahora los datos de Airtable + tus datos manuales salvados.");
}

restore();
