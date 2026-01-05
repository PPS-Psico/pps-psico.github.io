
import { useMemo, useState, useEffect } from 'react';
import { differenceInDays } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { FIELD_NOMBRE_PPS_LANZAMIENTOS, GEMINI_API_KEY } from '../constants';
import { parseToUTCDate } from '../utils/formatters';

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

        const endingSoonByInst = new Map<string, any>();
        const overdueByInst = new Map<string, any>();

        data.endingLaunches.forEach(l => {
            const status = l.estado_gestion;
            const isResolved = status === 'Relanzamiento Confirmado' || status === 'Archivado' || status === 'No se Relanza';

            if (isResolved) return;

            // Calculate daysLeft if not present (Safety fallback)
            let daysLeft = l.daysLeft;
            if (daysLeft === undefined && l.fecha_fin) {
                daysLeft = differenceInDays(parseToUTCDate(l.fecha_fin), now);
            }
            if (daysLeft === undefined && l.fecha_finalizacion) {
                daysLeft = differenceInDays(new Date(l.fecha_finalizacion), now);
            }

            if (daysLeft !== undefined) {
                if (daysLeft < 0) {
                    const name = getBaseName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '');
                    overdueByInst.set(name, l);
                } else if (daysLeft <= 7) {
                    const name = getBaseName(l[FIELD_NOMBRE_PPS_LANZAMIENTOS] || '');
                    endingSoonByInst.set(name, l);
                }
            }
        });

        const overdueCount = overdueByInst.size;
        const endingSoonCount = endingSoonByInst.size;

        // 1. CRITICAL: Overdue items (Management Required)
        if (overdueCount > 0) {
            score -= (overdueCount * 20);
            signals.push('Requiere Cierre/Renovación');
            insights.push({
                type: 'critical',
                message: `${overdueCount} instituciones finalizaron ciclo. Confirmar relanzamiento o archivar.`,
                actionLink: '/admin/gestion?filter=vencidas',
                icon: 'assignment_late'
            });
        }

        // 2. HIGH PRIORITY: Ending Soon (Proactive)
        if (endingSoonCount > 0) {
            score -= (endingSoonCount * 10);
            signals.push('Vencimiento Inminente (7 días)');
            insights.push({
                type: 'warning',
                message: `${endingSoonCount} finalizan esta semana. Contactar para asegurar continuidad.`,
                actionLink: '/admin/gestion?filter=proximas',
                icon: 'alarm'
            });
        }

        const stagnant = data.pendingRequests.filter((r: any) => {
            const lastUpdate = new Date(r.updated || r.created_at);
            return differenceInDays(now, lastUpdate) > 7;
        });
        if (stagnant.length > 0) {
            score -= (stagnant.length * 5);
            signals.push('Solicitudes en Espera');
            insights.push({
                type: 'warning',
                message: 'Alumnos esperando respuesta hace +7 días.',
                actionLink: '/admin/solicitudes?tab=ingreso',
                icon: 'hourglass_empty'
            });
        }

        if (data.pendingFinalizations.length > 0) {
            signals.push('Acreditaciones Pendientes');
            insights.push({
                type: 'stable',
                message: 'Egresos listos para cargar en SAC.',
                actionLink: '/admin/solicitudes?tab=egreso',
                icon: 'school'
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
                porVencerCount: endingSoonCount,
                estancadasCount: stagnant.length,
                acreditacionesCount: data.pendingFinalizations.length,
                mesActual: currentMonth
            }
        };
    }, [data, isLoading]);

    useEffect(() => {
        const fetchAiInsight = async () => {
            if (!algorithmicAnalysis.rawData || !GEMINI_API_KEY) return;

            setIsAiLoading(true);
            try {
                const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

                // Prompt de Ingeniería Inversa: Enfocado en acción y estrategia.
                const prompt = `
                    Actúa como un Coordinador de Vinculación Institucional. 
                    Analiza métricas: ${JSON.stringify(algorithmicAnalysis.rawData)}
                    
                    OBJETIVO: Recomendación estratégica de una sola frase (max 25 palabras).
                    
                    PRIORIDADES (En orden):
                    1. 'porVencerCount' > 0 (URGENTE): Hay convenios que caen en <7 días. Sugiere contactar YA para renovar y evitar baches ("Ciclo Continuo").
                    2. 'vencidasCount' > 0: Sugiere regularizar administrativamente (Cerrar o Relanzar).
                    3. 'estancadasCount' > 0: Foco en experiencia alumno (desbloquear trámites).
                    4. 'acreditacionesCount' > 0: Foco en eficiencia de egreso.
                    
                    Si todo es 0: "Todo al día. Sugiere buscar nuevas alianzas o revisar planificaciones futuras."
                    
                    Contexto: Estamos en ${algorithmicAnalysis.rawData.mesActual}.
                    Tono: Profesional, directo, proactivo.
                `;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash-exp',
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
