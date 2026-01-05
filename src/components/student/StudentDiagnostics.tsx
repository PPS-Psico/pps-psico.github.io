

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    TABLE_NAME_ESTUDIANTES,
    FIELD_LEGAJO_ESTUDIANTES,
    FIELD_NOMBRE_ESTUDIANTES,
    FIELD_CORREO_ESTUDIANTES,
    FIELD_USER_ID_ESTUDIANTES,
    TABLE_NAME_CONVOCATORIAS,
    FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS
} from '../../constants';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';

const StudentDiagnostics: React.FC = () => {
    const [legajo, setLegajo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCheck = async () => {
        if (!legajo) return;
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            // 1. Check Student Record
            const { data: students, error: dbError } = await supabase
                .from(TABLE_NAME_ESTUDIANTES as any)
                .select('*')
                .eq(FIELD_LEGAJO_ESTUDIANTES, legajo);

            if (dbError) throw dbError;

            // Ensure students is treated as an array of any to access properties safely
            const safeStudents = (students || []) as any[];

            const studentData = {
                exists: safeStudents.length > 0,
                count: safeStudents.length,
                records: safeStudents
            };

            let convocatoriasData = { count: 0, items: [] };

            // 2. Check Enrollments if student exists
            if (safeStudents.length === 1) {
                const studentId = safeStudents[0].id;
                const { data: convs, error: convError } = await supabase
                    .from(TABLE_NAME_CONVOCATORIAS as any)
                    .select('id, created_at, estado_inscripcion')
                    .eq(FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS, studentId);

                if (!convError && convs) {
                    convocatoriasData = { count: convs.length, items: convs as any };
                }
            }

            setResult({
                student: studentData,
                enrollments: convocatoriasData
            });

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card title="Diagnóstico de Estudiante" icon="troubleshoot" className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10">
            <div className="flex gap-4 items-end">
                <div className="flex-grow">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Legajo a investigar</label>
                    <Input
                        value={legajo}
                        onChange={e => setLegajo(e.target.value)}
                        placeholder="Ej: 32252"
                        onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                    />
                </div>
                <Button onClick={handleCheck} isLoading={isLoading} icon="search">Diagnosticar</Button>
            </div>

            {error && (
                <div className="mt-4 p-4 bg-rose-100 text-rose-800 rounded-lg text-sm">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {result && (
                <div className="mt-6 space-y-4 animate-fade-in">
                    <div className={`p-4 rounded-lg border ${result.student.count === 1 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                        <h4 className="font-bold flex items-center gap-2">
                            <span className="material-icons">{result.student.count === 1 ? 'check_circle' : 'warning'}</span>
                            Estado del Registro
                        </h4>
                        <p className="text-sm mt-1">
                            {result.student.count === 0 ? 'No se encontró el estudiante en la base de datos.' :
                                result.student.count > 1 ? `⚠️ ALERTA: Se encontraron ${result.student.count} registros duplicados para este legajo. Esto causa errores en la inscripción.` :
                                    'Registro único y correcto en tabla de estudiantes.'}
                        </p>
                    </div>

                    {result.student.records.map((s: any, idx: number) => (
                        <div key={s.id} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm space-y-2 shadow-sm">
                            <h5 className="font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-1 mb-2">
                                Detalle del Registro {result.student.count > 1 ? `#${idx + 1}` : ''}
                            </h5>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <div><span className="text-slate-400">ID Interno:</span> <span className="font-mono text-xs">{s.id}</span></div>
                                <div><span className="text-slate-400">Nombre:</span> {s[FIELD_NOMBRE_ESTUDIANTES]}</div>
                                <div><span className="text-slate-400">Email:</span> {s[FIELD_CORREO_ESTUDIANTES]}</div>
                                <div>
                                    <span className="text-slate-400">Usuario Vinculado (Auth):</span>
                                    {s[FIELD_USER_ID_ESTUDIANTES] ? (
                                        <span className="text-emerald-600 font-bold flex items-center gap-1"><span className="material-icons !text-sm">link</span> Sí</span>
                                    ) : (
                                        <span className="text-rose-600 font-bold flex items-center gap-1"><span className="material-icons !text-sm">link_off</span> No (Causa de error)</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {result.enrollments.count > 0 && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm mb-2">Inscripciones detectadas ({result.enrollments.count})</h4>
                            <ul className="list-disc pl-4 text-xs text-blue-700 dark:text-blue-300">
                                {result.enrollments.items.map((e: any) => (
                                    <li key={e.id}>ID: {e.id} - Estado: {e.estado_inscripcion}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

export default StudentDiagnostics;
