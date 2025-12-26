
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
        const currentMonth = now.toLocaleString('es-ES', { month: 'long' });

        const getBaseName = (name: string) => name.split(' - ')[0].trim();

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
            signals.push('Gestión Vencida'); // Changed from Riesgo Legal
            insights.push({
                type: 'critical',
                message: `${overdueCount} instituciones requieren gestión de cierre o renovación.`,
                actionLink: '/admin/gestion?filter=vencidas',
                icon: 'priority_high'
            });
        }

        const stagnant = data.pendingRequests.filter((r: any) => {
            const lastUpdate = new Date(r.updated || r.created_at);
            return differenceInDays(now, lastUpdate) > 7;
        });
        if (stagnant.length > 0) {
            score -= (stagnant.length * 5);
            signals.push('Demora en Respuesta');
            insights.push({
                type: 'warning',
                message: 'Atención al alumno: Solicitudes sin movimiento hace +7 días.',
                actionLink: '/admin/solicitudes?tab=ingreso',
                icon: 'hourglass_empty'
            });
        }

        if (data.pendingFinalizations.length > 0) {
            signals.push('Carga Administrativa');
            insights.push({
                type: 'stable',
                message: 'Documentación de egreso lista para procesar en SAC.',
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
                acreditacionesCount: data.pendingFinalizations.length,
                mesActual: currentMonth
            }
        };
    }, [data, isLoading]);

    useEffect(() => {
        const fetchAiInsight = async () => {
            if (!algorithmicAnalysis.rawData || !process.env.API_KEY) return;
            
            setIsAiLoading(true);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                // Prompt de Ingeniería Inversa: Enfocado en acción y estrategia, no en descripción.
                const prompt = `
                    Actúa como un Jefe de Operaciones Académicas Senior. 
                    Analiza los siguientes métricas del tablero de control:
                    ${JSON.stringify(algorithmicAnalysis.rawData)}

                    TU OBJETIVO: Dar una única recomendación estratégica de alto impacto.
                    
                    REGLAS ESTRICTAS:
                    1. NO repitas los números (el usuario ya los ve en las tarjetas).
                    2. NO uses frases genéricas como "Aquí tienes el resumen".
                    3. Si hay 'vencidasCount' > 0: Tu prioridad es sugerir la gestión administrativa de cierre o renovación de convenios para mantener el orden. NO menciones riesgos legales ni términos alarmistas.
                    4. Si hay muchas 'estancadasCount': Tu prioridad es la experiencia del alumno. Sugiere desbloquear trámites.
                    5. Si hay muchas 'acreditacionesCount': Tu prioridad es la eficiencia administrativa de egreso.
                    6. Considera que estamos en el mes de ${algorithmicAnalysis.rawData.mesActual}. Contextualiza la urgencia según la altura del año (ej: inicios o cierres de ciclo).
                    
                    FORMATO DE SALIDA:
                    Una sola frase, directa, imperativa y profesional. Máximo 25 palabras.
                `;

                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: prompt,
                });

                if (response.text) {
                    setAiSummary(response.text.trim());
                }
            } catch (error) {
                console.error("AI Generation Error", error);
                setAiSummary("Sistema de análisis estratégico no disponible momentáneamente.");
            } finally {
                setIsAiLoading(false);
            }
        };

        if (algorithmicAnalysis.status !== 'loading' && !isAiLoading && !aiSummary) {
            fetchAiInsight();
        }
    }, [algorithmicAnalysis.rawData, algorithmicAnalysis.status]);

    return {
        status: algorithmicAnalysis.status,
        summary: aiSummary || (isLoading ? 'Analizando patrones operativos...' : 'Calculando estrategia prioritaria...'),
        insights: algorithmicAnalysis.insights,
        signals: algorithmicAnalysis.signals
    };
};
