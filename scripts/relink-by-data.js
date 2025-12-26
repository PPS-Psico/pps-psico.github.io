
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN
// ==============================================================================

const SUPABASE_URL = "PEGAR_AQUI_TU_SUPABASE_URL"; 
const SUPABASE_SERVICE_KEY = "PEGAR_AQUI_TU_SUPABASE_SERVICE_ROLE_KEY";

// ==============================================================================

if (SUPABASE_URL.includes("PEGAR") || SUPABASE_SERVICE_KEY.includes("PEGAR")) {
    console.error("❌ ERROR: Edita scripts/relink-by-data.js y pega las credenciales.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Normalizador de texto para mejorar la coincidencia (ignora mayúsculas, tildes y espacios extra)
const normalize = (str) => {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .replace(/\s+/g, ' ') // Unificar espacios
        .trim();
};

// Normalizador de fecha (YYYY-MM-DD) para ignorar horas/zonas horarias
const getDateKey = (isoString) => {
    if (!isoString) return 'no-date';
    // Tomamos solo los primeros 10 caracteres: 2024-03-01
    return isoString.substring(0, 10);
};

async function relinkByData() {
    console.log("🔗 Iniciando VINCULACIÓN POR DATOS (Relink by Data)...");

    // 1. Obtener todos los Lanzamientos (Los "Padres")
    // Necesitamos construir un mapa para buscarlos rápido.
    console.log("   📥 Cargando catálogo de Lanzamientos...");
    
    const { data: lanzamientos, error: lError } = await supabase
        .from('lanzamientos_pps')
        .select('id, nombre_pps, fecha_inicio');

    if (lError) { console.error(lError); return; }

    // Mapa Clave -> ID Lanzamiento
    // La clave será: "nombre_normalizado|fecha"
    const launchMap = new Map();
    const nameOnlyMap = new Map(); // Backup: mapa solo por nombre (por si la fecha difiere por zona horaria)

    lanzamientos.forEach(l => {
        const nameKey = normalize(l.nombre_pps);
        const dateKey = getDateKey(l.fecha_inicio);
        
        // Mapa estricto (Nombre + Fecha)
        launchMap.set(`${nameKey}|${dateKey}`, l.id);
        
        // Mapa flexible (Solo Nombre - guarda el último encontrado)
        nameOnlyMap.set(nameKey, l.id);
    });

    console.log(`   📚 Se indexaron ${lanzamientos.length} lanzamientos.`);

    // 2. Buscar Convocatorias "Rotas" pero con Datos (Las "Hijas")
    console.log("   🔍 Buscando convocatorias con nombre pero sin vínculo...");

    const { data: convocatorias, error: cError } = await supabase
        .from('convocatorias')
        .select('id, nombre_pps, fecha_inicio')
        .is('lanzamiento_id', null) // Solo las que les falta el ID
        .not('nombre_pps', 'is', null); // Pero que TIENEN nombre (gracias al snapshot anterior)

    if (cError) { console.error(cError); return; }

    if (convocatorias.length === 0) {
        console.log("   ✅ No hay convocatorias para reconectar. Todo parece estar bien.");
        return;
    }

    console.log(`   👻 Se encontraron ${convocatorias.length} registros para analizar.`);

    // 3. Matchmaking
    console.log("   ❤️  Buscando parejas...");
    
    let updates = [];
    let exactMatches = 0;
    let nameMatches = 0;
    let failed = 0;

    for (const conv of convocatorias) {
        const nameKey = normalize(conv.nombre_pps);
        const dateKey = getDateKey(conv.fecha_inicio);
        const strictKey = `${nameKey}|${dateKey}`;

        let foundId = launchMap.get(strictKey);
        let method = 'exact';

        // Si no hay match exacto, intentamos solo por nombre (fallback)
        if (!foundId) {
            foundId = nameOnlyMap.get(nameKey);
            method = 'name_only';
        }

        if (foundId) {
            updates.push({
                id: conv.id,
                lanzamiento_id: foundId
            });
            if (method === 'exact') exactMatches++;
            else nameMatches++;
        } else {
            failed++;
            // console.log(`      ⚠️ Sin match: "${conv.nombre_pps}" (${conv.fecha_inicio})`);
        }
    }

    console.log(`   📊 Resultados del análisis:`);
    console.log(`      - Matches Exactos (Nombre + Fecha): ${exactMatches}`);
    console.log(`      - Matches Flexibles (Solo Nombre):  ${nameMatches}`);
    console.log(`      - Sin coincidencia:                 ${failed}`);

    if (updates.length === 0) {
        console.log("   🤷 No se pudo vincular nada nuevo.");
        return;
    }

    // 4. Aplicar Updates
    console.log(`   🚀 Restaurando vínculos para ${updates.length} registros...`);

    const CHUNK_SIZE = 50;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const batch = updates.slice(i, i + CHUNK_SIZE);
        const promises = batch.map(u => 
            supabase.from('convocatorias').update({ lanzamiento_id: u.lanzamiento_id }).eq('id', u.id)
        );
        await Promise.all(promises);
        process.stdout.write(".");
    }

    console.log(`\n\n✅ PROCESO FINALIZADO.`);
    console.log(`   ✨ La integridad referencial ha sido restaurada.`);
    console.log(`   🔄 Ahora la base de datos sabe a qué lanzamiento pertenece cada alumno.`);
}

relinkByData();
