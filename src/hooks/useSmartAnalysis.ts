import { useMemo, useState, useEffect } from 'react';
import { differenceInDays } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { FIELD_NOMBRE_PPS_LANZAMIENTOS } from '../constants';

interface DashboardData {
    endingLaunches: any[];
    pendingFinalizations: any[];
    pendingRequests: any[];
}

export type PriorityLevel = 'critical' | 'warning' | 'stable' | 'optimal';

export interface SmartInsight {
    type: PriorityLevel;
    message: string;
    actionLabel?: string;
    actionLink?: string;
    icon: string;
}

export const useSmartAnalysis = (data: DashboardData | undefined, isLoading: boolean) => {
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const algorithmicAnalysis = useMemo(() => {
        if (isLoading || !data) {
            return { status: 'loading' as const, insights: [], signals: [], rawData: null };
        }

        const insights: SmartInsight[] = [];
        const signals: string[] = [];
        let score = 100;
        const now = new Date();

        // --- DEDUPLICACIÓN POR INSTITUCIÓN ---
        const getBaseName = (name: string) => name.split(' - ')[0].trim();

        // 1. Cierres Vencidos por Institución
        const overdueByInst = new Map<string, any>();
        data.endingLaunches.forEach(l => {
            const status = l.estado_gestion;
            const isResolved = status === 'Relanzamiento Confirmado' || status === 'Archivado' || status === 'No se Relanza';
            
            if (l.daysLeft < 0 && !isResolved) {
                const name = getBaseName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '');
                overdueByInst.set(name, l);
            }
        });

        const overdueCount = overdueByInst.size;
        
        if (overdueCount > 0) {
            score -= (overdueCount * 20);
            signals.push(`${overdueCount} inst. vencidas`);
            insights.push({
                type: 'critical',
                message: `Urgente: ${overdueCount} instituciones finalizaron ciclo y requieren definición de cierre o relanzamiento.`,
                actionLink: '/admin/gestion?filter=vencidas',
                icon: 'priority_high'
            });
        }

        // 2. Solicitudes Estancadas
        const stagnant = data.pendingRequests.filter((r: any) => {
            const lastUpdate = new Date(r.updated || r.created_at);
            return differenceInDays(now, lastUpdate) > 7;
        });
        if (stagnant.length > 0) {
            score -= (stagnant.length * 5);
            signals.push(`${stagnant.length} trámites trabados`);
            insights.push({
                type: 'warning',
                message: `${stagnant.length} solicitudes de alumnos sin movimientos hace +7 días.`,
                actionLink: '/admin/solicitudes?tab=ingreso',
                icon: 'hourglass_empty'
            });
        }

        // 3. Acreditaciones Pendientes
        if (data.pendingFinalizations.length > 0) {
            signals.push(`${data.pendingFinalizations.length} listos p/ SAC`);
            insights.push({
                type: 'stable',
                message: `Hay ${data.pendingFinalizations.length} expedientes de finalización pendientes de carga en SAC.`,
                actionLink: '/admin/solicitudes?tab=egreso',
                icon: 'verified'
            });
        }

        let status: PriorityLevel = 'optimal';
        if (score < 60) status = 'critical';
        else if (score < 85) status = 'warning';
        else if (score < 95) status = 'stable';

        return { 
            status, 
            insights, 
            signals,
            rawData: {
                vencidasCount: overdueCount,
                estancadasCount: stagnant.length,
                acreditacionesCount: data.pendingFinalizations.length
            }
        };
    }, [data, isLoading]);

    useEffect(() => {
        const fetchAiInsight = async () => {
            // Fix: Use process.env.API_KEY exclusively for Gemini API interactions
            if (!algorithmicAnalysis.rawData || !process.env.API_KEY) return;
            
            setIsAiLoading(true);
            try {
                // Fix: Initialize GoogleGenAI with process.env.API_KEY directly
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                // Prompt ajustado para tono académico/administrativo
                const prompt = `
                    Actúa como un Analista de Gestión Académica.
                    Analiza la situación actual de tareas pendientes basada en los siguientes datos:
                    ${JSON.stringify(algorithmicAnalysis.rawData)}

                    Tu objetivo: Generar un resumen ejecutivo breve (máximo 2 oraciones) para la Coordinación de Prácticas Profesionales.

                    Reglas de Tono y Estilo:
                    1. FORMAL Y PROFESIONAL: Utiliza terminología administrativa adecuada (ej: "gestión", "requiere intervención", "expedientes"). Evita coloquialismos.
                    2. OBJETIVO: Céntrate en los hechos y la acción requerida.
                    3. PRIORIZACIÓN:
                       - Si 'vencidasCount' > 0: Es crítico. Menciona la necesidad de gestionar instituciones con plazos vencidos.
                       - Si 'estancadasCount' > 0: Menciona demoras en el flujo de solicitudes estudiantiles.
                       - Si 'acreditacionesCount' > 0: Menciona expedientes pendientes de carga administrativa (SAC).
                       - Si todo es 0: Indica "Sin novedades operativas pendientes" o "Gestión al día".

                    Ejemplos del estilo deseado:
                    - "Se requiere intervención en 3 instituciones con ciclos lectivos finalizados pendientes de cierre."
                    - "Existen solicitudes de estudiantes sin actividad reciente que requieren seguimiento administrativo."
                    - "La gestión operativa se encuentra al día; restan procesar 2 acreditaciones finales."
                    - "No se detectan pendientes prioritarios en las bandejas de entrada."
                `;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        temperature: 0.2, // Baja temperatura para mayor consistencia y formalidad
                        topP: 0.8
                    }
                });
                
                setAiSummary(response.text.trim());
            } catch (error) {
                console.error("AI Error", error);
            } finally {
                setIsAiLoading(false);
            }
        };

        const timer = setTimeout(fetchAiInsight, 1000);
        return () => clearTimeout(timer);
    }, [algorithmicAnalysis.rawData]);

    return {
        ...algorithmicAnalysis,
        summary: aiSummary || "Analizando estado de gestión...",
        isAiLoading
    };
};