
import { useMemo, useState, useEffect } from 'react';
import { differenceInDays } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from '../constants/configConstants';
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

        // --- DEDUPLICACIÓN POR INSTITUCIÓN (Corrección de conteo 73 vs 57) ---
        const getBaseName = (name: string) => name.split(' - ')[0].trim();

        // 1. Cierres Vencidos por Institución
        const overdueByInst = new Map<string, any>();
        data.endingLaunches.forEach(l => {
            const isPending = l.estado_gestion === 'Pendiente de Gestión' || !l.estado_gestion;
            if (l.daysLeft < 0 && isPending) {
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
                vencidas: Array.from(overdueByInst.keys()),
                vencidasCount: overdueCount,
                estancadasCount: stagnant.length,
                acreditacionesCount: data.pendingFinalizations.length
            }
        };
    }, [data, isLoading]);

    useEffect(() => {
        const fetchAiInsight = async () => {
            if (!algorithmicAnalysis.rawData || !GEMINI_API_KEY || GEMINI_API_KEY.includes('PEGAR_AQUI')) return;
            
            setIsAiLoading(true);
            try {
                const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
                const prompt = `
                    Actúa como un Monitor de Estado de Sistema. 
                    Analiza estas cifras actuales de la plataforma de PPS:
                    ${JSON.stringify(algorithmicAnalysis.rawData)}

                    Tu objetivo es generar un reporte técnico de estado (máx 30 palabras).
                    Reglas críticas:
                    1. PROHIBIDO usar lenguaje subjetivo, opiniones o frases como "es importante", "deberías", "atención".
                    2. PROHIBIDO hablar en primera persona ("nosotros", "sugiero").
                    3. Solo describe el estado de los puntos de bloqueo detectados.
                    4. No resumas todos los números, prioriza el bloqueo más grande.
                    
                    Formato: Texto directo, informativo, estilo log de sistema. Sin saludos.
                `;

                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: prompt,
                    config: {
                        temperature: 0.1, // Baja temperatura para más precisión y menos creatividad
                        topP: 0.1
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
        summary: aiSummary || "Generando reporte de estado...",
        isAiLoading
    };
};
