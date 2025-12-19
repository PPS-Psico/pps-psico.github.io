
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- CONFIGURACIÓN ---
const SUPABASE_URL = "https://qxnxtnhtbpsgzprqtrjl.supabase.co"; 
const SUPABASE_SERVICE_KEY = "TU_SERVICE_ROLE_KEY_AQUI"; // USA LA SERVICE ROLE, NO LA ANON
// ---------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TABLES = [
    'estudiantes',
    'instituciones',
    'lanzamientos_pps',
    'convocatorias',
    'practicas',
    'solicitudes_pps',
    'finalizacion_pps',
    'penalizaciones'
];

async function backup() {
    console.log("💾 Iniciando backup de seguridad de registros manuales...");
    
    if (!fs.existsSync('./backup')) {
        fs.mkdirSync('./backup');
    }

    for (const table of TABLES) {
        // Filtramos: airtable_id debe ser NULL (registros creados en Supabase)
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .is('airtable_id', null);

        if (error) {
            console.error(`❌ Error en ${table}:`, error.message);
            continue;
        }

        if (data && data.length > 0) {
            const filePath = path.join('./backup', `${table}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ ${table}: ${data.length} registros salvados en ${filePath}`);
        } else {
            console.log(`ℹ️  ${table}: Sin datos manuales para salvar.`);
        }
    }
    console.log("\n🏁 Backup finalizado. Revisa la carpeta /backup antes de seguir.");
}

backup();
