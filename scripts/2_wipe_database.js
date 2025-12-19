
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN ---
const SUPABASE_URL = "https://qxnxtnhtbpsgzprqtrjl.supabase.co"; 
const SUPABASE_SERVICE_KEY = "TU_SERVICE_ROLE_KEY_AQUI";
// ---------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function wipe() {
    console.log("🔥 LIMPIEZA TOTAL EN CURSO...");

    // El orden es CRÍTICO: Primero borramos lo que depende de otros (hijos), 
    // y al final los padres (estudiantes, instituciones).
    const ORDER = [
        'penalizaciones',
        'finalizacion_pps',
        'solicitudes_pps',
        'practicas',
        'convocatorias',
        'lanzamientos_pps',
        'instituciones',
        'estudiantes'
    ];

    for (const table of ORDER) {
        process.stdout.write(`🗑️  Vaciando ${table}... `);
        const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Truco para borrar todo

        if (error) {
            console.log(`❌ ERROR: ${error.message}`);
        } else {
            console.log(`OK`);
        }
    }

    console.log("\n✨ Supabase está limpio como el primer día.");
}

console.log("⚠️  ADVERTENCIA: Vas a borrar todos los datos de las tablas.");
console.log("Asegúrate de haber ejecutado el Script 1 (Backup) primero.");
console.log("Escribe 'si' para continuar:");

process.stdin.once('data', (data) => {
    if (data.toString().trim().toLowerCase() === 'si') {
        wipe();
    } else {
        console.log("Operación cancelada.");
        process.exit();
    }
});
