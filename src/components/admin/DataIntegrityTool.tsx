
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { db } from '../../lib/db';
import {
    TABLE_NAME_ESTUDIANTES,
    FIELD_ESTADO_ESTUDIANTES,
    FIELD_DNI_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_TELEFONO_ESTUDIANTES,
    TABLE_NAME_INSTITUCIONES,
    FIELD_NOMBRE_INSTITUCIONES,
    TABLE_NAME_LANZAMIENTOS_PPS,
    FIELD_NOMBRE_PPS_LANZAMIENTOS,
    TABLE_NAME_PRACTICAS,
    FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS
} from '../../constants';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Toast from '../ui/Toast';

const isRealData = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'number') return val > 0;
    const str = String(val).replace(/[\[\]"']/g, '').trim();
    return str.length > 2 && str.toLowerCase() !== 'null';
};

// Función robusta para limpiar artefactos (JSON stringified, Postgres Arrays, etc.)
const cleanNameArtifacts = (input: any): string => {
    if (input === null || input === undefined) return '';

    let str = input;

    // 1. Si ya viene como Objeto o Array (parseado por Supabase)
    if (typeof input === 'object') {
        if (Array.isArray(input) && input.length > 0) {
            return cleanNameArtifacts(input[0]);
        }
        // Si es un objeto, intentamos obtener valores o stringify
        const values = Object.values(input);
        if (values.length > 0) return cleanNameArtifacts(values[0]);
        str = JSON.stringify(input);
    }

    str = String(str);

    // 2. Intentar parsear si parece un array JSON stringificado ej: '["Nombre"]'
    if ((str.startsWith('[') && str.endsWith(']')) || (str.startsWith('"') && str.endsWith('"'))) {
        try {
            const parsed = JSON.parse(str);
            return cleanNameArtifacts(parsed);
        } catch (e) {
            // Si falla (ej: formato Postgres {Val}), seguimos con limpieza manual
        }
    }

    // 3. Limpieza manual de caracteres basura de sintaxis ({}, [], "")
    // Se eliminan llaves, corchetes y comillas dobles/simples.
    let clean = str.replace(/[\[\]\{\}"']/g, '').trim();

    // 4. Limpieza final de espacios o prefijos técnicos raros si hubieran
    return clean;
};

const DataIntegrityTool: React.FC = () => {
    const [isFixing, setIsFixing] = useState(false);
    const [isSanitizing, setIsSanitizing] = useState(false);
    const [toast, setToast] = useState<{ m: string, t: 'success' | 'error' } | null>(null);
    const queryClient = useQueryClient();

    // 1. HERRAMIENTA: Sincronizar Estados de Alumnos
    const fixDatabaseStates = async () => {
        setIsFixing(true);
        try {
            // Usamos db.estudiantes.getAll para traer todo paginado
            const students = await db.estudiantes.getAll();

            const zombies = students.filter(s => {
                const dbStatus = s[FIELD_ESTADO_ESTUDIANTES];
                const hasMail = isRealData(s[FIELD_CORREO_ESTUDIANTES]);
                const hasDni = isRealData(s[FIELD_DNI_ESTUDIANTES]);
                const hasTel = isRealData(s[FIELD_TELEFONO_ESTUDIANTES]);

                return (dbStatus === 'Nuevo (Sin cuenta)' || !dbStatus) && (hasMail || hasDni || hasTel);
            });

            if (zombies.length === 0) {
                setToast({ m: 'Los estados de alumnos están sincronizados.', t: 'success' });
                return;
            }

            const promises = zombies.map(z =>
                supabase
                    .from(TABLE_NAME_ESTUDIANTES)
                    .update({ [FIELD_ESTADO_ESTUDIANTES]: 'Inactivo' })
                    .eq('id', z.id)
            );

            await Promise.all(promises);

            setToast({ m: `¡Éxito! Se corrigieron ${zombies.length} estados "Nuevo" a "Inactivo".`, t: 'success' });
            queryClient.invalidateQueries();
        } catch (e: any) {
            setToast({ m: `Error técnico: ${e.message}`, t: 'error' });
        } finally {
            setIsFixing(false);
        }
    };

    // 2. HERRAMIENTA: Sanitizar Nombres (Quitar corchetes y comillas)
    const sanitizeNames = async () => {
        setIsSanitizing(true);
        let fixedCount = 0;

        try {
            // A. Limpiar Instituciones
            const instituciones = await db.instituciones.getAll({ fields: [FIELD_NOMBRE_INSTITUCIONES] });
            const dirtyInstitutions = instituciones.filter(i => {
                const originalName = i[FIELD_NOMBRE_INSTITUCIONES];
                if (!originalName) return false;
                if (typeof originalName === 'object') return true;
                const cleanName = cleanNameArtifacts(originalName);
                return cleanName !== String(originalName).trim();
            });
            console.log(`Instituciones sucias: ${dirtyInstitutions.length}`);

            for (const inst of dirtyInstitutions) {
                const oldName = inst[FIELD_NOMBRE_INSTITUCIONES];
                const newName = cleanNameArtifacts(oldName);
                if (newName && newName !== oldName) {
                    await supabase.from(TABLE_NAME_INSTITUCIONES).update({ [FIELD_NOMBRE_INSTITUCIONES]: newName }).eq('id', inst.id);
                    fixedCount++;
                }
            }

            // B. Limpiar Lanzamientos
            const lanzamientos = await db.lanzamientos.getAll({ fields: [FIELD_NOMBRE_PPS_LANZAMIENTOS] });
            const dirtyLaunches = lanzamientos.filter(l => {
                const originalName = l[FIELD_NOMBRE_PPS_LANZAMIENTOS];
                if (!originalName) return false;
                if (typeof originalName === 'object') return true;
                const cleanName = cleanNameArtifacts(originalName);
                return cleanName !== String(originalName).trim();
            });
            console.log(`Lanzamientos sucios: ${dirtyLaunches.length}`);

            for (const lanz of dirtyLaunches) {
                const oldName = lanz[FIELD_NOMBRE_PPS_LANZAMIENTOS];
                const newName = cleanNameArtifacts(oldName);
                if (newName && newName !== oldName) {
                    await supabase.from(TABLE_NAME_LANZAMIENTOS_PPS).update({ [FIELD_NOMBRE_PPS_LANZAMIENTOS]: newName }).eq('id', lanz.id);
                    fixedCount++;
                }
            }

            // C. Limpiar Prácticas (nombre_institucion) - El campo más propenso a errores de migración
            const practicas = await db.practicas.getAll({ fields: [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS] });
            const dirtyPracticas = practicas.filter(p => {
                const originalName = p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
                if (!originalName) return false;
                if (typeof originalName === 'object') return true;
                const cleanName = cleanNameArtifacts(originalName);
                return cleanName !== String(originalName).trim();
            });
            console.log(`Prácticas sucias (nombre_institucion): ${dirtyPracticas.length}`);

            for (const p of dirtyPracticas) {
                const oldName = p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS];
                const newName = cleanNameArtifacts(oldName);
                if (newName && newName !== oldName) {
                    await supabase.from(TABLE_NAME_PRACTICAS).update({ [FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: newName }).eq('id', p.id);
                    fixedCount++;
                }
            }

            if (fixedCount > 0) {
                setToast({ m: `Se limpiaron ${fixedCount} registros con corchetes/comillas en Instituciones, Lanzamientos y Prácticas.`, t: 'success' });
                queryClient.invalidateQueries();
            } else {
                setToast({ m: 'No se encontraron registros sucios. La base de datos está limpia.', t: 'success' });
            }

        } catch (e: any) {
            console.error(e);
            setToast({ m: `Error al sanitizar: ${e.message}`, t: 'error' });
        } finally {
            setIsSanitizing(false);
        }
    };

    return (
        <Card title="Mantenimiento de Base de Datos" icon="auto_fix_high">
            {toast && <Toast message={toast.m} type={toast.t} onClose={() => setToast(null)} />}

            <div className="p-4 space-y-6">

                {/* Bloque 1: Estados */}
                <div className="space-y-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">Sincronización de Estados</h4>
                        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                            Analiza si un alumno tiene datos de contacto (Mail/DNI) pero figura como "Nuevo". Actualiza a "Inactivo" para que pueda operar.
                        </p>
                    </div>
                    <Button
                        onClick={fixDatabaseStates}
                        isLoading={isFixing}
                        disabled={isSanitizing}
                        icon="cleaning_services"
                    >
                        Sincronizar Estados de Alumnos
                    </Button>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                {/* Bloque 2: Limpieza de Nombres */}
                <div className="space-y-3">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">Sanitizador de Texto (Migración)</h4>
                        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                            Escanea <strong>Instituciones, Lanzamientos y Prácticas</strong> y elimina caracteres basura como <code>["..."]</code>, <code>&#123;...&#125;</code> o comillas extra que quedaron de la importación.
                        </p>
                    </div>
                    <Button
                        onClick={sanitizeNames}
                        isLoading={isSanitizing}
                        disabled={isFixing}
                        icon="spellcheck"
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        Limpiar Corchetes y Comillas
                    </Button>
                </div>

            </div>
        </Card>
    );
};

export default DataIntegrityTool;
