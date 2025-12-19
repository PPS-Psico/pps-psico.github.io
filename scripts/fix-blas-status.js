
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// ⚙️ CONFIGURACIÓN
// ==============================================================================

const SUPABASE_URL = "PEGAR_TU_URL_AQUI"; 
const SERVICE_ROLE_KEY = "PEGAR_TU_SERVICE_ROLE_KEY_AQUI"; 

const TARGET_LEGAJO = 'BLAS_LEGAJO_AQUI'; // Reemplazar con el legajo real de Blas si no es el email

// ==============================================================================

if (SUPABASE_URL.includes("PEGAR") || SERVICE_ROLE_KEY.includes("PEGAR")) {
    console.error("❌ ERROR: Edita el archivo y pega las credenciales (SERVICE ROLE KEY).");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function fixBlasStatus() {
    console.log(`\n🕵️  REPARACIÓN DE ESTADO PARA USUARIO (BLAS RIVERA)`);
    
    // Buscar por nombre si no tenemos el legajo exacto
    const { data: students, error } = await supabase
        .from('estudiantes')
        .select('*')
        .ilike('nombre', '%Blas Rivera%')
        .limit(1);

    if (error || !students || students.length === 0) {
        console.error("❌ No se encontró al estudiante 'Blas Rivera'.");
        return;
    }

    const student = students[0];
    console.log(`   👤 Alumno encontrado: ${student.nombre} (Legajo: ${student.legajo})`);
    console.log(`   📊 Estado Actual: Finalizó = ${student.finalizaron}`);

    if (student.finalizaron) {
        console.log(`\n🛠️  Corrigiendo estado a 'Cursando' (Finalizó = false)...`);
        
        const { error: updateError } = await supabase
            .from('estudiantes')
            .update({ 
                finalizaron: false,
                fecha_finalizacion: null 
            })
            .eq('id', student.id);
            
        if (updateError) {
            console.error(`   ❌ Error al actualizar: ${updateError.message}`);
        } else {
            console.log(`   ✅ ÉXITO: El estudiante ya no figura como finalizado.`);
        }
    } else {
        console.log(`   ✅ El estudiante ya figura como NO finalizado. No se requieren cambios.`);
    }
}

fixBlasStatus();
